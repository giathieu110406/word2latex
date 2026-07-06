import React, { useState, useEffect } from 'react';
import { File, Folder, Download, Search, RefreshCw, AlertCircle, HardDrive } from 'lucide-react';
import { authorizeGoogleDrive, getDriveAccessToken } from '../lib/googleDriveAuth';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
}

export default function GoogleDriveManager() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'My Drive' }]);

  useEffect(() => {
    const token = getDriveAccessToken();
    if (token) {
      setNeedsAuth(false);
      fetchFiles(token, 'root');
    }
  }, []);

  const handleAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await authorizeGoogleDrive();
      if (result?.accessToken) {
        setNeedsAuth(false);
        fetchFiles(result.accessToken, 'root');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi xác thực Google Drive');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async (token: string, folderId: string, query: string = '') => {
    try {
      setLoading(true);
      setError(null);
      
      let q = `'${folderId}' in parents and trashed = false`;
      if (query) {
        q = `name contains '${query}' and trashed = false`;
      }
      
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=folder,name`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách file');
      if (err.status === 401) {
        setNeedsAuth(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const token = getDriveAccessToken();
    if (token) {
      fetchFiles(token, currentFolderId, searchQuery);
    }
  };

  const handleFileClick = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      setCurrentFolderId(file.id);
      setFolderPath([...folderPath, { id: file.id, name: file.name }]);
      const token = getDriveAccessToken();
      if (token) fetchFiles(token, file.id);
    } else {
      // Could open preview or download
      alert(`Đã chọn file: ${file.name}`);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    const targetFolderId = newPath[newPath.length - 1].id;
    setCurrentFolderId(targetFolderId);
    const token = getDriveAccessToken();
    if (token) fetchFiles(token, targetFolderId);
  };

  const formatSize = (bytes?: string) => {
    if (!bytes) return '--';
    const b = parseInt(bytes);
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (needsAuth) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
        <HardDrive className="w-16 h-16 text-indigo-500 mb-6" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Google Drive Integration</h2>
        <p className="text-slate-500 text-center max-w-md mb-8">
          Kết nối với Google Drive của bạn để dễ dàng quản lý, nhập và xử lý tài liệu trực tiếp từ Word2LaTeX.
        </p>
        <button
          onClick={handleAuth}
          disabled={loading}
          className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-300 rounded-xl shadow-sm text-slate-700 font-semibold hover:bg-slate-50 transition-all focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 block">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
          )}
          <span>Kết nối Google Drive</span>
        </button>
        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-120px)]">
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50">
        <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 sm:pb-0 hide-scrollbar">
          {folderPath.map((folder, index) => (
            <React.Fragment key={folder.id}>
              {index > 0 && <span className="text-slate-400">/</span>}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={`whitespace-nowrap hover:text-indigo-600 transition-colors ${index === folderPath.length - 1 ? 'font-semibold text-slate-800' : 'text-slate-600'}`}
              >
                {folder.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        
        <form onSubmit={handleSearch} className="relative w-full sm:w-64 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm file..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
            <p>Đang tải tệp...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Folder className="w-12 h-12 mb-4 text-slate-300" />
            <p>Thư mục trống</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-2">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => handleFileClick(file)}
                className="group p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col h-32"
              >
                <div className="flex items-start justify-between mb-auto">
                  {file.mimeType === 'application/vnd.google-apps.folder' ? (
                    <Folder className="w-8 h-8 text-blue-500" fill="currentColor" fillOpacity={0.2} />
                  ) : (
                    <File className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-slate-800 text-sm line-clamp-2 leading-tight mb-1 group-hover:text-indigo-700">
                    {file.name}
                  </h3>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
                    {file.size && <span>{formatSize(file.size)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
