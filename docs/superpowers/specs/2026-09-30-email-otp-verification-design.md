# Xac thuc OTP qua Email

## Muc tieu

Buoc bat buoc cho moi tai khoan Google dang nhap Word2LaTeX cung cap so dien thoai Viet Nam va xac thuc email bang OTP truoc khi su dung ung dung va cac API AI.

## Pham vi

- Ap dung cho tai khoan moi va tai khoan cu chua co `emailOtpVerifiedAt`, bao gom tai khoan quan tri.
- Gui OTP 6 chu so den email cua tai khoan Firebase dang dang nhap qua Gmail SMTP.
- Luu so dien thoai o dinh dang E.164 `+84...` trong `users/{uid}`.
- Giu nguyen trang thai `pending`, `approved`, `rejected` va vai tro hien co.
- Khong gui OTP SMS va khong xac minh quyen so huu so dien thoai.

## Luong nguoi dung

1. Nguoi dung dang nhap bang Google nhu hien tai.
2. Neu `users/{uid}.emailOtpVerifiedAt` chua ton tai, giao dien chi hien thi man hinh xac thuc.
3. Nguoi dung nhap so dien thoai Viet Nam hop le va yeu cau ma OTP.
4. Nguoi dung nhap OTP 6 chu so trong vong 10 phut.
5. Xac thuc thanh cong luu ho so, cap nhat custom claim Firebase, lam moi ID token va mo ung dung.

## Backend va du lieu

- Tao Vercel Function `api/email-verification.ts` voi cac action `send` va `verify`.
- Moi yeu cau can Firebase ID token hop le va chi duoc thao tac voi `uid` cua token.
- Document `email_verifications/{uid}` chi do backend quan ly, gom `codeHash`, `expiresAt`, `attempts`, `lastSentAt` va `phoneNumber`.
- OTP duoc tao bang crypto an toan, bam HMAC voi `OTP_PEPPER`, khong luu ma goc.
- `send` tu choi neu lan gui truoc chua qua 60 giay. `verify` tu choi ma het han hoac sau 5 lan sai.
- `verify` cap nhat `users/{uid}` voi `phoneNumber`, `emailOtpVerifiedAt`, `emailOtpVerificationMethod: 'gmail-otp'`; sau do gan custom claim `emailOtpVerified: true`.
- Gmail SMTP dung `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_APP_PASSWORD` va `SMTP_FROM`.

## Bao ve truy cap

- Frontend khong render giao dien chinh truoc khi ho so xac thuc.
- `verifyAuthAndApproval` yeu cau custom claim `emailOtpVerified` truoc khi cho phep API AI, ke ca owner.
- Firestore rules cam client doc hoac ghi `email_verifications`.
- Cac quy tac Firestore khac giu nguyen trong thay doi nay.

## Giao dien

- Them `EmailVerificationGate` sau khi dang nhap va nap `userDoc`.
- Hien thi email dang nhap, input so dien thoai, input OTP, dong dem gui lai va thong bao loi ro rang.
- Goi endpoint qua `authFetch`; sau khi thanh cong goi `getIdToken(true)` va doi `userDoc` realtime.

## Kiem thu

- Don vi: tao, bam va kiem tra OTP; xac thuc so dien thoai; gioi han gui lai va so lan thu.
- API: tu choi token thieu, OTP sai, OTP het han va vuot gioi han; cap nhat ho so khi OTP dung.
- Giao dien: tai khoan chua xac thuc bi chan; tai khoan da xac thuc vao ung dung.
- Build, lint va kiem tra diff truoc khi ban giao.

## Ngoai pham vi

- Xac minh SMS, dang nhap email va mat khau, DOI tu dong, va chuyen sang dich vu email khac.
