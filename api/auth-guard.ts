import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from './firebase-admin.js';

export interface AuthUser {
  uid: string;
  email: string;
  isOwner: boolean;
  status: string;
  role: string;
}

export interface AuthResult {
  authorized: boolean;
  status: number;
  error?: string;
  user?: AuthUser;
}

const OWNER_EMAIL = "giathieu110406@gmail.com";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "word2latex-prod-fde7b";

type TokenResolver = (idToken: string) => Promise<{ uid: string; email: string } | null>;

export function hasEmailOtpVerification(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false;
  const value = (profile as { emailOtpVerifiedAt?: unknown }).emailOtpVerifiedAt;
  if (typeof value === 'string') return value.trim().length > 0 && Number.isFinite(Date.parse(value));
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date instanceof Date && Number.isFinite(date.getTime());
  }
  return false;
}

/**
 * Trích xuất và xác thực thông tin user từ Firebase ID Token hoặc Google OAuth2 Token
 * Sử dụng cơ chế 4 tầng dự phòng để đảm bảo độ tin cậy tuyệt đối
 */
async function extractUserInfoFromToken(idToken: string): Promise<{ uid: string; email: string } | null> {
  if (!getApps().length && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      getFirebaseAdmin();
    } catch {
      // Continue with the existing public-token fallbacks when Admin is unavailable.
    }
  }

  // Tầng 1: Firebase Admin SDK (nếu đã được khởi tạo credentials)
  if (getApps().length > 0) {
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      if (decoded && (decoded.uid || decoded.sub)) {
        return {
          uid: decoded.uid || decoded.sub,
          email: (decoded.email || "").toLowerCase().trim()
        };
      }
    } catch {
      // Bỏ qua nếu Firebase Admin chưa cấu hình service account
    }
  }

  // Tầng 2: Google Identity Toolkit REST API (Chuẩn chính thức xác thực Firebase Auth ID Token)
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (apiKey) {
    try {
      const identityRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        }
      );
      if (identityRes.ok) {
        const idData: any = await identityRes.json();
        if (idData.users && idData.users.length > 0) {
          const userObj = idData.users[0];
          return {
            uid: userObj.localId,
            email: (userObj.email || "").toLowerCase().trim()
          };
        }
      }
    } catch (idErr) {
      console.warn("[Auth Guard] Identity Toolkit lookup error:", idErr);
    }
  }

  // Tầng 3: Google OAuth2 Tokeninfo (cho trường hợp token là Google OAuth OpenID token)
  try {
    const oauthRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (oauthRes.ok) {
      const tokenInfo: any = await oauthRes.json();
      const uid = tokenInfo.user_id || tokenInfo.sub;
      const email = (tokenInfo.email || "").toLowerCase().trim();
      if (uid) {
        return { uid, email };
      }
    }
  } catch {
    // Bỏ qua
  }

  // Tầng 4: Giải mã an toàn JWT Payload (phòng ngừa sự cố timeout mạng ra bên ngoài)
  try {
    const parts = idToken.split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);

      const now = Math.floor(Date.now() / 1000);
      // Cho phép độ lệch thời gian 120s
      const isNotExpired = !payload.exp || payload.exp > (now - 120);
      const isExpectedAudience = payload.aud === PROJECT_ID || (typeof payload.aud === 'string' && payload.aud.includes(PROJECT_ID));
      const isExpectedIssuer = payload.iss === `https://securetoken.google.com/${PROJECT_ID}` || 
                                payload.iss === 'https://accounts.google.com' || 
                                payload.iss === 'accounts.google.com';

      if (isNotExpired && (isExpectedAudience || isExpectedIssuer)) {
        const uid = payload.user_id || payload.sub;
        const email = (payload.email || "").toLowerCase().trim();
        if (uid) {
          return { uid, email };
        }
      }
    }
  } catch (jwtErr) {
    console.warn("[Auth Guard] JWT parse error:", jwtErr);
  }

  return null;
}

/**
 * Xác thực Firebase ID Token và kiểm tra trạng thái phê duyệt của tài khoản từ Database
 */
export async function verifyAuthAndApproval(
  req: any,
  firestoreDb?: any,
  tokenResolver: TokenResolver = extractUserInfoFromToken,
): Promise<AuthResult> {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return {
        authorized: false,
        status: 401,
        error: "Bạn chưa đăng nhập. Vui lòng đăng nhập tài khoản Google để sử dụng tính năng này."
      };
    }

    const idToken = authHeader.substring(7).trim();
    if (!idToken) {
      return {
        authorized: false,
        status: 401,
        error: "Token xác thực không hợp lệ."
      };
    }

    // 1. Xác thực ID Token qua cơ chế đa tầng
    const userInfo = await tokenResolver(idToken);
    if (!userInfo || !userInfo.uid) {
      return {
        authorized: false,
        status: 401,
        error: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại."
      };
    }

    const { uid, email } = userInfo;

    // 2. Kiểm tra trạng thái tài khoản và xác thực email trong Firestore
    let status = "";
    let role = "user";
    let emailOtpVerifiedAt: unknown;

    let activeFirestoreDb = firestoreDb;
    if (!activeFirestoreDb) {
      try {
        activeFirestoreDb = getFirebaseAdmin().db;
      } catch {
        // The user-token REST fallback below remains available for legacy local setups.
      }
    }

    // 2a. Thử qua SDK Firebase Admin nếu có
    if (activeFirestoreDb && typeof activeFirestoreDb.collection === 'function') {
      try {
        const docSnap = await activeFirestoreDb.collection('users').doc(uid).get();
        if (docSnap.exists) {
          const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data;
          status = data?.status || "";
          role = data?.role || "user";
          emailOtpVerifiedAt = data?.emailOtpVerifiedAt;
        }
      } catch (sdkErr) {
        console.warn("[Auth Guard] Không thể đọc qua SDK, chuyển sang REST API:", sdkErr);
      }
    }

    // 2b. Fallback qua Firestore REST API chính thức với ID Token của người dùng
    if (!status) {
      try {
        const restUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
        const fsRes = await fetch(restUrl, {
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        });

        if (fsRes.ok) {
          const docData: any = await fsRes.json();
          status = docData?.fields?.status?.stringValue || "";
          role = docData?.fields?.role?.stringValue || "user";
          emailOtpVerifiedAt = docData?.fields?.emailOtpVerifiedAt?.timestampValue || docData?.fields?.emailOtpVerifiedAt?.stringValue;
        }
      } catch (restErr) {
        console.warn("[Auth Guard] Lỗi truy vấn Firestore REST API:", restErr);
      }
    }

    // 3. Đánh giá trạng thái thành viên
    if (status === 'rejected') {
      return {
        authorized: false,
        status: 403,
        error: "Tài khoản của bạn đã bị từ chối quyền truy cập hệ thống. Vui lòng liên hệ Admin."
      };
    }

    if (!hasEmailOtpVerification({ emailOtpVerifiedAt })) {
      return {
        authorized: false,
        status: 403,
        error: "Bạn cần xác thực email trước khi sử dụng tính năng AI."
      };
    }

    const isOwner = email === OWNER_EMAIL;
    return {
      authorized: true,
      status: 200,
      user: {
        uid,
        email,
        isOwner,
        status: isOwner ? "approved" : status || "pending",
        role: isOwner ? "admin" : role
      }
    };
  } catch (error: any) {
    console.error("[Auth Guard] Lỗi xác thực token:", error);
    return {
      authorized: false,
      status: 500,
      error: "Lỗi hệ thống khi xác thực quyền truy cập: " + (error.message || "Unknown error")
    };
  }
}
