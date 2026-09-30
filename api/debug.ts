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
    FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    APPROVAL_SECRET_KEY: !!process.env.APPROVAL_SECRET_KEY,
  };

  // 3. Test Email Verification env vars (SMTP + OTP_PEPPER)
  reports.email_verification = {
    SMTP_HOST: !!process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT || '(default 465)',
    SMTP_SECURE: process.env.SMTP_SECURE || '(default true)',
    SMTP_USER: !!process.env.SMTP_USER,
    SMTP_APP_PASSWORD: !!process.env.SMTP_APP_PASSWORD,
    SMTP_FROM: !!process.env.SMTP_FROM,
    OTP_PEPPER: !!process.env.OTP_PEPPER,
  };
  
  // 4. Try importing @google/genai
  try {
    const sdk = await import('@google/genai');
    reports.sdk_import = "success";
  } catch (err: any) {
    reports.sdk_import_error = err.message || String(err);
  }
  
  // 5. Try importing markitdown
  try {
    await import('../markitdown');
    reports.markitdown_import = "success";
  } catch (err: any) {
    reports.markitdown_import_error = err.message || String(err);
  }
  
  return res.status(200).json(reports);
}
