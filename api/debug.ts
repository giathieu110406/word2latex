import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const reports: any = {};
  
  // 1. Test GEMINI_API_KEY
  reports.gemini_key_exists = !!process.env.GEMINI_API_KEY;
  if (process.env.GEMINI_API_KEY) {
    reports.gemini_key_length = process.env.GEMINI_API_KEY.length;
    reports.gemini_key_prefix = process.env.GEMINI_API_KEY.substring(0, 6);
  }
  
  // 2. Test Firebase Keys
  reports.firebase_keys = {
    VITE_FIREBASE_API_KEY: !!process.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_PROJECT_ID: !!process.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_AUTH_DOMAIN: !!process.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_APP_ID: !!process.env.VITE_FIREBASE_APP_ID,
  };
  
  // 3. Try importing @google/genai
  try {
    const sdk = await import('@google/genai');
    reports.sdk_import = "success";
    reports.sdk_keys = Object.keys(sdk);
  } catch (err: any) {
    reports.sdk_import_error = err.message || String(err);
    reports.sdk_import_stack = err.stack;
  }
  
  // 4. Try importing markitdown
  try {
    const md = await import('../markitdown');
    reports.markitdown_import = "success";
  } catch (err: any) {
    reports.markitdown_import_error = err.message || String(err);
    reports.markitdown_import_stack = err.stack;
  }
  
  return res.status(200).json(reports);
}
