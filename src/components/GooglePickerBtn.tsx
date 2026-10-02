import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { HardDrive, Copy, Loader2 } from 'lucide-react';
import { readDriveSession, saveDriveSession, clearDriveSession } from '../lib/drive-session';

export interface DriveDocument {
  id: string;
  name: string;
  ownedByMe?: boolean;
  capabilities?: { canCopy?: boolean; canEdit?: boolean };
}

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface Props {
  onFileSelect: (fileId: string) => void;
  onDocumentChange?: (document: DriveDocument) => void;
  accountId?: string;
  disabled?: boolean;
}

export const GooglePickerBtn: React.FC<Props> = ({ onFileSelect, onDocumentChange, accountId = 'anonymous', disabled = false }) => {
  const [pickerInited, setPickerInited] = useState(false);
  const developerKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const appId = import.meta.env.VITE_GOOGLE_PROJECT_NUMBER || clientId?.split('-')[0];
  const [errorMessage, setErrorMessage] = useState('');
  const [document, setDocument] = useState<DriveDocument | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [documentLink, setDocumentLink] = useState('');
  const [resourceKey, setResourceKey] = useState<string | undefined>();

  const selectDocument = async (id: string, token: string, resourceKey?: string) => {
    setBusy(true);
    setErrorMessage('');
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (resourceKey) headers['X-Goog-Drive-Resource-Keys'] = `${id}/${resourceKey}`;
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,ownedByMe,capabilities(canCopy,canEdit)`, { headers });
      if (response.status === 401) clearDriveSession(accountId);
      if (!response.ok) throw new Error(response.status === 401 ? 'Phiên Google đã hết hạn. Hãy chọn lại tài liệu.' : 'Không đọc được tài liệu. Kiểm tra quyền chia sẻ và tài khoản Google đã chọn.');
      const file = await response.json();
      if (file.mimeType !== 'application/vnd.google-apps.document') throw new Error('Vui lòng chọn tài liệu Google Docs.');
      setDocument(file);
      setResourceKey(resourceKey);
      setAccessToken(token);
      onFileSelect(file.id);
      onDocumentChange?.(file);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không mở được tài liệu.');
    } finally { setBusy(false); }
  };

  const copyDocument = async () => {
    if (!document || !document.capabilities?.canCopy || busy || disabled) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(document.id)}/copy?supportsAllDrives=true&fields=id`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(resourceKey ? { 'X-Goog-Drive-Resource-Keys': `${document.id}/${resourceKey}` } : {}) },
        body: JSON.stringify({ name: `Bản sao - ${document.name}`, parents: ['root'] }),
      });
      if (response.status === 401) clearDriveSession(accountId);
      if (!response.ok) throw new Error(response.status === 401 ? 'Phiên Google đã hết hạn. Hãy chọn lại tài liệu.' : 'Google không cho phép sao chép tài liệu này. Kiểm tra quyền của chủ sở hữu.');
      const copy = await response.json();
      await selectDocument(copy.id, accessToken);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không tạo được bản sao.');
    } finally { setBusy(false); }
  };

  useEffect(() => {
    // Load the Picker API
    const loadPicker = () => {
      if (window.gapi) {
        window.gapi.load('picker', () => {
          setPickerInited(true);
        });
      }
    };

    if (window.gapi) {
      loadPicker();
    } else {
      // In case gapi script is still loading
      const interval = setInterval(() => {
        if (window.gapi) {
          clearInterval(interval);
          loadPicker();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  const openPicker = (token: string) => {
      if (!pickerInited || !window.google || !window.google.picker) {
        setErrorMessage('Google Picker chưa tải xong. Vui lòng thử lại.');
        return;
      }

      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setMimeTypes('application/vnd.google-apps.document').setIncludeFolders(true).setLabel('Tất cả tài liệu');
      const sharedView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setMimeTypes('application/vnd.google-apps.document').setOwnedByMe(false).setLabel('Được chia sẻ với tôi');
      const drivesView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setMimeTypes('application/vnd.google-apps.document').setEnableDrives(true).setLabel('Bộ nhớ dùng chung');
      const linkId = documentLink.trim().match(/(?:\/document\/d\/|^)([\w-]{20,})(?:[/?#]|$)/)?.[1];
      if (linkId) view.setFileIds([linkId]);

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .addView(sharedView)
        .addView(drivesView)
        .setTitle('Chọn Google Docs · Cá nhân và được chia sẻ')
        .setOAuthToken(token)
        .setDeveloperKey(developerKey)
        .setAppId(appId)
        .setOrigin(window.location.origin)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs[0];
            void selectDocument(doc.id, token, doc.resourceKey);
          }
        })
        .build();

      picker.setVisible(true);
  };

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.file',
    prompt: '',
    onSuccess: (tokenResponse) => {
      saveDriveSession(accountId, tokenResponse.access_token, tokenResponse.expires_in);
      openPicker(tokenResponse.access_token);
    },
    onError: () => setErrorMessage('Google chưa cấp quyền chọn tài liệu. Vui lòng thử lại.'),
    onNonOAuthError: () => setErrorMessage('Không mở được cửa sổ Google. Hãy cho phép popup rồi thử lại.'),
  });

  const handleButtonClick = () => {
      if (disabled) return;
      setErrorMessage('');
      if (!clientId || clientId === "mock-client-id") {
          alert("Lỗi cấu hình: Vui lòng thêm VITE_GOOGLE_CLIENT_ID vào file .env của bạn (Tạo từ Google Cloud Console > APIs & Services > Credentials > OAuth client ID).");
          return;
      }
      if (!developerKey || !/^\d+$/.test(appId || '')) {
        setErrorMessage('Thiếu API key hoặc số dự án Google Picker.');
        return;
      }
      if (!pickerInited) {
        setErrorMessage('Google Picker đang tải. Vui lòng thử lại sau vài giây.');
        return;
      }
      if (documentLink.trim() && !documentLink.trim().match(/(?:\/document\/d\/|^)([\w-]{20,})(?:[/?#]|$)/)) {
        setErrorMessage('Dán link Google Docs hoặc ID tài liệu hợp lệ.');
        return;
      }
      const cachedToken = readDriveSession(accountId);
      if (cachedToken) openPicker(cachedToken);
      else login();
  };

  return (
    <div className="sync-drive-actions">
    <button
      onClick={handleButtonClick}
      disabled={busy || disabled}
      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
      {busy ? 'Đang xử lý…' : 'Chọn tài liệu'}
    </button>
    <button type="button" className="text-xs text-slate-500 hover:text-blue-600" disabled={busy || disabled} onClick={() => { clearDriveSession(accountId); login({ prompt: 'select_account' }); }}>Đổi tài khoản</button>
    <details className="text-xs text-slate-500"><summary className="cursor-pointer">Có link tài liệu?</summary><input aria-label="Link hoặc ID Google Docs" type="text" value={documentLink} onChange={event => setDocumentLink(event.target.value)} placeholder="Dán link rồi bấm Chọn từ Google Drive" className="mt-2 w-72 max-w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></details>
    {document && document.ownedByMe === false && <div className="sync-copy-suggestion" role="status">
      <span>{document.capabilities?.canCopy ? 'Tệp được chia sẻ' : 'Không có quyền sao chép'}</span>
      {document.capabilities?.canCopy && <button onClick={copyDocument} disabled={busy || disabled} className="inline-flex items-center gap-1.5 font-semibold text-blue-700 disabled:opacity-50 whitespace-nowrap"><Copy className="w-4 h-4" /> Tạo bản sao</button>}
    </div>}
    {errorMessage && <p role="alert" className="mt-2 text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
};
