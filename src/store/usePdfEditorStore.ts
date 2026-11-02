import { create } from 'zustand';

export interface PdfSourceFile {
  id: string;
  name: string;
  size: number;
  rawData: ArrayBuffer;
  totalPages: number;
  colorBadge: string;
  coverThumbnailUrl?: string;
}

export interface VirtualPage {
  id: string;
  sourceFileId: string;
  originalPageIndex: number; // 0-indexed, -1 if blank
  rotation: number; // 0 | 90 | 180 | 270
  isBlank: boolean;
  thumbnailUrl?: string;
}

export interface FileSegment {
  id: string; // segment_xxx
  sourceFileId: string;
  name: string;
  totalPages: number;
  colorBadge: string;
  coverThumbnailUrl?: string;
  isBlank: boolean;
  pageIds: string[];
}

export type WatermarkType = 'text' | 'image';

export interface WatermarkConfig {
  enabled: boolean;
  type?: WatermarkType; // 'text' | 'image'
  text: string;
  opacity: number; // 0.1 to 1.0
  fontSize: number;
  color: string; // hex
  diagonal: boolean;
  imageDataUrl?: string; // base64 data url for image/stamp watermark
  imageScale?: number; // 10 to 100 (%)
}

export type EditorTabMode = 'files' | 'pages';

interface PdfEditorState {
  files: PdfSourceFile[];
  pages: VirtualPage[];
  activeTab: EditorTabMode;
  selectedFileIds: string[];
  selectedPageIds: string[];
  previewPageId: string | null;
  watermark: WatermarkConfig;
  flattenOnExport: boolean;
  gridColumns: 4 | 6;

  // Segment Selector
  getFileSegments: () => FileSegment[];

  // Actions
  setActiveTab: (tab: EditorTabMode) => void;
  setGridColumns: (cols: 4 | 6) => void;
  addFiles: (newFiles: PdfSourceFile[], insertAtFileIndex?: number, insertAtPageIndex?: number) => void;
  removeFile: (fileId: string) => void;
  renameFile: (fileId: string, newName: string) => void;
  reorderFiles: (activeId: string, overId: string) => void;
  reorderFileSegments: (activeSegmentId: string, overSegmentId: string) => void;
  removeFileSegment: (segmentId: string) => void;
  rotateFileSegment: (segmentId: string, deltaDegrees?: number) => void;
  sortFilesByName: (direction: 'asc' | 'desc') => void;
  insertBlankDocumentAtFileIndex: (fileIndex?: number) => void;

  // Page Actions
  reorderPages: (activeId: string, overId: string) => void;
  rotatePage: (pageId: string, deltaDegrees?: number) => void;
  duplicatePage: (pageId: string) => void;
  deletePage: (pageId: string) => void;
  insertBlankPage: (atIndex?: number) => void;
  updatePageThumbnail: (pageId: string, thumbnailUrl: string) => void;
  updateFileCoverThumbnail: (fileId: string, thumbnailUrl: string) => void;

  // Selection & Bulk Actions
  toggleSelectFile: (fileId: string) => void;
  selectAllFiles: (select: boolean) => void;
  rotateSelectedFiles: (deltaDegrees?: number) => void;
  deleteSelectedFiles: () => void;

  toggleSelectPage: (pageId: string) => void;
  selectAllPages: (select: boolean) => void;
  rotateSelectedPages: (deltaDegrees?: number) => void;
  deleteSelectedPages: () => void;
  batchDeletePages: (pageIds: string[]) => void;
  keepOnlyPages: (pageIds: string[]) => void;

  // Preview & Export Settings
  setPreviewPageId: (pageId: string | null) => void;
  setWatermark: (config: Partial<WatermarkConfig>) => void;
  setFlattenOnExport: (flatten: boolean) => void;
  reset: () => void;
}

const BADGE_PALETTE = [
  '#FEE2E2', // rose-100
  '#DBEAFE', // blue-100
  '#D1FAE5', // emerald-100
  '#FEF3C7', // amber-100
  '#EDE9FE', // violet-100
  '#FCE7F3', // pink-100
  '#E0F2FE', // sky-100
];

let idCounter = 0;
function makeUniqueId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getBadgeColor(index: number): string {
  return BADGE_PALETTE[index % BADGE_PALETTE.length];
}

function normalizeRotation(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

const initialWatermark: WatermarkConfig = {
  enabled: false,
  type: 'text',
  text: 'BẢN QUYỀN / CONFIDENTIAL',
  opacity: 0.25,
  fontSize: 42,
  color: '#EF4444',
  diagonal: true,
  imageScale: 40,
};

export const usePdfEditorStore = create<PdfEditorState>((set, get) => ({
  files: [],
  pages: [],
  activeTab: 'pages',
  selectedFileIds: [],
  selectedPageIds: [],
  previewPageId: null,
  watermark: initialWatermark,
  flattenOnExport: false,
  gridColumns: 4,

  // Thuật toán gom cụm (Clustering/Run-Length) tạo danh sách Segments từ mảng pages
  getFileSegments: () => {
    const { pages, files } = get();
    if (pages.length === 0) return [];

    const segments: FileSegment[] = [];
    const filesMap = new Map(files.map((f) => [f.id, f]));

    let currentSegment: FileSegment | null = null;
    let segIndex = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const isBlank = page.isBlank || page.sourceFileId === 'blank';
      const srcFile = !isBlank ? filesMap.get(page.sourceFileId) : null;
      const fileId = isBlank ? 'blank' : page.sourceFileId;

      // Nếu chuyển sang tệp khác hoặc tệp bị ngắt bởi trang khác/trang trống
      if (!currentSegment || currentSegment.sourceFileId !== fileId) {
        segIndex += 1;
        const name = isBlank ? 'Trang trống' : srcFile?.name || 'Tài liệu.pdf';
        const colorBadge = isBlank ? '#E2E8F0' : srcFile?.colorBadge || getBadgeColor(segIndex);

        currentSegment = {
          id: `seg_${segIndex}_${fileId}`,
          sourceFileId: fileId,
          name,
          totalPages: 1,
          colorBadge,
          coverThumbnailUrl: page.thumbnailUrl || srcFile?.coverThumbnailUrl,
          isBlank,
          pageIds: [page.id],
        };
        segments.push(currentSegment);
      } else {
        currentSegment.totalPages += 1;
        currentSegment.pageIds.push(page.id);
        if (!currentSegment.coverThumbnailUrl && page.thumbnailUrl) {
          currentSegment.coverThumbnailUrl = page.thumbnailUrl;
        }
      }
    }

    return segments;
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setGridColumns: (cols) => set({ gridColumns: cols }),

  addFiles: (newFiles, insertAtFileIndex, insertAtPageIndex) =>
    set((state) => {
      const generatedPages: VirtualPage[] = [];
      for (const file of newFiles) {
        for (let i = 0; i < file.totalPages; i++) {
          generatedPages.push({
            id: makeUniqueId('page'),
            sourceFileId: file.id,
            originalPageIndex: i,
            rotation: 0,
            isBlank: false,
          });
        }
      }

      const nextFiles = [...state.files];
      if (typeof insertAtFileIndex === 'number' && insertAtFileIndex >= 0 && insertAtFileIndex <= nextFiles.length) {
        nextFiles.splice(insertAtFileIndex, 0, ...newFiles);
      } else {
        nextFiles.push(...newFiles);
      }

      let nextPages = [...state.pages];
      if (typeof insertAtPageIndex === 'number' && insertAtPageIndex >= 0 && insertAtPageIndex <= nextPages.length) {
        nextPages.splice(insertAtPageIndex, 0, ...generatedPages);
      } else if (typeof insertAtFileIndex === 'number' && insertAtFileIndex >= 0 && insertAtFileIndex < state.files.length) {
        const targetFileId = state.files[insertAtFileIndex].id;
        const firstPageIdx = nextPages.findIndex((p) => p.sourceFileId === targetFileId);
        if (firstPageIdx >= 0) {
          nextPages.splice(firstPageIdx, 0, ...generatedPages);
        } else {
          nextPages.push(...generatedPages);
        }
      } else {
        nextPages.push(...generatedPages);
      }

      return {
        files: nextFiles,
        pages: nextPages,
      };
    }),

  removeFile: (fileId) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== fileId),
      pages: state.pages.filter((p) => p.sourceFileId !== fileId),
      selectedFileIds: state.selectedFileIds.filter((id) => id !== fileId),
      selectedPageIds: state.selectedPageIds.filter((pageId) => {
        const page = state.pages.find((p) => p.id === pageId);
        return page && page.sourceFileId !== fileId;
      }),
    })),

  renameFile: (fileId, newName) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === fileId ? { ...f, name: newName } : f)),
    })),

  reorderFiles: (activeId, overId) =>
    set((state) => {
      if (activeId === overId) return state;
      const oldIndex = state.files.findIndex((f) => f.id === activeId);
      const newIndex = state.files.findIndex((f) => f.id === overId);
      if (oldIndex < 0 || newIndex < 0) return state;

      const nextFiles = [...state.files];
      const [moved] = nextFiles.splice(oldIndex, 1);
      nextFiles.splice(newIndex, 0, moved);

      const reorderedPages: VirtualPage[] = [];
      for (const file of nextFiles) {
        const filePages = state.pages.filter((p) => p.sourceFileId === file.id);
        reorderedPages.push(...filePages);
      }
      const orphanBlankPages = state.pages.filter(
        (p) => !nextFiles.some((f) => f.id === p.sourceFileId)
      );
      reorderedPages.push(...orphanBlankPages);

      return {
        files: nextFiles,
        pages: reorderedPages,
      };
    }),

  // Kéo thả sắp xếp trực tiếp giữa các Segments ở tab CÁC FILE
  reorderFileSegments: (activeSegmentId, overSegmentId) =>
    set((state) => {
      if (activeSegmentId === overSegmentId) return state;
      const segments = get().getFileSegments();
      const oldIdx = segments.findIndex((s) => s.id === activeSegmentId);
      const newIdx = segments.findIndex((s) => s.id === overSegmentId);
      if (oldIdx < 0 || newIdx < 0) return state;

      const nextSegments = [...segments];
      const [moved] = nextSegments.splice(oldIdx, 1);
      nextSegments.splice(newIdx, 0, moved);

      const pagesMap = new Map(state.pages.map((p) => [p.id, p]));
      const newPages: VirtualPage[] = [];

      for (const seg of nextSegments) {
        for (const pid of seg.pageIds) {
          const page = pagesMap.get(pid);
          if (page) newPages.push(page);
        }
      }

      return { pages: newPages };
    }),

  removeFileSegment: (segmentId) =>
    set((state) => {
      const segments = get().getFileSegments();
      const targetSeg = segments.find((s) => s.id === segmentId);
      if (!targetSeg) return state;

      const targetPageIdSet = new Set(targetSeg.pageIds);
      const nextPages = state.pages.filter((p) => !targetPageIdSet.has(p.id));

      const activeFileIds = new Set(nextPages.map((p) => p.sourceFileId));
      const nextFiles = state.files.filter((f) => activeFileIds.has(f.id));

      return {
        pages: nextPages,
        files: nextFiles,
        selectedFileIds: state.selectedFileIds.filter((id) => id !== segmentId),
        selectedPageIds: state.selectedPageIds.filter((id) => !targetPageIdSet.has(id)),
      };
    }),

  rotateFileSegment: (segmentId, deltaDegrees = 90) =>
    set((state) => {
      const segments = get().getFileSegments();
      const targetSeg = segments.find((s) => s.id === segmentId);
      if (!targetSeg) return state;

      const targetPageIdSet = new Set(targetSeg.pageIds);
      return {
        pages: state.pages.map((p) =>
          targetPageIdSet.has(p.id)
            ? { ...p, rotation: normalizeRotation(p.rotation + deltaDegrees) }
            : p
        ),
      };
    }),

  sortFilesByName: (direction) =>
    set((state) => {
      const nextFiles = [...state.files].sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, 'vi', { numeric: true });
        return direction === 'asc' ? cmp : -cmp;
      });

      const reorderedPages: VirtualPage[] = [];
      for (const file of nextFiles) {
        reorderedPages.push(...state.pages.filter((p) => p.sourceFileId === file.id));
      }
      const orphanBlankPages = state.pages.filter(
        (p) => !nextFiles.some((f) => f.id === p.sourceFileId)
      );
      reorderedPages.push(...orphanBlankPages);

      return {
        files: nextFiles,
        pages: reorderedPages,
      };
    }),

  insertBlankDocumentAtFileIndex: (fileIndex) =>
    set((state) => {
      const blankFileId = 'blank';
      const blankPage: VirtualPage = {
        id: makeUniqueId('page'),
        sourceFileId: blankFileId,
        originalPageIndex: -1,
        rotation: 0,
        isBlank: true,
      };

      const segments = get().getFileSegments();
      let insertPageIndex = state.pages.length;

      if (typeof fileIndex === 'number' && fileIndex >= 0 && fileIndex < segments.length) {
        const targetSeg = segments[fileIndex];
        const firstPageId = targetSeg.pageIds[0];
        const pIdx = state.pages.findIndex((p) => p.id === firstPageId);
        if (pIdx >= 0) insertPageIndex = pIdx;
      }

      const nextPages = [...state.pages];
      nextPages.splice(insertPageIndex, 0, blankPage);
      return { pages: nextPages };
    }),

  reorderPages: (activeId, overId) =>
    set((state) => {
      if (activeId === overId) return state;
      const oldIndex = state.pages.findIndex((p) => p.id === activeId);
      const newIndex = state.pages.findIndex((p) => p.id === overId);
      if (oldIndex < 0 || newIndex < 0) return state;

      const nextPages = [...state.pages];
      const [moved] = nextPages.splice(oldIndex, 1);
      nextPages.splice(newIndex, 0, moved);
      return { pages: nextPages };
    }),

  rotatePage: (pageId, deltaDegrees = 90) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, rotation: normalizeRotation(p.rotation + deltaDegrees) } : p
      ),
    })),

  duplicatePage: (pageId) =>
    set((state) => {
      const idx = state.pages.findIndex((p) => p.id === pageId);
      if (idx < 0) return state;
      const target = state.pages[idx];
      const clone: VirtualPage = {
        ...target,
        id: makeUniqueId('page'),
      };
      const nextPages = [...state.pages];
      nextPages.splice(idx + 1, 0, clone);
      return { pages: nextPages };
    }),

  deletePage: (pageId) =>
    set((state) => {
      const nextPages = state.pages.filter((p) => p.id !== pageId);
      const activeFileIds = new Set(nextPages.map((p) => p.sourceFileId));
      const nextFiles = state.files.filter((f) => activeFileIds.has(f.id));
      return {
        pages: nextPages,
        files: nextFiles,
        selectedPageIds: state.selectedPageIds.filter((id) => id !== pageId),
        previewPageId: state.previewPageId === pageId ? null : state.previewPageId,
      };
    }),

  insertBlankPage: (atIndex) =>
    set((state) => {
      const blankPage: VirtualPage = {
        id: makeUniqueId('page'),
        sourceFileId: 'blank',
        originalPageIndex: -1,
        rotation: 0,
        isBlank: true,
      };
      const nextPages = [...state.pages];
      if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= nextPages.length) {
        nextPages.splice(atIndex, 0, blankPage);
      } else {
        nextPages.push(blankPage);
      }
      return { pages: nextPages };
    }),

  updatePageThumbnail: (pageId, thumbnailUrl) =>
    set((state) => ({
      pages: state.pages.map((p) => (p.id === pageId ? { ...p, thumbnailUrl } : p)),
    })),

  updateFileCoverThumbnail: (fileId, thumbnailUrl) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === fileId ? { ...f, coverThumbnailUrl: thumbnailUrl } : f)),
    })),

  toggleSelectFile: (fileId) =>
    set((state) => {
      const exists = state.selectedFileIds.includes(fileId);
      return {
        selectedFileIds: exists
          ? state.selectedFileIds.filter((id) => id !== fileId)
          : [...state.selectedFileIds, fileId],
      };
    }),

  selectAllFiles: (select) =>
    set((state) => {
      const segments = get().getFileSegments();
      return {
        selectedFileIds: select ? segments.map((s) => s.id) : [],
      };
    }),

  rotateSelectedFiles: (deltaDegrees = 90) =>
    set((state) => {
      const segments = get().getFileSegments();
      const selectedSegSet = new Set(state.selectedFileIds);
      const targetPageIdSet = new Set<string>();

      for (const seg of segments) {
        if (selectedSegSet.has(seg.id) || selectedSegSet.has(seg.sourceFileId)) {
          for (const pid of seg.pageIds) targetPageIdSet.add(pid);
        }
      }

      return {
        pages: state.pages.map((p) =>
          targetPageIdSet.has(p.id)
            ? { ...p, rotation: normalizeRotation(p.rotation + deltaDegrees) }
            : p
        ),
      };
    }),

  deleteSelectedFiles: () =>
    set((state) => {
      const segments = get().getFileSegments();
      const selectedSegSet = new Set(state.selectedFileIds);
      const targetPageIdSet = new Set<string>();

      for (const seg of segments) {
        if (selectedSegSet.has(seg.id) || selectedSegSet.has(seg.sourceFileId)) {
          for (const pid of seg.pageIds) targetPageIdSet.add(pid);
        }
      }

      const nextPages = state.pages.filter((p) => !targetPageIdSet.has(p.id));
      const activeFileIds = new Set(nextPages.map((p) => p.sourceFileId));
      const nextFiles = state.files.filter((f) => activeFileIds.has(f.id));

      return {
        files: nextFiles,
        pages: nextPages,
        selectedFileIds: [],
        selectedPageIds: state.selectedPageIds.filter((id) => !targetPageIdSet.has(id)),
      };
    }),

  toggleSelectPage: (pageId) =>
    set((state) => {
      const exists = state.selectedPageIds.includes(pageId);
      return {
        selectedPageIds: exists
          ? state.selectedPageIds.filter((id) => id !== pageId)
          : [...state.selectedPageIds, pageId],
      };
    }),

  selectAllPages: (select) =>
    set((state) => ({
      selectedPageIds: select ? state.pages.map((p) => p.id) : [],
    })),

  rotateSelectedPages: (deltaDegrees = 90) =>
    set((state) => {
      const selectedSet = new Set(state.selectedPageIds);
      return {
        pages: state.pages.map((p) =>
          selectedSet.has(p.id)
            ? { ...p, rotation: normalizeRotation(p.rotation + deltaDegrees) }
            : p
        ),
      };
    }),

  deleteSelectedPages: () =>
    set((state) => {
      const selectedSet = new Set(state.selectedPageIds);
      const nextPages = state.pages.filter((p) => !selectedSet.has(p.id));
      const activeFileIds = new Set(nextPages.map((p) => p.sourceFileId));
      const nextFiles = state.files.filter((f) => activeFileIds.has(f.id));
      return {
        pages: nextPages,
        files: nextFiles,
        selectedPageIds: [],
        previewPageId: selectedSet.has(state.previewPageId || '') ? null : state.previewPageId,
      };
    }),

  batchDeletePages: (pageIds) =>
    set((state) => {
      const toDeleteSet = new Set(pageIds);
      const nextPages = state.pages.filter((p) => !toDeleteSet.has(p.id));
      const activeFileIds = new Set(nextPages.map((p) => p.sourceFileId));
      const nextFiles = state.files.filter((f) => activeFileIds.has(f.id));
      return {
        pages: nextPages,
        files: nextFiles,
        selectedPageIds: state.selectedPageIds.filter((id) => !toDeleteSet.has(id)),
        previewPageId: toDeleteSet.has(state.previewPageId || '') ? null : state.previewPageId,
      };
    }),

  keepOnlyPages: (pageIds) =>
    set((state) => {
      const keepSet = new Set(pageIds);
      const nextPages = state.pages.filter((p) => keepSet.has(p.id));
      const activeFileIds = new Set(nextPages.map((p) => p.sourceFileId));
      const nextFiles = state.files.filter((f) => activeFileIds.has(f.id));
      return {
        pages: nextPages,
        files: nextFiles,
        selectedPageIds: state.selectedPageIds.filter((id) => keepSet.has(id)),
        previewPageId: keepSet.has(state.previewPageId || '') ? state.previewPageId : null,
      };
    }),

  setPreviewPageId: (pageId) => set({ previewPageId: pageId }),

  setWatermark: (config) =>
    set((state) => ({
      watermark: { ...state.watermark, ...config },
    })),

  setFlattenOnExport: (flatten) => set({ flattenOnExport: flatten }),

  reset: () =>
    set({
      files: [],
      pages: [],
      activeTab: 'pages',
      selectedFileIds: [],
      selectedPageIds: [],
      previewPageId: null,
      watermark: initialWatermark,
      flattenOnExport: false,
      gridColumns: 4,
    }),
}));
