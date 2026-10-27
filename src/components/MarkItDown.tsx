
import { authFetch } from "../utils/api-client";
import { getActivePlan, getPlanLimits } from "../../shared/subscription-policy";
import React, { useEffect, useState, useRef, useMemo, useDeferredValue, startTransition } from "react";
import { 
  FileUp, Link as LinkIcon, Loader2, Sparkles, Copy, Download, Check, 
  FileType, FileText, Image as ImageIcon, Layout, 
  Layers, Clock, AlertCircle, RotateCcw, XCircle, CheckCircle2, Sliders,
  Trash2, Plus, X, Zap, FileSpreadsheet, Presentation, Activity,
  FileCode, FileAudio, FileVideo, FileArchive, BookOpen
} from "lucide-react";
import Markdown from 'react-markdown';
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { PDFDocument } from "pdf-lib";
import { motion } from "motion/react";
import { beginCodexPetActivity, type CodexPetResult } from "../utils/codex-pet-activity";
import { normalizeMarkdownMath } from "../utils/markdown-math";

const REMARK_PLUGINS = [remarkMath, remarkGfm];
const REHYPE_PLUGINS: any[] = [[rehypeKatex, { throwOnError: false, strict: false }]];

interface MemoizedMarkdownContentProps {
  content: string;
}

const MemoizedMarkdownContent = React.memo<MemoizedMarkdownContentProps>(({ content }) => {
  return (
    <div className="markdown-body prose prose-sm max-w-none prose-indigo">
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
      >
        {content}
      </Markdown>
    </div>
  );
});
MemoizedMarkdownContent.displayName = "MemoizedMarkdownContent";

interface MarkItDownProps {
  triggerToast: (msg: string, success?: boolean) => void;
  isPro: boolean;
  currentMultiplier?: number;
  userDoc?: any;
  onMarkItDownUsage?: (isAi?: boolean) => Promise<void>;
  onRequireAuth?: () => boolean;
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

export type AnalysisStage = 
  | "idle"
  | "reading"         // Đang đọc tệp & phân tích cấu trúc
  | "fast_extracted"  // Đã trích xuất siêu tốc & hiển thị bản nháp
  | "ai_polishing"    // Đang chuẩn hóa công thức Toán LaTeX qua AI
  | "completed"       // Hoàn tất chuẩn hóa
  | "error";          // Gặp lỗi

export const MarkItDown: React.FC<MarkItDownProps> = ({ triggerToast, isPro, userDoc, onMarkItDownUsage, onRequireAuth, currentMultiplier = 1 }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputMarkdown, setOutputMarkdown] = useState("");
  const [inputType, setInputType] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [conversionMode, setConversionMode] = useState<"fast" | "ai">("fast");

  const normalizedMarkdown = useMemo(() => {
    return normalizeMarkdownMath(outputMarkdown);
  }, [outputMarkdown]);
  const deferredMarkdown = useDeferredValue(normalizedMarkdown);
  const [isCopied, setIsCopied] = useState(false);
  const [mobileView, setMobileView] = useState<"input" | "output">("input");
  const [hasChargedCurrentFile, setHasChargedCurrentFile] = useState(false);
  const petResult = useRef<CodexPetResult>("ready");

  // Tiến trình phân tích 2 giai đoạn & báo lỗi
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>("idle");
  const [stageErrorMsg, setStageErrorMsg] = useState<string | null>(null);
  const [fastDraftMarkdown, setFastDraftMarkdown] = useState<string>("");
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const abortControllerRef = useRef<boolean>(false);

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

  // Helper để làm sạch và ghép các đoạn Markdown
  const stitchChunks = (chunkList: ChunkItem[]): string => {
    const stitched = chunkList
      .filter((c) => c.markdown && typeof c.markdown === "string" && c.markdown.trim().length > 0 && c.markdown.trim() !== "undefined")
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

        if (c.title) {
          return `\n\n<!-- ====== ${c.title.toUpperCase()} ====== -->\n\n${text}`;
        }
        if (c.startPage > 0) {
          return `\n\n<!-- ====== TRANG ${c.startPage} - ${c.endPage} ====== -->\n\n${text}`;
        }
        return text;
      })
      .join("\n\n");
    return normalizeMarkdownMath(stitched);
  };

  // Hàm sleep có kiểm tra cờ hủy
  const sleep = (ms: number) => {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      if (abortControllerRef.current) {
        clearTimeout(timer);
        resolve();
      }
    });
  };

  // Helper định dạng kích thước tệp
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper hiển thị icon đại diện theo định dạng tệp (Hỗ trợ toàn diện định dạng Anytype)
  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return <FileType className="w-3.5 h-3.5 text-red-500 shrink-0" />;
      case "doc":
      case "docx":
      case "odt":
      case "rtf":
      case "pages":
        return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      case "txt":
      case "md":
      case "markdown":
        return <FileText className="w-3.5 h-3.5 text-slate-600 shrink-0" />;
      case "epub":
      case "mobi":
        return <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
      case "xls":
      case "xlsx":
      case "csv":
      case "tsv":
      case "ods":
      case "numbers":
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case "ppt":
      case "pptx":
      case "odp":
      case "key":
        return <Presentation className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case "png":
      case "jpg":
      case "jpeg":
      case "webp":
      case "gif":
      case "svg":
      case "bmp":
      case "ico":
      case "tiff":
      case "tif":
      case "heic":
        return <ImageIcon className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
      case "mp3":
      case "wav":
      case "m4a":
      case "aac":
      case "ogg":
      case "flac":
      case "wma":
      case "opus":
        return <FileAudio className="w-3.5 h-3.5 text-pink-500 shrink-0" />;
      case "mp4":
      case "mov":
      case "avi":
      case "mkv":
      case "webm":
      case "wmv":
      case "flv":
      case "m4v":
        return <FileVideo className="w-3.5 h-3.5 text-violet-500 shrink-0" />;
      case "js":
      case "jsx":
      case "ts":
      case "tsx":
      case "py":
      case "java":
      case "c":
      case "cpp":
      case "cs":
      case "html":
      case "htm":
      case "css":
      case "scss":
      case "json":
      case "xml":
      case "yaml":
      case "yml":
      case "sql":
      case "sh":
      case "bash":
      case "tex":
      case "latex":
        return <FileCode className="w-3.5 h-3.5 text-cyan-600 shrink-0" />;
      case "zip":
      case "rar":
      case "7z":
      case "tar":
      case "gz":
        return <FileArchive className="w-3.5 h-3.5 text-orange-500 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
  };

  // Helper MIME type dự phòng khi trình duyệt trả về rỗng (Đầy đủ mọi loại tệp)
  const getFallbackMimeType = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      // Tài liệu & Sách
      case "pdf": return "application/pdf";
      case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "doc": return "application/msword";
      case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      case "xls": return "application/vnd.ms-excel";
      case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      case "ppt": return "application/vnd.ms-powerpoint";
      case "odt": return "application/vnd.oasis.opendocument.text";
      case "ods": return "application/vnd.oasis.opendocument.spreadsheet";
      case "odp": return "application/vnd.oasis.opendocument.presentation";
      case "rtf": return "application/rtf";
      case "epub": return "application/epub+zip";
      // Văn bản & Mã nguồn
      case "txt": return "text/plain";
      case "md":
      case "markdown": return "text/markdown";
      case "tex":
      case "latex": return "text/x-tex";
      case "html":
      case "htm": return "text/html";
      case "css": return "text/css";
      case "csv": return "text/csv";
      case "tsv": return "text/tab-separated-values";
      case "json": return "application/json";
      case "xml": return "application/xml";
      case "yaml":
      case "yml": return "text/yaml";
      case "js":
      case "mjs":
      case "cjs": return "text/javascript";
      case "ts":
      case "tsx":
      case "jsx": return "text/typescript";
      case "py": return "text/x-python";
      case "java": return "text/x-java-source";
      case "c":
      case "cpp":
      case "h": return "text/x-c";
      case "sql": return "application/sql";
      // Hình ảnh
      case "png": return "image/png";
      case "jpg":
      case "jpeg": return "image/jpeg";
      case "webp": return "image/webp";
      case "gif": return "image/gif";
      case "svg": return "image/svg+xml";
      case "bmp": return "image/bmp";
      case "ico": return "image/x-icon";
      case "tiff":
      case "tif": return "image/tiff";
      case "heic": return "image/heic";
      // Âm thanh
      case "mp3": return "audio/mp3";
      case "wav": return "audio/wav";
      case "m4a": return "audio/m4a";
      case "aac": return "audio/aac";
      case "ogg": return "audio/ogg";
      case "flac": return "audio/flac";
      // Video
      case "mp4": return "video/mp4";
      case "webm": return "video/webm";
      case "mov": return "video/quicktime";
      case "avi": return "video/x-msvideo";
      case "mkv": return "video/x-matroska";
      // Nén & Khác
      case "zip": return "application/zip";
      case "rar": return "application/vnd.rar";
      case "7z": return "application/x-7z-compressed";
      case "tar": return "application/x-tar";
      case "gz": return "application/gzip";
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
    maxRetries = 2,
    mode: "fast" | "ai" = conversionMode
  ): Promise<string> => {
    let attempt = 0;
    let delay = 2000;

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
          
          // Chỉ retry khi bị 429 Too Many Requests hoặc 503 Quá tải
          if ((res.status === 429 || res.status === 503 || errorMsg.toLowerCase().includes("quota")) && attempt < maxRetries) {
            console.warn(`[Queue] Gặp hạn mức 429/503 ở lần thử ${attempt}. Nghỉ ${delay}ms...`);
            await sleep(delay);
            delay *= 2;
            continue;
          }
          petResult.current = getPetErrorResult(new Error(errorMsg), res.status);
          throw new Error(errorMsg);
        }

        const data = await res.json();
        if (data.success && typeof data.markdown === "string" && data.markdown.trim().length > 0 && data.markdown.trim() !== "undefined") {
          return data.markdown.trim();
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

  // GIAI ĐOẠN 2: Gọi AI Polish chuẩn hóa công thức Toán LaTeX ($...$, $$...$$)
  const runAiPolishStage = async (rawContent: string): Promise<string> => {
    setAnalysisStage("ai_polishing");
    setStageErrorMsg(null);
    setIsProcessing(true);
    triggerToast("AI đang chuẩn hóa công thức Toán LaTeX...", true);

    try {
      const res = await authFetch("/api/markitdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          rawText: rawContent,
          mode: "ai",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success && typeof data.markdown === "string" && data.markdown.trim().length > 0 && data.markdown.trim() !== "undefined") {
        const finalMarkdown = data.markdown.trim();
        startTransition(() => {
          setOutputMarkdown(finalMarkdown);
          setAnalysisStage("completed");
        });
        triggerToast("Chuẩn hóa công thức Toán LaTeX thành công!", true);
        return finalMarkdown;
      } else {
        throw new Error(data.error || "Không nhận được nội dung Markdown hợp lệ từ AI");
      }
    } catch (err: any) {
      console.error("Lỗi AI Polish:", err);
      const errMsg = err.message || "Kết nối AI gián đoạn, không thể chuẩn hóa LaTeX.";
      setStageErrorMsg(errMsg);
      setAnalysisStage("error");
      triggerToast("AI gián đoạn, hệ thống giữ nguyên bản Markdown siêu tốc.", false);
      return rawContent;
    } finally {
      setIsProcessing(false);
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

  // Pipeline xử lý 1 tệp qua 2 giai đoạn: Siêu tốc -> AI Polish
  const processSingleFilePipeline = async (file: File): Promise<string> => {
    setAnalysisStage("reading");
    setStageErrorMsg(null);
    triggerToast(`Đang đọc tệp ${file.name}...`, true);

    const base64Data = await fileToBase64(file);
    const mimeType = file.type || getFallbackMimeType(file.name);

    // GIAI ĐOẠN 1: Trích xuất siêu tốc tức thì (<300ms)
    let fastMarkdown = "";
    try {
      const fastRes = await authFetch("/api/markitdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "file",
          fileData: base64Data,
          mimeType: mimeType,
          fileName: file.name,
          mode: "fast",
        }),
      });

      if (fastRes.ok) {
        const fastData = await fastRes.json();
        if (fastData.success && typeof fastData.markdown === "string" && fastData.markdown.trim().length > 0) {
          fastMarkdown = fastData.markdown.trim();
          startTransition(() => {
            setFastDraftMarkdown(fastMarkdown);
            setOutputMarkdown(fastMarkdown);
            setAnalysisStage("fast_extracted");
          });
          triggerToast("Trích xuất siêu tốc thành công!", true);
        }
      }
    } catch (fastErr) {
      console.warn("Chế độ siêu tốc không trích xuất được (file scan ảnh hoặc cần OCR):", fastErr);
    }

    // Nếu người dùng chọn chế độ Siêu tốc thuần túy (0 token AI)
    if (conversionMode === "fast") {
      if (fastMarkdown) {
        setAnalysisStage("completed");
        return fastMarkdown;
      } else {
        throw new Error("Không thể trích xuất văn bản ở chế độ Siêu tốc (file scan/ảnh cần OCR). Vui lòng chọn chế độ 'AI Math Polish'.");
      }
    }

    // GIAI ĐOẠN 2: AI Math Polish
    setAnalysisStage("ai_polishing");

    if (fastMarkdown) {
      // Đã có text siêu tốc -> Gửi text để AI chuẩn hóa LaTeX (nhẹ, nhanh, tiết kiệm token)
      return await runAiPolishStage(fastMarkdown);
    } else {
      // File dạng ảnh hoặc PDF scan không có text -> Gửi multimodal AI
      triggerToast("Đang nhận diện nội dung & chuẩn hóa LaTeX qua AI...", true);
      const aiRes = await authFetch("/api/markitdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "file",
          fileData: base64Data,
          mimeType: mimeType,
          fileName: file.name,
          mode: "ai",
        }),
      });

      if (!aiRes.ok) {
        const errData = await aiRes.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${aiRes.status}`);
      }

      const aiData = await aiRes.json();
      if (aiData.success && typeof aiData.markdown === "string" && aiData.markdown.trim().length > 0 && aiData.markdown.trim() !== "undefined") {
        const aiMarkdown = normalizeMarkdownMath(aiData.markdown.trim());
        startTransition(() => {
          setOutputMarkdown(aiMarkdown);
          setAnalysisStage("completed");
        });
        triggerToast("Chuyển đổi AI thành công!", true);
        return aiMarkdown;
      } else {
        throw new Error(aiData.error || "Không thể chuyển đổi tài liệu này qua AI");
      }
    }
  };

  // Khởi động chuyển đổi toàn bộ danh sách tệp chờ
  const handleStartConversion = async () => {
    if (onRequireAuth && !onRequireAuth()) return;
    if (selectedFiles.length === 0) {
      triggerToast("Vui lòng chọn hoặc kéo thả ít nhất 1 tệp tin!", false);
      return;
    }

    petResult.current = "ready";
    setIsProcessing(true);
    abortControllerRef.current = false;
    setMobileView("output");
    setHasChargedCurrentFile(false);
    setOutputMarkdown("");
    setFastDraftMarkdown("");
    setStageErrorMsg(null);
    setAnalysisStage("reading");

    // Cho phép trình duyệt render frame cập nhật trạng thái UI và chuyển tab mượt mà trước khi đọc tệp
    await new Promise((resolve) => setTimeout(resolve, 30));

    // TRƯỜNG HỢP 1: Chỉ có 1 tệp duy nhất
    if (selectedFiles.length === 1) {
      const file = selectedFiles[0];
      setFileName(file.name);
      setChunks([]);
      try {
        await processSingleFilePipeline(file);
      } catch (err: any) {
        console.error("Lỗi chuyển đổi tệp:", err);
        petResult.current = getPetErrorResult(err);
        setStageErrorMsg(err.message || "Lỗi xử lý tài liệu");
        setAnalysisStage("error");
        triggerToast(`Lỗi: ${err.message || "Lỗi xử lý tài liệu"}`, false);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // TRƯỜNG HỢP 2: Hàng đợi nhiều tệp
    setFileName(`${selectedFiles.length}_tep_tin`);
    const chunkList: ChunkItem[] = selectedFiles.map((file, i) => ({
      id: i + 1,
      startPage: 0,
      endPage: 0,
      title: file.name,
      status: "waiting",
      retryCount: 0,
    }));
    setChunks(chunkList);
    triggerToast(`Bắt đầu xử lý ${selectedFiles.length} tệp tin...`, true);

    const updatedChunks = [...chunkList];

    for (let idx = 0; idx < updatedChunks.length; idx++) {
      if (abortControllerRef.current) {
        triggerToast("Đã dừng hàng đợi xử lý", false);
        break;
      }

      updatedChunks[idx].status = "processing";
      setChunks([...updatedChunks]);

      try {
        const file = selectedFiles[idx];
        const resMarkdown = await processSingleFilePipeline(file);
        updatedChunks[idx].status = "completed";
        updatedChunks[idx].markdown = resMarkdown;
        setChunks([...updatedChunks]);
        startTransition(() => {
          setOutputMarkdown(stitchChunks(updatedChunks));
        });
      } catch (err: any) {
        console.error(`Lỗi tại tệp ${idx + 1}:`, err);
        petResult.current = getPetErrorResult(err);
        updatedChunks[idx].status = "error";
        updatedChunks[idx].errorMsg = err.message || "Lỗi phân tích tệp này";
        setChunks([...updatedChunks]);
        setStageErrorMsg(`Tệp "${selectedFiles[idx].name}": ${err.message}`);
        triggerToast(`Tệp ${selectedFiles[idx].name} gặp lỗi: ${err.message}`, false);
      }
    }

    const finalCombined = stitchChunks(updatedChunks);
    if (finalCombined) {
      startTransition(() => {
        setOutputMarkdown(finalCombined);
        setAnalysisStage("completed");
      });
    }
    if (!abortControllerRef.current) {
      triggerToast("Đã hoàn tất xử lý danh sách tệp tin!", true);
    }
    setIsProcessing(false);
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
        setOutputMarkdown(stitchChunks(chunks));
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

      setOutputMarkdown(stitchChunks(chunks));
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
    if (onRequireAuth && !onRequireAuth()) return;
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

  const fallbackCopy = (text: string) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    } catch (e) {
      console.warn("Không thể sao chép qua execCommand:", e);
    }
  };

  const handleCopy = () => {
    if (onRequireAuth && !onRequireAuth()) return;

    // 1. Sao chép tức thì vào bộ nhớ tạm (0ms latency, không chờ await mạng)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(outputMarkdown).catch(() => {
        fallbackCopy(outputMarkdown);
      });
    } else {
      fallbackCopy(outputMarkdown);
    }
    setIsCopied(true);
    triggerToast("Đã sao chép toàn bộ Markdown vào bộ nhớ tạm", true);
    setTimeout(() => setIsCopied(false), 2000);

    // 2. Ghi nhận hạn mức chạy nền không block UI
    if (!isPro && !hasChargedCurrentFile) {
      const markItDownCount = userDoc?.markItDownCount || 0;
      const promptCount = userDoc?.promptCount || 0;
      const userPlan = getActivePlan(userDoc?.planType, userDoc?.planExpiresAt);
      const limits = getPlanLimits(userPlan);

      // Nếu chế độ AI: kiểm tra hạn mức AI trong ngày
      if (conversionMode === "ai") {
        if (promptCount >= limits.ai) {
          triggerToast(`Bạn đã hết lượt sử dụng AI hôm nay (tối đa ${limits.ai} lượt/ngày). Hãy nâng cấp gói để tiếp tục!`, false);
          return;
        }
      } else {
        // Chế độ AnyDoc không AI: kiểm tra hạn mức file MarkItDown
        if (limits.markitdown !== Infinity && markItDownCount >= limits.markitdown) {
          triggerToast(`Bạn đã hết lượt chuyển đổi MarkItDown hôm nay (tối đa ${limits.markitdown} file/ngày). Hãy nâng cấp gói PRO để sử dụng không giới hạn!`, false);
          return;
        }
      }
      setHasChargedCurrentFile(true);
      if (onMarkItDownUsage) {
        onMarkItDownUsage(conversionMode === "ai").catch((err) => {
          console.error("Lỗi cập nhật số lượt dùng MarkItDown:", err);
        });
      }
    }
  };

  const handleDownload = () => {
    if (onRequireAuth && !onRequireAuth()) return;
    if (!isPro && !hasChargedCurrentFile) {
      const markItDownCount = userDoc?.markItDownCount || 0;
      const promptCount = userDoc?.promptCount || 0;
      const userPlan = getActivePlan(userDoc?.planType, userDoc?.planExpiresAt);
      const limits = getPlanLimits(userPlan);

      // Nếu chế độ AI: kiểm tra hạn mức AI trong ngày
      if (conversionMode === "ai") {
        if (promptCount >= limits.ai) {
          triggerToast(`Bạn đã hết lượt sử dụng AI hôm nay (tối đa ${limits.ai} lượt/ngày). Hãy nâng cấp gói để tiếp tục!`, false);
          return;
        }
      } else {
        // Chế độ AnyDoc không AI: kiểm tra hạn mức file MarkItDown
        if (limits.markitdown !== Infinity && markItDownCount >= limits.markitdown) {
          triggerToast(`Bạn đã hết lượt chuyển đổi MarkItDown hôm nay (tối đa ${limits.markitdown} file/ngày). Hãy nâng cấp gói PRO để sử dụng không giới hạn!`, false);
          return;
        }
      }
      setHasChargedCurrentFile(true);
      if (onMarkItDownUsage) {
        onMarkItDownUsage(conversionMode === "ai").catch((err) => {
          console.error("Lỗi cập nhật số lượt dùng MarkItDown:", err);
        });
      }
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
    <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] overflow-hidden flex flex-col flex-1 min-h-0 h-full">
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
      <div className="md:hidden flex bg-slate-100/90 p-1.5 rounded-2xl mx-3.5 mt-3 mb-2 shrink-0 select-none border border-slate-200/60 shadow-xs relative">
        <button
          type="button"
          onClick={() => setMobileView("input")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-colors cursor-pointer relative z-10 ${
            mobileView === "input" ? "text-indigo-700 font-extrabold" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {mobileView === "input" && (
            <motion.div
              layoutId="active-markitdown-mobile-tab"
              className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/50 -z-10"
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
            />
          )}
          <Sliders className="w-3.5 h-3.5" />
          <span>Cấu hình & Tải tệp</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileView("output")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-colors cursor-pointer relative z-10 ${
            mobileView === "output" ? "text-indigo-700 font-extrabold" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {mobileView === "output" && (
            <motion.div
              layoutId="active-markitdown-mobile-tab"
              className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/50 -z-10"
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
            />
          )}
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
                  Hỗ trợ mọi loại tệp: Tài liệu (PDF, Word, Excel, PPT, EPUB), Văn bản, Mã nguồn, Ảnh, Âm thanh &amp; Video
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="*/*"
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
              <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs flex flex-col gap-1.5">
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
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Siêu tốc</span>
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
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>AI Math Polish</span>
                  </button>
                </div>
              </div>

              {/* Khu vực Tiến trình Hệ thống Phân tích & Báo lỗi */}
              {(isProcessing || analysisStage !== "idle") && (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-indigo-600" />
                      Tiến trình phân tích
                    </span>
                    {isProcessing && (
                      <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Đang chạy...
                      </span>
                    )}
                  </div>

                  {/* Stepper trực quan 3 bước */}
                  <div className="flex flex-col gap-2 pt-1">
                    {/* Bước 1: Trích xuất siêu tốc */}
                    <div className="flex items-center gap-2.5 text-xs">
                      {analysisStage === "reading" ? (
                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                      ) : analysisStage === "fast_extracted" || analysisStage === "ai_polishing" || analysisStage === "completed" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                      )}
                      <span className={analysisStage === "reading" ? "font-bold text-amber-700" : "text-slate-600"}>
                        Trích xuất siêu tốc (&lt;300ms)
                      </span>
                    </div>

                    {/* Bước 2: Hiển thị bản xem trước */}
                    <div className="flex items-center gap-2.5 text-xs">
                      {outputMarkdown ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : analysisStage === "reading" ? (
                        <div className="w-4 h-4 rounded-full border border-slate-200 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                      )}
                      <span className={outputMarkdown && analysisStage === "ai_polishing" ? "font-medium text-slate-700" : "text-slate-600"}>
                        Xuất kết quả bản nháp tức thì
                      </span>
                    </div>

                    {/* Bước 3: AI Math Polish */}
                    {conversionMode === "ai" && (
                      <div className="flex items-center gap-2.5 text-xs">
                        {analysisStage === "ai_polishing" ? (
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                        ) : analysisStage === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : stageErrorMsg ? (
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                        )}
                        <span className={analysisStage === "ai_polishing" ? "font-bold text-indigo-700" : "text-slate-600"}>
                          AI chuẩn hóa công thức LaTeX ($...$)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Báo lỗi chi tiết nếu có */}
                  {stageErrorMsg && (
                    <div className="mt-1 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-rose-800">Thông báo lỗi chi tiết:</p>
                          <p className="text-[11px] leading-relaxed break-words text-rose-700">{stageErrorMsg}</p>
                        </div>
                      </div>
                      {fastDraftMarkdown && conversionMode === "ai" && !isProcessing && (
                        <button
                          type="button"
                          onClick={() => runAiPolishStage(fastDraftMarkdown)}
                          className="self-end px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Thử lại chuẩn hóa AI
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

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
          <div className="flex items-center justify-between mb-3 shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-800 text-base">Kết quả Markdown</h3>

              {/* Badge giai đoạn xử lý */}
              {analysisStage === "fast_extracted" || (analysisStage === "ai_polishing" && outputMarkdown) ? (
                <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                  <Zap className="w-3 h-3 text-amber-500" /> Bản nháp Siêu tốc (Đang AI tinh chỉnh...)
                </span>
              ) : analysisStage === "completed" && conversionMode === "ai" ? (
                <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" /> Đã chuẩn hóa LaTeX
                </span>
              ) : analysisStage === "completed" && conversionMode === "fast" ? (
                <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <Zap className="w-3 h-3 text-indigo-600" /> Bản Siêu tốc (0 AI token)
                </span>
              ) : stageErrorMsg && outputMarkdown ? (
                <span className="text-[11px] bg-rose-50 text-rose-800 border border-rose-200 font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-600" /> Bản Siêu tốc (AI gián đoạn)
                </span>
              ) : null}

              {chunks.length > 0 && (
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                  {completedChunksCount}/{chunks.length} tệp
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

          {/* Queue Monitor Bar (hiện khi có danh sách nhiều tệp) */}
          {chunks.length > 1 && (
            <div className="mb-4 bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shrink-0 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Tiến độ hàng đợi tệp tin:</span>
                  <span className="text-xs font-bold text-indigo-600">{progressPercent}%</span>
                </div>
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
            {isProcessing && chunks.length === 0 && !outputMarkdown ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-9 h-9 animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-slate-600">Đang đọc tài liệu & khởi tạo phân đoạn...</p>
              </div>
            ) : outputMarkdown ? (
              <MemoizedMarkdownContent content={deferredMarkdown} />
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
