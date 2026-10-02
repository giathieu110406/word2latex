import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Send, Undo2, FileText } from 'lucide-react';
import { authFetch } from '../utils/api-client';
import { textDifference, validateProposal, type WorkEdit, type WorkProposal } from '../../shared/ai-work';
import { readWorkDocument, applyWorkEdits, WorkConflict, WorkUncertain, type WorkSnapshot } from '../lib/ai-work-docs';
import type { DriveDocument } from './GooglePickerBtn';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface Props {
  document: DriveDocument | null;
  accountId: string;
  onPreviewChange: (preview: React.ReactNode) => void;
  onDocumentWritten: () => void;
  onBusyChange: (busy: boolean) => void;
}
type Proposal = WorkProposal & { task: string; snapshot: WorkSnapshot };
type Undo = { snapshot: WorkSnapshot; edits: WorkEdit[] };

export function WorkDiff({ proposal, selected }: { proposal: Proposal; selected: string[] }) {
  return <div className="work-diff">
    <div className="work-diff-legend"><span className="work-added">Phần thêm</span><span className="work-removed">Phần bỏ</span><span>Chưa ghi vào Docs</span></div>
    {proposal.edits.filter(edit => selected.includes(edit.blockId)).map((edit, index) => {
      const block = proposal.snapshot.blocks.find(block => block.id === edit.blockId)!;
      const diff = textDifference(block.text, edit.after);
      return <article key={edit.blockId} className="work-diff-card"><h4>Thay đổi {index + 1} · {block.id}</h4>
        <p>{block.text.slice(0, diff.prefix)}{diff.removed && <del className="work-removed">{diff.removed}</del>}{diff.inserted && <ins className="work-added">{diff.inserted}</ins>}{diff.suffix ? block.text.slice(-diff.suffix) : ''}</p>
      </article>;
    })}
    {!selected.length && <p>Chọn ít nhất một thay đổi để xem trước.</p>}
  </div>;
}

export default function AIWork({ document, accountId, onPreviewChange, onDocumentWritten, onBusyChange }: Props) {
  const [task, setTask] = useState('');

  const [snapshot, setSnapshot] = useState<WorkSnapshot | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [busy, setBusy] = useState<'read' | 'generate' | 'write' | 'undo' | null>(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const operation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const currentDocument = useRef(document?.id);
  currentDocument.current = document?.id;
  const writing = busy === 'write' || busy === 'undo';
  const valid = proposal && proposal.task === task && proposal.snapshot.documentId === document?.id;

  useEffect(() => {
    operation.current++;
    controller.current?.abort();
    setSnapshot(null); setProposal(null); setUndo(null); setSelected([]); setError(''); setBusy(null); setMessages([]); setHistory([]);
    onPreviewChange(null);
    return () => { operation.current++; controller.current?.abort(); onPreviewChange(null); };
  }, [document?.id, accountId, onPreviewChange]);

  useEffect(() => {
    onPreviewChange(valid && proposal ? <WorkDiff proposal={proposal} selected={selected} /> : null);
  }, [proposal, selected, task, document?.id, onPreviewChange]);

  useEffect(() => { onBusyChange(writing); return () => onBusyChange(false); }, [writing, onBusyChange]);

  const note = (text: string) => setHistory(items => [`${new Date().toLocaleTimeString('vi-VN')} · ${text}`, ...items].slice(0, 20));
  const invalidate = () => { operation.current++; controller.current?.abort(); setProposal(null); setSelected([]); onPreviewChange(null); if (!writing) setBusy(null); };

  const read = async () => {
    if (!document || busy) return;
    const ticket = ++operation.current;
    setBusy('read'); setError('');
    try {
      const result = await readWorkDocument(document.id, accountId);
      if (ticket !== operation.current || document.id !== currentDocument.current) return;
      setSnapshot(result); setProposal(null); setUndo(null);
      note(`Đã tự động nạp ${result.blocks.length} đoạn hỗ trợ.`);
    } catch (e) { if (ticket === operation.current) setError(e instanceof Error ? e.message : 'Không đọc được tài liệu.'); }
    finally { if (ticket === operation.current) setBusy(null); }
  };

  useEffect(() => {
    if (document?.id && document.id === currentDocument.current && !snapshot && !busy) {
      void read();
    }
  }, [document?.id]);

  const generate = async () => {
    if (!document || busy || !task.trim()) return;
    const ticket = ++operation.current;
    const requestedTask = task;

    controller.current?.abort(); controller.current = new AbortController();
    setBusy('generate'); setError(''); setProposal(null); setSelected([]);
    setMessages(items => [...items, { role: 'user' as const, text: requestedTask }].slice(-12));
    try {
      const source = snapshot || await readWorkDocument(document.id, accountId);
      if (ticket !== operation.current) return;
      if (!snapshot) setSnapshot(source);
      const blocks = source.blocks;
      if (!blocks.length) throw new Error('Không có đoạn văn bản hỗ trợ trong phạm vi này. Hãy đọc lại tài liệu.');
      const response = await authFetch('/api/ai?action=ai-work', {
        method: 'POST', signal: controller.current.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: requestedTask, documentId: document.id, blocks: blocks.map(block => ({ id: block.id, text: block.text })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không tạo được đề xuất.');
      if (ticket !== operation.current || document.id !== currentDocument.current) return;
      
      if (response.status === 202) {
        setMessages(items => [...items, { role: 'assistant' as const, text: 'Đã gửi yêu cầu cho AI xử lý ngầm. Vui lòng đợi trong giây lát...' }].slice(-12));
        
        // Listen to Firestore for completion
        const unsub = onSnapshot(doc(db, "ai_works", `${accountId}_${document.id}`), async (snapshotDoc) => {
          if (!snapshotDoc.exists()) return;
          const snapData = snapshotDoc.data();
          
          if (snapData?.status === "completed" && snapData?.proposal?.task === requestedTask) {
            unsub();
            if (ticket !== operation.current) return;
            
            const reviewed = validateProposal(snapData.proposal, blocks);
            setProposal({ ...reviewed, task: requestedTask, snapshot: source });
            setSelected(reviewed.edits.map(edit => edit.blockId));
            setMessages(items => [...items, { role: 'assistant' as const, text: reviewed.summary || 'Đã nhận kết quả AI, đang tự động áp dụng...' }].slice(-12));
            
            // Tự động ghi (Auto Apply)
            if (reviewed.edits.length > 0) {
              try {
                const result = await applyWorkEdits(source, reviewed.edits, accountId);
                if (ticket !== operation.current) return;
                setSnapshot(result.after);
                setUndo({ snapshot: result.undo, edits: result.inverse });
                setMessages(items => [...items, { role: 'assistant' as const, text: 'Đã hoàn tất tự động ghi vào Google Docs.' }].slice(-12));
                onDocumentWritten();
              } catch (e) {
                if (ticket !== operation.current) return;
                setError(e instanceof Error ? e.message : 'Không tự động ghi được tài liệu.');
              }
            }
            
            setBusy(null);
          }
        });
        
        // Timeout after 2 minutes if no response
        setTimeout(() => {
          unsub();
          if (ticket === operation.current && busy === 'generate') {
            setError('Quá thời gian chờ phản hồi từ hệ thống xử lý ngầm.');
            setBusy(null);
          }
        }, 120000);
        
      } else {
        const reviewed = validateProposal(data, blocks);
        setProposal({ ...reviewed, task: requestedTask, snapshot: source });
        setSelected(reviewed.edits.map(edit => edit.blockId));
        setMessages(items => [...items, { role: 'assistant' as const, text: reviewed.summary || 'Đang tự động áp dụng thay đổi vào Docs...' }].slice(-12));
        setBusy(null);
      }
      
    } catch (e) { if (ticket === operation.current) { setError(e instanceof Error ? e.message : 'Không tạo được đề xuất.'); setBusy(null); } }
  };

  const write = async (isUndo = false) => {
    if (busy || !document) return;
    const source = isUndo ? undo?.snapshot : valid ? proposal?.snapshot : null;
    const edits = isUndo ? undo?.edits : proposal?.edits.filter(edit => selected.includes(edit.blockId));
    if (!source || !edits?.length) return;
    const ticket = ++operation.current;
    setBusy(isUndo ? 'undo' : 'write'); setError('');
    try {
      const result = await applyWorkEdits(source, edits, accountId);
      if (ticket !== operation.current) return;
      setSnapshot(result.after); setProposal(null); setSelected([]);
      setUndo(isUndo ? null : { snapshot: result.undo, edits: result.inverse });
      note(isUndo ? 'Đã hoàn tác các thay đổi của lần áp dụng vừa rồi.' : `Đã áp dụng ${edits.length} thay đổi được duyệt.`);
      setMessages(items => [...items, { role: 'assistant' as const, text: isUndo ? 'Đã hoàn tác.' : 'Đã ghi và xác nhận kết quả trong Google Docs.' }].slice(-12));
      onDocumentWritten();
    } catch (e) {
      if (ticket !== operation.current) return;
      setError(e instanceof Error ? e.message : 'Không ghi được tài liệu.');
      if (e instanceof WorkConflict || e instanceof WorkUncertain) {
        setProposal(null); setUndo(null); setSelected([]); onPreviewChange(null);
        if (e instanceof WorkUncertain) onDocumentWritten();
        note('Lỗi xung đột tài liệu. Đang nạp lại bản mới nhất...');
        setTimeout(() => void read(), 0);
      }
      note('Lệnh hoàn tác chưa được xác nhận thành công. Kiểm tra thông báo trước khi tiếp tục.');
    } finally { if (ticket === operation.current) setBusy(null); }
  };

  return <section className="ai-work" aria-label="AI Work">
    <header><div className="flex items-center gap-2 font-semibold text-slate-900"><Sparkles className="w-5 h-5 text-blue-600" />AI Work</div><p>Giao việc · Duyệt thay đổi · Áp dụng vào Docs</p></header>
    {!document && <div className="work-notice"><FileText className="w-4 h-4" />Chọn tài liệu Google Docs trước khi giao việc.</div>}
    <div className="work-read-row"><button type="button" disabled={!document || !!busy} onClick={read}>{busy === 'read' ? 'Đang đọc…' : 'Đọc tài liệu'}</button><span>{snapshot ? `${snapshot.blocks.length} đoạn hỗ trợ` : 'Chưa đọc nội dung'}</span></div>
    {snapshot && !snapshot.canEdit && <div className="work-notice">Bạn chỉ có quyền xem. Có thể tạo đề xuất; cần tạo bản sao để áp dụng.</div>}
    <div className="work-chat" aria-live="polite">{messages.length ? messages.map((message, index) => <div key={index} className={`work-message work-message-${message.role}`}><small>{message.role === 'user' ? 'Bạn' : 'AI Work'}</small><p>{message.text}</p></div>) : <p className="text-sm text-slate-500">Ví dụ: “Sửa lỗi chính tả, giữ nguyên công thức và số liệu.”</p>}</div>

    <label className="work-label">Task — có thể chỉnh sửa<textarea value={task} maxLength={4000} disabled={writing} onChange={event => { invalidate(); setTask(event.target.value); }} placeholder="Mô tả công việc, phạm vi và những phần cần giữ nguyên…" rows={4} /></label>
    <p className="work-privacy">Bấm Tạo đề xuất sẽ gửi yêu cầu và văn bản trong phạm vi đã chọn tới AI. Tài liệu chưa bị sửa.</p>
    <button type="button" className="work-primary" disabled={!document || !!busy || !task.trim()} onClick={generate}>{busy === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{busy === 'generate' ? 'Đang tạo đề xuất…' : proposal ? 'Tạo lại đề xuất' : 'Tạo đề xuất'}</button>
    {error && <p role="alert" className="work-error">{error}</p>}
    {proposal && <div className="work-proposal"><h3>{proposal.edits.length} thay đổi đề xuất</h3><p>{proposal.summary}</p>{proposal.edits.map((edit, index) => {
      const original = proposal.snapshot.blocks.find(block => block.id === edit.blockId)!;
      return <article key={edit.blockId}><label className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(edit.blockId)} disabled={writing} onChange={event => setSelected(items => event.target.checked ? [...items, edit.blockId] : items.filter(id => id !== edit.blockId))} />Thay đổi {index + 1}</label><details><summary>Nội dung gốc</summary><p>{original.text}</p></details><label className="work-label">Sau chỉnh sửa<textarea rows={3} value={edit.after} maxLength={20000} disabled={writing} onChange={event => setProposal(current => current ? { ...current, edits: current.edits.map(item => item.blockId === edit.blockId ? { ...item, after: event.target.value.replace(/[\r\n]/g, ' ') } : item) } : null)} /></label></article>;
    })}</div>}
    <div className="work-command-bar">

      {undo && <button type="button" disabled={!!busy} onClick={() => write(true)}><Undo2 className="w-4 h-4" />Hoàn tác</button>}
    </div>
    <details className="work-history"><summary>Lịch sử phiên ({history.length})</summary>{history.map((item, index) => <p key={index}>{item}</p>)}</details>
    <p className="work-privacy">Bản đầu hỗ trợ sửa văn bản trong đoạn; không sửa cấu trúc bảng, hình, phương trình hoặc định dạng tiêu đề. Highlight chỉ nằm trong bản đề xuất.</p>
  </section>;
}

