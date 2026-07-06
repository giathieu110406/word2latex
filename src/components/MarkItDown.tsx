import React, { useState, useRef } from "react";
import { FileUp, Link as LinkIcon, Loader2, Sparkles, Copy, Download, Check, FileType, FileText, Image as ImageIcon, Music, Youtube, Layout } from "lucide-react";
import Markdown from 'react-markdown';
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";

interface MarkItDownProps {
  triggerToast: (msg: string, success?: boolean) => void;
  isPro: boolean;
}

export const MarkItDown: React.FC<MarkItDownProps> = ({ triggerToast, isPro }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputMarkdown, setOutputMarkdown] = useState("");
  const [inputType, setInputType] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [mobileView, setMobileView] = useState<"input" | "output">("input");

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    setMobileView("output");
    triggerToast("Đang phân tích tài liệu bằng AI...", true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      try {
        const res = await fetch("/api/markitdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            type: "file",
            fileData: base64Data, 
            mimeType: file.type,
            fileName: file.name
          }),
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Lỗi máy chủ khi xử lý file");
        }

        const data = await res.json();
        if (data.success && data.markdown) {
          setOutputMarkdown(data.markdown);
          triggerToast("Chuyển đổi thành công!", true);
        } else {
          triggerToast(data.error || "Không thể chuyển đổi tài liệu này", false);
        }
      } catch (err: any) {
        console.error(err);
        triggerToast("Lỗi kết nối đến máy chủ!", false);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const processUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsProcessing(true);
    setMobileView("output");
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
        setOutputMarkdown(data.markdown);
        triggerToast("Chuyển đổi thành công!", true);
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

  const handleCopy = () => {
    navigator.clipboard.writeText(outputMarkdown);
    setIsCopied(true);
    triggerToast("Đã sao chép vào bộ nhớ tạm", true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([outputMarkdown], { type: "text/markdown" });
    const fileUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName ? `${fileName.split('.')[0]}.md` : "document.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(fileUrl);
    triggerToast("Đang tải file xuống...", true);
  };

  if (!isPro) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-6 flex flex-col items-center text-center bg-white rounded-2xl border border-slate-200 shadow-sm mt-8">
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100 shadow-inner">
            <Layout className="w-10 h-10 text-indigo-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center border-4 border-white text-white shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-slate-800 tracking-tight font-sans">
          MarkItDown AI (PRO PLAN)
        </h2>
        <p className="text-slate-500 max-w-md mt-2 text-sm font-medium leading-relaxed">
          Chuyển đổi mọi loại tài liệu (PDF, Word, Excel, PowerPoint, HTML, Audio, Hình ảnh, YouTube) sang định dạng Markdown chuẩn xác bằng trí tuệ nhân tạo.
        </p>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => triggerToast("Vui lòng nâng cấp gói PRO để sử dụng tính năng này", false)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition-colors text-sm"
          >
            Nâng cấp ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] overflow-hidden flex flex-col flex-1 h-full max-h-full">
      <div className="p-6 border-b border-white/50 bg-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layout className="w-5 h-5 text-indigo-600" />
            MarkItDown AI
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Chuyển đổi PDF, Word, Excel, PowerPoint, Audio, Hình ảnh và URL thành Markdown chuẩn xác.
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl self-end sm:self-auto shrink-0">
          <button
            onClick={() => setInputType("file")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${inputType === "file" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Tệp tin
          </button>
          <button
            onClick={() => setInputType("url")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${inputType === "url" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            URL
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex bg-slate-100 p-1 rounded-xl mx-6 mt-4 mb-2 shrink-0 select-none">
        <button
          type="button"
          onClick={() => setMobileView("input")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
            mobileView === "input"
              ? "bg-white text-indigo-700 shadow-3xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Nhập liệu & Tải tệp
        </button>
        <button
          type="button"
          onClick={() => setMobileView("output")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
            mobileView === "output"
              ? "bg-white text-indigo-700 shadow-3xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Kết quả Markdown
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        {/* Input Section */}
        <div className={`w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50 p-6 flex flex-col gap-6 overflow-y-auto ${mobileView === "input" ? "flex" : "hidden md:flex"}`}>
          {inputType === "file" ? (
            <div className="flex flex-col gap-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 bg-white/60 hover:bg-indigo-50/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                  <FileUp className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="font-semibold text-slate-700 text-sm">Nhấn để tải lên</p>
                <p className="text-xs text-slate-500 mt-1">Hỗ trợ PDF, DOCX, XLSX, PPTX, JPG, PNG, MP3...</p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processFile(file);
                  }}
                />
              </div>

              {fileName && (
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 truncate text-sm font-medium text-slate-700">
                    {fileName}
                  </div>
                  {isProcessing && <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />}
                </div>
              )}

              <div className="mt-4">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Định dạng hỗ trợ</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm"><FileType className="w-3.5 h-3.5 text-red-500"/> PDF</div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm"><FileType className="w-3.5 h-3.5 text-blue-500"/> Word</div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm"><FileType className="w-3.5 h-3.5 text-green-600"/> Excel</div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm"><FileType className="w-3.5 h-3.5 text-orange-500"/> Powerpoint</div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm"><ImageIcon className="w-3.5 h-3.5 text-purple-500"/> Hình ảnh</div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm"><Music className="w-3.5 h-3.5 text-pink-500"/> Audio</div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={processUrl} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">URL / Youtube Link</label>
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
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</> : <><Sparkles className="w-4 h-4" /> Chuyển đổi URL</>}
              </button>

              <div className="mt-4">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Hỗ trợ</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm"><FileType className="w-3.5 h-3.5 text-blue-500"/> Bài viết HTML / Blog</div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm"><Youtube className="w-3.5 h-3.5 text-red-500"/> Youtube Video Transcript</div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Output Section */}
        <div className={`w-full md:w-2/3 p-6 flex flex-col bg-white overflow-hidden min-h-0 relative ${mobileView === "output" ? "flex" : "hidden md:flex"}`}>
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="font-semibold text-slate-800">Kết quả Markdown</h3>
            {outputMarkdown && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? "Đã sao chép" : "Sao chép"}
                </button>
                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải .md
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 overflow-y-auto p-5 custom-scrollbar">
            {isProcessing ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm">Hệ thống AI đang phân tích dữ liệu đa phương tiện...</p>
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
                <Sparkles className="w-10 h-10 opacity-20" />
                <p className="text-sm">Kết quả sẽ hiển thị tại đây</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
