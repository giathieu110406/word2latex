import * as mammoth from "mammoth";
import * as xlsx from 'xlsx';
import * as cheerio from 'cheerio';
import { YoutubeTranscript } from 'youtube-transcript';

export async function parseFile(base64Data: string, mimeType: string, filename: string): Promise<string | null> {
  const buffer = Buffer.from(base64Data, 'base64');
  
  try {
    if (mimeType.includes('wordprocessingml') || filename.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } 
    else if (mimeType.includes('spreadsheetml') || mimeType.includes('excel') || filename.endsWith('.xlsx') || filename.endsWith('.csv')) {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        text += `\n--- Sheet: ${sheetName} ---\n`;
        const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        text += csv;
      });
      return text;
    }
    // Dành cho PDF, hình ảnh, audio, video: Trả về null để sử dụng tính năng đọc trực tiếp của Gemini
    else if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
      return null;
    }
  } catch (error) {
    console.error("Parse file error:", error);
  }
  return null;
}

export async function parseUrl(url: string): Promise<string | null> {
  try {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      return transcript.map(t => t.text).join(' ');
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const html = await res.text();
      const $ = cheerio.load(html);
      
      // Remove scripts, styles
      $('script, style, noscript').remove();
      
      // Basic extraction
      return $('body').text().replace(/\s+/g, ' ').trim();
    }
  } catch (err) {
    console.error("Parse URL error:", err);
  }
  return null;
}
 