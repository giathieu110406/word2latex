export interface ImageAsset {
  id: string;
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  widthPct: number;
  name?: string;
}

const imageRegistry = new Map<string, ImageAsset>();
let imageCounter = 0;

export function clearImageRegistryForTests(): void {
  imageRegistry.clear();
  imageCounter = 0;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(cleaned, 'base64'));
  }
  const binString = atob(cleaned);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Đọc kích thước (width, height) trực tiếp từ header nhị phân của PNG, JPEG, GIF, WebP.
 * Không phụ thuộc vào DOM Image async, chạy đồng bộ trong cả Node.js và Browser.
 */
export function parseImageDimensionsFromBase64(
  base64Data: string,
  mimeType = 'image/png'
): { width: number; height: number } {
  try {
    const bytes = decodeBase64ToBytes(base64Data);
    // 1. PNG: bytes 0..7 là signature, IHDR bắt đầu ở byte 8, width tại 16..19, height tại 20..23 (Big Endian)
    if (
      bytes.length >= 24 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(16, false);
      const height = view.getUint32(20, false);
      if (width > 0 && height > 0) return { width, height };
    }

    // 2. GIF: "GIF87a" hoặc "GIF89a", width ở 6..7, height ở 8..9 (Little Endian)
    if (
      bytes.length >= 10 &&
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46
    ) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint16(6, true);
      const height = view.getUint16(8, true);
      if (width > 0 && height > 0) return { width, height };
    }

    // 3. JPEG: Tìm SOF0/SOF2 marker (0xFF 0xC0..0xCF, trừ 0xC4, 0xC8, 0xCC)
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = bytes[offset + 1];
        if (marker === 0xff) {
          offset++;
          continue;
        }
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        ) {
          const height = view.getUint16(offset + 5, false);
          const width = view.getUint16(offset + 7, false);
          if (width > 0 && height > 0) return { width, height };
          break;
        }
        const segLen = view.getUint16(offset + 2, false);
        if (segLen < 2) break;
        offset += 2 + segLen;
      }
    }

    // 4. WebP: "RIFF"...."WEBP"
    if (
      bytes.length >= 30 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      // VP8X
      if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
        const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
        const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
        if (width > 0 && height > 0) return { width, height };
      }
      // VP8L
      if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4c) {
        const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        if (width > 0 && height > 0) return { width, height };
      }
    }
  } catch {
    // Fallback below
  }
  void mimeType;
  return { width: 420, height: 280 };
}

export function registerImageAsset(
  dataUrl: string,
  widthPct = 50,
  name?: string
): ImageAsset {
  const normalizedUrl = dataUrl.trim();

  const match = normalizedUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  const mimeType = match ? match[1].toLowerCase() : 'image/png';
  const base64Data = match ? match[2] : normalizedUrl;
  const { width, height } = parseImageDimensionsFromBase64(base64Data, mimeType);

  imageCounter += 1;
  const id = `img_${Date.now().toString(36)}_${imageCounter}`;
  const clampedPct = Math.max(15, Math.min(100, Math.round(widthPct)));

  const asset: ImageAsset = {
    id,
    dataUrl: normalizedUrl,
    mimeType,
    width,
    height,
    widthPct: clampedPct,
    name: name || 'Hình minh họa',
  };

  imageRegistry.set(id, asset);
  return asset;
}

export function getImageAsset(id: string): ImageAsset | undefined {
  return imageRegistry.get(id);
}

export function updateImageAssetWidth(id: string, widthPct: number): void {
  const asset = imageRegistry.get(id);
  if (asset) {
    asset.widthPct = Math.max(15, Math.min(100, Math.round(widthPct)));
  }
}

const IMG_TOKEN_REGEX = /!\[([^\]]*)\]\(img:(img_[a-zA-Z0-9_]+)(?:#w=(\d+))?\)/g;
const RAW_DATA_IMG_REGEX = /!\[([^\]]*)\]\((data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=\s]+)\)/g;

export function extractQuestionImageIds(text: string): string[] {
  if (!text) return [];
  const ids: string[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  const tokenRe = new RegExp(IMG_TOKEN_REGEX.source, 'g');
  while ((match = tokenRe.exec(text)) !== null) {
    const id = match[2];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  const rawRe = new RegExp(RAW_DATA_IMG_REGEX.source, 'g');
  while ((match = rawRe.exec(text)) !== null) {
    const asset = registerImageAsset(match[2], 50, match[1] || undefined);
    if (!seen.has(asset.id)) {
      seen.add(asset.id);
      ids.push(asset.id);
    }
  }
  return ids;
}

export function insertImageTokenAtCursor(
  currentText: string,
  imageId: string,
  selectionStart?: number,
  selectionEnd?: number
): { text: string; nextCursor: number } {
  const asset = imageRegistry.get(imageId);
  const label = asset?.name || 'Hình minh họa';
  const token = `![${label}](img:${imageId})`;

  if (typeof selectionStart === 'number' && selectionStart >= 0 && selectionStart <= currentText.length) {
    const end = typeof selectionEnd === 'number' && selectionEnd >= selectionStart ? selectionEnd : selectionStart;
    const before = currentText.slice(0, selectionStart);
    const after = currentText.slice(end);
    const needLeadingNewline = before.length > 0 && !before.endsWith('\n') && !before.endsWith(' ');
    const prefix = needLeadingNewline ? '\n' : '';
    const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
    const nextText = `${before}${prefix}${token}${suffix}${after}`;
    const nextCursor = before.length + prefix.length + token.length;
    return { text: nextText, nextCursor };
  }

  const trimmed = currentText.trimEnd();
  const nextText = trimmed ? `${trimmed}\n${token}` : token;
  return { text: nextText, nextCursor: nextText.length };
}

export function removeImageTokenFromText(currentText: string, imageId: string): string {
  if (!currentText) return '';
  const escapedId = imageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\n?!\\[[^\\]]*\\]\\(img:${escapedId}(?:#w=\\d+)?\\)\\n?`, 'g');
  return currentText.replace(re, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Chuyển đổi mọi token `![...](img:id)` hoặc `![...](data:image/...)` thành thẻ HTML `<img>`
 * có gắn `data-width-pct`, `data-image-id`, `data-natural-width`, `data-natural-height` để cả Preview A4 và `word-export.ts` sử dụng.
 */
export function resolveImageTokensToMarkdown(text: string): string {
  if (!text) return '';
  let output = text.replace(RAW_DATA_IMG_REGEX, (_full, alt, dataUrl) => {
    const asset = registerImageAsset(dataUrl, 50, alt || undefined);
    return `![${alt || asset.name || 'Hình minh họa'}](img:${asset.id})`;
  });

  output = output.replace(IMG_TOKEN_REGEX, (_full, alt, id, explicitWidth) => {
    const asset = imageRegistry.get(id);
    if (!asset) return '';
    const widthPct = explicitWidth ? Math.max(15, Math.min(100, Number(explicitWidth))) : asset.widthPct;
    const safeAlt = (alt || asset.name || 'Hình minh họa').replace(/"/g, '&quot;');
    return `<img src="${asset.dataUrl}" alt="${safeAlt}" data-image-id="${asset.id}" data-width-pct="${widthPct}" data-natural-width="${asset.width}" data-natural-height="${asset.height}" style="max-width:${widthPct}%; height:auto; display:block; margin:6px auto; border-radius:6px;" />`;
  });

  return output;
}

/**
 * Thay thế toàn bộ ảnh (`![...](img:...)`, `![...](data:image/...)`, `<img src="data:image/...">`)
 * bằng token siêu nhẹ `[[IMG_0]]`, `[[IMG_1]]` trước khi gửi qua AI hoặc bộ tách câu.
 */
export function maskImagesForAi(text: string): {
  maskedText: string;
  restoreImages: (aiText: string) => string;
} {
  if (!text) {
    return { maskedText: '', restoreImages: (s) => s };
  }
  const slotToAssetId: string[] = [];

  const registerSlot = (assetId: string): string => {
    const idx = slotToAssetId.length;
    slotToAssetId.push(assetId);
    return `[[IMG_${idx}]]`;
  };

  let masked = text.replace(
    /<img\b[^>]*\bsrc=["'](data:image\/[a-zA-Z0-9.+-]+;base64,[^"']+)["'][^>]*>/gi,
    (_m, dataUrl) => {
      const asset = registerImageAsset(dataUrl, 50);
      return registerSlot(asset.id);
    }
  );

  masked = masked.replace(RAW_DATA_IMG_REGEX, (_m, alt, dataUrl) => {
    const asset = registerImageAsset(dataUrl, 50, alt || undefined);
    return registerSlot(asset.id);
  });

  masked = masked.replace(IMG_TOKEN_REGEX, (_m, _alt, id) => {
    return registerSlot(id);
  });

  const restoreImages = (aiText: string): string => {
    if (!aiText) return '';
    return aiText.replace(/\[\[IMG_(\d+)\]\]/g, (full, idxStr) => {
      const assetId = slotToAssetId[Number(idxStr)];
      if (!assetId) return full;
      const asset = imageRegistry.get(assetId);
      const label = asset?.name || `Hình ${Number(idxStr) + 1}`;
      return `![${label}](img:${assetId})`;
    });
  };

  return { maskedText: masked, restoreImages };
}

/**
 * Nén và chuẩn hóa File/Blob hình ảnh sang PNG DataURL trên trình duyệt qua HTML5 Canvas.
 * Đảm bảo tương thích tuyệt đối với OpenXML Word (`image/png`) và giữ dung lượng nhẹ (< 150KB).
 */
export async function compressImageFileToDataUrl(
  file: File | Blob,
  maxWidth = 1000
): Promise<{ dataUrl: string; width: number; height: number }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    const match = rawDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    const dims = parseImageDimensionsFromBase64(match ? match[2] : rawDataUrl, match ? match[1] : 'image/png');
    return { dataUrl: rawDataUrl, ...dims };
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      let targetW = img.naturalWidth || img.width || 400;
      let targetH = img.naturalHeight || img.height || 300;
      if (targetW > maxWidth) {
        const ratio = maxWidth / targetW;
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const pngDataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl: pngDataUrl, width: targetW, height: targetH });
      } else {
        resolve({ dataUrl: rawDataUrl, width: targetW, height: targetH });
      }
    };
    img.onerror = () => {
      resolve({ dataUrl: rawDataUrl, width: 400, height: 300 });
    };
    img.src = rawDataUrl;
  });
}

/**
 * Cắt các vùng hình vẽ minh họa (Diagram Bounding Boxes) từ ảnh đề thi gốc dựa trên tọa độ chuẩn hóa [ymin, xmin, ymax, xmax] (thang 0..1000 của Gemini Vision).
 */
export async function cropRegionsFromImageDataUrl(
  sourceDataUrl: string,
  boxes: Array<{ id: string; box_2d: [number, number, number, number]; label?: string }>
): Promise<Record<string, ImageAsset>> {
  const result: Record<string, ImageAsset> = {};
  if (!boxes || boxes.length === 0 || typeof document === 'undefined' || typeof window === 'undefined') {
    return result;
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const natW = img.naturalWidth || img.width;
      const natH = img.naturalHeight || img.height;

      for (const item of boxes) {
        const [ymin, xmin, ymax, xmax] = item.box_2d;
        const pad = 12; // padding nhẹ 1.2% để không mất nhãn điểm hình học (A, B, C, O, x, y)
        const y1 = Math.max(0, Math.floor(((ymin - pad) / 1000) * natH));
        const x1 = Math.max(0, Math.floor(((xmin - pad) / 1000) * natW));
        const y2 = Math.min(natH, Math.ceil(((ymax + pad) / 1000) * natH));
        const x2 = Math.min(natW, Math.ceil(((xmax + pad) / 1000) * natW));

        const cropW = Math.max(24, x2 - x1);
        const cropH = Math.max(24, y2 - y1);

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, cropW, cropH);
          ctx.drawImage(img, x1, y1, cropW, cropH, 0, 0, cropW, cropH);
          const croppedUrl = canvas.toDataURL('image/png');
          result[item.id] = registerImageAsset(croppedUrl, 45, item.label || `Hình ${item.id}`);
        }
      }
      resolve(result);
    };
    img.onerror = () => resolve(result);
    img.src = sourceDataUrl;
  });
}
