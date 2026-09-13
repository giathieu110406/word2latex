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

/**
 * Xác thực Firebase ID Token và kiểm tra trạng thái phê duyệt của tài khoản từ Database
 */
export async function verifyAuthAndApproval(
  req: any,
  firestoreDb?: any
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

    // 1. Xác thực ID Token qua Google OAuth2 tokeninfo endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!verifyRes.ok) {
      return {
        authorized: false,
        status: 401,
        error: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại."
      };
    }

    const tokenInfo: any = await verifyRes.json();
    const uid = tokenInfo.user_id || tokenInfo.sub;
    const email = (tokenInfo.email || "").toLowerCase().trim();

    if (!uid) {
      return {
        authorized: false,
        status: 401,
        error: "Không thể nhận diện danh tính người dùng từ token."
      };
    }

    // 2. Kiểm tra nếu là Owner
    if (email === OWNER_EMAIL) {
      return {
        authorized: true,
        status: 200,
        user: {
          uid,
          email,
          isOwner: true,
          status: "approved",
          role: "admin"
        }
      };
    }

    // 3. Kiểm tra trạng thái tài khoản trong Firestore
    let status = "";
    let role = "user";

    // 3a. Thử qua SDK firestoreDb nếu có
    if (firestoreDb && typeof firestoreDb.collection === 'function') {
      try {
        const docSnap = await firestoreDb.collection('users').doc(uid).get();
        if (docSnap.exists) {
          const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data;
          status = data?.status || "";
          role = data?.role || "user";
        }
      } catch (sdkErr) {
        console.warn("[Auth Guard] Không thể đọc qua SDK, chuyển sang REST API:", sdkErr);
      }
    }

    // 3b. Fallback qua Firestore REST API chính thức với ID Token của người dùng
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
        }
      } catch (restErr) {
        console.warn("[Auth Guard] Lỗi truy vấn Firestore REST API:", restErr);
      }
    }

    // 4. Đánh giá trạng thái thành viên
    if (status === 'approved') {
      return {
        authorized: true,
        status: 200,
        user: {
          uid,
          email,
          isOwner: false,
          status: "approved",
          role
        }
      };
    }

    if (status === 'rejected') {
      return {
        authorized: false,
        status: 403,
        error: "Tài khoản của bạn đã bị từ chối quyền truy cập hệ thống. Vui lòng liên hệ Admin."
      };
    }

    return {
      authorized: false,
      status: 403,
      error: "Tài khoản của bạn đang chờ phê duyệt. Vui lòng liên hệ Admin qua email giathieu110406@gmail.com để được kích hoạt."
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
