import * as pdfjsLib from 'pdfjs-dist';

// Configure worker for pdfjs-dist in Vite
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export async function renderPdfPageThumbnail(
  rawData: ArrayBuffer,
  pageIndex: number,
  targetWidth = 260
): Promise<string> {
  if (typeof document === 'undefined') return '';
  try {
    const dataCopy = rawData.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(dataCopy) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageIndex + 1);

    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / unscaledViewport.width;
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

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    await loadingTask.destroy();
    return dataUrl;
  } catch (err) {
    console.error('Error rendering PDF page thumbnail:', err);
    return '';
  }
}
