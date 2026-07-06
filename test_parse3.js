const text = `Phần 1: Trắc nghiệm nhiều lựa chọn
Câu hỏi: Cho hàm số f(x)=x2−4x+3. Đỉnh của parabol có tọa độ là:

A) (2,−1)

B) (−2,15)

C) (1,0)

D) (0,3)

Đáp án:* A.
Phần 2: Trắc nghiệm Đúng/Sai
Câu hỏi: Cho hàm số f(x)=x2−4x+3. Các mệnh đề sau đây đúng hay sai?

a) Hàm số đồng biến trên khoảng (2,+∞).

b) Giá trị nhỏ nhất của hàm số là −1.

c) Đồ thị hàm số cắt trục tung tại điểm (0,3).

d) Hàm số có hai nghiệm phân biệt là x=1 và x=3.

Đáp án:

a: Đúng.

b: Đúng.

c: Đúng.

d: Đúng.

Phần 3: Trắc nghiệm trả lời ngắn
Câu hỏi:* Tìm giá trị nhỏ nhất của hàm số f(x)=x2−4x+3.
Đáp án: −1`;

let blocks = [];
let currentBlock = "";
let currentTypeContext = "trac_nghiem";

const lines = text.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTrimmed = line.trim();
    const lowerLine = lineTrimmed.toLowerCase();
    
    const isNewQuestion = /^(?:Câu|Bài)\s*(?:hỏi)?\s*(?:\d+)?\s*(?:[:.\-|\*]|$)/i.test(lineTrimmed);
    const isNewSection = /^Phần\s+\d+/i.test(lineTrimmed);

    if (isNewQuestion || isNewSection) {
        if (currentBlock.trim()) blocks.push({ text: currentBlock, typeContext: currentTypeContext });
        
        if (isNewSection) {
            currentBlock = "";
        } else {
            currentBlock = line + '\n';
        }
    } else {
        currentBlock += line + '\n';
    }

    if (lowerLine.includes("nhiều lựa chọn") || lowerLine.includes("4 lựa chọn") || lowerLine.includes("chọn một phương án") || lowerLine.includes("phương án đúng") || lowerLine.includes("một đáp án")) {
        currentTypeContext = "trac_nghiem";
    } else if (lowerLine.includes("đúng/sai") || lowerLine.includes("đúng sai") || lowerLine.includes("đúng hay sai")) {
        currentTypeContext = "trac_nghiem_dung_sai";
    } else if (lowerLine.includes("trả lời ngắn")) {
        currentTypeContext = "trac_nghiem_tra_loi_ngan";
    } else if (lowerLine.includes("tự luận")) {
        currentTypeContext = "tu_luan";
    }
}
if (currentBlock.trim()) blocks.push({ text: currentBlock, typeContext: currentTypeContext });

// Filter blocks that are actually questions (must contain at least some content)
blocks = blocks.filter(b => /^(?:Câu|Bài)/i.test(b.text.trim()));

console.log(blocks);
