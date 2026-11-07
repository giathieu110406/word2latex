/**
 * Vercel Edge Routing Proxy
 * Tự động chuyển tiếp toàn bộ yêu cầu /api/* từ domain chính (word2latex.io.vn)
 * sang Google Cloud Run backend (word2latexbackend-341505323323.asia-southeast1.run.app)
 * ở tầng Edge trước khi chạm vào filesystem, loại bỏ hoàn toàn lỗi CORS.
 */

const CLOUD_RUN_BACKEND = 'https://word2latexbackend-341505323323.asia-southeast1.run.app';

export default async function proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Chỉ chuyển tiếp các request tới /api/*
  if (url.pathname.startsWith('/api/')) {
    const targetUrl = new URL(url.pathname + url.search, CLOUD_RUN_BACKEND);

    // Chuẩn bị headers chuyển tiếp
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.set('x-forwarded-host', url.host);
    forwardHeaders.set('x-forwarded-proto', url.protocol.replace(':', ''));

    const init: RequestInit = {
      method: request.method,
      headers: forwardHeaders,
      redirect: 'manual',
    };

    // Chỉ đính kèm body cho các phương thức có payload
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      // @ts-ignore
      init.duplex = 'half';
    }

    try {
      return await fetch(targetUrl.toString(), init);
    } catch (err: any) {
      console.error('[Vercel Edge Proxy Error]:', err);
      return new Response(JSON.stringify({ error: 'Lỗi kết nối tới Cloud Run Backend', detail: err?.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Đối với các static assets hoặc trang web, cho phép Vercel xử lý bình thường
  return fetch(request);
}
