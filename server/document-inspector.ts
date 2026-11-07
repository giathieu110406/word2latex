import JSZip from 'jszip';

export interface DocumentInspectionResult {
  hasImagesOrScan: boolean;
  reason:
    | 'image_file'
    | 'multimedia'
    | 'docx_embedded_media'
    | 'docx_pure_text'
    | 'pdf_contains_images'
    | 'pdf_pure_text'
    | 'pure_tabular_text'
    | 'unknown';
  detail?: string;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'gif', 'svg']);
const MULTIMEDIA_EXTENSIONS = new Set(['mp3', 'wav', 'mp4', 'm4a', 'ogg', 'webm']);
const PURE_TEXT_EXTENSIONS = new Set(['csv', 'tsv', 'txt', 'xlsx', 'xls', 'ods']);

/**
 * Phân tích nhanh cấu trúc nhị phân của tệp trong RAM (< 5ms)
 * để xác định xem tệp có chứa hình ảnh, sơ đồ hoặc scan hay không.
 */
export async function inspectDocumentMedia(
  buffer: Buffer,
  mimeType: string = '',
  filename: string = ''
): Promise<DocumentInspectionResult> {
  const lowerExt = (filename.split('.').pop() || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  // 1. Tệp hình ảnh trực tiếp
  if (IMAGE_EXTENSIONS.has(lowerExt) || lowerMime.startsWith('image/')) {
    return {
      hasImagesOrScan: true,
      reason: 'image_file',
      detail: `Tệp ảnh định dạng .${lowerExt || 'image'}`,
    };
  }

  // 2. Tệp âm thanh / video
  if (MULTIMEDIA_EXTENSIONS.has(lowerExt) || lowerMime.startsWith('audio/') || lowerMime.startsWith('video/')) {
    return {
      hasImagesOrScan: true,
      reason: 'multimedia',
      detail: `Tệp đa phương tiện .${lowerExt}`,
    };
  }

  // 3. Tệp bảng tính hoặc văn bản thuần
  if (PURE_TEXT_EXTENSIONS.has(lowerExt) || lowerMime.includes('spreadsheet') || lowerMime === 'text/csv' || lowerMime === 'text/plain') {
    return {
      hasImagesOrScan: false,
      reason: 'pure_tabular_text',
      detail: `Tệp bảng tính hoặc văn bản thuần .${lowerExt}`,
    };
  }

  // 4. Tệp Word (.docx)
  if (lowerExt === 'docx' || lowerMime.includes('wordprocessingml')) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const fileNames = Object.keys(zip.files);
      const hasMediaFolder = fileNames.some((f) => f.startsWith('word/media/') && !zip.files[f].dir);

      if (hasMediaFolder) {
        return {
          hasImagesOrScan: true,
          reason: 'docx_embedded_media',
          detail: 'DOCX có chứa thư mục hình ảnh word/media/',
        };
      }

      // Kiểm tra thêm thẻ <w:drawing> trong word/document.xml
      const docXml = zip.files['word/document.xml'];
      if (docXml) {
        const textXml = await docXml.async('text');
        if (textXml.includes('<w:drawing') || textXml.includes('<w:pict')) {
          return {
            hasImagesOrScan: true,
            reason: 'docx_embedded_media',
            detail: 'DOCX có chứa khối vẽ đồ họa <w:drawing>',
          };
        }
      }

      return {
        hasImagesOrScan: false,
        reason: 'docx_pure_text',
        detail: 'DOCX thuần văn bản, không chứa ảnh',
      };
    } catch {
      // Nếu không parse được zip, coi như fallback thuần text
      return {
        hasImagesOrScan: false,
        reason: 'docx_pure_text',
      };
    }
  }

  // 5. Tệp PDF
  if (lowerExt === 'pdf' || lowerMime.includes('application/pdf')) {
    const rawContent = buffer.toString('latin1');

    // Kiểm tra sự xuất hiện của Image XObject trong cấu trúc PDF
    const hasImageObject =
      /\/Subtype\s*\/Image\b/i.test(rawContent) ||
      /\/Type\s*\/XObject[\s\S]{0,100}\/Subtype\s*\/Image\b/i.test(rawContent);

    if (hasImageObject) {
      return {
        hasImagesOrScan: true,
        reason: 'pdf_contains_images',
        detail: 'PDF có chứa các đối tượng hình ảnh XObject /Image',
      };
    }

    return {
      hasImagesOrScan: false,
      reason: 'pdf_pure_text',
      detail: 'PDF thuần văn bản text layer',
    };
  }

  // Mặc định cho các loại tệp khác
  return {
    hasImagesOrScan: false,
    reason: 'unknown',
  };
}
