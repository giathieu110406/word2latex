// src/components/SplitViewWorkspace.tsx
import React, { useEffect, useState } from 'react';
import { FileText, ExternalLink, Minus, Plus, Maximize2, Minimize2 } from 'lucide-react';
import type { DriveDocument } from './GooglePickerBtn';
import './sync-hub.css';

interface Props {
  documentId: string | null;
  document?: DriveDocument | null;
  workPreview?: React.ReactNode;
  documentVersion?: number;
  children?: React.ReactNode;
}

export const SplitViewWorkspace: React.FC<Props> = ({ documentId, document, children, workPreview, documentVersion = 0 }) => {
  const [zoom, setZoom] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const hasProposal = !!workPreview;
  useEffect(() => { setShowProposal(hasProposal); }, [hasProposal]);
  return (
    <div className={`sync-workspace${expanded ? ' sync-workspace-expanded' : ''}`}>
      {/* Left Panel: AI Workspace */}
      <div 
        data-testid="left-panel-ai" 
        className="sync-converter"
      >
        {children || (
          <div className="p-4 h-full flex flex-col">
            <h2 className="text-xl font-bold mb-4">AI Workspace</h2>
            <div className="flex-1 bg-white border border-gray-300 rounded shadow-sm p-4 overflow-auto">
              <p className="text-gray-500">Khu vực phân tích và chuẩn hóa Toán học</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Google Docs iframe */}
      <div 
        data-testid="right-panel-docs" 
        className="sync-document"
      >
        <div className="sync-document-toolbar">
          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{document?.name || 'Tài liệu Google Docs'}</p><p className="text-xs text-slate-500">{documentId ? document?.ownedByMe === false ? 'Được chia sẻ với bạn' : 'Mở trực tiếp trong Google Docs' : 'Cá nhân · Được chia sẻ · Bộ nhớ dùng chung'}</p></div>
          {documentId && <a href={`https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit`} target="_blank" rel="noopener noreferrer" className="sync-open-document" title="Mở trong tab Google Docs"><ExternalLink className="w-4 h-4" /><span>Mở tab</span></a>}
        </div>
        {hasProposal && <div className="work-preview-tabs" role="group" aria-label="Xem thay đổi AI"><button aria-pressed={!showProposal} onClick={() => setShowProposal(false)}>Tài liệu gốc</button><button aria-pressed={showProposal} onClick={() => setShowProposal(true)}>Bản đề xuất</button></div>}
        <div className="sync-document-view-controls" aria-label="Điều chỉnh vùng tài liệu">
          <div className="sync-zoom-controls">
            <button type="button" aria-label="Thu nhỏ tài liệu" disabled={!documentId || zoom <= 50} onClick={() => setZoom(value => Math.max(50, value - 10))}><Minus className="w-4 h-4" /></button>
            <select aria-label="Mức thu phóng tài liệu" value={zoom} disabled={!documentId} onChange={event => setZoom(Number(event.target.value))}>{[50,60,70,80,90,100,110,120,130,140,150].map(value => <option key={value} value={value}>{value}%</option>)}</select>
            <button type="button" aria-label="Phóng to tài liệu" disabled={!documentId || zoom >= 150} onClick={() => setZoom(value => Math.min(150, value + 10))}><Plus className="w-4 h-4" /></button>
          </div>
          <button type="button" onClick={() => setZoom(100)} disabled={!documentId || zoom === 100} className="sync-view-reset">Đặt lại</button>
          <button type="button" aria-pressed={expanded} onClick={() => setExpanded(value => !value)} className="sync-view-expand">{expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}{expanded ? 'Chia đôi' : 'Mở rộng'}</button>
        </div>
        {documentId ? (
          <div className="sync-docs-viewport" style={showProposal && hasProposal ? { display: 'none' } : undefined}>
          <iframe
            key={`${documentId}:${documentVersion}`}
            src={`https://docs.google.com/document/d/${documentId}/edit?rm=minimal`}
            className="sync-docs-frame"
            style={{ width: `${10000 / zoom}%`, height: `${10000 / zoom}%`, transform: `scale(${zoom / 100})` }}
            allow="clipboard-read; clipboard-write"
            title="Google Docs Live View"
          />
          </div>
        ) : (
          <div className="sync-empty-document">
            <div className="rounded-2xl bg-blue-50 p-4 text-blue-600"><FileText className="w-9 h-9" /></div>
            <h3 className="font-semibold text-slate-800">Tài liệu của bạn, ngay cạnh vùng soạn thảo</h3>
            <p>Chọn Google Docs từ Drive để mở ở đây.<br />Tệp được chia sẻ vẫn dùng quyền của chủ sở hữu.</p>
          </div>
        )}
        {showProposal && hasProposal && <div className="work-preview-pane">{workPreview}</div>}
      </div>
    </div>
  );
};
