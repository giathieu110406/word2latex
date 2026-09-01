import { logApiUsage } from "../utils/logger";
import React, { useState, useRef } from "react";
import { 
  FileUp, Link as LinkIcon, Loader2, Sparkles, Copy, Download, Check, 
  FileType, FileText, Image as ImageIcon, Layout, 
  Layers, Clock, AlertCircle, RotateCcw, XCircle, CheckCircle2, Sliders
} from "lucide-react";
import Markdown from 'react-markdown';
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { PDFDocument } from "pdf-lib";

interface MarkItDownProps {
  triggerToast: (msg: string, success?: boolean) => void;
  isPro: boolean;
  userDoc?: any;
  onMarkItDownUsage?: () => Promise<void>;
}

export interface ChunkItem {
  id: number;
  startPage: number;
  endPage: number;
  status: "waiting" | "processing" | "cooldown" | "completed" | "error";
  markdown?: string;
  errorMsg?: string;
  retryCount: number;
}

export const MarkItDown: React.FC<MarkItDownProps> = ({ triggerToast, isPro, userDoc, onMarkItDownUsage }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputMarkdown, setOutputMarkdown] = useState("");
  const [inputType, setInputType] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [mobileView, setMobileView] = useState<"input" | "output">("input");
  const [hasChargedCurrentFile, setHasChargedCurrentFile] = useState(false);

  // Queue & Chunking configuration
  const [chunkSize, setChunkSize] = useState<number>(15); // Hỗ trợ 5, 10, 15, 20 trang
  const [interChunkDelay, setInterChunkDelay] = useState<number>(3500); // 3.5 giây nghỉ giữa các request
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [, setCurrentChunkIndex] = useState<number>(-1);
  const [cooldownCountdown, setCooldownCountdown] = useState<number>(0);
  const [includePageDividers, setIncludePageDividers] = useState<boolean>(true);
  const abortControllerRef = useRef<boolean>(false);

  // Helper để làm sạch và ghép các đoạn Markdown
  const stitchChunks = (chunkList: ChunkItem[], withDividers: boolean = true): string => {
    return chunkList
      .filter((c) => c.markdown && c.markdown.trim().length > 0)
      .map((c) => {
        let text = c.markdown!.trim();
        // Xóa code fence bao quanh nếu AI trả về ```markdown ... ```
        if (text.startsWith("```markdown")) {
          text = text.replace(/^```markdown\s*/i, "").replace(/\s*```$/, "");
        } else if (text.startsWith("```md")) {
          text = text.replace(/^```md\s*/i, "").replace(/\s*```$/, "");
        } else if (text.startsWith("```") && text.endsWith("```")) {
          text = text.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "");
        }

        if (withDividers && c.startPage > 0) {
          return `\n\n<!-- ====== TRANG ${c.startPage} - ${c.endPage} ====== -->\n\n${text}`;
        }
        return text;
      })
      .join("\n\n");
  };

  // Hàm sleep có kiểm tra cờ hủy
  const sleep = (ms: number, updateCountdown = false) => {
    return new Promise<void>((resolve) => {
      let remaining = Math.ceil(ms / 1000);
      if (updateCountdown) setCooldownCountdown(remaining);
      
      const interval = setInterval(() => {
        remaining -= 1;
        if (updateCountdown && remaining >= 0) setCooldownCountdown(remaining);
        if (remaining <= 0 || abortControllerRef.current) {
          clearInterval(interval);
          if (updateCountdown) setCooldownCountdown(0);
          resolve();
        }
      }, 1000);
    });
  };

  // Gửi 1 phần dữ liệu tới API với cơ chế Exponential Backoff
  const sendChunkToApi = async (fileData: string, mimeType: string, fName: string, maxRetries = 3): Promise<string> => {
    let attempt = 0;
    let delay = 4000;

    while (attempt < maxRetries) {
      if (abortControllerRef.current) throw new Error("Quá trình đã bị người dùng dừng lại.");
      attempt++;
      try {
        const res = await fetch("/api/markitdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "file",
            fileData: fileData,
            mimeType: mimeType,
            fileName: fName,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errorMsg = errData.error || `HTTP ${res.status}`;
          
          // Nếu bị 429 Too Many Requests hoặc quá tải, chờ lâu hơn rồi thử lại
          if (res.status === 429 || res.status === 503 || errorMsg.toLowerCase().includes("quota")) {
            console.warn(`[Queue] Gặp hạn mức 429/503 ở lần thử ${attempt}. Nghỉ ${delay}ms...`);
            await sleep(delay);
            delay *= 2;
            continue;
          }
          throw new Error(errorMsg);
        }

        const data = await res.json();
        if (data.success && data.markdown) {
          return data.markdown;
        } else {
          throw new Error(data.error || "Không thể phân tích dữ liệu phân đoạn này");
        }
      } catch (err: any) {
        if (attempt >= maxRetries || abortControllerRef.current) {
          throw err;
        }
        await sleep(delay);
        delay *= 2;
      }
    }
    throw new Error("Vượt quá số lần thử lại cho phân đoạn này.");
  };

  // Xử lý phân tích File (hỗ trợ phân trang PDF lớn)
  const processFile = async (file: File) => {
    setIsProcessing(true);
    abortControllerRef.current = false;
    setFileName(file.name);
    setMobileView("output");
    setHasChargedCurrentFile(false);
    setOutputMarkdown("");
    setChunks([]);
    setCurrentChunkIndex(-1);

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    try {
      const arrayBuffer = await file.arrayBuffer();

      // TRƯỜNG HỢP 1: File PDF cần chia đoạn
      if (isPdf) {
        let pdfDoc: PDFDocument;
        try {
          pdfDoc = await PDFDocument.load(arrayBuffer);
        } catch (pdfErr) {
          console.warn("Không thể tải cấu trúc PDF bằng pdf-lib, chuyển sang gửi nguyên file:", pdfErr);
          await processSingleWholeFile(file, arrayBuffer);
          return;
        }

        const totalPages = pdfDoc.getPageCount();

        // Nếu file nhỏ hơn hoặc bằng 1 chunk -> xử lý trực tiếp
        if (totalPages <= chunkSize) {
          triggerToast(`Tài liệu ${totalPages} trang, phân tích trực tiếp...`, true);
          await processSingleWholeFile(file, arrayBuffer);
          return;
        }

        // Tạo danh sách các chunks (15-20 trang/lần)
        const chunkList: ChunkItem[] = [];
        let chunkIndex = 0;
        for (let i = 0; i < totalPages; i += chunkSize) {
          chunkIndex++;
          const startPage = i + 1;
          const endPage = Math.min(i + chunkSize, totalPages);
          chunkList.push({
            id: chunkIndex,
            startPage: startPage,
            endPage: endPage,
            status: "waiting",
            retryCount: 0,
          });
        }

        setChunks(chunkList);
        triggerToast(`Đã chia tài liệu ${totalPages} trang thành ${chunkList.length} phân đoạn (${chunkSize} trang/lần)`, true);

        // Chạy hàng đợi xử lý tuần tự từng chunk
        const updatedChunks = [...chunkList];

        for (let idx = 0; idx < updatedChunks.length; idx++) {
          if (abortControllerRef.current) {
            triggerToast("Đã dừng hàng đợi xử lý", false);
            break;
          }

          setCurrentChunkIndex(idx);
          updatedChunks[idx].status = "processing";
          setChunks([...updatedChunks]);

          try {
            // Tách các trang của chunk này thành 1 sub-PDF
            const subPdf = await PDFDocument.create();
            const pageIndices: number[] = [];
            for (let p = updatedChunks[idx].startPage - 1; p < updatedChunks[idx].endPage; p++) {
              pageIndices.push(p);
            }
            const copiedPages = await subPdf.copyPages(pdfDoc, pageIndices);
            copiedPages.forEach((page) => subPdf.addPage(page));
            const subPdfBase64 = await subPdf.saveAsBase64({ dataUri: false });

            // Gửi API
            const resultMarkdown = await sendChunkToApi(
              subPdfBase64,
              "application/pdf",
              `${file.name.replace(/\.[^/.]+$/, "")}_part_${idx + 1}.pdf`
            );

            updatedChunks[idx].status = "completed";
            updatedChunks[idx].markdown = resultMarkdown;
            setChunks([...updatedChunks]);

            // Cập nhật Markdown ghép nối thời gian thực
            const currentCombined = stitchChunks(updatedChunks, includePageDividers);
            setOutputMarkdown(currentCombined);

            // Nghỉ cooldown giữa các chunk để bảo vệ hạn mức RPM (Requests Per Minute)
            if (idx < updatedChunks.length - 1 && !abortControllerRef.current) {
              updatedChunks[idx + 1].status = "cooldown";
              setChunks([...updatedChunks]);
              await sleep(interChunkDelay, true);
            }
          } catch (err: any) {
            console.error(`Lỗi tại Chunk ${idx + 1}:`, err);
            updatedChunks[idx].status = "error";
            updatedChunks[idx].errorMsg = err.message || "Lỗi phân tích đoạn này";
            setChunks([...updatedChunks]);
            triggerToast(`Phân đoạn ${idx + 1} gặp lỗi: ${err.message || "Lỗi kết nối"}`, false);
          }
        }

        logApiUsage("Markitdown");
        const finalCombined = stitchChunks(updatedChunks, includePageDividers);
        setOutputMarkdown(finalCombined);
        triggerToast("Đã hoàn tất phân tích và ghép file thành công!", true);

      } else {
        // TRƯỜNG HỢP 2: File khác (DOCX, XLSX, Image, Audio...)
        await processSingleWholeFile(file, arrayBuffer);
      }
    } catch (error: any) {
      console.error(error);
      triggerToast(`Lỗi xử lý: ${error.message || "Lỗi không xác định"}`, false);
    } finally {
      setIsProcessing(false);
      setCurrentChunkIndex(-1);
      setCooldownCountdown(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Xử lý gửi 1 file trọn vẹn
  const processSingleWholeFile = async (file: File, arrayBuffer: ArrayBuffer) => {
    triggerToast("Đang phân tích tài liệu bằng AI...", true);
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    const res = await fetch("/api/markitdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "file",
        fileData: base64Data,
        mimeType: file.type,
        fileName: file.name,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Lỗi máy chủ khi xử lý file");
    }

    const data = await res.json();
    if (data.success && data.markdown) {
      logApiUsage("Markitdown");
      setOutputMarkdown(data.markdown);
      triggerToast("Chuyển đổi thành công!", true);
    } else {
      triggerToast(data.error || "Không thể chuyển đổi tài liệu này", false);
    }
  };

  // Thử lại 1 chunk bị lỗi
  const retryChunk = async (chunkIndex: number) => {
    if (!fileInputRef.current?.files?.[0]) return;
    const file = fileInputRef.current.files[0];
    const targetChunk = chunks[chunkIndex];
    if (!targetChunk) return;

    targetChunk.status = "processing";
    setChunks([...chunks]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const subPdf = await PDFDocument.create();
      const pageIndices: number[] = [];
      for (let p = targetChunk.startPage - 1; p < targetChunk.endPage; p++) {
        pageIndices.push(p);
      }
      const copiedPages = await subPdf.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach((page) => subPdf.addPage(page));
      const subPdfBase64 = await subPdf.saveAsBase64({ dataUri: false });

      const resultMarkdown = await sendChunkToApi(
        subPdfBase64,
        "application/pdf",
        `${file.name.replace(/\.[^/.]+$/, "")}_part_${chunkIndex + 1}.pdf`
      );

      targetChunk.status = "completed";
      targetChunk.markdown = resultMarkdown;
      targetChunk.errorMsg = undefined;
      setChunks([...chunks]);

      setOutputMarkdown(stitchChunks(chunks, includePageDividers));
      triggerToast(`Đã phân tích lại phân đoạn ${chunkIndex + 1} thành công!`, true);
    } catch (err: any) {
      targetChunk.status = "error";
      targetChunk.errorMsg = err.message || "Lỗi thử lại";
      setChunks([...chunks]);
      triggerToast(`Thử lại phân đoạn ${chunkIndex + 1} thất bại: ${err.message}`, false);
    }
  };

  const handleStopQueue = () => {
    abortControllerRef.current = true;
    triggerToast("Đang dừng hàng đợi...", false);
  };

  const processUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsProcessing(true);
    setMobileView("output");
    setHasChargedCurrentFile(false);
    setOutputMarkdown("");
    setChunks([]);
    triggerToast("Đang phân tích URL bằng AI...", true);

    try {
      const res = await fetch("/api/markitdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "url", url: url }),
      });

      if (!res.ok) throw new Error("Lỗi máy chủ khi xử lý URL");

      const data = await res.json();
      if (data.success && data.markdown) {
        logApiUsage("Markitdown");
        setOutputMarkdown(data.markdown);
        triggerToast("Chuyển đổi URL thành công!", true);
      } else {
        triggerToast(data.error || "Không thể chuyển đổi URL này", false);
      }
    } catch (err: any) {
      console.error(err);
      triggerToast("Lỗi kết nối đến máy chủ!", false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!isPro && !hasChargedCurrentFile) {
      const markItDownCount = userDoc?.markItDownCount || 0;
      const promptCount = userDoc?.promptCount || 0;

      if (markItDownCount >= 1) {
        triggerToast("Bạn đã hết lượt dùng thử MarkItDown AI miễn phí hôm nay. Hãy nâng cấp gói PRO để sử dụng không giới hạn!", false);
        return;
      }
      if (promptCount >= 10) {
        triggerToast("Bạn đã hết lượt sử dụng AI hôm nay. Hãy nâng cấp gói PRO!", false);
        return;
      }
      if (onMarkItDownUsage) await onMarkItDownUsage();
      setHasChargedCurrentFile(true);
    }

    navigator.clipboard.writeText(outputMarkdown);
    setIsCopied(true);
    triggerToast("Đã sao chép toàn bộ Markdown vào bộ nhớ tạm", true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!isPro && !hasChargedCurrentFile) {
      const markItDownCount = userDoc?.markItDownCount || 0;
      const promptCount = userDoc?.promptCount || 0;

      if (markItDownCount >= 1) {
        triggerToast("Bạn đã hết lượt dùng thử MarkItDown AI miễn phí hôm nay. Hãy nâng cấp gói PRO!", false);
        return;
      }
      if (promptCount >= 10) {
        triggerToast("Bạn đã hết lượt sử dụng AI hôm nay. Hãy nâng cấp gói PRO!", false);
        return;
      }
      if (onMarkItDownUsage) await onMarkItDownUsage();
      setHasChargedCurrentFile(true);
    }

    const blob = new Blob([outputMarkdown], { type: "text/markdown;charset=utf-8" });
    const fileUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName ? `${fileName.replace(/\.[^/.]+$/, "")}.md` : "document.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(fileUrl);
    triggerToast("Đã tải xuống file Markdown hoàn chỉnh!", true);
  };

  // Tính tiến độ tổng thể
  const completedChunksCount = chunks.filter((c) => c.status === "completed").length;
  const progressPercent = chunks.length > 0 ? Math.round((completedChunksCount / chunks.length) * 100) : 0;

  return (
    <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] overflow-hidden flex flex-col flex-1 min-h-[620px] md:h-[calc(100vh-120px)] md:max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="p-6 border-b border-white/50 bg-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex flex-wrap items-center gap-2">
            <Layout className="w-5 h-5 text-indigo-600" />
            MarkItDown AI Enterprise
            <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Layers className="w-3 h-3" /> Auto Chunk & Stitch
            </span>
          </h2>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl self-end sm:self-auto shrink-0">
          <button
            onClick={() => setInputType("file")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              inputType === "file" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Tệp tin (PDF / Doc)
          </button>
          <button
            onClick={() => setInputType("url")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              inputType === "url" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            URL / Youtube
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex bg-slate-100 p-1 rounded-xl mx-6 mt-4 mb-2 shrink-0 select-none">
        <button
          type="button"
          onClick={() => setMobileView("input")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
            mobileView === "input" ? "bg-white text-indigo-700 shadow-3xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Cấu hình & Tải tệp
        </button>
        <button
          type="button"
          onClick={() => setMobileView("output")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
            mobileView === "output" ? "bg-white text-indigo-700 shadow-3xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Hàng đợi & Kết quả
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        {/* Left Side: Input & Settings */}
        <div className={`w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50 p-6 flex flex-col gap-5 overflow-y-auto ${
          mobileView === "input" ? "flex" : "hidden md:flex"
        }`}>
          {inputType === "file" ? (
            <div className="flex flex-col gap-4">
              {/* Dropzone */}
              <div
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all ${
                  isProcessing 
                    ? "border-slate-200 bg-slate-100/60 cursor-not-allowed opacity-75" 
                    : "border-indigo-200 bg-white/60 hover:bg-indigo-50/50 hover:border-indigo-400 cursor-pointer shadow-sm"
                }`}
              >
                <div className="w-11 h-11 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-2.5">
                  <FileUp className="w-5 h-5" />
                </div>
                <p className="font-semibold text-slate-700 text-sm">Nhấn để tải tệp lên</p>
                <p className="text-xs text-slate-500 mt-1">Hỗ trợ PDF (1 - 100+ trang), Word, Excel, PPTX, Ảnh, Âm thanh...</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  disabled={isProcessing}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processFile(file);
                  }}
                />
              </div>

              {/* Chunking & Queue Settings Card */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    Cấu hình Hàng đợi & Cắt trang
                  </span>
                </div>

                {/* Chunk Size Selector */}
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-medium">
                    <span>Kích thước phân đoạn:</span>
                    <span className="font-bold text-indigo-600">{chunkSize} trang / lần</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[5, 10, 15, 20].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setChunkSize(sz)}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all ${
                          chunkSize === sz
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        } disabled:opacity-50`}
                      >
                        {sz} trang
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cooldown Delay Setting */}
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Khoảng nghỉ giữa các đoạn:
                    </span>
                    <span className="font-bold text-slate-700">{interChunkDelay / 1000}s</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: "2.5s (Nhanh)", val: 2500 },
                      { label: "3.5s (Chuẩn)", val: 3500 },
                      { label: "5.0s (An toàn)", val: 5000 },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setInterChunkDelay(item.val)}
                        className={`py-1.5 px-1.5 text-[11px] font-semibold rounded-lg border transition-all text-center ${
                          interChunkDelay === item.val
                            ? "bg-slate-800 text-white border-slate-800 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        } disabled:opacity-50`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Switch Page Dividers */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <label htmlFor="dividerToggle" className="cursor-pointer select-none">
                    Ghi chú mốc trang (&lt;!-- Trang X-Y --&gt;)
                  </label>
                  <input
                    id="dividerToggle"
                    type="checkbox"
                    checked={includePageDividers}
                    onChange={(e) => {
                      setIncludePageDividers(e.target.checked);
                      if (chunks.length > 0) {
                        setOutputMarkdown(stitchChunks(chunks, e.target.checked));
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Active File Card */}
              {fileName && (
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3 shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{fileName}</p>
                    <p className="text-[11px] text-slate-400">
                      {chunks.length > 0 ? `${chunks.length} phân đoạn queue` : "Tệp đơn lẻ"}
                    </p>
                  </div>
                  {isProcessing && (
                    <button
                      onClick={handleStopQueue}
                      className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Dừng
                    </button>
                  )}
                </div>
              )}

              {/* Supported Badges */}
              <div className="mt-1">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Định dạng hỗ trợ</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-xs"><FileType className="w-3.5 h-3.5 text-red-500" /> PDF Nhiều trang</div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-xs"><FileType className="w-3.5 h-3.5 text-blue-500" /> Word (.docx)</div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-xs"><FileType className="w-3.5 h-3.5 text-green-600" /> Excel (.xlsx)</div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-xs"><ImageIcon className="w-3.5 h-3.5 text-purple-500" /> Hình ảnh OCR</div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={processUrl} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">URL Trang web / Youtube</label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isProcessing || !url.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý URL...</> : <><Sparkles className="w-4 h-4" /> Bắt đầu chuyển đổi URL</>}
              </button>
            </form>
          )}
        </div>

        {/* Right Side: Queue Status & Markdown Output */}
        <div className={`w-full md:w-2/3 p-6 flex flex-col bg-white overflow-hidden min-h-0 h-full max-h-full relative ${
          mobileView === "output" ? "flex" : "hidden md:flex"
        }`}>
          {/* Header Action Bar */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-base">Kết quả Markdown</h3>
              {chunks.length > 0 && (
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                  {completedChunksCount}/{chunks.length} phân đoạn
                </span>
              )}
            </div>
            {outputMarkdown && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? "Đã sao chép" : "Sao chép"}
                </button>
                <button
                  onClick={handleDownload}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải 1 file .md
                </button>
              </div>
            )}
          </div>

          {/* Queue Monitor Bar (hiện khi có chunks) */}
          {chunks.length > 0 && (
            <div className="mb-4 bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shrink-0 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Tiến độ Hàng đợi phân tích:</span>
                  <span className="text-xs font-bold text-indigo-600">{progressPercent}%</span>
                </div>
                {cooldownCountdown > 0 && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 animate-spin" /> Nghỉ {cooldownCountdown}s hạ nhiệt API...
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-3">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Chunk Badges List */}
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                {chunks.map((chk, i) => (
                  <div
                    key={chk.id}
                    className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                      chk.status === "completed"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-medium"
                        : chk.status === "processing"
                        ? "bg-indigo-50 text-indigo-700 border-indigo-300 font-bold animate-pulse"
                        : chk.status === "cooldown"
                        ? "bg-amber-50 text-amber-800 border-amber-200 font-medium"
                        : chk.status === "error"
                        ? "bg-rose-50 text-rose-800 border-rose-300 font-medium"
                        : "bg-white text-slate-500 border-slate-200"
                    }`}
                  >
                    {chk.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    {chk.status === "processing" && <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />}
                    {chk.status === "cooldown" && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                    {chk.status === "error" && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
                    
                    <span>Đoạn {chk.id} (Trang {chk.startPage}-{chk.endPage})</span>

                    {chk.status === "error" && (
                      <button
                        onClick={() => retryChunk(i)}
                        title="Thử lại đoạn này"
                        className="ml-1 hover:text-rose-950 underline flex items-center"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Markdown Content Area */}
          <div className="flex-1 min-h-0 bg-slate-50/70 rounded-2xl border border-slate-200 overflow-y-auto p-6 custom-scrollbar h-full max-h-full">
            {isProcessing && chunks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-9 h-9 animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-slate-600">Đang đọc tài liệu & khởi tạo phân đoạn...</p>
              </div>
            ) : outputMarkdown ? (
              <div className="markdown-body prose prose-sm max-w-none prose-indigo">
                <Markdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {outputMarkdown}
                </Markdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <Sparkles className="w-12 h-12 text-slate-300" />
                <p className="text-sm text-slate-500 font-medium">Kết quả phân tích Markdown sẽ hiển thị trực tiếp tại đây</p>
                <p className="text-xs text-slate-400 text-center max-w-sm">
                  Với file nhiều trang, các đoạn hoàn tất sẽ xuất hiện lần lượt và tự động kết nối thành 1 tài liệu duy nhất.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};