import React, { useState } from "react";
import { 
  Folder, 
  Search, 
  Trash2, 
  Download, 
  FileText, 
  Crown, 
  Lock, 
  ArrowRight, 
  Clock, 
  Database,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SavedDocument {
  id: string;
  userId: string;
  title: string;
  type: "word" | "pdf";
  source: "latex" | "qbuilder";
  htmlContent: string;
  wordFont?: string;
  fileSize?: number;
  createdAt: string;
}

interface DocsManagementProps {
  savedDocuments: SavedDocument[];
  onDeleteDoc: (id: string) => Promise<void>;
  onDownloadDoc: (doc: SavedDocument) => void;
  onPrintPdf: (doc: SavedDocument) => void;
  isPro: boolean;
  onNavigate: (view: "latex" | "qbuilder") => void;
}

export const DocsManagement: React.FC<DocsManagementProps> = ({
  savedDocuments,
  onDeleteDoc,
  onDownloadDoc,
  onPrintPdf,
  isPro,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter documents based on search
  const filteredDocs = savedDocuments.filter((doc) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Compute stats
  const totalSize = savedDocuments.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);
  const totalSizeFormatted = 
    totalSize > 1024 * 1024 
      ? `${(totalSize / (1024 * 1024)).toFixed(2)} MB` 
      : `${(totalSize / 1024).toFixed(1)} KB`;

  const wordCount = savedDocuments.filter((d) => d.type === "word").length;
  const pdfCount = savedDocuments.filter((d) => d.type === "pdf").length;

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await onDeleteDoc(id);
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  if (!isPro) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="max-w-3xl mx-auto py-12 px-6 flex flex-col items-center text-center bg-white rounded-2xl border border-slate-200 shadow-sm mt-8"
        id="docs-locked-view"
      >
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100 shadow-inner">
            <Folder className="w-10 h-10 text-indigo-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center border-4 border-white text-white shadow-md">
            <Crown className="w-3.5 h-3.5" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-slate-800 tracking-tight font-sans">
          Quản lý Tài liệu Đám mây (PRO PLAN)
        </h2>
        <p className="text-slate-500 max-w-md mt-2 text-sm font-medium leading-relaxed">
          Đồng bộ hóa, lưu trữ và bảo mật an toàn các tài liệu Word & PDF được tạo ra từ công cụ LaTeX Converter và QBuilder trên đám mây của riêng bạn.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-8 mb-8 text-left">
          <div className="p-4 bg-white/40 rounded-xl border border-slate-200/50 flex flex-col gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-bold text-xs text-slate-800">Truy cập mọi lúc</span>
            <span className="text-[11px] text-slate-500 font-medium">Lưu trữ tập trung và tải lại tài liệu từ bất kỳ máy tính, trình duyệt nào.</span>
          </div>
          <div className="p-4 bg-white/40 rounded-xl border border-slate-200/50 flex flex-col gap-1.5">
            <Database className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-bold text-xs text-slate-800">Tối ưu dung lượng</span>
            <span className="text-[11px] text-slate-500 font-medium">Chỉ lưu khi bạn yêu cầu, không gây nặng máy hoặc mất file khi dọn cache.</span>
          </div>
          <div className="p-4 bg-white/40 rounded-xl border border-slate-200/50 flex flex-col gap-1.5">
            <Crown className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-bold text-xs text-slate-800">Không giới hạn tệp</span>
            <span className="text-[11px] text-slate-500 font-medium">Mở rộng không giới hạn dung lượng lưu trữ tài liệu LaTeX và đề thi trắc nghiệm.</span>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 w-full max-w-md text-left flex items-start gap-3.5 mb-6">
          <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-xs text-indigo-900">Cách thức nâng cấp tài khoản</h4>
            <p className="text-[11px] text-indigo-700/90 font-semibold mt-1 leading-relaxed">
              Vui lòng liên hệ Admin qua email <span className="underline font-extrabold text-indigo-950">giathieu110406@gmail.com</span> với email đăng ký của bạn để được nâng cấp lên thành viên PRO PLAN hoàn toàn miễn phí ngay lập tức!
            </p>
          </div>
        </div>

        <a
          href="mailto:giathieu110406@gmail.com?subject=Yêu cầu nâng cấp tài khoản PRO PLAN - Word2LaTeX"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-6 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs active:scale-95 shrink-0"
        >
          <span>Gửi Email Yêu Cầu Nâng Cấp</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 flex-1 flex flex-col"
      id="docs-pro-view"
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] py-4 px-5 rounded-[28px]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 shadow-sm">
            <Folder className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-extrabold tracking-tight text-slate-800 font-sans flex items-center gap-1.5">
              <span>Quản lý tài liệu đám mây</span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">PRO PLAN</span>
            </h2>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
              Tra cứu, quản lý và khôi phục các tệp Word & PDF của bạn được lưu trữ trên Firestore.
            </p>
          </div>
        </div>

        {/* Storage usage indicator card */}
        <div className="flex items-center gap-4 bg-white/40 border border-slate-200/60 rounded-xl px-4 py-2 shrink-0 md:max-w-xs w-full md:w-auto">
          <Database className="w-4 h-4 text-indigo-500 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              <span>Đã lưu trữ ({savedDocuments.length} tệp)</span>
              <span>{totalSizeFormatted}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (savedDocuments.length / 100) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] flex flex-col flex-1 p-4 md:p-6 min-h-[450px]">
        {/* Search & Statistics Filter Row */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between mb-6">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu, loại tệp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/40 border border-slate-200 rounded-xl h-9 pl-10 pr-4 text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-[11px] font-bold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>{wordCount} file Word</span>
            </div>
            <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-[11px] font-bold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{pdfCount} file PDF</span>
            </div>
          </div>
        </div>

        {/* Documents Grid / Table */}
        <AnimatePresence mode="popLayout">
          {filteredDocs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4"
            >
              <div className="w-14 h-14 bg-white/40 border border-slate-150 rounded-full flex items-center justify-center text-slate-400 mb-4 shadow-2xs">
                <Folder className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-700 text-sm">Không tìm thấy tài liệu nào</h3>
              <p className="text-[11px] text-slate-400 font-semibold max-w-sm mt-1 leading-relaxed">
                {searchTerm 
                  ? "Không có tệp nào trùng khớp với truy vấn của bạn. Vui lòng kiểm tra lại!"
                  : "Bạn chưa lưu trữ tệp nào. Hãy thực hiện chuyển đổi LaTeX hoặc soạn đề thi rồi nhấn nút 'Lưu đám mây' để lưu trữ!"}
              </p>
              {!searchTerm && (
                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={() => onNavigate("latex")}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-4 rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Chuyển đổi LaTeX</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onNavigate("qbuilder")}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs h-8 px-4 rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer border border-slate-200"
                  >
                    <span>Soạn đề thi (AI)</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => {
                const docSize = doc.fileSize
                  ? doc.fileSize > 1024 * 1024
                    ? `${(doc.fileSize / (1024 * 1024)).toFixed(2)} MB`
                    : `${(doc.fileSize / 1024).toFixed(1)} KB`
                  : "Unknown";

                return (
                  <motion.div
                    key={doc.id}
                    layoutId={`doc-card-${doc.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white/50 border border-white/50 hover:border-white rounded-2xl p-4 flex flex-col justify-between hover:shadow-2xs transition-all relative overflow-hidden"
                  >
                    {/* Source Indicator Tag */}
                    <div className="absolute top-0 right-0">
                      <span className={`text-[8px] font-extrabold uppercase px-2 py-1 rounded-bl-xl ${
                        doc.source === "latex"
                          ? "bg-sky-50 text-sky-700 border-l border-b border-sky-100"
                          : "bg-purple-50 text-purple-700 border-l border-b border-purple-100"
                      }`}>
                        {doc.source === "latex" ? "LaTeX Converter" : "QBuilder"}
                      </span>
                    </div>

                    <div className="flex items-start gap-3 mt-1.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
                        doc.type === "word"
                          ? "bg-indigo-50 border-indigo-100 text-indigo-600"
                          : "bg-rose-50 border-rose-100 text-rose-600"
                      }`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0 pr-12">
                        <h4 className="font-bold text-slate-800 text-xs truncate" title={doc.title}>
                          {doc.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mt-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                          <span>•</span>
                          <span>{docSize}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        doc.type === "word"
                          ? "bg-indigo-100/70 text-indigo-700"
                          : "bg-emerald-100/70 text-emerald-700"
                      }`}>
                        {doc.type === "word" ? "Microsoft Word" : "Portable Doc (PDF)"}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {/* Download button */}
                        <button
                          onClick={() => doc.type === "word" ? onDownloadDoc(doc) : onPrintPdf(doc)}
                          className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                            doc.type === "word"
                              ? "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
                              : "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          }`}
                          title={doc.type === "word" ? "Tải xuống Word" : "Xuất file PDF"}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete with Confirmation State */}
                        {deletingId === doc.id ? (
                          <div className="flex items-center gap-1 shrink-0 animate-fade-in bg-rose-50 border border-rose-100 rounded-lg p-0.5">
                            <button
                              disabled={isDeleting}
                              onClick={() => handleDelete(doc.id)}
                              className="px-2 py-1 text-[9px] font-extrabold bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              disabled={isDeleting}
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-1 text-[9px] font-extrabold bg-white text-slate-600 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(doc.id)}
                            className="w-7.5 h-7.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                            title="Xóa tài liệu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
