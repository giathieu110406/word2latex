import { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from "crypto";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

const SECRET_KEY = "graphic-heading-0km1r-secret-token-key";

function generateApprovalToken(uid: string): string {
  return crypto.createHmac("sha256", SECRET_KEY).update(uid).digest("hex");
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "AIzaSyCVpL5IwumfJ5PuTkERYxjDsA9ypr1M2_8",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || "word2latex-prod-fde7b.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "word2latex-prod-fde7b",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "word2latex-prod-fde7b.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "341505323323",
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || "1:341505323323:web:8ba2fc4bb7e14a6fa6871e",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    // Approve user via email link
    const { uid, token } = req.query;

    if (!uid || !token) {
      return res.status(400).send(`
        <div style="font-family: 'Segoe UI', system-ui, sans-serif; text-align: center; padding: 50px; background: #fafafa; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
          <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); max-width: 500px; border: 1px solid #fca5a5;">
            <h2 style="color: #ef4444; margin-top: 0;">Lỗi Phê Duyệt</h2>
            <p style="color: #64748b; font-size: 15px; line-height: 1.6;">Yêu cầu phê duyệt không hợp lệ. Vui lòng kiểm tra lại liên kết trong email.</p>
          </div>
        </div>
      `);
    }

    const expectedToken = generateApprovalToken(uid as string);
    if (token !== expectedToken) {
      return res.status(403).send(`
        <div style="font-family: 'Segoe UI', system-ui, sans-serif; text-align: center; padding: 50px; background: #fafafa; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
          <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); max-width: 500px; border: 1px solid #fca5a5;">
            <h2 style="color: #ef4444; margin-top: 0;">Xác Thực Thất Bại</h2>
            <p style="color: #64748b; font-size: 15px; line-height: 1.6;">Chữ ký xác thực không khớp hoặc đã hết hạn. Bạn không thể phê duyệt yêu cầu này.</p>
          </div>
        </div>
      `);
    }

    try {
      const userRef = doc(db, "users", uid as string);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return res.status(404).send(`
          <div style="font-family: 'Segoe UI', system-ui, sans-serif; text-align: center; padding: 50px; background: #fafafa; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); max-width: 500px; border: 1px solid #cbd5e1;">
              <h2 style="color: #f59e0b; margin-top: 0;">Không Tìm Thấy Người Dùng</h2>
              <p style="color: #64748b; font-size: 15px; line-height: 1.6;">Tài khoản yêu cầu phê duyệt không tồn tại trong hệ thống.</p>
            </div>
          </div>
        `);
      }

      const userData = userSnap.data();

      await updateDoc(userRef, {
        status: "approved",
        secretApprovalToken: SECRET_KEY
      });

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Phê duyệt thành công</title>
          <style>
            body {
              font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
              background: #f1f5f9;
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
              max-width: 500px;
              text-align: center;
              border-top: 8px solid #10b981;
            }
            .icon-box {
              width: 72px;
              height: 72px;
              background: #d1fae5;
              color: #10b981;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 36px;
              margin: 0 auto 24px auto;
            }
            h2 {
              color: #1e293b;
              margin: 0 0 12px 0;
              font-size: 24px;
              font-weight: 700;
            }
            p {
              color: #64748b;
              font-size: 16px;
              line-height: 1.6;
              margin: 0 0 28px 0;
            }
            .badge {
              background: #f1f5f9;
              border: 1px solid #e2e8f0;
              padding: 10px 16px;
              border-radius: 8px;
              display: inline-block;
              margin-bottom: 24px;
              font-weight: bold;
              color: #334155;
            }
            .btn-success {
              background-color: #2563eb;
              color: white;
              padding: 12px 28px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              font-size: 15px;
              box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
              transition: all 0.2s;
            }
            .btn-success:hover {
              background-color: #1d4ed8;
            }
          </style>
        </head>
        <body>
          <div class="card" id="success-card">
            <div class="icon-box">✓</div>
            <h2>Phê Duyệt Thành Công!</h2>
            <p>Tài khoản sau đây đã được phê duyệt làm người dùng chính thức và có thể truy cập toàn bộ chức năng của hệ thống:</p>
            <div class="badge">${userData.email}</div>
            <div>
              <a href="/" class="btn-success">Đến Trang Chủ</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Firestore error:", error);
      return res.status(500).send(`
        <div style="font-family: 'Segoe UI', system-ui, sans-serif; text-align: center; padding: 50px; background: #fafafa; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
          <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); max-width: 500px; border: 1px solid #fca5a5;">
            <h2 style="color: #ef4444; margin-top: 0;">Lỗi Hệ Thống</h2>
            <p style="color: #64748b; font-size: 15px; line-height: 1.6;">Có lỗi xảy ra khi phê duyệt tài khoản. Vui lòng thử lại sau.</p>
          </div>
        </div>
      `);
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
 