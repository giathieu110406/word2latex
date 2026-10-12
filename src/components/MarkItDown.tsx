
import { authFetch } from "../utils/api-client";
import React, { useEffect, useState, useRef } from "react";
import { 
  FileUp, Link as LinkIcon, Loader2, Sparkles, Copy, Download, Check, 
  FileType, FileText, Image as ImageIcon, Layout, 
  Layers, Clock, AlertCircle, RotateCcw, XCircle, CheckCircle2, Sliders,
  Trash2, Plus, X, ChevronDown, Zap, FileSpreadsheet, Presentation
} from "lucide-react";
import Markdown from 'react-markdown';
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { PDFDocument } from "pdf-lib";
import { beginCodexPetActivity, type CodexPetResult } from "../utils/codex-pet-activity";

interface MarkItDownProps {
  triggerToast: (msg: string, success?: boolean) => void;
  isPro: boolean;
  currentMultiplier?: number;
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
  title?: string;
}

export const MarkItDown: React.FC<MarkItDownProps> = ({ triggerToast, isPro, userDoc, onMarkItDownUsage, currentMultiplier = 1 }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputMarkdown, setOutputMarkdown] = useState("");
  const [inputType, setInputType] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isQueueSettingsOpen, setIsQueueSettingsOpen] = useState(false);
  const [conversionMode, setConversionMode] = useState<"fast" | "ai">("ai");
  const [isCopied, setIsCopied] = useState(false);
  const [mobileView, setMobileView] = useState<"input" | "output">("input");
  const [hasChargedCurrentFile, setHasChargedCurrentFile] = useState(false);
  const petResult = useRef<CodexPetResult>("ready");

  const getPetErrorResult = (error: unknown, status?: number): CodexPetResult => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return status === 401 || status === 403 || /401|403|unauthori[sz]ed|forbidden|đăng nhập|quyền truy cập/i.test(message)
      ? "needs-input"
      : "blocked";
  };

  useEffect(() => {
    if (!isProcessing) return;
    const finishActivity = beginCodexPetActivity("Đang chuyển đổi tài liệu bằng AI…");
    return () => finishActivity(petResult.current);
  }, [isProcessing]);

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

        if (withDividers) {
          if (c.title) {
            return `\n\n<!-- ====== ${c.title.toUpperCase()} ====== -->\n\n${text}`;
          }
          if (c.startPage > 0) {
            return `\n\n<!-- ====== TRANG ${c.startPage} - ${c.endPage} ====== -->\n\n${text}`;
          }
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

  // Helper định dạng kích thước tệp
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper hiển thị icon đại diện theo định dạng tệp
  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return <FileType className="w-3.5 h-3.5 text-red-500 shrink-0" />;
      case "doc":
      case "docx":
      case "odt":
      case "rtf":
      case "txt":
        return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      case "xls":
      case "xlsx":
      case "csv":
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case "ppt":
      case "pptx":
        return <Presentation className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case "png":
      case "jpg":
      case "jpeg":
      case "webp":
      case "gif":
      case "svg":
        return <ImageIcon className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
  };

  // Helper MIME type dự phòng khi trình duyệt trả về rỗng
  const getFallbackMimeType = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf": return "application/pdf";
      case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "doc": return "application/msword";
      case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      case "xls": return "application/vnd.ms-excel";
      case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      case "ppt": return "application/vnd.ms-powerpoint";
      case "png": return "image/png";
      case "jpg":
      case "jpeg": return "image/jpeg";
      case "webp": return "image/webp";
      case "txt": return "text/plain";
      case "csv": return "text/csv";
      default: return "application/octet-stream";
    }
  };

  // Quản lý danh sách tệp chờ
  const handleFilesSelect = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.size > 0);
    if (list.length === 0) return;

    setSelectedFiles((prev) => [...prev, ...list]);
    triggerToast(`Đã thêm ${list.length} tệp vào danh sách chờ`, true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Gửi 1 phần dữ liệu tới API với cơ chế Exponential Backoff
  const sendChunkToApi = async (
    fileData: string, 
    mimeType: string, 
    fName: string, 
    maxRetries = 3,
    mode: "fast" | "ai" = conversionMode
  ): Promise<string> => {
    let attempt = 0;
    let delay = 4000;

    while (attempt < maxRetries) {
      if (abortControllerRef.current) throw new Error("Quá trình đã bị người dùng dừng lại.");
      attempt++;
      try {
        const res = await authFetch("/api/markitdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "file",
            fileData: fileData,
            mimeType: mimeType,
            fileName: fName,
            mode: mode,
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
          petResult.current = getPetErrorResult(new Error(errorMsg), res.status);
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
    petResult.current = "ready";
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
              `${file.name.replace(/\.[^/.]+$/, "")}_part_${idx + 1}.pdf`,
              3,
              conversionMode
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
            petResult.current = getPetErrorResult(err);
            updatedChunks[idx].status = "error";
            updatedChunks[idx].errorMsg = err.message || "Lỗi phân tích đoạn này";
            setChunks([...updatedChunks]);
            triggerToast(`Phân đoạn ${idx + 1} gặp lỗi: ${err.message || "Lỗi kết nối"}`, false);
          }
        }


        const finalCombined = stitchChunks(updatedChunks, includePageDividers);
        setOutputMarkdown(finalCombined);
        triggerToast("Đã hoàn tất phân tích và ghép file thành công!", true);

      } else {
        // TRƯỜNG HỢP 2: File khác (DOCX, XLSX, Image, Audio...)
        await processSingleWholeFile(file, arrayBuffer);
      }
    } catch (error: any) {
      console.error(error);
      petResult.current = getPetErrorResult(error);
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
    triggerToast("Đang phân tích tài liệu...", true);
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    const res = await authFetch("/api/markitdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "file",
        fileData: base64Data,
        mimeType: file.type || getFallbackMimeType(file.name),
        fileName: file.name,
        mode: conversionMode,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Lỗi máy chủ khi xử lý file");
    }

    const data = await res.json();
    if (data.success && data.markdown) {

      setOutputMarkdown(data.markdown);
      triggerToast("Chuyển đổi thành công!", true);
    } else {
        petResult.current = "blocked";
      triggerToast(data.error || "Không thể chuyển đổi tài liệu này", false);
    }
  };

  // Helper chuyển file thành chuỗi base64 thuần
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const base64 = res.includes(",") ? res.split(",")[1] : res;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Khởi động chuyển đổi toàn bộ danh sách tệp chờ
  const handleStartConversion = async () => {
    if (selectedFiles.length === 0) {
      triggerToast("Vui lòng chọn hoặc kéo thả ít nhất 1 tệp tin!", false);
      return;
    }

    // TRƯỜNG HỢP 1: Chỉ có 1 file PDF -> Phân đoạn theo trang nếu vượt quá chunkSize
    const firstFile = selectedFiles[0];
    const isPdf = firstFile.type === "application/pdf" || firstFile.name.toLowerCase().endsWith(".pdf");

    if (selectedFiles.length === 1 && isPdf) {
      await processFile(firstFile);
      return;
    }

    // TRƯỜNG HỢP 2: Nhiều tệp hỗn hợp hoặc 1 tệp đơn lẻ phi PDF
    petResult.current = "ready";
    setIsProcessing(true);
    abortControllerRef.current = false;
    setFileName(selectedFiles.length === 1 ? firstFile.name : `${selectedFiles.length}_tep_tin`);
    setMobileView("output");
    setHasChargedCurrentFile(false);
    setOutputMarkdown("");

    const chunkList: ChunkItem[] = selectedFiles.map((file, i) => ({
      id: i + 1,
      startPage: 0,
      endPage: 0,
      title: file.name,
      status: "waiting",
      retryCount: 0,
    }));

    setChunks(chunkList);
    triggerToast(`Bắt đầu xử lý hàng đợi ${selectedFiles.length} tệp...`, true);

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
        const file = selectedFiles[idx];
        const base64Data = await fileToBase64(file);
        const mimeType = file.type || getFallbackMimeType(file.name);
        const resultMarkdown = await sendChunkToApi(
          base64Data,
          mimeType,
          file.name,
          3,
          conversionMode
        );

        updatedChunks[idx].status = "completed";
        updatedChunks[idx].markdown = resultMarkdown;
        setChunks([...updatedChunks]);

        setOutputMarkdown(stitchChunks(updatedChunks, includePageDividers));

        if (idx < updatedChunks.length - 1 && !abortControllerRef.current) {
          updatedChunks[idx + 1].status = "cooldown";
          setChunks([...updatedChunks]);
          await sleep(interChunkDelay, true);
        }
      } catch (err: any) {
        console.error(`Lỗi tại tệp ${idx + 1}:`, err);
        petResult.current = getPetErrorResult(err);
        updatedChunks[idx].status = "error";
        updatedChunks[idx].errorMsg = err.message || "Lỗi phân tích tệp này";
        setChunks([...updatedChunks]);
        triggerToast(`Tệp ${idx + 1} (${selectedFiles[idx].name}) gặp lỗi: ${err.message || "Lỗi xử lý"}`, false);
      }
    }

    const finalCombined = stitchChunks(updatedChunks, includePageDividers);
    setOutputMarkdown(finalCombined);
    if (!abortControllerRef.current) {
      triggerToast("Đã hoàn tất chuyển đổi tất cả tệp tin!", true);
    }
    setIsProcessing(false);
    setCurrentChunkIndex(-1);
    setCooldownCountdown(0);
  };

  // Thử lại 1 chunk bị lỗi
  const retryChunk = async (chunkIndex: number) => {
    const targetChunk = chunks[chunkIndex];
    if (!targetChunk) return;

    targetChunk.status = "processing";
    setChunks([...chunks]);

    // Nhánh A: Thử lại 1 tệp trong hàng đợi đa tệp
    if (selectedFiles.length > 0 && selectedFiles[chunkIndex] && targetChunk.startPage === 0) {
      const file = selectedFiles[chunkIndex];
      try {
        const base64Data = await fileToBase64(file);
        const mimeType = file.type || getFallbackMimeType(file.name);
        const resultMarkdown = await sendChunkToApi(
          base64Data,
          mimeType,
          file.name,
          3,
          conversionMode
        );
        targetChunk.status = "completed";
        targetChunk.markdown = resultMarkdown;
        targetChunk.errorMsg = undefined;
        setChunks([...chunks]);
        setOutputMarkdown(stitchChunks(chunks, includePageDividers));
        triggerToast(`Đã phân tích lại tệp "${file.name}" thành công!`, true);
      } catch (err: any) {
        petResult.current = getPetErrorResult(err);
        targetChunk.status = "error";
        targetChunk.errorMsg = err.message || "Lỗi thử lại";
        setChunks([...chunks]);
        triggerToast(`Thử lại tệp thất bại: ${err.message}`, false);
      }
      return;
    }

    // Nhánh B: Thử lại 1 phân đoạn trang của file PDF
    const pdfFile = selectedFiles[0] || fileInputRef.current?.files?.[0];
    if (!pdfFile) return;

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
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
        `${pdfFile.name.replace(/\.[^/.]+$/, "")}_part_${chunkIndex + 1}.pdf`,
        3,
        conversionMode
      );

      targetChunk.status = "completed";
      targetChunk.markdown = resultMarkdown;
      targetChunk.errorMsg = undefined;
      setChunks([...chunks]);

      setOutputMarkdown(stitchChunks(chunks, includePageDividers));
      triggerToast(`Đã phân tích lại phân đoạn ${chunkIndex + 1} thành công!`, true);
    } catch (err: any) {
      petResult.current = getPetErrorResult(err);
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

    petResult.current = "ready";
    setIsProcessing(true);
    setMobileView("output");
    setHasChargedCurrentFile(false);
    setOutputMarkdown("");
    setChunks([]);
    triggerToast("Đang phân tích URL bằng AI...", true);

    try {
      const res = await authFetch("/api/markitdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "url", url: url, mode: conversionMode }),
      });

      if (!res.ok) {
        petResult.current = getPetErrorResult(new Error(`HTTP ${res.status}`), res.status);
        throw new Error("Lỗi máy chủ khi xử lý URL");
      }

      const data = await res.json();
      if (data.success && data.markdown) {

        setOutputMarkdown(data.markdown);
        triggerToast("Chuyển đổi URL thành công!", true);
      } else {
        petResult.current = "blocked";
        triggerToast(data.error || "Không thể chuyển đổi URL này", false);
      }
    } catch (err: any) {
      console.error(err);
      petResult.current = getPetErrorResult(err);
      triggerToast("Lỗi kết nối đến máy chủ!", false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!isPro && !hasChargedCurrentFile) {
      const markItDownCount = userDoc?.markItDownCount || 0;
      const promptCount = userDoc?.promptCount || 0;

      if (markItDownCount >= 1 * currentMultiplier) {
        triggerToast("Bạn đã hết lượt dùng thử MarkItDown AI miễn phí hôm nay. Hãy nâng cấp gói PRO để sử dụng không giới hạn!", false);
        return;
      }
      if (promptCount >= 15 * currentMultiplier) {
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

      if (markItDownCount >= 1 * currentMultiplier) {
        triggerToast("Bạn đã hết lượt dùng thử MarkItDown AI miễn phí hôm nay. Hãy nâng cấp gói PRO!", false);
        return;
      }
      if (promptCount >= 15 * currentMultiplier) {
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
      <div className="p-4 sm:p-6 border-b border-white/50 bg-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex flex-wrap items-center gap-2">
            <Layout className="w-5 h-5 text-indigo-600" />
            MarkItDown AI Enterprise
            <span className="text-[11px] sm:text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Layers className="w-3 h-3" /> Auto Chunk & Stitch
            </span>
          </h2>
        </div>
        <div className="flex bg-slate-100/90 p-1 rounded-xl w-full sm:w-auto shrink-0 border border-slate-200/50">
          <button
            onClick={() => setInputType("file")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer text-center ${
              inputType === "file" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Tài liệu & Hình ảnh
          </button>
          <button
            onClick={() => setInputType("url")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer text-center ${
              inputType === "url" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            URL / Youtube
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex bg-slate-100/90 p-1.5 rounded-2xl mx-3.5 mt-3 mb-2 shrink-0 select-none border border-slate-200/60 shadow-xs">
        <button
          type="button"
          onClick={() => setMobileView("input")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            mobileView === "input" ? "bg-white text-indigo-700 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Cấu hình & Tải tệp</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileView("output")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            mobileView === "output" ? "bg-white text-indigo-700 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Hàng đợi & Kết quả</span>
          {outputMarkdown.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5" />
          )}
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        {/* Left Side: Input & Settings */}
        <div className={`w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50 p-3.5 sm:p-6 flex flex-col gap-4 sm:gap-5 overflow-y-auto ${
          mobileView === "input" ? "flex" : "hidden md:flex"
        }`}>
          {inputType === "file" ? (
            <div className="flex flex-col gap-3.5 sm:gap-4">
              {/* Dropzone Thống nhất Đa tệp & Hình ảnh */}
              <div
                id="tour-markitdown-dropzone"
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isProcessing) setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (!isProcessing && e.dataTransfer.files) {
                    handleFilesSelect(e.dataTransfer.files);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center text-center transition-all ${
                  isProcessing 
                    ? "border-slate-200 bg-slate-100/60 cursor-not-allowed opacity-75" 
                    : isDragging
                    ? "border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-200 cursor-pointer shadow-md"
                    : "border-indigo-200 bg-white/60 hover:bg-indigo-50/50 hover:border-indigo-400 cursor-pointer shadow-sm"
                }`}
              >
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center mb-2 transition-transform ${
                  isDragging ? "bg-indigo-600 text-white scale-110" : "bg-indigo-100 text-indigo-600"
                }`}>
                  <FileUp className="w-5 h-5" />
                </div>
                <p className="font-semibold text-slate-700 text-xs sm:text-sm">
                  {isDragging ? "Thả các tệp vào đây..." : "Kéo thả hoặc nhấn để tải tệp lên"}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  Hỗ trợ nhiều tệp: PDF, Word, Excel, PPTX, Văn bản &amp; Ảnh (PNG, JPG, WebP...)
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.rtf,.txt,.csv,image/*"
                  disabled={isProcessing}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFilesSelect(e.target.files);
                  }}
                />
              </div>

              {/* Danh sách tệp chờ & Nút bắt đầu chuyển đổi */}
              {selectedFiles.length > 0 && (
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      Đã chọn {selectedFiles.length} tệp ({formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))})
                    </span>
                    {!isProcessing && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Thêm tệp
                        </button>
                        <button
                          type="button"
                          onClick={clearFiles}
                          className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Xóa hết
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {selectedFiles.map((file, i) => (
                      <div
                        key={`${file.name}-${i}-${file.size}`}
                        className="flex items-center justify-between bg-slate-50 border border-slate-200/70 px-2.5 py-1.5 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">#{i + 1}</span>
                          {getFileIcon(file.name)}
                          <span className="truncate text-slate-700 font-medium">{file.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">({formatFileSize(file.size)})</span>
                        </div>
                        {!isProcessing && (
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                            title="Xóa tệp này"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleStartConversion}
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-1"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang xử lý {selectedFiles.length} tệp...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Bắt đầu chuyển đổi ({selectedFiles.length} tệp)
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Bộ chọn Chế độ Chuyển đổi (Conversion Mode Selector) */}
              <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Chế độ Chuyển đổi
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {conversionMode === "fast" ? "⚡ Siêu tốc (0 AI token)" : "✨ AI Math Polish"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/50">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConversionMode("fast")}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      conversionMode === "fast"
                        ? "bg-white text-amber-600 shadow-xs border border-amber-200/60"
                        : "text-slate-600 hover:text-slate-800"
                    } disabled:opacity-50`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Siêu tốc</span>
                    <span className="text-[10px] font-normal px-1 py-0.2 bg-amber-100 text-amber-700 rounded-sm">Fast</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConversionMode("ai")}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      conversionMode === "ai"
                        ? "bg-white text-indigo-600 shadow-xs border border-indigo-200/60"
                        : "text-slate-600 hover:text-slate-800"
                    } disabled:opacity-50`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Math Polish</span>
                    <span className="text-[10px] font-normal px-1 py-0.2 bg-indigo-100 text-indigo-700 rounded-sm">AI</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  {conversionMode === "fast" 
                    ? "⚡ Trích xuất Markdown thuần tức thì qua AnyDoc (<100ms), 0 token AI."
                    : "✨ Tự động chuẩn hóa công thức Toán/Lý/Hóa sang LaTeX ($...$, $$...$$) với Gemini 3.7 Flash."}
                </p>
              </div>

              {/* Accordion Cấu hình Hàng đợi 1 hàng (Thu gọn mặc định) */}
              <div id="tour-markitdown-queue-settings" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
                {/* Accordion Summary Header (1 hàng) */}
                <button
                  type="button"
                  onClick={() => setIsQueueSettingsOpen((prev) => !prev)}
                  className="w-full p-3 sm:p-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-700 shrink-0">Cấu hình Hàng đợi &amp; Cắt trang</span>
                    <span className="hidden sm:inline text-slate-300">|</span>
                    <span className="text-[11px] text-slate-500 font-medium truncate">
                      {chunkSize} trang/lần • {(interChunkDelay / 1000).toFixed(1)}s • Mốc trang {includePageDividers ? "ON" : "OFF"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isQueueSettingsOpen ? "rotate-180 text-indigo-600" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Accordion Expandable Content */}
                {isQueueSettingsOpen && (
                  <div className="px-3.5 pb-4 pt-1 border-t border-slate-100 flex flex-col gap-3.5">
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
                            className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
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
                            className={`py-1.5 px-1.5 text-[11px] font-semibold rounded-lg border transition-all text-center cursor-pointer ${
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
                      <label htmlFor="dividerToggle" className="cursor-pointer select-none flex items-center gap-1.5">
                        <span>Ghi chú mốc phân cách</span>
                        <span className="text-[10px] text-slate-400">(&lt;!-- Mốc trang / Tệp --&gt;)</span>
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
                )}
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
                      className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
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
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-xs"><FileText className="w-3.5 h-3.5 text-blue-500" /> Word (.docx)</div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel (.xlsx)</div>
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
        <div id="tour-markitdown-output-panel" className={`w-full md:w-2/3 p-6 flex flex-col bg-white overflow-hidden min-h-0 h-full max-h-full relative ${
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
                    
                    <span className="truncate max-w-[200px]">{chk.title || `Đoạn ${chk.id} (Trang ${chk.startPage}-${chk.endPage})`}</span>

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
