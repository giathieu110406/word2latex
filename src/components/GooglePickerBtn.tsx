// src/components/GooglePickerBtn.tsx
import React from 'react';

interface Props {
  onFileSelect: (fileId: string) => void;
}

export const GooglePickerBtn: React.FC<Props> = ({ onFileSelect }) => {
  const handleClick = () => {
    // Logic gapi.picker thực tế sẽ được thêm vào sau, mock tạm thời
    // Trong thực tế, bạn sẽ dùng gapi.client load thư viện picker
    onFileSelect('mock_file_id');
  };

  return (
    <button 
      onClick={handleClick}
      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center gap-2"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 13h10v-2H7v2zm0 4h10v-2H7v2zm-4 4h18V3H3v18z" /></svg>
      Chọn từ Google Drive
    </button>
  );
};
