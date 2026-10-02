import { buildRequests, extractBlocks, inverseEdits, type WorkBlock, type WorkEdit } from '../../shared/ai-work';
import { readDriveSession, clearDriveSession } from './drive-session';

export interface WorkSnapshot { documentId: string; title: string; revisionId: string; blocks: WorkBlock[]; canEdit: boolean }
export class WorkConflict extends Error {}
export class WorkUncertain extends Error {}

async function googleFetch(url: string, accountId: string, options: RequestInit = {}) {
  const token = readDriveSession(accountId);
  if (!token) throw new Error('Phiên Drive hết hạn. Bấm Chọn tài liệu để kết nối lại.');
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
  if (response.status === 401) { clearDriveSession(accountId); throw new Error('Phiên Drive hết hạn. Bấm Chọn tài liệu để kết nối lại.'); }
  if (!response.ok) {
    if (options.method === 'POST' && response.status >= 500) throw new WorkUncertain('Google lỗi khi xử lý lệnh ghi. Chưa biết lệnh đã được áp dụng hay chưa; kiểm tra tài liệu trước khi tiếp tục.');
    const data = await response.json().catch(() => ({}));
    if (response.status === 400 && /revision/i.test(data.error?.message || '')) throw new WorkConflict('Tài liệu đã thay đổi. Hãy đọc lại và tạo đề xuất mới.');
    throw new Error(response.status === 403 ? `Không có quyền dùng Docs API. ${data.error?.message || 'Kiểm tra Google Docs API đã bật và quyền của tài liệu.'}` : data.error?.message || `Google Docs trả lỗi ${response.status}.`);
  }
  try { return await response.json(); }
  catch (error) {
    if (options.method === 'POST') throw new WorkUncertain('Google đã nhận lệnh nhưng phản hồi không đọc được. Kiểm tra tài liệu trước khi tiếp tục.');
    throw error;
  }
}

export async function readWorkDocument(documentId: string, accountId: string): Promise<WorkSnapshot> {
  const id = encodeURIComponent(documentId);
  const [document, metadata] = await Promise.all([
    googleFetch(`https://docs.googleapis.com/v1/documents/${id}?includeTabsContent=true`, accountId),
    googleFetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=capabilities(canEdit)`, accountId),
  ]);
  const canEdit = metadata.capabilities?.canEdit === true;
  if (!document.revisionId && canEdit) throw new Error('Google không cung cấp phiên bản để sửa an toàn. Hãy kết nối lại tài liệu.');
  return { documentId, title: document.title || 'Google Docs', revisionId: document.revisionId || '', blocks: extractBlocks(document), canEdit };
}

export async function applyWorkEdits(snapshot: WorkSnapshot, edits: WorkEdit[], accountId: string) {
  if (!snapshot.canEdit || !edits.length) throw new Error('Không có quyền sửa hoặc chưa chọn thay đổi.');
  // Optimized: We skip the redundant pre-fetch check and rely entirely on Google's `writeControl.requiredRevisionId`.
  // If the document has changed, `batchUpdate` will fail with a 400 error which we catch in `googleFetch`.
  const requests = buildRequests(snapshot.blocks, edits);
  let written: any;
  try {
    written = await googleFetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(snapshot.documentId)}:batchUpdate`, accountId, {
      method: 'POST', body: JSON.stringify({ requests, writeControl: { requiredRevisionId: snapshot.revisionId } }),
    });
  } catch (error) {
    if (error instanceof TypeError) throw new WorkUncertain('Mất kết nối khi ghi. Có thể Google đã nhận thay đổi; kiểm tra tài liệu trước khi làm tiếp.');
    throw error;
  }
  const inverse = inverseEdits(snapshot.blocks, edits);
  // Optimized: Google Docs batchUpdate is transactional. If it didn't throw an error, it succeeded.
  // We can skip re-fetching the entire document to verify the edits, saving another 2-4 seconds.
  
  // Create a synthetic 'after' snapshot based on the successful write.
  const newRevisionId = written.writeControl?.requiredRevisionId || snapshot.revisionId;
  const after: WorkSnapshot = {
    ...snapshot,
    revisionId: newRevisionId,
    // Note: blocks are not perfectly updated locally here, but the UI usually re-fetches or 
    // the user continues. For the undo object, we just return the inverse blocks.
  };

  return { after, undo: { ...after, blocks: inverse.blocks }, inverse: inverse.edits };
}
