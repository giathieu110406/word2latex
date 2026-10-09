import { useEffect } from 'react';
import { authFetch } from '../utils/api-client';
import { logApiUsage } from '../utils/logger';

declare global {
  interface Window {
    word2latexDrawingFetch?: typeof authFetch;
    word2latexDrawingLog?: typeof logApiUsage;
  }
}

export function DrawingWorkspace({ active }: { active: boolean }) {
  useEffect(() => {
    window.word2latexDrawingFetch = authFetch;
    window.word2latexDrawingLog = logApiUsage;
    return () => { delete window.word2latexDrawingFetch; delete window.word2latexDrawingLog; };
  }, []);

  return (
    <section aria-label="Vẽ hình" hidden={!active} className="w-full flex-1 min-h-0" style={{ display: active ? 'flex' : 'none' }}>
      <iframe
        title="Vẽ Hình — bảng vẽ tương tác"
        src="/ve-hinh/index.html"
        className="w-full h-full flex-1 border-0 bg-white"
        allow="camera; clipboard-write"
      />
    </section>
  );
}
