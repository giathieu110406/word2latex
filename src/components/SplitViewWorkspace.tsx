// src/components/SplitViewWorkspace.tsx
import React from 'react';

interface Props {
  documentId: string | null;
}

export const SplitViewWorkspace: React.FC<Props> = ({ documentId }) => {
  return (
    <div className="flex h-screen w-full flex-col md:flex-row overflow-hidden bg-gray-50">
      {/* Left Panel: AI Workspace */}
      <div 
        data-testid="left-panel-ai" 
        className="w-full md:w-1/2 h-full border-r border-gray-200 flex flex-col p-4"
      >
        <h2 className="text-xl font-bold mb-4">AI Workspace</h2>
        <div className="flex-1 bg-white border border-gray-300 rounded shadow-sm p-4 overflow-auto">
          {/* Nơi chứa trình soạn thảo KaTeX / AI prompts sẽ đặt ở đây */}
          <p className="text-gray-500">Khu vực phân tích và chuẩn hóa Toán học</p>
        </div>
      </div>

      {/* Right Panel: Google Docs iframe */}
      <div 
        data-testid="right-panel-docs" 
        className="w-full md:w-1/2 h-full bg-white relative"
      >
        {documentId ? (
          <iframe
            src={`https://docs.google.com/document/d/${documentId}/edit?rm=minimal`}
            className="w-full h-full border-none"
            allow="clipboard-read; clipboard-write"
            title="Google Docs Live View"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Hãy chọn một tài liệu từ Google Drive để xem trước
          </div>
        )}
      </div>
    </div>
  );
};
