import grantPlanHandler from './api/admin/grant-plan';
import "dotenv/config";
import express from "express";
import aiHandler from "./api/ai";
import markitdownHandler from "./api/markitdown";
import emailVerificationHandler from "./api/email-verification";
import drawingHandler from "./api/ve-hinh";
import activityHandler from "./api/activity";



import * as path from "path";
import * as crypto from "crypto";

import payosCreateHandler from "./api/payos-create";
import payosWebhookHandler from "./api/payos-webhook";
import payosCheckHandler from "./api/payos-check";
import approveUserHandler from "./api/approve-user";
import adminPaymentsHandler from "./api/admin/payments";
import { getFirebaseAdmin } from "./server/firebase-admin.js";


const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.all('/api/ve-hinh', drawingHandler);
app.all('/api/activity', activityHandler);
app.use('/ve-hinh', express.static(path.join(process.cwd(), 'public', 've-hinh')));

// VERCEL PROXY HANDLER (cho cả local dev và production Vercel)


// Helper to generate a tamper-proof cryptographic approval token
const SECRET_KEY = process.env.APPROVAL_SECRET_KEY || "graphic-heading-0km1r-secret-token-key";
function generateApprovalToken(uid: string): string {
  return crypto.createHmac("sha256", SECRET_KEY).update(uid).digest("hex");
}

app.post("/api/payos-create", async (req, res) => {
  await payosCreateHandler(req as any, res as any);
});

app.all(["/api/payos-webhook", "/api/webhook/payos"], async (req, res) => {
  await payosWebhookHandler(req as any, res as any);
});

app.post("/api/payos-check", async (req, res) => {
  await payosCheckHandler(req as any, res as any);
});

// 1. API: Approve user directly from email link (GET)
app.post("/api/ai", async (req, res) => {
  await aiHandler(req as any, res as any);
});

app.post("/api/markitdown", async (req, res) => {
  await markitdownHandler(req as any, res as any);
});

app.post("/api/email-verification", async (req, res) => {
  await emailVerificationHandler(req as any, res as any);
});





app.get("/api/approve-user", async (req, res) => {
  await approveUserHandler(req as any, res as any);
});

// 2. API: Notify admin of access registration (POST) - SMTP removed by request

app.get("/api/admin/payments", async (req, res) => {
  await adminPaymentsHandler(req as any, res as any);
});

app.delete("/api/admin/payments", async (req, res) => {
  await adminPaymentsHandler(req as any, res as any);
});

app.post('/api/admin/grant-plan', (req,res) => grantPlanHandler(req as any,res as any));

app.post("/api/user/update-phone", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }
    const token = authHeader.split('Bearer ')[1];
    const { auth: adminAuth, db } = getFirebaseAdmin();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const { phoneNumber } = req.body;
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ error: 'Vui lòng cung cấp số điện thoại' });
    }

    const cleaned = phoneNumber.trim().replace(/[\s().-]/g, '');
    const local = cleaned.startsWith('+84') ? `0${cleaned.slice(3)}` : cleaned;
    if (!/^0[35789]\d{8}$/.test(local)) {
      return res.status(400).json({ error: 'Số điện thoại không đúng định dạng di động Việt Nam (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09).' });
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tài khoản' });
    }

    const userData = userSnap.data() || {};
    const oldPhone = userData.phoneNumber || userData.confirmedPhoneNumber || '';
    const now = new Date().toISOString();

    // Lưu giữ số cũ vào lịch sử: không bao giờ bị xóa hay ghi đè
    const existingHistory = Array.isArray(userData.phoneHistory) ? userData.phoneHistory : [];
    const newHistory = [...existingHistory];
    if (oldPhone && !newHistory.some((h: any) => (typeof h === 'string' ? h === oldPhone : h.phone === oldPhone))) {
      newHistory.push({
        phone: oldPhone,
        recordedAt: userData.phoneConfirmedAt || userData.createdAt || now,
        type: 'previous'
      });
    }

    newHistory.push({
      phone: local,
      recordedAt: now,
      type: 'current'
    });

    const allPhones = Array.isArray(userData.allPhoneNumbers) ? userData.allPhoneNumbers : [];
    if (oldPhone && !allPhones.includes(oldPhone)) allPhones.push(oldPhone);
    if (!allPhones.includes(local)) allPhones.push(local);

    const updateData: any = {
      phoneNumber: local,
      confirmedPhoneNumber: `+84${local.slice(1)}`,
      phoneHistory: newHistory,
      allPhoneNumbers: allPhones,
      phoneConfirmedAt: now,
      phoneConfirmationMethod: userData.phoneConfirmationMethod || 'verified',
      phoneConfirmationVersion: 1,
      updatedAt: now
    };

    if (!userData.emailOtpVerifiedAt && (decodedToken.email_verified || userData.emailVerified)) {
      updateData.emailOtpVerifiedAt = now;
    }

    await userRef.update(updateData);

    // Lưu vĩnh viễn vào subcollection phoneConfirmations
    await userRef.collection('phoneConfirmations').add({
      phoneNumber: local,
      canonicalPhone: `+84${local.slice(1)}`,
      previousPhoneNumber: oldPhone,
      updatedAt: now,
      updatedBy: uid,
      source: 'user_profile'
    });

    return res.json({
      success: true,
      message: 'Cập nhật số điện thoại thành công!',
      phoneNumber: local,
      phoneHistory: newHistory
    });
  } catch (error: any) {
    console.error('Lỗi /api/user/update-phone:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
});




app.post("/api/notify-approval", async (req, res) => {
  const { uid, email } = req.body;

  if (!uid || !email) {
    return res.status(400).json({ error: "Thiếu dữ liệu uid hoặc email" });
  }

  // Generate secure token URL
  const token = generateApprovalToken(uid);
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const hostUrl = process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL" ? process.env.APP_URL : `${protocol}://${host}`;
  const approvalLink = `${hostUrl}/api/approve-user?uid=${uid}&token=${token}`;

  // Always output the log so developers can see the link in the terminal
  console.log("\n==================================================");
  console.log(`[YÊU CẦU PHÊ DUYỆT MỚI] Người dùng: ${email}`);
  console.log(`Liên kết phê duyệt trực tiếp: ${approvalLink}`);
  console.log("==================================================\n");

  return res.json({
    success: true,
    emailSent: false,
    statusMessage: "Yêu cầu phê duyệt đã được gửi đến quản trị viên."
  });
});




// 3. API: Parse exam file contents to structured JSON using Gemini API
// Helper to call Gemini with robust retry mechanism & fallback models to handle 503 Service Unavailable gracefully










// 5. API: Chat with AI about the system

// 4. API: Compile LaTeX to PDF via standard fast LaTeX compiler
app.post("/api/compile-latex", async (req, res) => {
  try {
    const { latexCode } = req.body;
    if (!latexCode) {
      return res.status(400).json({ error: "Thiếu dữ liệu latexCode" });
    }

    console.log("[LaTeX compiler] Đang gửi yêu cầu biên dịch LaTeX sang PDF...");

    // Try texlive.net first as it is extremely fast and reliable
    try {
     const formData = new FormData();
      // Ensure CRLF line endings as latexcgi is sensitive to it
      const formattedLatex = latexCode.replace(/\r?\n/g, "\r\n");
      
      formData.append("filecontents[]", formattedLatex);
      formData.append("filename[]", "document.tex");
      formData.append("engine", "pdflatex");
      formData.append("return", "pdf");

      const compileRes = await fetch("https://texlive.net/cgi-bin/latexcgi", {
        method: "POST",
         body: formData,
      });

      if (compileRes.ok) {
        const contentType = compileRes.headers.get("content-type") || "";
        if (contentType.toLowerCase().includes("application/pdf")) {
          console.log("[LaTeX compiler] Biên dịch PDF thành công qua texlive.net!");
          const pdfBuffer = await compileRes.arrayBuffer();
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", "attachment; filename=tai_lieu_latex.pdf");
          return res.send(Buffer.from(pdfBuffer));
        } else {
          console.warn("[LaTeX compiler] texlive.net did not return a PDF. Content-Type:", contentType);
        }
      } else {
        console.warn("[LaTeX compiler] texlive.net failed with status:", compileRes.status);
      }
    } catch (texliveError) {
      console.error("[LaTeX compiler] Lỗi khi biên dịch qua texlive.net:", texliveError);
    }

    // Fallback to latexonline.cc
    console.log("[LaTeX compiler] Đang thử biên dịch dự phòng qua latexonline.cc...");
    const url = `https://latexonline.cc/compile?text=${encodeURIComponent(latexCode)}&command=pdflatex`;
    const fallbackRes = await fetch(url);

    if (fallbackRes.ok) {
      console.log("[LaTeX compiler] Biên dịch PDF thành công qua latexonline.cc!");
      const pdfBuffer = await fallbackRes.arrayBuffer();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=tai_lieu_latex.pdf");
      return res.send(Buffer.from(pdfBuffer));
    }

    return res.status(502).json({ error: "Biên dịch LaTeX sang PDF thất bại từ các server." });
  } catch (error: any) {
    console.error("Lỗi biên dịch LaTeX sang PDF tổng quát:", error);
    return res.status(500).json({ error: error.message || "Lỗi xử lý file PDF" });
  }
});





async function startServer() {
  // Vite developer middleware for rendering Vite React client assets
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BACKEND SERVER] Đang khởi động tại http://localhost:${PORT}`);
  });
}

if (process.env.VERCEL !== "1") {
  startServer();
}

export default app;

