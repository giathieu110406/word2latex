const smartPasteText = `Câu 1: Trong kế toán, nguyên tắc nào yêu cầu các khoản doanh thu và chi phí phải được ghi nhận vào kỳ kế toán phát sinh, bất kể việc thu hoặc chi tiền đã diễn ra hay chưa?
A. Nguyên tắc giá gốc
B. Nguyên tắc thận trọng
C. Nguyên tắc phù hợp
D. Nguyên tắc cơ sở dồn tích

Câu 2: Đâu là ngôn ngữ lập trình phổ biến nhất hiện nay thường được ứng dụng trong phân tích dữ liệu và AI?
A. C++
B. Java
C. Python
D. Swift`;

const fixMarkdown = (text) => {
  let t = text.replace(/(^|\s)\*\s+\*(.*?)\*\*/g, '$1**$2**');
  t = t.replace(/\*\s+\*\*/g, '***');
  t = t.replace(/\*\*\s+\*/g, '***');
  t = t.replace(/^#\s+#/gm, '##');
  t = t.replace(/\*\s+\*(.*?)\*\s+\*/g, '**$1**');
  return t;
};

const fixedText = fixMarkdown(smartPasteText);
const lines = fixedText.split('\n');

let blocks = [];
let currentBlock = "";

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^Câu\s+\d+[:.]/i.test(line.trim())) {
        if (currentBlock.trim()) blocks.push(currentBlock);
        currentBlock = line + '\n';
    } else {
        currentBlock += line + '\n';
    }
}
if (currentBlock.trim()) blocks.push(currentBlock);

if (blocks.length === 0) {
    blocks.push(fixedText);
}

const parsedQuestions = blocks.map(block => {
    let qLines = [];
    let aLines = [];
    let isAnswer = false;
    
    const blockLines = block.split('\n');
    for (let i = 0; i < blockLines.length; i++) {
        const lower = blockLines[i].toLowerCase().trim();
        const plain = lower.replace(/\*/g, '').trim();
        
        if (
            plain.startsWith('đáp án:') || 
            plain.startsWith('đáp án') || 
            plain.startsWith('hướng dẫn giải') || 
            plain.startsWith('lời giải') || 
            plain.startsWith('giải thích') ||
            plain.match(/^--+$/)
        ) {
            isAnswer = true;
        }
        
        if (isAnswer) {
            aLines.push(blockLines[i]);
        } else {
            qLines.push(blockLines[i]);
        }
    }
    
    return {
       q: qLines.join('\n').trim(),
       a: aLines.join('\n').trim()
    };
});

console.log(JSON.stringify(parsedQuestions, null, 2));
