// src/lib/google-auth.ts
let currentAccessToken: string | null = null;

export const setAccessToken = (token: string) => {
  currentAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return currentAccessToken;
};

export const initGoogleClient = (clientId: string) => {
  // Logic khởi tạo sẽ được wrap bởi @react-oauth/google ở tầng UI
  // File này giữ state token để dùng cho các hàm API fetch chay
};
