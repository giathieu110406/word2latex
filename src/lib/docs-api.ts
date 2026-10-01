// src/lib/docs-api.ts
import { getAccessToken } from './google-auth';

export const getDocumentContent = async (docId: string): Promise<any> => {
  const token = getAccessToken();
  if (!token) throw new Error("Chưa đăng nhập Google");

  const response = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  return response.json();
};

export const updateDocument = async (
  docId: string, 
  startIndex: number, 
  endIndex: number, 
  newText: string
): Promise<boolean> => {
  const token = getAccessToken();
  if (!token) throw new Error("Chưa đăng nhập Google");

  // Quy trình: Xóa đoạn cũ (nếu có), sau đó chèn mới
  const requests = [];
  
  if (endIndex > startIndex) {
    requests.push({
      deleteContentRange: {
        range: { startIndex, endIndex }
      }
    });
  }
  
  requests.push({
    insertText: {
      location: { index: startIndex },
      text: newText
    }
  });

  const response = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests })
  });

  return response.ok;
};
