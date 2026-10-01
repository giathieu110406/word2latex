import { VercelRequest, VercelResponse } from '@vercel/node';
import { PayOS } from "@payos/node";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let payos: any = null;
  if (process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY) {
    payos = new PayOS(process.env.PAYOS_CLIENT_ID, process.env.PAYOS_API_KEY, process.env.PAYOS_CHECKSUM_KEY);
  } else {
    return res.status(500).json({ error: "PayOS chưa cấu hình" });
  }

  try {
    const webhookData = payos.webhooks.verify(req.body);
    console.log("PayOS Webhook Received:", webhookData);

    if (webhookData.code === "00") {
      const description = webhookData.data.description || "";
      if (description.startsWith("W2L")) {
        const partialUid = description.replace("W2L", "").trim().toLowerCase();
        
        // Scan firebase for user matching first 4 chars of UID
        const usersSnap = await getDocs(collection(db, "users"));
        for (const userDoc of usersSnap.docs) {
          const uid = userDoc.id;
          if (uid.toLowerCase().startsWith(partialUid)) {
            const amount = webhookData.data.amount;
            let targetPlan = "trial";
            if (amount >= 29000) targetPlan = "pro";
            else if (amount >= 19000) targetPlan = "plus";
            
            await updateDoc(doc(db, "users", uid), {
              pricingPlan: targetPlan,
              updatedAt: new Date().toISOString()
            });
            console.log(`Updated user ${uid} to plan ${targetPlan} from Webhook`);
            break;
          }
        }
      }
    }
    return res.json({ success: true });
  } catch (error: any) {
    console.error("PayOS Webhook Error:", error);
    return res.json({ success: false, error: error.message });
  }
}
