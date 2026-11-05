import * as pdfjsLib from 'pdfjs-dist';

// Configure worker for pdfjs-dist in Vite
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

// Cache PDFDocumentProxy instances theo ArrayBuffer để không phải parse lại toàn bộ PDF cho mỗi trang
const pdfDocCache = new WeakMap<ArrayBuffer, Promise<pdfjsLib.PDFDocumentProxy>>();

function getCachedPdfDocument(rawData: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  let cached = pdfDocCache.get(rawData);
  if (!cached) {
    const dataCopy = rawData.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(dataCopy) });
    cached = loadingTask.promise.catch((err) => {
      pdfDocCache.delete(rawData);
      throw err;
    });
    pdfDocCache.set(rawData, cached);
  }
  return cached;
}

export async function renderPdfPageThumbnail(
  rawData: ArrayBuffer,
  pageIndex: number,
  targetWidth = 360
): Promise<string> {
  if (typeof document === 'undefined') return '';
  try {
    const pdf = await getCachedPdfDocument(rawData);
    const page = await pdf.getPage(pageIndex + 1);

    const unscaledViewport = page.getViewport({ scale: 1 });
    // Với trang nằm ngang (landscape), dùng cạnh lớn hơn để đảm bảo độ phân giải sắc nét tương đương Retina
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1.5;
    const effectiveTarget = targetWidth * Math.max(1.25, dpr);
    const scale = effectiveTarget / Math.max(unscaledViewport.width, 1);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as any).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    page.cleanup();
    return dataUrl;
  } catch (err) {
    console.error('Error rendering PDF page thumbnail:', err);
    return '';
  }
}
