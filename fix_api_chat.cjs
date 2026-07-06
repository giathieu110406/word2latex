const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

const newRoute = `
// 5. API: Chat with AI about the system
app.post("/api/chat-ai", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Thiếu dữ liệu messages" });
    }

    console.log("[Gemini API] Đang gửi yêu cầu chat AI...");
    
    // Format messages for gemini (systemInstruction cannot be easily mixed with chat history in the basic generateContent call without proper structure, but we can just prepend the context to the first message if needed, or use the \`contents\` array properly)
    
    // Convert to genai contents format
    const contents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const response = await generateContentWithRetry({
      model: "gemini-3.1-flash-lite", 
      contents: contents,
      config: {
        systemInstruction: "Bạn là trợ lý AI thông minh của hệ thống Word2LaTeX.io.vn. Hệ thống cung cấp chức năng chuyển đổi các công thức LaTeX sang định dạng Word, đồng thời hỗ trợ soạn đề thi thông minh (QBuilder). Nhiệm vụ của bạn là hướng dẫn người dùng, trả lời câu hỏi về hệ thống, giải đáp thắc mắc về cách sử dụng tính năng chuyển đổi hoặc quản lý tài liệu, soạn đề. Hãy trả lời ngắn gọn, thân thiện, dễ hiểu bằng tiếng Việt và CHỈ GIỚI HẠN trả lời trong phạm vi các vấn đề liên quan đến toán học, giáo dục, hệ thống chuyển đổi Word2LaTeX này.",
      }
    });

    return res.json({ success: true, text: response.text });
  } catch (error: any) {
    console.error("Lỗi Chat AI:", error);
    return res.status(500).json({ error: error.message || "Lỗi máy chủ khi chat AI" });
  }
});

`;

code = code.replace('// 4. API: Compile LaTeX to PDF via standard fast LaTeX compiler', newRoute + '// 4. API: Compile LaTeX to PDF via standard fast LaTeX compiler');
fs.writeFileSync('api/index.ts', code);
