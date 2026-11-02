import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2, ArrowUpLeft, Loader2 } from 'lucide-react';
import {
  compressImageFileToDataUrl,
  extractQuestionImageIds,
  getImageAsset,
  registerImageAsset,
  updateImageAssetWidth,
} from '../../utils/qbuilder-image';

interface QuestionImageBarProps {
  value: string;
  onChange: (nextValue: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  label?: string;
}

const WIDTH_OPTIONS: (25 | 50 | 75 | 100)[] = [25, 50, 75, 100];

export const QuestionImageBar: React.FC<QuestionImageBarProps> = ({
  value,
  onChange,
  textareaRef,
  label = 'Hình ảnh đính kèm',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, setVersion] = useState(0);

  const imageIds = extractQuestionImageIds(value);

  const insertTokenAtCursor = (token: string) => {
    const el = textareaRef?.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const prefix = value.slice(0, start);
      const suffix = value.slice(end);
      const sepBefore = prefix && !prefix.endsWith('\n') && !prefix.endsWith(' ') ? '\n' : '';
      const sepAfter = suffix && !suffix.startsWith('\n') ? '\n' : '';
      const next = `${prefix}${sepBefore}${token}${sepAfter}${suffix}`;
      onChange(next);
      return;
    }
    const next = value ? `${value.trimEnd()}\n${token}\n` : `${token}\n`;
    onChange(next);
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      let currentText = value;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const compressed = await compressImageFileToDataUrl(file);
        const asset = registerImageAsset(
          compressed.dataUrl,
          50,
          file.name.replace(/\.[^.]+$/, '') || 'Hình minh họa'
        );
        const token = `![${asset.name || 'Hình minh họa'}](img:${asset.id})`;
        if (files.length === 1) {
          insertTokenAtCursor(token);
          return;
        }
        currentText = currentText ? `${currentText.trimEnd()}\n${token}\n` : `${token}\n`;
      }
      onChange(currentText);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (id: string) => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\n?!\\[[^\\]]*\\]\\(img:${escaped}\\)\\n?`, 'g');
    const cleaned = value.replace(regex, '\n').replace(/\n{3,}/g, '\n\n').trim();
    onChange(cleaned);
  };

  const handleWidthChange = (id: string, pct: 25 | 50 | 75 | 100) => {
    updateImageAssetWidth(id, pct);
    setVersion(v => v + 1);
    // Trigger re-render trên parent preview bằng cách giữ nguyên nội dung nhưng thông báo thay đổi
    onChange(value.endsWith(' ') ? value.trimEnd() : `${value} `);
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFilesSelected(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200/80 transition-colors cursor-pointer"
          title="Tải ảnh lên hoặc bấm Ctrl+V trực tiếp vào ô nhập để dán ảnh"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
          ) : (
            <ImagePlus className="w-3.5 h-3.5 text-indigo-600" />
          )}
          <span>Thêm hình ảnh (hoặc Ctrl+V dán ảnh)</span>
        </button>
        {imageIds.length > 0 && (
          <span className="text-[11px] text-slate-500 font-medium">
            {label}: {imageIds.length} ảnh
          </span>
        )}
      </div>

      {imageIds.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-slate-50/90 border border-slate-200/80">
          {imageIds.map((id, idx) => {
            const asset = getImageAsset(id);
            if (!asset) return null;
            return (
              <div
                key={`${id}_${idx}`}
                className="group relative flex items-center gap-2 bg-white rounded-md border border-slate-200 p-1.5 shadow-2xs"
              >
                <img
                  src={asset.dataUrl}
                  alt={asset.name || `Hình ${idx + 1}`}
                  className="w-12 h-12 object-contain rounded bg-slate-50 border border-slate-100"
                />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold text-slate-700 max-w-[110px] truncate">
                      {asset.name || `Hình ${idx + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => insertTokenAtCursor(`![${asset.name || 'Hình minh họa'}](img:${asset.id})`)}
                      className="p-0.5 text-slate-400 hover:text-indigo-600 rounded"
                      title="Chèn thêm vị trí ảnh tại con trỏ"
                    >
                      <ArrowUpLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(id)}
                      className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                      title="Xóa ảnh này khỏi nội dung"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {WIDTH_OPTIONS.map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleWidthChange(id, pct)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          asset.widthPct === pct
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title={`Độ rộng ảnh khi in/xuất Word: ${pct}%`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
