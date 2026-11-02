declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

let gapiLoaded = false;
let gisLoaded = false;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Không thể tải script: ${src}`));
    document.head.appendChild(script);
  });
}

export async function ensureGooglePickerScripts(): Promise<void> {
  if (!gapiLoaded) {
    await loadScript('https://apis.google.com/js/api.js');
    await new Promise<void>((resolve) => {
      window.gapi.load('picker', () => {
        gapiLoaded = true;
        resolve();
      });
    });
  }
  if (!gisLoaded) {
    await loadScript('https://accounts.google.com/gsi/client');
    gisLoaded = true;
  }
}

export interface GoogleDrivePickedFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  buffer: ArrayBuffer;
}

export async function openGoogleDriveFilePicker(options?: {
  clientId?: string;
  apiKey?: string;
}): Promise<GoogleDrivePickedFile[]> {
  // 1. Kiểm tra xem người dùng đã đăng nhập Google từ phiên ứng dụng chưa
  let accessToken = localStorage.getItem('GOOGLE_DRIVE_OAUTH_TOKEN') || '';

  const apiKey =
    options?.apiKey ||
    (import.meta as any).env?.VITE_GOOGLE_DRIVE_API_KEY ||
    (import.meta as any).env?.VITE_FIREBASE_API_KEY ||
    localStorage.getItem('W2L_GOOGLE_API_KEY') ||
    'AIzaSyCVpL5IwumfJ5PuTkERYxjDsA9ypr1M2_8'; // Fallback Firebase API Key có sẵn

  const clientId =
    options?.clientId ||
    (import.meta as any).env?.VITE_GOOGLE_DRIVE_CLIENT_ID ||
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
    localStorage.getItem('W2L_GOOGLE_CLIENT_ID') ||
    '341505323323-sg7ja2vt64llqulf988nu7r85kdd6d9e.apps.googleusercontent.com';

  await ensureGooglePickerScripts();

  // 2. Nếu chưa có Access Token từ phiên Google Login, xin cấp quyền qua Google Identity Services
  if (!accessToken) {
    if (!clientId) {
      throw new Error('MISSING_GOOGLE_CREDENTIALS');
    }

    accessToken = await new Promise((resolve, reject) => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.error !== undefined) {
            reject(new Error(response.error));
            return;
          }
          localStorage.setItem('GOOGLE_DRIVE_OAUTH_TOKEN', response.access_token);
          resolve(response.access_token);
        },
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  // 3. Mở Google Picker với Access Token đã có
  const pickedDocs: any[] = await new Promise((resolve, reject) => {
    try {
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
      view.setMimeTypes('application/pdf,image/png,image/jpeg');

      const pickerBuilder = new window.google.picker.PickerBuilder()
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(accessToken)
        .addView(view)
        .setCallback((data: any) => {
          if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
            resolve(data[window.google.picker.Response.DOCUMENTS] || []);
          } else if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.CANCEL) {
            resolve([]);
          }
        });

      if (apiKey) {
        pickerBuilder.setDeveloperKey(apiKey);
      }

      const picker = pickerBuilder.build();
      picker.setVisible(true);
    } catch (pickerErr) {
      reject(pickerErr);
    }
  });

  const downloadedFiles: GoogleDrivePickedFile[] = [];
  for (const doc of pickedDocs) {
    const fileId = doc[window.google.picker.Document.ID];
    const name = doc[window.google.picker.Document.NAME] || 'GoogleDrive.pdf';
    const mimeType = doc[window.google.picker.Document.MIMETYPE] || 'application/pdf';

    const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!resp.ok) {
      // Nếu token hết hạn (401), dọn dẹp token để lần sau xin token mới
      if (resp.status === 401) {
        localStorage.removeItem('GOOGLE_DRIVE_OAUTH_TOKEN');
      }
      throw new Error(`Không thể tải tệp "${name}" từ Google Drive (${resp.status})`);
    }
    const buffer = await resp.arrayBuffer();
    downloadedFiles.push({
      id: fileId,
      name,
      mimeType,
      sizeBytes: buffer.byteLength,
      buffer,
    });
  }

  return downloadedFiles;
}
