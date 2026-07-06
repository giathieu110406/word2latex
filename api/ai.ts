import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { parseFile, parseUrl } from "../markitdown.ts";
import * as mammoth from "mammoth";


let aiClient: GoogleGenAI | null = null;
let aiBackupClient: GoogleGenAI | null = null;

function getAiClient(useBackup = false): GoogleGenAI {
  if (useBackup) {
    if (!aiBackupClient) {
      const backupKey = process.env.keyduphongrk1104 || process.env.GEMINI_API_KEY_BACKUP || "AQ.Ab8RN6JaJXwFc-5EVoSbWQ7RwD_7qoLOc7DWrkM-7HdSM5cVgg";
      aiBackupClient = new GoogleGenAI({
        apiKey: backupKey,
      });
    }
    return aiBackupClient;
  }

  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Không thể kết nối đến Trợ lý AI Canvas. Vui lòng cấu hình GEMINI_API_KEY trong biến môi trường.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
    });
  }
  return aiClient;
}

async function generateContentWithRetry(params: any, retries = 3, delay = 1500, overrideModelsToTry?: string[]) {
  if (!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY_BACKUP && !process.env.keyduphongrk1104) {
    throw new Error("Không thể kết nối đến Trợ lý AI Canvas. Vui lòng cấu hình GEMINI_API_KEY trong biến môi trường.");
  }

  let lastError: any = null;
  let firstImportantError: any = null;
  
  const modelsToTry = overrideModelsToTry || [
    params.model || "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-pro"
  ].filter((value, index, self) => self.indexOf(value) === index && value);
  
  const keysToTry = [false, true]; 
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    for (const useBackup of keysToTry) {
      for (const model of modelsToTry) {
        try {
          console.log(`[Gemini API] Đang gửi yêu cầu bằng model: ${model} (Key dự phòng: ${useBackup ? 'Có' : 'Không'}, Lần thử ${attempt}/${retries})`);
          const aiInstance = getAiClient(useBackup);
          const response = await aiInstance.models.generateContent({
            ...params,
            model: model
          });
          return response;
        } catch (error: any) {
          lastError = error;
          if (!firstImportantError && error.status !== 404) {
             firstImportantError = error;
          }
          console.warn(`[Gemini API] Thử nghiệm model ${model} (Key dự phòng: ${useBackup ? 'Có' : 'Không'}) thất bại:`, error.message || error);
          
          if (
            error.message?.includes("API_KEY_INVALID") ||
            error.message?.includes("cấu hình GEMINI_API_KEY") ||
            error.status === 403 ||
            error.status === 401
          ) {
            break; 
          }
          
          if (error.status === 429 || error.status === 503 || (error.message && (error.message.includes("quota") || error.message.includes("Quota") || error.message.includes("high demand") || error.message.includes("overloaded")))) {
             continue;
          }
        }
      }
    }
    
    if (attempt < retries) {
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`[Gemini API] Tất cả các model và key đều tạm thời không khả dụng ở lần thử ${attempt}. Đang chờ ${waitTime}ms trước khi thử lại...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  let finalError = firstImportantError || lastError || new Error("Tất cả các model đều thất bại sau nhiều lần thử.");
  if (finalError.status === 429 || (finalError.message && (finalError.message.includes("quota") || finalError.message.includes("Quota")))) {
    finalError.message = "Đã hết hạn mức sử dụng API Gemini (Quota Exceeded) hoặc API Key không hỗ trợ gói miễn phí. Vui lòng kiểm tra lại tài khoản Google AI Studio của bạn.";
  } else if (finalError.status === 404 || (finalError.message && finalError.message.includes("not found"))) {
    finalError.message = "Model AI không được hỗ trợ bởi API Key này (404 Not Found). Vui lòng kiểm tra lại cấu hình.";
  } else if (finalError.status === 503 || (finalError.message && (finalError.message.includes("high demand") || finalError.message.includes("overloaded") || finalError.message.includes("UNAVAILABLE")))) {
    finalError.message = "Hệ thống AI đang quá tải (503). Vui lòng thử lại sau ít phút.";
  }
  throw finalError;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (action === 'parse-exam') {

  try {
    const { fileContent, fileName } = req.body;
    
    if (!fileContent) {
      return res.status(400).json({ error: "Thiếu dữ liệu fileContent" });
    }

    let rawText = "";

    if (fileName && fileName.endsWith(".docx")) {
      const buffer = Buffer.from(fileContent, "base64");
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else {
      // For txt or md files, decodes from base64
      rawText = Buffer.from(fileContent, "base64").toString("utf-8");
    }

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: "Nội dung tài liệu trống hoặc không thể giải mã" });
    }

    // Call Gemini API using retry logic to parse the text with strict guidelines
    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash-lite", // Use the fastest and lightest model by default
      contents: `Hãy phân tích văn bản đề thi dưới đây:\n\n${rawText}`,
      config: {
        systemInstruction: `Bạn là chuyên gia phân tích đề thi và bài tập học thuật. Hãy bóc tách văn bản đề bài thành các câu hỏi/bài tập hoàn chỉnh và trả về định dạng JSON theo các quy tắc nghiêm ngặt sau:

1. ĐỊNH NGHĨA CÂU HỎI HOẶC BÀI TẬP HOÀN CHỈNH (QUAN TRỌNG NHẤT):
- Một "câu hỏi" hoặc "bài tập" (question) phải là một đơn vị logic hoàn chỉnh, tự chứa (self-contained).
- TUYỆT ĐỐI KHÔNG ĐƯỢC tách các danh sách ghi chú, các mục giao dịch (ví dụ: các mục 1, 2, 3... trong "Ghi chú trong năm"), các bảng số liệu, hoặc các điều khoản nhỏ thành các câu hỏi riêng biệt. Các phần này chỉ là phần mô tả dữ kiện và ngữ cảnh của một bài tập lớn (ví dụ: "Bài 1: THUẾ THU NHẬP DOANH NGHIỆP", "Bài 2.1: Trường hợp lương GROSS", "Bài 2.2: Trường hợp lương NET").
- Hãy gộp toàn bộ đề bài lớn (gồm tiêu đề bài, bảng chỉ tiêu tài chính, danh sách các ghi chú/giao dịch đầy đủ, và các yêu cầu/câu hỏi nhỏ ở cuối) thành MỘT câu hỏi duy nhất trong mảng "questions".
- Ví dụ cụ thể từ văn bản đầu vào:
  + Toàn bộ phần "Bài 1: THUẾ THU NHẬP DOANH NGHIỆP" (bao gồm bảng Chỉ tiêu tài chính, tất cả các mục từ 1 đến 11 trong phần Ghi chú trong năm, và yêu cầu cuối cùng "Tính thuế TNDN phải nộp...") phải được nhận diện là MỘT câu hỏi tự luận duy nhất.
  + Toàn bộ phần "2.1: Trường hợp lương GROSS" (bao gồm thông tin lương, bảo hiểm, giảm trừ gia cảnh, và tất cả 3 yêu cầu nhỏ ở cuối) phải được nhận diện là MỘT câu hỏi tự luận duy nhất.
  + Toàn bộ phần "2.2: Trường hợp lương NET" (bao gồm thông tin lương net, bảo hiểm, giảm trừ gia cảnh, và tất cả 4 yêu cầu nhỏ ở cuối) phải được nhận diện là MỘT câu hỏi tự luận duy nhất.

2. LẤY TOÀN BỘ NỘI DUNG (TUYỆT ĐỐI KHÔNG ĐƯỢC RÚT GỌN HOẶC CẮT BỚT):
- TUYỆT ĐỐI KHÔNG ĐƯỢC tóm tắt hoặc rút gọn đề bài. Không được chỉ lấy một đoạn ngắn ở đầu.
- Trường "questionText" của mỗi câu hỏi phải chứa TOÀN BỘ văn bản chi tiết gốc của đề bài đó, bao gồm đầy đủ dữ kiện, bảng biểu số liệu, danh sách ghi chú và toàn bộ yêu cầu ở cuối để học sinh có đủ dữ liệu giải bài.

3. PHÂN LOẠI CÂU HỎI (type):
- Chỉ phân loại là "trac_nghiem" khi câu hỏi đó thực sự là câu hỏi trắc nghiệm khách quan có các phương án lựa chọn (A, B, C, D) rõ ràng đi kèm để chọn.
- Nếu là bài tập lớn, bài tính toán tự luận, bài yêu cầu giải trình, định khoản, lập báo cáo mà không có các phương án lựa chọn sẵn có để chọn ngay lập tức, bắt buộc phải phân loại là "tu_luan".

4. QUY TẮC XỬ LÝ KHÁC:
- Xóa các tiền tố dạng "Câu 1.", "Câu 2.", "Bài 1:" ở ngay đầu đề bài lớn nếu có (để hệ thống tự đánh số lại theo thứ tự), nhưng GIỮ NGUYÊN các số thứ tự của các mục nhỏ, ghi chú hoặc bảng biểu bên trong nội dung đề bài.
- Giữ nguyên các biểu thức toán học hoặc ký hiệu LaTeX dưới dạng $ ... $ nếu có.
- Trả về JSON chứa mảng "questions" đúng thứ tự xuất hiện gốc từ trên xuống dưới.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { 
                    type: Type.STRING,
                    description: "Phân loại câu hỏi. Chỉ được nhận giá trị 'trac_nghiem' hoặc 'tu_luan'."
                  },
                  questionText: { type: Type.STRING },
                  answerText: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  flags: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING } 
                  }
                },
                required: ["id", "type", "questionText", "confidence"]
              }
            },
            summary: {
              type: Type.OBJECT,
              properties: {
                total: { type: Type.NUMBER },
                trac_nghiem_count: { type: Type.NUMBER },
                tu_luan_count: { type: Type.NUMBER },
                low_confidence_count: { type: Type.NUMBER },
                warnings: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING } 
                }
              },
              required: ["total", "trac_nghiem_count", "tu_luan_count", "low_confidence_count", "warnings"]
            }
          },
          required: ["questions", "summary"]
        }
      }
    });

    const parsedJson = JSON.parse(response.text?.trim() || "{}");
    const questions = parsedJson.questions || [];
    const summary = parsedJson.summary || {};
    return res.json({ success: true, questions, summary });

  } catch (error: any) {
    console.error("Lỗi khi xử lý đề thi bằng Gemini:", error);
    return res.status(500).json({ error: error.message || "Lỗi máy chủ khi xử lý đề thi" });
  }

      return;
    }

    if (action === 'smart-paste-parse') {

  try {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Nội dung văn bản trống" });
    }

    console.log("[Gemini API] Đang xử lý bóc tách và phân loại câu hỏi thô bằng model gemini-2.5-flash-lite...");

    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash-lite", // The fastest and lightest AI model
      contents: `Hãy phân tích, phân nhóm và bóc tách các câu hỏi từ văn bản dưới đây:\n\n${text}`,
      config: {
        systemInstruction: `Bạn là trợ lý AI chuyên môn cao đóng vai trò là bộ bóc tách cấu trúc câu hỏi thô (raw extractor) và phân loại câu hỏi cực kỳ chính xác.

NHIỆM VỤ CỦA BẠN:
1. Nhận diện các câu hỏi trong văn bản dán của người dùng, phân tách chúng thành các khối riêng biệt.
2. Với mỗi khối câu hỏi:
   - Trích xuất NGUYÊN BẢN (RAW) phần nội dung câu hỏi và các phương án lựa chọn (A, B, C, D nếu có) cho vào "questionRawText".
   - Trích xuất NGUYÊN BẢN (RAW) phần đáp án, lời giải, giải thích hoặc hướng dẫn giải cho vào "answerRawText". Nếu không có đáp án, hãy để chuỗi rỗng "".
3. Phân loại loại câu hỏi ("type") chính xác:
   - 'trac_nghiem': Câu hỏi trắc nghiệm khách quan chọn một đáp án đúng (A, B, C, D).
   - 'trac_nghiem_dung_sai': Câu hỏi trắc nghiệm Đúng/Sai.
   - 'trac_nghiem_tra_loi_ngan': Câu hỏi trắc nghiệm điền khuyết / trả lời ngắn gọn.
   - 'tu_luan': Câu hỏi tự luận lớn, chứng minh, giải thích dài.

HƯỚNG DẪN CỰC KỲ QUAN TRỌNG:
- TUYỆT ĐỐI GIỮ NGUYÊN BẢN (RAW TEXT): Không tự ý viết lại câu chữ, không sửa đổi ký hiệu, không sửa LaTeX (giữ nguyên $...$ hoặc $$...$$), không tóm tắt, không bổ sung từ ngữ mới. Bạn chỉ được phép cắt các chuỗi ký tự thô từ văn bản gốc của người dùng đưa vào đúng hai trường tương ứng.
- KHÔNG TRỘN LẪN: Phần đáp án/lời giải/hướng dẫn giải phải được tách riêng hoàn toàn sang "answerRawText", không được để lẫn lộn trong "questionRawText".`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { 
                    type: Type.STRING,
                    description: "Phân loại câu hỏi: 'trac_nghiem', 'trac_nghiem_dung_sai', 'trac_nghiem_tra_loi_ngan', 'tu_luan'."
                  },
                  questionRawText: { type: Type.STRING, description: "Toàn bộ chuỗi nguyên bản thô của câu hỏi và các lựa chọn trắc nghiệm." },
                  answerRawText: { type: Type.STRING, description: "Toàn bộ chuỗi nguyên bản thô của phần đáp án, lời giải hoặc hướng dẫn giải (nếu có)." }
                },
                required: ["type", "questionRawText"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    const parsedJson = JSON.parse(response.text?.trim() || "{}");
    const questions = parsedJson.questions || [];
    return res.json({ success: true, questions });

  } catch (error: any) {
    console.error("Lỗi khi xử lý dán thông minh bằng Gemini:", error);
    return res.status(500).json({ error: error.message || "Lỗi máy chủ khi dán thông minh" });
  }

      return;
    }

    if (action === 'fix-logic') {

  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "Thiếu dữ liệu text" });
    }

    console.log("[Gemini API] Đang gửi yêu cầu Sửa lỗi Logic bằng AI...");

    // Call Gemini API using retry logic to fix the text with strict presentation guidelines
    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash-lite", // Use the fastest and lightest model by default
      contents: `Hãy tối ưu hóa hiển thị và sửa toàn bộ các lỗi trình bày, lỗi logic định dạng cho văn bản tiếng Việt sau đây:\n\n${text}`,
      config: {
        systemInstruction: `Bạn là chuyên gia định dạng tài liệu học thuật (Markdown, LaTeX và bảng biểu).
Nhiệm vụ của bạn là phục hồi và chuẩn hóa văn bản tiếng Việt bị lỗi định dạng (do copy từ PDF/Word) về dạng Markdown chuẩn xác theo mẫu sau.

HÃY ÁP DỤNG NGHIÊM NGẶT CÁC QUY TẮC SAU:

1. ĐỊNH DẠNG TIÊU ĐỀ (HEADING) VÀ DANH SÁCH:
   - Sử dụng heading Markdown chuẩn (#, ##, ###) cho các tiêu đề (ví dụ: "# MẪU VĂN BẢN TOÁN HỌC", "## 1. Công thức Toán học").
   - Các mục liệt kê dùng dấu gạch ngang "- " hoặc đánh số. Phải có khoảng trắng sau dấu gạch ngang.

2. BẢNG BIỂU (RẤT QUAN TRỌNG):
   - Nhận diện các số liệu nằm liền nhau và chuyển đổi CHÍNH XÁC sang dạng bảng Markdown có đầy đủ hàng rào '|' và dòng kẻ phân cách cột '| --- | --- |'.
   - KHÔNG bao giờ để bảng biểu bị vỡ thành các dòng text độc lập.

3. CÔNG THỨC TOÁN HỌC (LATEX):
   - Công thức nội dòng (inline) đặt trong dấu $...$ (ví dụ: $a^2 + b^2 = c^2$). 
   - Công thức khối (display) phải đặt trên dòng riêng biệt và bọc bởi $$...$$ TRÊN CÙNG MỘT DÒNG hoặc tách dòng chuẩn (ví dụ: $$\\int_{a}^{b} f(x) dx = F(b) - F(a)$$).
   - Sửa các ký hiệu unicode (như ², ³, α, β) thành mã LaTeX tương ứng ($^2$, $^3$, $\\alpha$, $\\beta$).
   - Đảm bảo các phân số, căn bậc hai, giới hạn, tích phân... viết bằng mã LaTeX chuẩn (ví dụ: \\frac{a}{b}, \\sqrt{x}, \\lim, \\int).

4. TRÌNH BÀY IN ĐẬM VÀ CẤU TRÚC CÂU HỎI:
   - Các từ khóa như "Câu 1:", "Thời gian làm bài:", "Đáp án & Lời giải", "Đáp án đúng:", "Lời giải chi tiết:" PHẢI được in đậm bằng \`**...**\`.
   - TUYỆT ĐỐI không để khoảng trắng sát bên trong dấu in đậm (Đúng: \`**Câu 1:**\`, Sai: \`** Câu 1: **\`).
   - Sửa lỗi dấu hoa thị bị tách rời cho in đậm (ví dụ: \`* *Đáp án đúng:**\` thành \`* **Đáp án đúng:**\` nếu có dấu đầu dòng bullet point ở trước, hoặc thành \`**Đáp án đúng:**\` nếu không có dấu đầu dòng). Tuyệt đối KHÔNG được xóa hoặc triệt tiêu dấu đầu dòng bullet point (\`* \` hoặc \`- \`) ở đầu dòng.

5. ĐOẠN VĂN VÀ BẢO TOÀN NỘI DUNG:
   - Dùng khối trích dẫn \`> \` cho các dòng ghi chú quan trọng.
   - Xóa các khoảng trắng, dấu xuống dòng vô lý, đứt đoạn giữa chừng do lỗi copy-paste.
   - TUYỆT ĐỐI KHÔNG tự ý thay đổi, tóm tắt, giải mã hay lược bớt bất kỳ nội dung văn bản, số liệu nào. CHỈ CHỈNH SỬA ĐỊNH DẠNG.

6. ĐẦU RA:
   - TRẢ VỀ TRỰC TIẾP VĂN BẢN ĐÃ SỬA. KHÔNG giải thích, KHÔNG bọc trong khối \`\`\`markdown ... \`\`\`.`,
      }
    });

    let fixedText = response.text || "";
    fixedText = fixedText.trim();
    
    // Clean any outer markdown code block wrapper if the model still returns it
    if (fixedText.startsWith("```markdown")) {
      fixedText = fixedText.slice(11);
      if (fixedText.endsWith("```")) {
        fixedText = fixedText.slice(0, -3);
      }
    } else if (fixedText.startsWith("```")) {
      fixedText = fixedText.slice(3);
      if (fixedText.endsWith("```")) {
        fixedText = fixedText.slice(0, -3);
      }
    }
    fixedText = fixedText.trim();

    return res.json({ success: true, fixedText });
  } catch (error: any) {
    console.error("Lỗi khi sửa logic bằng Gemini:", error);
    return res.status(500).json({ error: error.message || "Lỗi máy chủ khi sửa logic văn bản" });
  }

      return;
    }

    if (action === 'gemini-canvas') {

  try {
    const { text, prompt } = req.body;
    
    if (!text && !prompt) {
      return res.status(400).json({ error: "Thiếu dữ liệu" });
    }

    console.log("[Gemini API] Đang gửi yêu cầu Trợ lý AI Canvas...");

    // Call Gemini API using retry logic to process text with user prompt
    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash-lite", // standard highly-available fast model
      contents: `Nội dung Canvas hiện tại:\n${text || ""}\n\nYêu cầu thực hiện:\n${prompt}`,
      config: {
        systemInstruction: `Bạn là trợ lý AI Canvas chuyên nghiệp. Nhiệm vụ của bạn là thực hiện chỉnh sửa, dịch thuật, thêm lời giải chi tiết, in đậm từ khóa hoặc tạo câu hỏi tương tự từ văn bản hiện tại được cung cấp bởi người dùng.
HÃY TUÂN THỦ CÁC QUY TẮC CHẶT CHẼ SAU:
1. Đảm bảo giữ nguyên các công thức toán học LaTeX dạng $...$ hoặc $$...$$ trừ khi có yêu cầu thay đổi trực tiếp liên quan đến công thức.
2. Đảm bảo cấu trúc Markdown (bảng biểu, in đậm, tiêu đề, danh sách) được giữ nguyên vẹn và hiển thị chính xác.
3. Chỉ trả về trực tiếp kết quả văn bản sau khi đã sửa đổi. Tuyệt đối KHÔNG giải thích dông dài, KHÔNG thêm lời chào hay lời cảm ơn, KHÔNG bọc trong khối \`\`\`markdown ... \`\`\`.`,
      }
    });

    let fixedText = response.text || "";
    fixedText = fixedText.trim();
    
    // Clean any outer markdown code block wrapper if the model still returns it
    if (fixedText.startsWith("```markdown")) {
      fixedText = fixedText.slice(11);
      if (fixedText.endsWith("```")) {
        fixedText = fixedText.slice(0, -3);
      }
    } else if (fixedText.startsWith("```")) {
      fixedText = fixedText.slice(3);
      if (fixedText.endsWith("```")) {
        fixedText = fixedText.slice(0, -3);
      }
    }
    fixedText = fixedText.trim();

    return res.json({ success: true, fixedText });
  } catch (error: any) {
    console.error("Lỗi trợ lý AI Canvas:", error);
    return res.status(500).json({ error: error.message || "Lỗi máy chủ khi gọi trợ lý AI Canvas" });
  }

      return;
    }

    if (action === 'shuffle-ai') {

  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Thiếu danh sách câu hỏi" });
    }

    console.log("[Gemini API] Đang gửi yêu cầu thay thế số liệu đề thi bằng AI...");

    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash-lite", // Use the fastest and lightest model by default
      contents: `Dưới đây là danh sách câu hỏi trong đề thi. Với mỗi câu hỏi, hãy THAY ĐỔI CÁC SỐ LIỆU (số tự nhiên, số thực, phân số, tọa độ...), biến số hoặc ngữ cảnh nhỏ trong câu hỏi sao cho vẫn GIỮ NGUYÊN cấu trúc toán học/logic và phương pháp giải bài toán đó. Tuyệt đối không thay đổi phương pháp giải hoặc bản chất câu hỏi.
Nếu là câu hỏi trắc nghiệm có các phương án lựa chọn A, B, C, D, hãy đảm bảo tính toán lại các phương án nhiễu và phương án đúng một cách chính xác theo số liệu mới đã thay thế.
Trả về dữ liệu dưới dạng JSON với định dạng là một mảng đối tượng giống hệt đầu vào, chứa "id", "type", và "questionText" đã được thay đổi số liệu. Đặt mảng này trong thuộc tính "questions" của đối tượng JSON trả về.

Danh sách câu hỏi cần thay thế số liệu:
${JSON.stringify(questions, null, 2)}`,
      config: {
        systemInstruction: "Bạn là chuyên gia toán học và khảo sát đề thi chuyên nghiệp. Nhiệm vụ của bạn là lấy các câu hỏi học thuật từ người dùng, thay thế các con số hoặc ngữ cảnh nhẹ nhàng mà không thay đổi cách giải quyết, đảm bảo các tùy chọn trắc nghiệm được cập nhật chính xác theo số liệu mới.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  questionText: { type: Type.STRING }
                },
                required: ["id", "type", "questionText"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    const parsedJson = JSON.parse(response.text?.trim() || "{}");
    const updatedQuestions = parsedJson.questions || [];

    return res.json({ success: true, questions: updatedQuestions });
  } catch (error: any) {
    console.error("Lỗi khi thay số bằng AI:", error);
    return res.status(500).json({ error: error.message || "Lỗi máy chủ khi thay số câu hỏi bằng AI" });
  }

      return;
    }

    if (action === 'chat-ai') {

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Thiếu dữ liệu messages" });
    }

    console.log("[Gemini API] Đang gửi yêu cầu chat AI...");
    
    // Format messages for gemini
    const contents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const systemPrompt = `Bạn là trợ lý AI thông minh, chuyên nghiệp và tận tâm của hệ thống Word2LaTeX.io.vn (chuyên chuyển đổi công thức Toán/Lý/Hóa từ LaTeX sang Word chất lượng cao và soạn đề thi trắc nghiệm thông minh).

Nhiệm vụ duy nhất của bạn là hỗ trợ, giải đáp và hướng dẫn người dùng sử dụng và vận hành hệ thống Word2LaTeX.io.vn một cách tốt nhất. Bạn CHỈ trả lời các câu hỏi trong phạm vi hệ thống này, các chủ đề Toán học, LaTeX, Soạn đề thi và Giáo dục liên quan. Nếu người dùng hỏi ngoài phạm vi, hãy từ chối khéo léo và hướng người dùng quay lại chủ đề của hệ thống.

DƯỚI ĐÂY LÀ DỮ LIỆU ĐÀO TẠO VÀ THÔNG TIN CHI TIẾT VỀ HỆ THỐNG WORD2LATEX.IO.VN:

1. TÍNH NĂNG CHUYỂN ĐỔI LATEX SANG WORD (LATEX CONVERTER):
   - Cho phép người dùng nhập trực tiếp mã LaTeX hoặc tải lên file LaTeX (.tex), file văn bản để biên dịch.
   - Hiển thị công thức toán học trực quan và tức thời bằng KaTeX trước khi xuất.
   - Xuất file Word (.docx) chất lượng cực cao. Tất cả công thức toán học sẽ được giữ nguyên dưới dạng Microsoft Word Equation chuẩn (không phải dạng ảnh), cho phép chỉnh sửa trực tiếp trên Microsoft Word một cách hoàn hảo, không bị vỡ hay lỗi font.
   - Trợ lý AI Canvas (AI Assistant) được tích hợp trực tiếp trong Workspace để giúp người dùng:
     + Chỉnh sửa, tối ưu hóa mã LaTeX.
     + Thêm lời giải chi tiết, lời giải thích cho các bài toán.
     + Định dạng in đậm, in nghiêng, tiêu đề, bảng biểu bằng Markdown.
     + Sửa lỗi chính tả, lỗi cú pháp hoặc tạo bài toán tương tự từ bài toán đang có.

2. TÍNH NĂNG SOẠN ĐỀ THI THÔNG MINH (QBUILDER - AI EXAM CREATOR):
   - Tự động nhận diện và bóc tách câu hỏi từ file Word (.docx) thô hoặc văn bản dán vào thành danh sách câu hỏi có cấu trúc.
   - Phân loại câu hỏi tự động thành 4 loại: Trắc nghiệm (MCQ), Tự luận (Essay), Trắc nghiệm Đúng/Sai, và Điền khuyết.
   - Cho phép hoán vị, đảo vị trí câu hỏi hoặc xáo trộn các phương án trả lời A, B, C, D để tạo ra nhiều mã đề thi khác nhau.
   - **Xáo trộn bằng AI (AI Shuffling):** Đây là tính năng đột phá, sử dụng AI (Gemini) để tự động thay đổi các con số (số thực, số nguyên, phân số, tọa độ...), biến số hoặc thay đổi một chút ngữ cảnh nhỏ trong đề bài nhưng vẫn giữ nguyên cấu trúc toán học/logic và phương pháp giải của câu hỏi. Đồng thời tính toán lại và cập nhật chính xác đáp án đúng cùng các phương án nhiễu theo số liệu mới.
   - Hỗ trợ xuất đề thi và đáp án ra file Word (.docx) hoặc PDF chất lượng cao.

3. TÍNH NĂNG CHUYỂN ĐỔI TÀI LIỆU BẰNG AI (MARKITDOWN AI - GÓI PRO):
   - Đây là công cụ chuyển đổi tài liệu đa năng, cực kỳ mạnh mẽ sử dụng trí tuệ nhân tạo Gemini.
   - Hỗ trợ chuyển đổi hầu hết các định dạng tệp thông dụng hiện nay sang định dạng Markdown (.md) tiêu chuẩn:
     + Tài liệu văn bản: PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), trang web HTML.
     + Hình ảnh: Phân tích nội dung ảnh, trích xuất văn bản (OCR) và mô tả hình ảnh.
     + Âm thanh: Chuyển giọng nói/âm thanh (file Audio) thành văn bản Markdown.
     + Nội dung trực tuyến: Chuyển đổi nội dung của một URL (trang web bất kỳ) hoặc bóc tách phụ đề/nội dung từ đường dẫn video YouTube thành Markdown.
   - Người dùng có thể dễ dàng sao chép mã Markdown hoặc tải trực tiếp tệp ".md" về thiết bị cá nhân.
   - **Tính năng này yêu cầu nâng cấp gói PRO** để có thể trải nghiệm toàn diện.

4. QUẢN TRỊ HỆ THỐNG (ADMIN PANEL - DÀNH CHO ADMIN):
   - Quản lý danh sách thành viên đăng ký sử dụng hệ thống.
   - Theo dõi và phản hồi các góp ý, phản hồi (Feedbacks) từ người dùng.
   - Gửi thông báo (Notifications) hệ thống đến toàn bộ thành viên.

5. NÂNG CẤP TÀI KHOẢN PRO & PHÊ DUYỆT (PRO UPGRADE):
   - Người dùng chưa được duyệt có thể gửi yêu cầu phê duyệt bằng cách nhấn "Nâng cấp PRO".
   - Hệ thống sẽ tạo một liên kết phê duyệt an toàn gửi đến admin (hoặc hiển thị trong log/giao diện thử nghiệm) để admin phê duyệt kích hoạt tài khoản chính thức nhanh chóng.

6. HẠN MỨC SỬ DỤNG VÀ THỜI GIAN RESET (USAGE LIMITS & AUTO-RESET):
   - **Thành viên Free có các hạn mức hằng ngày sau:**
     + Số lần dùng LaTeX: Tối đa 30 lượt/ngày.
     + Số lần soạn đề thi bằng AI: Tối đa 5 lượt/ngày.
     + Lượt dán thông minh AI (promptCount): Tối đa 10 lượt/ngày.
   - **Cơ chế reset tự động:** Toàn bộ các hạn mức sử dụng (LaTeX, Soạn đề thi, Lượt dán thông minh AI) của tất cả người dùng sẽ **tự động reset (thiết lập lại) về 0 sau 5h sáng (5:00 AM) mỗi ngày** theo giờ Việt Nam.

HƯỚNG DẪN XỬ LÝ SỰ CỐ (TROUBLESHOOTING):
- Lỗi không hiển thị công thức LaTeX: Đảm bảo công thức được bọc trong dấu $ (inline) hoặc $$ (khối hiển thị). Ví dụ: $x^2 + y^2 = z^2$.
- Lỗi bóc tách câu hỏi khi tải file Word lên: Nếu file Word quá phức tạp hoặc có định dạng đặc biệt, người dùng nên dùng tính năng "Dán văn bản thô" để AI nhận diện dễ dàng hơn.
- Cách thay số bằng AI: Trong giao diện QBuilder, tích chọn các câu hỏi cần đổi số, chọn "Xáo trộn đề" -> "Thay số bằng AI", hệ thống sẽ xử lý và tạo câu hỏi mới tự động.

Hãy trả lời bằng tiếng Việt, giọng điệu thân thiện, chuyên nghiệp, súc tích, dễ hiểu. Sử dụng định dạng Markdown (tiêu đề, danh sách, in đậm) để câu trả lời rõ ràng, trực quan.`;

    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash-lite", 
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      }
    }, 2, 500, ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"]);

    return res.json({ success: true, text: response.text });
  } catch (error: any) {
    console.error("Lỗi Chat AI:", error);
    return res.status(500).json({ error: error.message || "Lỗi máy chủ khi chat AI" });
  }

      return;
    }

    if (action === 'markitdown') {

  try {
    const { type, fileData, mimeType, fileName, url } = req.body;
    let rawText = "";
    let inlineParts: any[] = [];

    if (type === "url" && url) {
      const extracted = await parseUrl(url);
      if (!extracted) {
        return res.status(400).json({ error: "Không thể trích xuất nội dung từ URL này" });
      }
      rawText = extracted;
    } else if (type === "file" && fileData) {
      const extracted = await parseFile(fileData, mimeType, fileName || "");
      
      if (extracted) {
        rawText = extracted;
      } else {
        // If not extracted by custom parsers, it might be image/audio/pdf or other supported by Gemini directly
        inlineParts = [{
          inlineData: {
            mimeType: mimeType || 'application/octet-stream',
            data: fileData
          }
        }];
      }
    } else {
      return res.status(400).json({ error: "Tham số không hợp lệ" });
    }

    const contents: any = {
      parts: [
        {
          text: `Nhiệm vụ của bạn là nhận diện đầy đủ và chính xác toàn bộ nội dung trong tài liệu/URL được cung cấp, sau đó chuyển đổi thành định dạng Markdown chuẩn và đẹp mắt nhất.
Lưu ý:
- Phải trích xuất ĐẦY ĐỦ VÀ CHÍNH XÁC mọi nội dung: chữ, số, công thức toán học (Latex), ký hiệu đặc biệt, văn bản, bảng biểu. Không bỏ sót bất kỳ thông tin nào.
- Giữ nguyên cấu trúc tiêu đề, đoạn văn, danh sách (list).
- Đối với bảng biểu (tables): Nhận diện và format chính xác thành bảng Markdown.
- Nếu là văn xuôi/bài báo, hãy trích xuất gọn gàng, loại bỏ các thành phần rác (header/footer web nếu có).
- Nếu là transcript (Youtube, Audio), hãy trình bày lại thành các đoạn văn dễ đọc, có thể thêm tiêu đề phụ nếu cần thiết.
- Không cần giải thích gì thêm, CHỈ TRẢ VỀ ĐÚNG NỘI DUNG MARKDOWN.`
        }
      ]
    };

    if (rawText) {
      contents.parts.push({ text: `\n\n[NỘI DUNG TÀI LIỆU]:\n${rawText}` });
    }
    
    if (inlineParts.length > 0) {
      contents.parts.push(...inlineParts);
    }

    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash",
      contents: contents
    }, 3, 1500, ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]);

    return res.json({ success: true, markdown: response.text });

  } catch (error: any) {
    console.error("Lỗi chuyển đổi tài liệu MarkItDown:", error);
    return res.status(500).json({ error: error.message || "Lỗi máy chủ khi chuyển đổi tài liệu" });
  }

      return;
    }


    
    if (action === 'extract-text') {
      const { image, mimeType } = req.body;
      
      if (!image || !mimeType) {
        return res.status(400).json({ error: "Thiếu dữ liệu hình ảnh" });
      }
  
      console.log("[Gemini API] Đang trích xuất văn bản từ hình ảnh...");
  
      const response = await generateContentWithRetry({
        model: "gemini-2.5-flash-lite",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: image,
              },
            },
            {
              text: "Hãy trích xuất toàn bộ văn bản trong hình ảnh này. Trả về văn bản nguyên bản. Không cần giải thích thêm.",
            },
          ],
        },
      });
  
      return res.json({ success: true, text: response.text });
    }

    return res.status(400).json({ error: "Action không hợp lệ hoặc chưa được hỗ trợ" });
  } catch (error: any) {
    console.error("Lỗi AI Proxy:", error);
    return res.status(500).json({ 
      error: error.message || "Lỗi máy chủ (500): Không thể xử lý yêu cầu AI."
    });
  }
}
