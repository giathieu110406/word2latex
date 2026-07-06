const fs = require('fs');

const indexCode = fs.readFileSync('api/index.ts', 'utf-8');

const aiTsCode = `
import { GoogleGenAI, Type } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Không thể kết nối đến Trợ lý AI Canvas. Vui lòng cấu hình GEMINI_API_KEY trong biến môi trường.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

const geminiModel = "gemini-2.5-pro";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action } = req.query;

  try {
    const ai = getAiClient();

    if (action === 'gemini-canvas') {
      const { text, prompt } = req.body;
      const fullPrompt = \`Bạn là Trợ lý AI Canvas chuyên môn cao.
Nhiệm vụ: \${prompt}
Dữ liệu đầu vào:
\${text}\`;
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: fullPrompt,
      });
      return res.json({ result: response.text });
    }

    if (action === 'smart-paste-parse') {
      const { text } = req.body;
      const prompt = "Phân tích và trích xuất câu hỏi từ văn bản sau. Trả về định dạng JSON mảng các câu hỏi.";
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt + "\\n\\n" + text,
        config: {
          responseMimeType: "application/json",
        }
      });
      return res.json({ result: response.text });
    }
    
    if (action === 'shuffle-ai') {
       const { questions } = req.body;
       const response = await ai.models.generateContent({
        model: geminiModel,
        contents: "Đảo trộn mảng câu hỏi JSON sau: " + JSON.stringify(questions),
        config: { responseMimeType: "application/json" }
       });
       return res.json({ result: response.text });
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
`;
fs.writeFileSync('api/ai.ts', aiTsCode);
