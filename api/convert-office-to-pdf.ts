import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  convertOfficeDocumentWithGotenberg, 
  isSupportedOfficeExtension 
} from '../server/gotenberg-client.js';
import { verifyAuthAndApproval } from '../server/auth-guard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });
  }

  // Xác thực token nếu có (đảm bảo bảo mật trên môi trường production)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const authCheck = await verifyAuthAndApproval(req);
    if (!authCheck.authorized) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }
  }

  try {
    const { 
      fileBase64, 
      fileData, 
      fileName, 
      filename, 
      landscape, 
      pdfa 
    } = req.body || {};

    const rawBase64 = fileBase64 || fileData;
    const resolvedName = (fileName || filename || 'document.docx').trim();

    if (!rawBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu tệp (fileBase64 / fileData)' });
    }

    if (!isSupportedOfficeExtension(resolvedName)) {
      return res.status(400).json({ 
        error: `Định dạng tệp "${resolvedName}" không được hỗ trợ để biên dịch sang PDF vector. Các định dạng hỗ trợ: .docx, .doc, .pptx, .ppt, .xlsx, .xls, .odt, .ods, .odp, .rtf, .txt` 
      });
    }

    // Clean base64 header if present (e.g. data:application/vnd...;base64,...)
    const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
    const fileBuffer = Buffer.from(cleanBase64, 'base64');

    if (fileBuffer.length === 0) {
      return res.status(400).json({ error: 'Dữ liệu tệp tải lên rỗng (0 bytes)' });
    }

    // Thực hiện biên dịch qua Gotenberg LibreOffice Engine
    const pdfBuffer = await convertOfficeDocumentWithGotenberg(fileBuffer, resolvedName, {
      landscape: Boolean(landscape),
      pdfa: Boolean(pdfa),
    });

    const safeDownloadName = encodeURIComponent(
      resolvedName.replace(/\.[^/.]+$/, '') + '.pdf'
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${safeDownloadName}"; filename*=UTF-8''${safeDownloadName}`
    );

    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error('[API /api/convert-office-to-pdf Error]:', error);
    return res.status(502).json({ 
      error: error?.message || 'Lỗi khi biên dịch tài liệu sang PDF qua máy chủ' 
    });
  }
}
