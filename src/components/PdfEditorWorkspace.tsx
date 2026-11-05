import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  LayoutGrid,
  Plus,
  RotateCw,
  RotateCcw,
  Copy,
  Trash2,
  ZoomIn,
  ChevronDown,
  Upload,
  Check,
  ArrowRight,
  ArrowUpAZ,
  ArrowDownZA,
  List,
  Grid,
  Stamp,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Scissors,
  Download,
  Loader2,
  Settings2,
  Image as ImageIcon,
  Type as TypeIcon,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  usePdfEditorStore,
  getBadgeColor,
  type PdfSourceFile,
  type VirtualPage,
  type FileSegment,
} from '../store/usePdfEditorStore';
import {
  parsePdfBufferMetadata,
  convertImageFileToPdfBuffer,
  exportEditedPdf,
} from '../utils/pdf-service';
import { renderPdfPageThumbnail } from '../utils/pdf-thumbnail';
import {
  isWordFile,
  isPowerPointFile,
  convertWordToPdfBuffer,
  convertPowerPointToPdfBuffer,
} from '../utils/office-to-pdf';

export interface PdfEditorWorkspaceProps {
  triggerToast?: (msg: string, success?: boolean) => void;
}

// ============================================================================
// SORTABLE FILE CARD (Chế độ "Các file" - Giống hình 4)
// ============================================================================
interface SortableFileCardProps {
  segment: FileSegment;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onSwitchToPages: () => void;
}

const SortableFileCard: React.FC<SortableFileCardProps> = ({
  segment,
  isSelected,
  onToggleSelect,
  onRemove,
  onSwitchToPages,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: segment.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : 1,
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col items-center p-3 rounded-xl transition-all select-none ${
        isSelected
          ? 'bg-blue-50/90 ring-2 ring-blue-500 shadow-sm'
          : 'hover:bg-blue-50/50'
      }`}
    >
      {/* Top Bar: Checkbox + Quick Actions on Hover */}
      <div className="w-full flex items-center justify-between mb-2 z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          title="Chọn"
          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
            isSelected
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-slate-300 hover:border-blue-500'
          }`}
        >
          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/95 border border-slate-200 rounded-lg px-1.5 py-1 shadow-xs">
          <button
            type="button"
            disabled={segment.status === 'converting'}
            onClick={(e) => {
              e.stopPropagation();
              onSwitchToPages();
            }}
            title="Xem các trang"
            className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:pointer-events-none rounded cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Xóa tệp"
            className="p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stacked Document Thumbnail Container */}
      <div
        {...attributes}
        {...listeners}
        className="relative w-44 h-56 cursor-grab active:cursor-grabbing flex items-center justify-center"
      >
        {/* Stacked paper effect behind */}
        {segment.totalPages > 1 && !segment.isBlank && (
          <>
            <div className="absolute -top-1.5 left-2 right-0 bottom-1.5 bg-white border border-slate-200 rounded shadow-2xs pointer-events-none" />
            <div className="absolute -top-0.5 left-1 right-0.5 bottom-0.5 bg-white border border-slate-200 rounded shadow-2xs pointer-events-none" />
          </>
        )}
        <div className="relative w-full h-full bg-white border border-slate-200/90 rounded shadow-sm overflow-hidden flex items-center justify-center p-2">
          {segment.status === 'converting' ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-3.5 text-center bg-blue-50/50">
              <div className="w-11 h-11 rounded-2xl bg-white border border-blue-200/80 shadow-xs flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-blue-600 stroke-[1.8]" />
              </div>
              <div className="w-full bg-slate-200/90 rounded-full h-2 mb-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${segment.conversionProgress || 5}%` }}
                />
              </div>
              <span className="text-sm font-extrabold text-blue-700 tracking-tight">
                {segment.conversionProgress || 5}%
              </span>
              <span className="text-[11px] text-slate-500 font-medium mt-0.5">
                Đang chuyển đổi...
              </span>
            </div>
          ) : segment.status === 'error' ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-red-50/50">
              <X className="w-8 h-8 text-red-500 mb-1" />
              <span className="text-xs font-semibold text-red-600">Lỗi chuyển đổi</span>
              <span className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                {segment.errorMessage || 'Không thể đọc tệp'}
              </span>
            </div>
          ) : segment.isBlank ? (
            <div className="w-full h-full border border-dashed border-slate-200 rounded flex flex-col items-center justify-center text-slate-400 gap-1">
              <span className="text-xs font-medium">Trang trống</span>
            </div>
          ) : segment.coverThumbnailUrl ? (
            <img
              src={segment.coverThumbnailUrl}
              alt={segment.name}
              className="max-w-full max-h-full object-contain pointer-events-none"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
              <FileText className="w-10 h-10 stroke-1" />
              <span className="text-[11px]">PDF</span>
            </div>
          )}
        </div>
      </div>

      {/* File Badge & Page Count */}
      <div className="mt-3 flex flex-col items-center gap-1 max-w-[180px]">
        <span
          title={segment.name}
          style={{ backgroundColor: segment.colorBadge || '#FEE2E2' }}
          className="px-2.5 py-0.5 rounded text-xs font-semibold text-slate-800 truncate max-w-full"
        >
          {segment.name}
        </span>
        <span className="text-xs text-slate-500 font-medium">
          {segment.status === 'converting'
            ? `Đang xử lý (${segment.conversionProgress || 5}%)`
            : `${segment.totalPages} trang`}
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// SORTABLE PAGE CARD (Chế độ "Trang" - Giống hình 3)
// ============================================================================
interface SortablePageCardProps {
  page: VirtualPage;
  pageNumber: number;
  sourceFile?: PdfSourceFile;
  isSelected: boolean;
  watermark?: import('../store/usePdfEditorStore').WatermarkConfig;
  onToggleSelect: () => void;
  onPreview: () => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const SortablePageCard: React.FC<SortablePageCardProps> = ({
  page,
  pageNumber,
  sourceFile,
  isSelected,
  watermark,
  onToggleSelect,
  onPreview,
  onRotate,
  onDuplicate,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : 1,
    opacity: isDragging ? 0.75 : 1,
  };

  const fileLabel = page.isBlank
    ? 'Trang trống'
    : sourceFile?.name || 'Tài liệu.pdf';
  const badgeColor = page.isBlank
    ? '#E2E8F0'
    : sourceFile?.colorBadge || '#FEE2E2';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col items-center p-3 rounded-xl transition-all select-none ${
        isSelected
          ? 'bg-blue-100/80 ring-2 ring-blue-500 shadow-xs'
          : 'hover:bg-blue-50/70'
      }`}
    >
      {/* Top Overlay Action Bar: Checkbox Left + 4 Action Buttons Right */}
      <div className="w-full flex items-center justify-between mb-2 z-10 min-h-[30px]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          title="Chọn"
          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
            isSelected
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-slate-300 hover:border-blue-500'
          }`}
        >
          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        {/* 4 Action Icons (Xem trước, Xoay, Nhân đôi, Xóa) */}
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center bg-white border border-slate-200/90 rounded-lg shadow-xs overflow-hidden divide-x divide-slate-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            title="Xem trước"
            className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRotate();
            }}
            title="Xoay"
            className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title="Nhân đôi"
            className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Xóa"
            className="p-1.5 text-slate-700 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Page Thumbnail Box */}
      <div
        {...attributes}
        {...listeners}
        className="relative w-44 h-56 bg-white border border-slate-200/90 rounded shadow-xs flex items-center justify-center p-2 cursor-grab active:cursor-grabbing overflow-hidden"
      >
        {sourceFile?.status === 'converting' ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-3.5 text-center bg-blue-50/50">
            <div className="w-11 h-11 rounded-2xl bg-white border border-blue-200/80 shadow-xs flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-blue-600 stroke-[1.8]" />
            </div>
            <div className="w-full bg-slate-200/90 rounded-full h-2 mb-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${sourceFile.conversionProgress || 5}%` }}
              />
            </div>
            <span className="text-sm font-extrabold text-blue-700 tracking-tight">
              {sourceFile.conversionProgress || 5}%
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5">
              Đang chuyển đổi tệp...
            </span>
          </div>
        ) : page.isBlank ? (
          <div className="w-full h-full border border-dashed border-slate-200 rounded flex flex-col items-center justify-center text-slate-400 gap-1">
            <span className="text-xs font-medium">Trang trống</span>
          </div>
        ) : page.thumbnailUrl ? (
          <img
            src={page.thumbnailUrl}
            alt={`Trang ${pageNumber}`}
            style={{
              transform: `rotate(${page.rotation}deg)`,
              transition: 'transform 0.2s ease',
            }}
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500 [will-change:transform] [transform:translateZ(0)]" />
            <span className="text-[11px]">Đang dựng trang...</span>
          </div>
        )}

        {/* Live Watermark Overlay trên từng trang */}
        {watermark?.enabled && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none p-2 z-10">
            {watermark.type === 'image' && watermark.imageDataUrl ? (
              <img
                src={watermark.imageDataUrl}
                alt="Watermark"
                style={{
                  maxWidth: `${watermark.imageScale || 40}%`,
                  maxHeight: `${watermark.imageScale || 40}%`,
                  opacity: watermark.opacity ?? 0.25,
                  transform: watermark.diagonal ? 'rotate(-35deg)' : 'none',
                  objectFit: 'contain',
                }}
              />
            ) : watermark.text?.trim() ? (
              <span
                style={{
                  transform: watermark.diagonal ? 'rotate(-35deg)' : 'none',
                  color: watermark.color || '#EF4444',
                  opacity: watermark.opacity ?? 0.25,
                  fontSize: `${Math.max(10, Math.round((watermark.fontSize || 42) * 0.35))}px`,
                  fontWeight: 700,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  wordBreak: 'break-word',
                }}
              >
                {watermark.text}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Bottom File Name Pill & Page Number */}
      <div className="mt-2.5 flex flex-col items-center gap-0.5 max-w-[175px]">
        <span
          title={fileLabel}
          style={{ backgroundColor: badgeColor }}
          className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800 truncate max-w-full"
        >
          {fileLabel}
        </span>
        <span className="text-xs font-semibold text-slate-500">
          {pageNumber}
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// INTERSTITIAL PLUS BUTTON (+) GIỮA CÁC TRANG / FILE
// ============================================================================
interface InterstitialAddButtonProps {
  onInsertFiles: () => void;
  onInsertBlankPage: () => void;
}

const InterstitialAddButton: React.FC<InterstitialAddButtonProps> = ({
  onInsertFiles,
  onInsertBlankPage,
}) => {
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  return (
    <div ref={menuRef} className="relative flex items-center justify-center self-center mx-0.5 z-20">
      <button
        type="button"
        onClick={() => setOpenMenu((v) => !v)}
        title="Thêm tài liệu hoặc trang trống"
        className="w-7 h-7 rounded-full bg-blue-400 hover:bg-blue-600 text-white flex items-center justify-center shadow-xs hover:scale-110 transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
      </button>

      {openMenu && (
        <div className="absolute top-9 left-1/2 -translate-x-1/2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 text-xs font-medium text-slate-700">
          <button
            type="button"
            onClick={() => {
              setOpenMenu(false);
              onInsertFiles();
            }}
            className="w-full px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Chèn tệp PDF / Ảnh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenMenu(false);
              onInsertBlankPage();
            }}
            className="w-full px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Chèn trang trống</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN PDF EDITOR WORKSPACE COMPONENT
// ============================================================================
export const PdfEditorWorkspace: React.FC<PdfEditorWorkspaceProps> = ({
  triggerToast,
}) => {
  const {
    files,
    pages,
    activeTab,
    getFileSegments,
    reorderFileSegments,
    removeFileSegment,
    selectedFileIds,
    selectedPageIds,
    previewPageId,
    watermark,
    flattenOnExport,
    gridColumns,
    setActiveTab,
    setGridColumns,
    addFiles,
    initConvertingFiles,
    updateFileProgress,
    completeFileConversion,
    setFileConversionError,
    removeFile,
    reorderFiles,
    sortFilesByName,
    insertBlankDocumentAtFileIndex,
    reorderPages,
    rotatePage,
    duplicatePage,
    deletePage,
    insertBlankPage,
    updatePageThumbnail,
    updateFileCoverThumbnail,
    toggleSelectFile,
    selectAllFiles,
    rotateSelectedFiles,
    deleteSelectedFiles,
    toggleSelectPage,
    selectAllPages,
    rotateSelectedPages,
    deleteSelectedPages,
    batchDeletePages,
    keepOnlyPages,
    setPreviewPageId,
    setWatermark,
    setFlattenOnExport,
  } = usePdfEditorStore();

  const [topAddDropdownOpen, setTopAddDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [watermarkModalOpen, setWatermarkModalOpen] = useState(false);
  const [flattenModalOpen, setFlattenModalOpen] = useState(false);
  const [watermarkTab, setWatermarkTab] = useState<'text' | 'image'>(watermark.type || 'text');
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitModalSelectedIds, setSplitModalSelectedIds] = useState<string[]>([]);
  const [splitRangeInput, setSplitRangeInput] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [previewHighResUrl, setPreviewHighResUrl] = useState<string>('');
  const [insertTarget, setInsertTarget] = useState<{
    fileIndex?: number;
    pageIndex?: number;
  } | null>(null);

  // Biến kiểm tra có tệp nào đang trong quá trình chuyển đổi hay không
  const isAnyFileConverting = files.some((f) => f.status === 'converting');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const watermarkImageInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const notify = (msg: string, ok = true) => {
    if (triggerToast) triggerToast(msg, ok);
  };

  // Đồng bộ danh sách trang chọn trong modal Cắt PDF khi mở
  useEffect(() => {
    if (splitModalOpen) {
      if (activeTab === 'pages' && selectedPageIds.length > 0) {
        setSplitModalSelectedIds([...selectedPageIds]);
      } else {
        setSplitModalSelectedIds(pages.map((p) => p.id));
      }
    }
  }, [splitModalOpen]);

  // Tự động khóa cứng về tab 'files' khi có bất kỳ file nào đang converting
  useEffect(() => {
    if (isAnyFileConverting && activeTab !== 'files') {
      setActiveTab('files');
    }
  }, [isAnyFileConverting, activeTab, setActiveTab]);

  // Render thumbnails lazily:
  // 1. Khi vẫn còn file đang converting: TUYỆT ĐỐI KHÔNG chạy bất kỳ tác vụ sinh thumbnail nào của tab Trang
  // 2. Chỉ sinh thumbnail các trang KHI người dùng thực sự mở tab 'pages' hoặc mở modal Cắt PDF (VÀ toàn bộ file đã convert xong)
  useEffect(() => {
    if (isAnyFileConverting) return;

    let cancelled = false;
    async function generateMissingThumbnails() {
      // Ưu tiên 1: Ảnh bìa (cover) cho các thẻ ở tab 'Các file'
      for (const file of files) {
        if (cancelled) return;
        if (file.status === 'converting') continue;
        if (!file.coverThumbnailUrl && file.rawData.byteLength > 0) {
          const url = await renderPdfPageThumbnail(file.rawData, 0, 320);
          if (!cancelled && url) {
            updateFileCoverThumbnail(file.id, url);
          }
        }
      }

      // Ưu tiên 2: Chỉ dựng ảnh từng trang khi đang ở tab 'pages' hoặc mở modal Cắt PDF
      if (activeTab !== 'pages' && !splitModalOpen) {
        return;
      }

      for (const page of pages) {
        if (cancelled) return;
        if (page.id.startsWith('page_ph_')) continue;
        if (!page.isBlank && !page.thumbnailUrl) {
          const srcFile = files.find((f) => f.id === page.sourceFileId);
          if (!srcFile || srcFile.status === 'converting' || srcFile.rawData.byteLength === 0) {
            continue;
          }
          // Tái sử dụng ngay ảnh bìa trang 1 nếu đã có sẵn để tiết kiệm 1 lần render PDF.js
          if (page.originalPageIndex === 0 && srcFile.coverThumbnailUrl) {
            updatePageThumbnail(page.id, srcFile.coverThumbnailUrl);
            continue;
          }
          const url = await renderPdfPageThumbnail(
            srcFile.rawData,
            page.originalPageIndex,
            320
          );
          if (!cancelled && url) {
            updatePageThumbnail(page.id, url);
          }
        }
      }
    }
    generateMissingThumbnails();
    return () => {
      cancelled = true;
    };
  }, [
    files,
    pages,
    activeTab,
    splitModalOpen,
    isAnyFileConverting,
    updateFileCoverThumbnail,
    updatePageThumbnail,
  ]);

  // High-res preview render when previewPageId changes
  useEffect(() => {
    let cancelled = false;
    async function loadHighResPreview() {
      if (!previewPageId) {
        setPreviewHighResUrl('');
        return;
      }
      const page = pages.find((p) => p.id === previewPageId);
      if (!page || page.isBlank) {
        setPreviewHighResUrl('');
        return;
      }
      const srcFile = files.find((f) => f.id === page.sourceFileId);
      if (!srcFile || srcFile.rawData.byteLength === 0) return;
      const highRes = await renderPdfPageThumbnail(
        srcFile.rawData,
        page.originalPageIndex,
        780
      );
      if (!cancelled) {
        setPreviewHighResUrl(highRes || page.thumbnailUrl || '');
      }
    }
    loadHighResPreview();
    return () => {
      cancelled = true;
    };
  }, [previewPageId, pages, files]);

  // Process uploaded files with Optimistic UI & Concurrency Limit
  const handleProcessFiles = async (
    fileList: FileList | File[],
    target?: { fileIndex?: number; pageIndex?: number } | null
  ) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;

    // 1. Tạo danh sách placeholder files để đưa ngay vào Workspace
    let colorIdx = files.length;
    const placeholders: { file: File; placeholder: PdfSourceFile }[] = arr.map((f) => {
      const pId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return {
        file: f,
        placeholder: {
          id: pId,
          name: f.name,
          size: f.size,
          rawData: new ArrayBuffer(0),
          totalPages: 1, // Tạm thời để 1 trang cho placeholder
          colorBadge: getBadgeColor(colorIdx++),
          status: 'converting',
          conversionProgress: 5,
        },
      };
    });

    // Cập nhật ngay vào Zustand Store để giao diện chuyển tức thì sang Workspace "Các file"
    initConvertingFiles(placeholders.map((p) => p.placeholder));
    setInsertTarget(null);

    // 2. Chuyển đổi và nạp file với Concurrent Pool nâng lên 4 file cùng lúc (tăng tốc độ gấp đôi)
    const CONCURRENCY_LIMIT = 4;
    let index = 0;

    const worker = async () => {
      while (index < placeholders.length) {
        const currentItem = placeholders[index++];
        if (!currentItem) break;

        const { file: f, placeholder } = currentItem;
        try {
          updateFileProgress(placeholder.id, 10);
          const lower = f.name.toLowerCase();
          let buffer: ArrayBuffer;

          if (
            f.type.startsWith('image/') ||
            lower.endsWith('.png') ||
            lower.endsWith('.jpg') ||
            lower.endsWith('.jpeg')
          ) {
            updateFileProgress(placeholder.id, 30);
            buffer = await convertImageFileToPdfBuffer(f);
            updateFileProgress(placeholder.id, 80);
          } else if (isWordFile(f.name, f.type)) {
            buffer = await convertWordToPdfBuffer(f, f.name, (pct) => {
              updateFileProgress(placeholder.id, pct);
            });
          } else if (isPowerPointFile(f.name, f.type)) {
            buffer = await convertPowerPointToPdfBuffer(f, f.name, (pct) => {
              updateFileProgress(placeholder.id, pct);
            });
          } else {
            // PDF thông thường
            updateFileProgress(placeholder.id, 40);
            buffer = await f.arrayBuffer();
            updateFileProgress(placeholder.id, 85);
          }

          const meta = await parsePdfBufferMetadata(buffer);
          updateFileProgress(placeholder.id, 100);

          completeFileConversion(placeholder.id, {
            rawData: buffer,
            totalPages: meta.totalPages,
          });

          // Tự động sinh ngay ảnh Thumbnail trang đầu tiên chất lượng cao (320px) để hiện ảnh thật ngay lập tức
          try {
            const coverUrl = await renderPdfPageThumbnail(buffer, 0, 320);
            if (coverUrl) {
              updateFileCoverThumbnail(placeholder.id, coverUrl);
            }
          } catch (thumbErr) {
            console.warn('Lỗi sinh ảnh bìa trang 1 cho tệp:', f.name, thumbErr);
          }
        } catch (err: any) {
          console.error('Error loading file:', f.name, err);
          setFileConversionError(placeholder.id, err?.message || 'Lỗi xử lý tệp');
          notify(
            `Không thể đọc tệp "${f.name}". Vui lòng kiểm tra định dạng PDF, Word, PowerPoint hoặc Ảnh.`,
            false
          );
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY_LIMIT, placeholders.length) },
      () => worker()
    );
    await Promise.all(workers);
    notify(`Đã xử lý xong ${placeholders.length} tệp!`);
  };

  const triggerDeviceFilePicker = (target?: {
    fileIndex?: number;
    pageIndex?: number;
  }) => {
    setInsertTarget(target || null);
    setTopAddDropdownOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDragEndFiles = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderFileSegments(String(active.id), String(over.id));
    }
  };

  const handleDragEndPages = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderPages(String(active.id), String(over.id));
    }
  };

  // Helper phân tích chuỗi khoảng trang "1-3, 5, 8-10"
  const parsePageIndicesFromInput = (input: string): Set<number> => {
    const indices = new Set<number>();
    const parts = input.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const s = parseInt(startStr, 10);
        const e = parseInt(endStr, 10);
        if (Number.isFinite(s) && Number.isFinite(e)) {
          for (let k = Math.min(s, e); k <= Math.max(s, e); k++) {
            if (k >= 1 && k <= pages.length) indices.add(k - 1);
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (Number.isFinite(num) && num >= 1 && num <= pages.length) {
          indices.add(num - 1);
        }
      }
    }
    return indices;
  };

  // 1. Chỉ giữ lại khoảng trang nhập vào
  const handleSplitKeepRange = () => {
    const indices = parsePageIndicesFromInput(splitRangeInput);
    if (indices.size === 0) {
      notify('Vui lòng nhập khoảng trang hợp lệ (Ví dụ: 1-3, 5)', false);
      return;
    }
    const idsToKeep = pages.filter((_, idx) => indices.has(idx)).map((p) => p.id);
    keepOnlyPages(idsToKeep);
    setSplitModalOpen(false);
    setSplitRangeInput('');
    notify(`Đã giữ lại ${idsToKeep.length} trang, đã cắt bỏ các trang khác!`);
  };

  // 2. Cắt bỏ khoảng trang nhập vào
  const handleSplitRemoveRange = () => {
    const indices = parsePageIndicesFromInput(splitRangeInput);
    if (indices.size === 0) {
      notify('Vui lòng nhập khoảng trang hợp lệ (Ví dụ: 1-3, 5)', false);
      return;
    }
    const idsToRemove = pages.filter((_, idx) => indices.has(idx)).map((p) => p.id);
    batchDeletePages(idsToRemove);
    setSplitModalOpen(false);
    setSplitRangeInput('');
    notify(`Đã cắt bỏ ${idsToRemove.length} trang được chọn!`);
  };

  // 3. Tách & Tải ngay file PDF từ danh sách trang chỉ định
  const handleSplitDownloadDirect = async (targetPages: VirtualPage[]) => {
    if (targetPages.length === 0) {
      notify('Không có trang nào để xuất!', false);
      return;
    }
    setSplitModalOpen(false);
    setIsExporting(true);
    setExportProgress(10);
    try {
      const pdfBytes = await exportEditedPdf({
        files,
        pages: targetPages,
        watermark,
        flatten: flattenOnExport,
        onProgress: (p) => setExportProgress(p),
      });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cat_PDF_${targetPages.length}_trang_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(`Đã tách và tải ${targetPages.length} trang PDF thành công!`);
    } catch (err: any) {
      console.error('Error split download:', err);
      notify(err?.message || 'Lỗi khi tách và tải PDF', false);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // 4. Làm phẳng & Tải về ngay lập tức
  const handleFlattenAndDownload = async () => {
    if (pages.length === 0) {
      notify('Không có trang nào để làm phẳng!', false);
      return;
    }
    setIsExporting(true);
    setExportProgress(15);
    try {
      const pdfBytes = await exportEditedPdf({
        files,
        pages,
        watermark,
        flatten: true,
        onProgress: (p) => setExportProgress(p),
      });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = files[0]?.name?.replace(/\.pdf$/i, '') || 'tai-lieu';
      a.href = url;
      a.download = `${baseName}-da-lam-phang.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFlattenModalOpen(false);
      notify('Làm phẳng và tải về tệp PDF thành công!');
    } catch (err: any) {
      console.error('Flatten download error:', err);
      notify(err?.message || 'Có lỗi xảy ra khi làm phẳng PDF', false);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // 5. Làm phẳng & Cập nhật trực tiếp vào Workspace
  const handleFlattenAndApplyToWorkspace = async () => {
    if (pages.length === 0) {
      notify('Không có trang nào để làm phẳng!', false);
      return;
    }
    setIsExporting(true);
    setExportProgress(15);
    try {
      const pdfBytes = await exportEditedPdf({
        files,
        pages,
        watermark,
        flatten: true,
        onProgress: (p) => setExportProgress(p),
      });

      const meta = await parsePdfBufferMetadata(pdfBytes.buffer as ArrayBuffer);
      const flattenedFileId = `file_flat_${Date.now()}`;
      const baseName = (files[0]?.name?.replace(/\.pdf$/i, '') || 'tai-lieu') + '-flattened';
      const newFile: PdfSourceFile = {
        id: flattenedFileId,
        name: `${baseName}.pdf`,
        size: pdfBytes.byteLength,
        rawData: pdfBytes.buffer as ArrayBuffer,
        totalPages: meta.totalPages,
        colorBadge: '#0D9488',
      };

      usePdfEditorStore.setState({
        files: [newFile],
        pages: Array.from({ length: meta.totalPages }, (_, idx) => ({
          id: `page_${flattenedFileId}_${idx}`,
          sourceFileId: flattenedFileId,
          originalPageIndex: idx,
          rotation: 0,
          isBlank: false,
        })),
        selectedFileIds: [],
        selectedPageIds: [],
        previewPageId: null,
        flattenOnExport: true,
      });
      setFlattenModalOpen(false);
      notify('Đã làm phẳng và cập nhật toàn bộ tài liệu tĩnh vào không gian làm việc!');
    } catch (err: any) {
      console.error('Flatten apply workspace error:', err);
      notify(err?.message || 'Có lỗi khi làm phẳng tài liệu', false);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // Export final PDF
  const handleExportPdf = async () => {
    if (pages.length === 0) {
      notify('Chưa có trang PDF nào để xuất!', false);
      return;
    }
    setIsExporting(true);
    setExportProgress(10);
    try {
      const pdfBytes = await exportEditedPdf({
        files,
        pages,
        watermark,
        flatten: flattenOnExport,
        onProgress: (p) => setExportProgress(p),
      });

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = files[0]?.name?.replace(/\.pdf$/i, '') || 'tai-lieu';
      a.href = url;
      a.download = `${baseName}-edited.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('Xuất tệp PDF hoàn chỉnh thành công!');
    } catch (err) {
      console.error('Export PDF error:', err);
      notify('Có lỗi xảy ra khi xuất tệp PDF.', false);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const allFilesSelected =
    files.length > 0 && selectedFileIds.length === files.length;
  const allPagesSelected =
    pages.length > 0 && selectedPageIds.length === pages.length;

  const previewIndex = previewPageId
    ? pages.findIndex((p) => p.id === previewPageId)
    : -1;
  const currentPreviewPage = previewIndex >= 0 ? pages[previewIndex] : null;

  return (
    <div className="w-full h-full flex flex-col bg-[#F5F7FA] rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden select-none">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf,image/png,image/jpeg,.jpg,.jpeg,.png,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleProcessFiles(e.target.files, insertTarget);
          }
        }}
      />

      {/* ====================================================================
          STATE 1: UPLOAD LANDING SCREEN (Khi chưa có tệp nào - Giống Hình 2)
      ==================================================================== */}
      {pages.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleProcessFiles(e.dataTransfer.files);
            }
          }}
          className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto bg-white"
        >
          <div className="max-w-4xl w-full flex flex-col items-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-6 tracking-tight text-center">
              Ghép & Biên tập file PDF
            </h1>

            {/* Purple Dropzone Box exactly like Screenshot 2 */}
            <div className="w-full bg-[#7961F2] rounded-xl p-3 sm:p-4 shadow-lg">
              <div className="w-full border-2 border-dashed border-white/40 rounded-lg py-14 sm:py-16 px-4 flex flex-col items-center justify-center relative">
                {/* Illustrated Stacked PDF Icon */}
                <div className="mb-5 text-white/90">
                  <svg
                    className="w-16 h-16"
                    viewBox="0 0 64 64"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="10"
                      y="12"
                      width="26"
                      height="34"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="rgba(255,255,255,0.1)"
                    />
                    <rect
                      x="28"
                      y="10"
                      width="26"
                      height="34"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="rgba(255,255,255,0.15)"
                    />
                    <rect
                      x="19"
                      y="20"
                      width="26"
                      height="34"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="#7961F2"
                    />
                    <text
                      x="25"
                      y="41"
                      fill="currentColor"
                      fontSize="8"
                      fontWeight="bold"
                    >
                      PDF
                    </text>
                  </svg>
                </div>

                {/* Single Direct Button: CHỌN CÁC TỆP TỪ THƯ MỤC */}
                <button
                  type="button"
                  onClick={() => triggerDeviceFilePicker()}
                  className="px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2.5 transition-all shadow-md hover:shadow-lg cursor-pointer transform active:scale-95"
                >
                  <FilePlus2 className="w-4 h-4 text-slate-800" />
                  <span>CHỌN CÁC TỆP TỪ THƯ MỤC</span>
                </button>

                <p className="mt-3 text-white/90 text-xs sm:text-sm font-medium">
                  hoặc kéo thả các tệp PDF, Word, PowerPoint, Ảnh ở đây
                </p>
              </div>
            </div>

            {/* Feature Highlights below Upload Box (Giống Hình 1 & Hình 2) */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 text-sm text-slate-600">
              <p className="leading-relaxed">
                Gộp các tệp PDF, Word, PowerPoint, ảnh, cắt trang, xoay chiều, sắp xếp thứ tự, đóng dấu
                Watermark và làm phẳng PDF trực tiếp trên trình duyệt với độ bảo
                mật tuyệt đối.
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                  <span>Gộp, cắt, xoay và sắp xếp trang PDF trong vài giây</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                  <span>
                    Xử lý 100% Client-side trên trình duyệt, an toàn dữ liệu tuyệt đối
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                  <span>
                    Hỗ trợ tải tệp từ Thiết bị (PDF, Word, PowerPoint, Ảnh), kèm Watermark và Làm phẳng PDF
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ====================================================================
            STATE 2: WORKSPACE EDITOR (Chế độ "Các file" & "Trang" - Hình 3 & 4)
        ==================================================================== */
        <>
          {/* TOP TOOLBAR */}
          <div className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0 z-30">
            <div className="flex flex-wrap items-center gap-2">
              {/* Segmented Switcher: Các file | Trang */}
              <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'files'
                      ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Các file</span>
                </button>
                <button
                  type="button"
                  disabled={isAnyFileConverting}
                  onClick={() => !isAnyFileConverting && setActiveTab('pages')}
                  title={isAnyFileConverting ? 'Đang chuyển đổi tệp, vui lòng chờ...' : 'Chuyển sang chế độ xem từng trang'}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all ${
                    isAnyFileConverting
                      ? 'opacity-40 cursor-not-allowed text-slate-400'
                      : activeTab === 'pages'
                      ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs cursor-pointer'
                      : 'text-slate-700 hover:text-slate-900 cursor-pointer'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Trang</span>
                  {isAnyFileConverting && (
                    <span className="text-[10px] ml-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 font-medium rounded-full">
                      Đang xử lý
                    </span>
                  )}
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 mx-0.5 hidden sm:block" />

              {/* "+ Thêm v" Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTopAddDropdownOpen((v) => !v)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {topAddDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 text-xs font-medium text-slate-700">
                    <button
                      type="button"
                      onClick={() => triggerDeviceFilePicker()}
                      className="w-full px-3.5 py-2 text-left hover:bg-blue-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span>Tải tệp từ thư mục</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTopAddDropdownOpen(false);
                        if (activeTab === 'files') {
                          insertBlankDocumentAtFileIndex();
                        } else {
                          insertBlankPage();
                        }
                        notify('Đã thêm trang trống!');
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-blue-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <FilePlus2 className="w-4 h-4 text-indigo-600" />
                      <span>Thêm trang trống</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Bulk Rotate & Delete Toolbar */}
              <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white divide-x divide-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    activeTab === 'files'
                      ? rotateSelectedFiles(-90)
                      : rotateSelectedPages(-90)
                  }
                  disabled={
                    activeTab === 'files'
                      ? selectedFileIds.length === 0
                      : selectedPageIds.length === 0
                  }
                  title="Xoay trái các mục đã chọn"
                  className="p-2 text-slate-600 hover:text-blue-600 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    activeTab === 'files'
                      ? rotateSelectedFiles(90)
                      : rotateSelectedPages(90)
                  }
                  disabled={
                    activeTab === 'files'
                      ? selectedFileIds.length === 0
                      : selectedPageIds.length === 0
                  }
                  title="Xoay phải các mục đã chọn"
                  className="p-2 text-slate-600 hover:text-blue-600 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    activeTab === 'files'
                      ? deleteSelectedFiles()
                      : deleteSelectedPages()
                  }
                  disabled={
                    activeTab === 'files'
                      ? selectedFileIds.length === 0
                      : selectedPageIds.length === 0
                  }
                  title="Xóa các mục đã chọn"
                  className="p-2 text-slate-600 hover:text-red-600 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 mx-0.5 hidden md:block" />

              {/* Extra Tools: Cắt PDF, Watermark, Làm phẳng */}
              <button
                type="button"
                disabled={isAnyFileConverting}
                onClick={() => !isAnyFileConverting && setSplitModalOpen(true)}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                title="Cắt / Trích xuất khoảng trang PDF"
              >
                <Scissors className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">Cắt PDF</span>
              </button>

              <button
                type="button"
                disabled={isAnyFileConverting}
                onClick={() => !isAnyFileConverting && setWatermarkModalOpen(true)}
                className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none transition-colors ${
                  watermark.enabled
                    ? 'bg-teal-50 border-teal-300 text-teal-800'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title="Đóng dấu bản quyền Watermark PDF"
              >
                <Stamp className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">Watermark</span>
                {watermark.enabled && (
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                )}
              </button>

              <button
                type="button"
                disabled={isAnyFileConverting}
                onClick={() => !isAnyFileConverting && setFlattenModalOpen(true)}
                className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none transition-colors ${
                  flattenOnExport
                    ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-2xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title="Làm phẳng tập tin PDF (Khóa cứng biểu mẫu, chú thích & bảo vệ nội dung cố định)"
              >
                <Layers className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">Làm phẳng</span>
                {flattenOnExport && <Check className="w-3.5 h-3.5 text-rose-600 stroke-[3]" />}
              </button>
            </div>

            {/* Primary "Hoàn thành ->" Button */}
            <button
              type="button"
              disabled={isExporting || isAnyFileConverting}
              onClick={handleExportPdf}
              className="px-5 py-2 bg-[#0055FF] hover:bg-blue-700 disabled:opacity-60 disabled:pointer-events-none text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý ({exportProgress}%)...</span>
                </>
              ) : (
                <>
                  <span>Hoàn thành</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* SUB-HEADER BAR: Chọn tất cả + Sort A-Z + Grid Density */}
          <div className="bg-[#F5F7FA] border-b border-slate-200/70 px-4 sm:px-6 py-2 flex items-center justify-between shrink-0">
            <label className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  activeTab === 'files' ? allFilesSelected : allPagesSelected
                }
                onChange={(e) =>
                  activeTab === 'files'
                    ? selectAllFiles(e.target.checked)
                    : selectAllPages(e.target.checked)
                }
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>
                Chọn tất cả{' '}
                <span className="text-slate-400 font-normal">
                  ({activeTab === 'files' ? `${getFileSegments().length} thẻ file` : `${pages.length} trang`})
                </span>
              </span>
            </label>

            <div className="flex items-center gap-2">
              {/* Sort A-Z Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSortDropdownOpen((v) => !v)}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 flex items-center gap-1 text-xs cursor-pointer"
                  title="Sắp xếp các file theo tên"
                >
                  <ArrowUpAZ className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3" />
                </button>
                {sortDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-40 text-xs font-medium text-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        sortFilesByName('asc');
                        setSortDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
                    >
                      <ArrowUpAZ className="w-4 h-4 text-blue-600" />
                      <span>Tên tệp (A → Z)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sortFilesByName('desc');
                        setSortDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
                    >
                      <ArrowDownZA className="w-4 h-4 text-blue-600" />
                      <span>Tên tệp (Z → A)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Grid Columns Switcher */}
              <div className="inline-flex bg-white border border-slate-200 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setGridColumns(6)}
                  title="Thu nhỏ (Nhiều cột)"
                  className={`p-1.5 rounded cursor-pointer ${
                    gridColumns === 6
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setGridColumns(4)}
                  title="Lưới tiêu chuẩn"
                  className={`p-1.5 rounded cursor-pointer ${
                    gridColumns === 4
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* MAIN WORKSPACE CANVAS */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleProcessFiles(e.dataTransfer.files);
              }
            }}
            className="flex-1 overflow-y-auto p-4 sm:p-8"
          >
            {activeTab === 'files' ? (
              /* ---------------- TAB 1: CÁC FILE (Hình 4) ---------------- */
              (() => {
                const fileSegments = getFileSegments();
                return (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEndFiles}
                  >
                    <SortableContext
                      items={fileSegments.map((s) => s.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="flex flex-wrap items-center gap-y-6 gap-x-2">
                        {fileSegments.map((segment, idx) => (
                          <React.Fragment key={segment.id}>
                            <SortableFileCard
                              segment={segment}
                              isSelected={selectedFileIds.includes(segment.id) || selectedFileIds.includes(segment.sourceFileId)}
                              onToggleSelect={() => toggleSelectFile(segment.id)}
                              onRemove={() => removeFileSegment(segment.id)}
                              onSwitchToPages={() => {
                                if (!isAnyFileConverting) {
                                  setActiveTab('pages');
                                }
                              }}
                            />
                            <InterstitialAddButton
                              onInsertFiles={() =>
                                triggerDeviceFilePicker({ fileIndex: idx + 1 })
                              }
                              onInsertBlankPage={() => {
                                insertBlankDocumentAtFileIndex(idx + 1);
                                notify('Đã chèn trang trống!');
                              }}
                            />
                          </React.Fragment>
                        ))}

                        {/* Dashed Drop Card at the end (Giống Hình 4) */}
                        <button
                          type="button"
                          onClick={() => triggerDeviceFilePicker()}
                          className="w-48 h-64 ml-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 hover:bg-blue-50/90 hover:border-blue-400 transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-full border border-blue-400 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Plus className="w-4 h-4" />
                          </div>
                          <p className="text-xs text-blue-600 leading-relaxed">
                            Thêm các file <span className="font-bold">PDF, hình ảnh</span> hoặc{' '}
                            <span className="font-bold">trang trống</span>
                          </p>
                        </button>
                      </div>
                    </SortableContext>
                  </DndContext>
                );
              })()
            ) : (
              /* ---------------- TAB 2: TRANG (Hình 3) ---------------- */
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEndPages}
              >
                <SortableContext
                  items={pages.map((p) => p.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="flex flex-wrap items-center gap-y-6 gap-x-1.5">
                    {pages.map((page, idx) => {
                      const srcFile = files.find(
                        (f) => f.id === page.sourceFileId
                      );
                      return (
                        <React.Fragment key={page.id}>
                          <SortablePageCard
                            page={page}
                            pageNumber={idx + 1}
                            sourceFile={srcFile}
                            isSelected={selectedPageIds.includes(page.id)}
                            watermark={watermark}
                            onToggleSelect={() => toggleSelectPage(page.id)}
                            onPreview={() => setPreviewPageId(page.id)}
                            onRotate={() => rotatePage(page.id, 90)}
                            onDuplicate={() => duplicatePage(page.id)}
                            onDelete={() => deletePage(page.id)}
                          />
                          <InterstitialAddButton
                            onInsertFiles={() =>
                              triggerDeviceFilePicker({ pageIndex: idx + 1 })
                            }
                            onInsertBlankPage={() => {
                              insertBlankPage(idx + 1);
                              notify(`Đã chèn trang trống vào sau trang ${idx + 1}!`);
                            }}
                          />
                        </React.Fragment>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}

      {/* ====================================================================
          MODAL 1: FULLSCREEN PAGE PREVIEW (Khi bấm kính lúp Xem trước)
      ==================================================================== */}
      {currentPreviewPage && (
        <div
          onClick={() => setPreviewPageId(null)}
          className="fixed inset-0 z-[100] bg-slate-900/75 backdrop-blur-xs flex flex-col items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center"
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setPreviewPageId(null)}
              className="absolute -top-2 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Preview Canvas Container */}
            <div className="relative bg-white rounded-xl shadow-2xl p-4 max-h-[75vh] overflow-auto flex items-center justify-center">
              {currentPreviewPage.isBlank ? (
                <div className="w-[420px] h-[580px] border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                  Trang trống (A4)
                </div>
              ) : previewHighResUrl ? (
                <img
                  src={previewHighResUrl}
                  alt="Preview"
                  style={{
                    transform: `rotate(${currentPreviewPage.rotation}deg)`,
                    transition: 'transform 0.2s ease',
                  }}
                  className="max-h-[68vh] w-auto object-contain"
                />
              ) : (
                <div className="w-[420px] h-[580px] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              )}

              {/* Watermark Overlay in High-Res Preview */}
              {watermark?.enabled && (
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none p-6 z-10">
                  {watermark.type === 'image' && watermark.imageDataUrl ? (
                    <img
                      src={watermark.imageDataUrl}
                      alt="Watermark"
                      style={{
                        maxWidth: `${watermark.imageScale || 40}%`,
                        maxHeight: `${watermark.imageScale || 40}%`,
                        opacity: watermark.opacity ?? 0.25,
                        transform: watermark.diagonal ? 'rotate(-35deg)' : 'none',
                        objectFit: 'contain',
                      }}
                    />
                  ) : watermark.text?.trim() ? (
                    <span
                      style={{
                        transform: watermark.diagonal ? 'rotate(-35deg)' : 'none',
                        color: watermark.color || '#EF4444',
                        opacity: watermark.opacity ?? 0.25,
                        fontSize: `${watermark.fontSize || 42}px`,
                        fontWeight: 700,
                        textAlign: 'center',
                        lineHeight: 1.2,
                        wordBreak: 'break-word',
                      }}
                    >
                      {watermark.text}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {/* Bottom Floating Control Bar (Giống Smallpdf Preview Modal) */}
            <div className="mt-4 bg-white rounded-full shadow-xl px-4 py-2 flex items-center gap-3 text-sm font-semibold text-slate-700">
              <button
                type="button"
                disabled={previewIndex <= 0}
                onClick={() =>
                  previewIndex > 0 && setPreviewPageId(pages[previewIndex - 1].id)
                }
                className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-2 text-xs sm:text-sm font-bold text-slate-800">
                {previewIndex + 1} / {pages.length}
              </span>
              <button
                type="button"
                disabled={previewIndex >= pages.length - 1}
                onClick={() =>
                  previewIndex < pages.length - 1 &&
                  setPreviewPageId(pages[previewIndex + 1].id)
                }
                className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                title="Trang tiếp"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="h-4 w-px bg-slate-200" />

              <button
                type="button"
                onClick={() => rotatePage(currentPreviewPage.id, -90)}
                className="p-1.5 rounded-full hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                title="Xoay trái"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => rotatePage(currentPreviewPage.id, 90)}
                className="p-1.5 rounded-full hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                title="Xoay phải"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = currentPreviewPage.id;
                  const nextPage =
                    pages[previewIndex + 1] || pages[previewIndex - 1] || null;
                  deletePage(idToDelete);
                  setPreviewPageId(nextPage ? nextPage.id : null);
                }}
                className="p-1.5 rounded-full hover:bg-red-50 hover:text-red-600 cursor-pointer"
                title="Xóa trang này"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: WATERMARK SETTINGS MODAL (Đóng dấu Văn bản & Con dấu / Logo)
      ==================================================================== */}
      {watermarkModalOpen && (
        <div
          onClick={() => setWatermarkModalOpen(false)}
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                  <Stamp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Cấu hình Watermark PDF
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đóng dấu bản quyền bằng Chữ tiếng Việt hoặc Con dấu/Logo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWatermarkModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Switch Mode: Chữ văn bản vs Con dấu hình ảnh */}
            <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setWatermarkTab('text');
                  setWatermark({ type: 'text' });
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  watermarkTab === 'text'
                    ? 'bg-white text-teal-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <TypeIcon className="w-4 h-4" />
                <span>Chữ tiếng Việt</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWatermarkTab('image');
                  setWatermark({ type: 'image' });
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  watermarkTab === 'image'
                    ? 'bg-white text-teal-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Con dấu / Logo hình ảnh</span>
              </button>
            </div>

            <label className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer">
              <span className="text-xs sm:text-sm font-semibold text-slate-700">
                Kích hoạt Watermark trên toàn bộ tài liệu
              </span>
              <input
                type="checkbox"
                checked={watermark.enabled}
                onChange={(e) => setWatermark({ enabled: e.target.checked })}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
              >
              </input>
            </label>

            {/* TAB 1: TEXT WATERMARK */}
            {watermarkTab === 'text' && (
              <div className="space-y-3.5">
                {/* Mẫu gán nhanh */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Mẫu đóng dấu nhanh:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'BẢN SAO', text: 'BẢN SAO', color: '#EF4444', diagonal: true },
                      { label: 'MẬT', text: 'MẬT - CONFIDENTIAL', color: '#DC2626', diagonal: true },
                      { label: 'ĐÃ DUYỆT', text: 'ĐÃ PHÊ DUYỆT', color: '#059669', diagonal: false },
                      { label: 'BẢN NHÁP', text: 'BẢN NHÁP / DRAFT', color: '#D97706', diagonal: true },
                      { label: 'MẪU THỬ', text: 'MẪU THỬ / SAMPLE', color: '#2563EB', diagonal: true },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setWatermark({
                            text: preset.text,
                            color: preset.color,
                            diagonal: preset.diagonal,
                            enabled: true,
                          })
                        }
                        className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nội dung chữ Watermark (hỗ trợ tiếng Việt đầy đủ)
                  </label>
                  <input
                    type="text"
                    value={watermark.text}
                    onChange={(e) => setWatermark({ text: e.target.value })}
                    placeholder="Ví dụ: BẢN SAO CHÍNH THỨC"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Cỡ chữ ({watermark.fontSize}px)
                    </label>
                    <input
                      type="range"
                      min={18}
                      max={84}
                      value={watermark.fontSize}
                      onChange={(e) =>
                        setWatermark({ fontSize: Number(e.target.value) })
                      }
                      className="w-full cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Độ mờ ({Math.round(watermark.opacity * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0.05}
                      max={0.9}
                      step={0.05}
                      value={watermark.opacity}
                      onChange={(e) =>
                        setWatermark({ opacity: Number(e.target.value) })
                      }
                      className="w-full cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={watermark.diagonal}
                      onChange={(e) =>
                        setWatermark({ diagonal: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-teal-600 cursor-pointer"
                    />
                    <span>Xoay chéo 35° giữa trang</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Màu chữ:</span>
                    <input
                      type="color"
                      value={watermark.color}
                      onChange={(e) => setWatermark({ color: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: IMAGE WATERMARK */}
            {watermarkTab === 'image' && (
              <div className="space-y-3.5">
                <input
                  ref={watermarkImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const dataUrl = event.target?.result as string;
                      setWatermark({
                        type: 'image',
                        imageDataUrl: dataUrl,
                        enabled: true,
                      });
                      notify('Đã tải con dấu / logo Watermark thành công!');
                    };
                    reader.readAsDataURL(file);
                  }}
                />

                {watermark.imageDataUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-teal-50/70 border border-teal-200 rounded-xl">
                    <img
                      src={watermark.imageDataUrl}
                      alt="Logo preview"
                      className="w-14 h-14 object-contain bg-white rounded-lg border border-teal-100 p-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-teal-900 truncate">
                        Con dấu / Logo đã tải lên
                      </p>
                      <p className="text-[11px] text-teal-700">Đang được áp dụng trên tất cả trang</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => watermarkImageInputRef.current?.click()}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-teal-200 text-teal-700 rounded-lg hover:bg-teal-50 cursor-pointer"
                      >
                        Đổi ảnh
                      </button>
                      <button
                        type="button"
                        onClick={() => setWatermark({ imageDataUrl: undefined })}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Xóa logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => watermarkImageInputRef.current?.click()}
                    className="border-2 border-dashed border-teal-300 hover:border-teal-400 bg-teal-50/40 rounded-xl p-5 text-center cursor-pointer transition-colors"
                  >
                    <Upload className="w-6 h-6 text-teal-600 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-teal-900">
                      Nhấn để tải con dấu đỏ hoặc logo PNG/JPG
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Khuyến nghị ảnh trong suốt (PNG không nền) để có hiệu ứng đẹp nhất
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Kích thước ({watermark.imageScale || 40}%)
                    </label>
                    <input
                      type="range"
                      min={15}
                      max={85}
                      value={watermark.imageScale || 40}
                      onChange={(e) =>
                        setWatermark({ imageScale: Number(e.target.value) })
                      }
                      className="w-full cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Độ mờ ({Math.round(watermark.opacity * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0.05}
                      max={0.95}
                      step={0.05}
                      value={watermark.opacity}
                      onChange={(e) =>
                        setWatermark({ opacity: Number(e.target.value) })
                      }
                      className="w-full cursor-pointer"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={watermark.diagonal}
                    onChange={(e) =>
                      setWatermark({ diagonal: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-teal-600 cursor-pointer"
                  />
                  <span>Xoay nghiêng 35° giữa trang</span>
                </label>
              </div>
            )}

            {/* Live Mini Preview Box */}
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-3 flex flex-col items-center">
              <span className="text-[11px] font-semibold text-slate-500 mb-1.5 self-start">
                Xem trước hiệu ứng thực tế:
              </span>
              <div className="relative w-36 h-48 bg-white rounded shadow-xs border border-slate-200 flex items-center justify-center overflow-hidden p-2">
                <div className="space-y-1 w-full opacity-25">
                  <div className="h-1.5 bg-slate-400 rounded w-3/4"></div>
                  <div className="h-1.5 bg-slate-300 rounded w-full"></div>
                  <div className="h-1.5 bg-slate-300 rounded w-5/6"></div>
                  <div className="h-1.5 bg-slate-300 rounded w-2/3"></div>
                  <div className="h-1.5 bg-slate-300 rounded w-4/5"></div>
                  <div className="h-1.5 bg-slate-300 rounded w-3/5"></div>
                </div>

                {watermark.enabled && (
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none p-1">
                    {watermark.type === 'image' && watermark.imageDataUrl ? (
                      <img
                        src={watermark.imageDataUrl}
                        alt="Watermark preview"
                        style={{
                          maxWidth: `${watermark.imageScale || 40}%`,
                          maxHeight: `${watermark.imageScale || 40}%`,
                          opacity: watermark.opacity ?? 0.25,
                          transform: watermark.diagonal ? 'rotate(-35deg)' : 'none',
                          objectFit: 'contain',
                        }}
                      />
                    ) : watermark.text?.trim() ? (
                      <span
                        style={{
                          transform: watermark.diagonal ? 'rotate(-35deg)' : 'none',
                          color: watermark.color || '#EF4444',
                          opacity: watermark.opacity ?? 0.25,
                          fontSize: `${Math.max(9, Math.round((watermark.fontSize || 42) * 0.32))}px`,
                          fontWeight: 700,
                          textAlign: 'center',
                          lineHeight: 1.2,
                          wordBreak: 'break-word',
                        }}
                      >
                        {watermark.text}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              {watermark.enabled ? (
                <button
                  type="button"
                  onClick={() => {
                    setWatermark({ enabled: false });
                    setWatermarkModalOpen(false);
                    notify('Đã tắt Watermark.');
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Tắt Watermark
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWatermarkModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWatermark({ enabled: true });
                    setWatermarkModalOpen(false);
                    notify('Đã áp dụng Watermark trên tất cả các trang!');
                  }}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  Bật &amp; Áp dụng Watermark
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: SPLIT / EXTRACT RANGE MODAL (Cắt / Trích xuất PDF Trực quan)
      ==================================================================== */}
      {splitModalOpen && (
        <div
          onClick={() => setSplitModalOpen(false)}
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Cắt &amp; Trích xuất trang PDF
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đang chọn {splitModalSelectedIds.length} / {pages.length} trang
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSplitModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600 mr-1">Chọn nhanh:</span>
              <button
                type="button"
                onClick={() => setSplitModalSelectedIds(pages.map((p) => p.id))}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
              >
                Tất cả ({pages.length})
              </button>
              <button
                type="button"
                onClick={() => setSplitModalSelectedIds([])}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
              >
                Bỏ chọn
              </button>
              <button
                type="button"
                onClick={() =>
                  setSplitModalSelectedIds(
                    pages.filter((_, i) => (i + 1) % 2 === 1).map((p) => p.id)
                  )
                }
                className="px-2.5 py-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg cursor-pointer"
              >
                Trang lẻ (1, 3, 5...)
              </button>
              <button
                type="button"
                onClick={() =>
                  setSplitModalSelectedIds(
                    pages.filter((_, i) => (i + 1) % 2 === 0).map((p) => p.id)
                  )
                }
                className="px-2.5 py-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg cursor-pointer"
              >
                Trang chẵn (2, 4, 6...)
              </button>
            </div>

            {/* Range Input with Apply */}
            <div className="flex gap-2">
              <input
                type="text"
                value={splitRangeInput}
                onChange={(e) => setSplitRangeInput(e.target.value)}
                placeholder="Nhập dải trang (Ví dụ: 1-3, 5, 8-10)..."
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={() => {
                  const indices = parsePageIndicesFromInput(splitRangeInput);
                  if (indices.size === 0) {
                    notify('Vui lòng nhập khoảng trang hợp lệ (Ví dụ: 1-3, 5)', false);
                    return;
                  }
                  const matchedIds = pages
                    .filter((_, idx) => indices.has(idx))
                    .map((p) => p.id);
                  setSplitModalSelectedIds(matchedIds);
                  notify(`Đã chọn ${matchedIds.length} trang theo dải trang đã nhập!`);
                }}
                className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Áp dụng chọn
              </button>
            </div>

            {/* Visual Thumbnail Grid for Selection */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/50 min-h-[160px] max-h-[260px]">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                {pages.map((p, index) => {
                  const isSelected = splitModalSelectedIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSplitModalSelectedIds((prev) =>
                          prev.includes(p.id)
                            ? prev.filter((id) => id !== p.id)
                            : [...prev, p.id]
                        );
                      }}
                      className={`relative rounded-lg p-1.5 border flex flex-col items-center cursor-pointer transition-all ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 opacity-70'
                      }`}
                    >
                      <div className="absolute top-1 left-1 z-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by parent onClick
                          className="w-3.5 h-3.5 rounded text-purple-600 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <div className="w-12 h-16 bg-slate-100 rounded flex items-center justify-center overflow-hidden mb-1 mt-3">
                        {p.thumbnailUrl ? (
                          <img
                            src={p.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400">Trang</span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-bold ${
                          isSelected ? 'text-purple-900' : 'text-slate-600'
                        }`}
                      >
                        {index + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3 Core Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                disabled={splitModalSelectedIds.length === 0}
                onClick={() => {
                  if (splitModalSelectedIds.length === 0) return;
                  batchDeletePages(splitModalSelectedIds);
                  setSplitModalOpen(false);
                  notify(`Đã cắt bỏ ${splitModalSelectedIds.length} trang được chọn!`);
                }}
                className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                ✂ Cắt bỏ trang chọn ({splitModalSelectedIds.length})
              </button>

              <button
                type="button"
                disabled={splitModalSelectedIds.length === 0}
                onClick={() => {
                  if (splitModalSelectedIds.length === 0) return;
                  keepOnlyPages(splitModalSelectedIds);
                  setSplitModalOpen(false);
                  notify(`Đã giữ lại ${splitModalSelectedIds.length} trang, đã cắt bỏ các trang khác!`);
                }}
                className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                📑 Chỉ giữ trang chọn ({splitModalSelectedIds.length})
              </button>

              <button
                type="button"
                disabled={splitModalSelectedIds.length === 0 || isExporting}
                onClick={() => {
                  if (splitModalSelectedIds.length === 0) return;
                  const targetPages = pages.filter((p) =>
                    splitModalSelectedIds.includes(p.id)
                  );
                  handleSplitDownloadDirect(targetPages);
                }}
                className="px-3 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center shadow-xs"
              >
                📥 Tách &amp; Tải ngay file mới
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSplitModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: FLATTEN PDF MODAL (Làm phẳng tài liệu trực quan)
      ==================================================================== */}
      {flattenModalOpen && (
        <div
          onClick={() => setFlattenModalOpen(false)}
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Làm phẳng tài liệu (Flatten PDF)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Khóa vĩnh viễn các trường biểu mẫu, chú thích và nội dung
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFlattenModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3.5 text-xs text-rose-800 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-rose-600" />
                Bảo vệ toàn vẹn tài liệu ({pages.length} trang hiện tại)
              </p>
              <p className="text-slate-600 leading-relaxed">
                Khi làm phẳng, toàn bộ form nhập liệu, chữ ký, ghi chú và watermark sẽ được sáp nhập trực tiếp vào từng lớp trang PDF, ngăn chặn việc chỉnh sửa hoặc bóc tách dữ liệu trái phép.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isExporting || pages.length === 0}
                onClick={handleFlattenAndDownload}
                className="w-full px-4 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang làm phẳng ({exportProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Làm phẳng &amp; Tải file về máy ngay</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isExporting || pages.length === 0}
                onClick={handleFlattenAndApplyToWorkspace}
                className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4 text-slate-600" />
                <span>Làm phẳng &amp; Áp dụng trực tiếp vào không gian làm việc</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={flattenOnExport}
                  onChange={(e) => {
                    setFlattenOnExport(e.target.checked);
                    notify(
                      e.target.checked
                        ? 'Đã bật chế độ tự động làm phẳng khi bấm nút Hoàn thành.'
                        : 'Đã tắt tự động làm phẳng.'
                    );
                  }}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-xs text-slate-600">
                  Tự động làm phẳng khi bấm nút <b>Hoàn thành</b> ở góc phải
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
