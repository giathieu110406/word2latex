import { VercelRequest, VercelResponse } from '@vercel/node';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI, Type } from "@google/genai";
import * as fs from 'fs';
import * as path from 'path';

// Initialize firebase admin if not already initialized
let db: FirebaseFirestore.Firestore | null = null;
if (!getApps().length) {
  try {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountStr) {
      initializeApp({
        credential: cert(JSON.parse(serviceAccountStr)),
        databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
      });
      db = getFirestore();
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT is missing. AI improvement job will run in local file fallback mode.");
    }
  } catch (e) {
    console.warn("Failed to initialize firebase admin", e);
  }
} else {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    db = getFirestore();
  }
}

const rawAiLogsFilePath = path.join(process.cwd(), 'raw_ai_logs_local.json');
const insightsFilePath = path.join(process.cwd(), 'ai_insights_local.json');

function saveInsightLocally(insight: any) {
  try {
    let data: any = {};
    if (fs.existsSync(insightsFilePath)) {
      try {
        data = JSON.parse(fs.readFileSync(insightsFilePath, 'utf8'));
      } catch (e) {
        data = {};
      }
    }
    const newId = "insight_" + Date.now();
    data[newId] = insight;
    fs.writeFileSync(insightsFilePath, JSON.stringify(data, null, 2), 'utf8');
    console.log("[Local AI Improvement] Saved new insight locally");
  } catch (err) {
    console.error("Failed to save insight locally", err);
  }
}

function deleteLocalLogs(processedIds: string[]) {
  try {
    if (fs.existsSync(rawAiLogsFilePath)) {
      const fileData = JSON.parse(fs.readFileSync(rawAiLogsFilePath, 'utf8'));
      const updated = fileData.filter((l: any) => !processedIds.includes(l.id));
      fs.writeFileSync(rawAiLogsFilePath, JSON.stringify(updated, null, 2), 'utf8');
      console.log(`[Local AI Improvement] Deleted ${processedIds.length} processed logs locally`);
    }
  } catch (err) {
    console.error("Failed to delete local logs", err);
  }
}

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = (process.env.GEMINI_API_KEY || "").trim();
    const apiKey = key.replace(/^["']|["']$/g, '');
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

const MAX_TOKENS_PER_BATCH = 15000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let pendingLogs: any[] = [];

    if (db) {
      const logsSnapshot = await db.collection('raw_ai_logs')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .limit(50)
        .get();
      pendingLogs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      // Local fallback
      if (fs.existsSync(rawAiLogsFilePath)) {
        try {
          const fileData = JSON.parse(fs.readFileSync(rawAiLogsFilePath, 'utf8'));
          pendingLogs = fileData.filter((l: any) => l.status === 'pending');
        } catch (e) {
          console.warn("Failed to read local raw logs", e);
        }
      }
    }

    if (pendingLogs.length === 0) {
      return res.json({ success: true, message: "No pending logs to process" });
    }

    let batchLogs = [];
    let currentTokenCount = 0;
    
    // Group logs by service
    const serviceGroups: Record<string, any[]> = {
      latex: [],
      qbuilder: []
    };

    for (const data of pendingLogs) {
      const tokens = data.totalTokens || 1000; // fallback est
      if (currentTokenCount + tokens > MAX_TOKENS_PER_BATCH) {
         break; // Stop collecting for this batch
      }
      currentTokenCount += tokens;
      batchLogs.push(data);
      if (serviceGroups[data.service]) {
        serviceGroups[data.service].push(data);
      }
    }

    if (batchLogs.length === 0) {
      return res.json({ success: true, message: "No valid logs to process (token issue)" });
    }

    let processedCount = 0;
    let newInsightsCount = 0;

    for (const [service, logs] of Object.entries(serviceGroups)) {
      if (logs.length === 0) continue;

      const ai = getAiClient();
      
      const payloadText = logs.map((l, idx) => {
        // Programmatic pre-checking for Homoglyphs and Zero-Width space anomalies
        const hasZeroWidth = /[\u200B-\u200D\uFEFF]/.test(l.inputPrompt || "") || /[\u200B-\u200D\uFEFF]/.test(l.aiResponse || "");
        const hasCyrillicO = /о/.test(l.inputPrompt || "") || /о/.test(l.aiResponse || "");
        
        return `--- LOG #${idx + 1} ID: ${l.id} ---
[SERVICE]: ${l.service}
[INPUT]: ${l.inputPrompt}
[OUTPUT]: ${l.aiResponse}
[SYSTEM DETECTED ANOMALIES]: ${hasZeroWidth ? "CÓ ký tự ẩn Zero-Width Space (U+200B) phá vỡ cú pháp!" : "Không"} | ${hasCyrillicO ? "CÓ chữ 'o' Cyrillic (U+043E) giả mạo tên miền!" : "Không"}\n`;
      }).join("\n");

      // We need to pass the current prompt so AI knows what to improve
      const promptInstruction = `Bạn là một chuyên gia AI chuyên đánh giá và cải tiến thuật toán (prompt engineer). 
Nhiệm vụ của bạn là phân tích các phiên làm việc của AI (log) theo lô, tìm ra các lỗi cụ thể bao gồm cả các lỗi ngầm hiểm hóc như ký tự ẩn (Zero-Width Space) và chữ giả mạo (Homoglyphs Cyrillic), và đưa ra gợi ý cập nhật System Prompt.
Dịch vụ đang đánh giá: ${service.toUpperCase()}

YÊU CẦU ĐÁNH GIÁ (TUYỆT ĐỐI TUÂN THỦ):
1. Đánh giá chất lượng đầu ra so với đầu vào: AI có hiểu đúng yêu cầu không? Định dạng có chuẩn không?
2. BẮT BUỘC liệt kê lỗi chi tiết nếu có (VD: "Thiếu ngoặc đóng ở dòng 5", "Không bọc công thức trong $...$", "Lỗi homoglyph Cyrillic trong đường link", "Lỗi Zero-Width Space làm hỏng danh sách"). Không được ghi chung chung.
3. Đề xuất một đoạn nội dung (text) cần bổ sung/sửa đổi vào System Prompt gốc để AI lần sau không lặp lại lỗi này.
4. Chấm điểm trung bình lô (0-10).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite', // use flash or flash-lite
        contents: `Hãy phân tích lô dữ liệu log sau và trả về JSON:\n\n${payloadText}`,
        config: {
          systemInstruction: promptInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
               score: { type: Type.NUMBER, description: "Điểm đánh giá (0-10)" },
               evaluation: { type: Type.STRING, description: "Đánh giá chung về chất lượng" },
               detailedErrors: { 
                 type: Type.ARRAY, 
                 items: { type: Type.STRING },
                 description: "Các lỗi chi tiết, cụ thể được tìm thấy (trích dẫn lỗi nếu cần)"
               },
               suggestedPromptAddition: { 
                 type: Type.STRING, 
                 description: "Đoạn mô tả quy tắc mới đề xuất thêm vào System Prompt để sửa các lỗi trên. Nếu không cần, để trống."
               }
            },
            required: ["score", "evaluation", "detailedErrors"]
          }
        }
      });

      const resultText = response.text || "{}";
      const resultData = JSON.parse(resultText);
      
      const newInsight = {
        service,
        score: resultData.score,
        evaluation: resultData.evaluation,
        detailedErrors: resultData.detailedErrors || [],
        suggestedPromptAddition: resultData.suggestedPromptAddition || "",
        processedLogsCount: logs.length,
        createdAt: new Date().toISOString(),
        status: "pending_review" // Admin will review and apply this
      };

      // Save insight
      if (db) {
        await db.collection('ai_insights').add(newInsight);
      } else {
        saveInsightLocally(newInsight);
      }
      
      newInsightsCount++;
      processedCount += logs.length;

      // Mark processed logs as evaluated and delete them immediately
      const processedIds = logs.map(l => l.id);
      if (db) {
        const batch = db.batch();
        processedIds.forEach(id => {
          const ref = db.collection('raw_ai_logs').doc(id);
          batch.delete(ref);
        });
        await batch.commit();
      } else {
        deleteLocalLogs(processedIds);
      }
    }

    return res.json({ 
      success: true, 
      processedCount,
      newInsightsCount,
      message: "Successfully processed AI logs" 
    });

  } catch (error: any) {
    console.error("Error in AI Improvement Job:", error);
    return res.status(500).json({ error: error.message });
  }
}
