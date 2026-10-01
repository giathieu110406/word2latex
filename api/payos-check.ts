import { VercelRequest, VercelResponse } from '@vercel/node';
import { PayOS } from "@payos/node";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, updateDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
};

let appFirebase;
if (!getApps().length) {
  appFirebase = initializeApp(firebaseConfig);
} else {
  appFirebase = getApp();
}
const db = getFirestore(appFirebase);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok' });
  }

  let payos: any = null;
  if (process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY) {
    payos = new PayOS(process.env.PAYOS_CLIENT_ID, process.env.PAYOS_API_KEY, process.env.PAYOS_CHECKSUM_KEY);
  } else {
    return res.status(500).json({ error: "PayOS chưa cấu hình" });
  }

  try {
    const { orderCode, uid, plan } = req.body;
    if (!orderCode) {
      return res.status(400).json({ error: "Thiếu orderCode" });
    }

    const paymentInfo = await payos.paymentRequests.get(orderCode);
    console.log("PayOS check paymentInfo:", paymentInfo.status);

    if (paymentInfo.status === "PAID") {
      if (uid && plan) {
        let durationDays = 3;
        if (plan === "pro") durationDays = 30;
        else if (plan === "plus") durationDays = 30;

        const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;
        await updateDoc(doc(db, "users", uid), {
          planType: plan,
          pricingPlan: plan,
          planExpiresAt: expiresAt,
          updatedAt: new Date().toISOString()
        });
      }
      return res.json({ paid: true, status: paymentInfo.status });
    }

    return res.json({ paid: false, status: paymentInfo.status });
  } catch (error: any) {
    console.error("PayOS status check error:", error);
    return res.status(500).json({ error: error.message });
  }
}
