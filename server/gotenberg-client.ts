/**
 * Gotenberg Microservice Client
 * Handles high-fidelity, vector-native document to PDF conversion via LibreOffice / Chromium in Gotenberg.
 */

const SUPPORTED_OFFICE_EXTENSIONS = new Set([
  'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'odt', 'ods', 'odp', 'rtf', 'txt'
]);

const MIME_MAP: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  pdf: 'application/pdf',
};

export function isSupportedOfficeExtension(filename: string): boolean {
  if (!filename) return false;
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_OFFICE_EXTENSIONS.has(ext);
}

export function getOfficeMimeType(filename: string): string {
  if (!filename) return 'application/octet-stream';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

export function getGotenbergUrl(): string {
  const envUrl = process.env.GOTENBERG_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  // Default fallback in Docker or local dev
  return 'http://localhost:3000';
}

export async function checkGotenbergHealth(): Promise<boolean> {
  const url = getGotenbergUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export interface GotenbergConvertOptions {
  landscape?: boolean;
  pdfa?: boolean;
}

/**
 * Converts an office document Buffer to a high-fidelity vector PDF buffer using Gotenberg.
 */
export async function convertOfficeDocumentWithGotenberg(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  options?: GotenbergConvertOptions
): Promise<Buffer> {
  const url = getGotenbergUrl();
  const mimeType = getOfficeMimeType(fileName);

  const formData = new FormData();
  const fileBlob = new Blob([fileBuffer], { type: mimeType });
  formData.append('files', fileBlob, fileName);

  if (options?.landscape) {
    formData.append('landscape', 'true');
  }
  if (options?.pdfa) {
    formData.append('pdfFormat', 'PDF/A-1b');
  }

  const endpoint = `${url}/forms/libreoffice/convert`;

  const controller = new AbortController();
  const timeoutMs = 90_000; // 90 seconds max for large files
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Quá thời gian chờ biên dịch Gotenberg (${timeoutMs / 1000}s)`);
    }
    throw new Error(`Không thể kết nối đến máy chủ Gotenberg (${url}): ${err?.message || err}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Gotenberg biên dịch thất bại với mã lỗi ${res.status}: ${errText.slice(0, 300) || res.statusText}`
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/pdf')) {
    throw new Error(`Gotenberg không trả về file PDF hợp lệ (Content-Type: ${contentType})`);
  }

  const pdfArrayBuffer = await res.arrayBuffer();
  return Buffer.from(pdfArrayBuffer);
}
