# Phone Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Khóa số liên hệ sau OTP email, buộc hồ sơ hợp lệ trước khi dùng workspace, hiển thị lịch sử cho admin và thống nhất điều hướng nâng cấp.

**Architecture:** Tận dụng endpoint email-verification và Firebase Admin hiện có. Một policy dùng chung quyết định hồ sơ hợp lệ ở frontend/server; transaction Firestore quản lý challenge, hạn mức và lịch sử. Không thêm endpoint serverless hoặc dịch vụ xác minh thuê bao.

**Tech Stack:** React, TypeScript, Firebase Admin/Firestore, Nodemailer, Vercel, tsx/node:assert.

**Spec:** docs/superpowers/specs/2026-10-01-phone-confirmation-design.md

## Global Constraints

- OTP 6 chữ số, hạn 10 phút; chờ 60 giây, tối đa 5 lần nhập sai; tối đa 5 lần gửi/giờ và 10 lần/24 giờ theo UID.
- Lưu số dạng +84; phương thức email_otp, phiên bản xác nhận 1; không khẳng định quyền sở hữu số.
- Tài khoản cũ xác nhận lại một lần; không sửa gói, hạn dùng hay trạng thái phê duyệt.
- Số khóa không tự sửa/xóa; dấu hiệu trùng số chỉ cảnh báo admin.
- Rules và backend phải hoạt động trước khi bật gate frontend; webhook/thanh toán không phụ thuộc gate.
- Giữ giao diện hiện có; không thêm SMS, fingerprint hoặc thư viện sản phẩm mới.

## Review Focus

- Hai request gửi/verify đồng thời không vượt hạn mức hoặc ghi hai sự kiện.
- SMTP lỗi sau đặt chỗ không để người dùng dùng challenge chưa gửi; lần thử vẫn tính vào hạn mức chống lạm dụng.
- Token đúng định dạng nhưng không có chữ ký hợp lệ phải bị từ chối.
- Hồ sơ cũ có ngày OTP nhưng số thiếu/sai vẫn bị gate, không mất quyền gói đã trả tiền.
- Client sửa số hoặc tự tạo lịch sử phải bị rules chặn, trong khi sửa tên/ngày sinh vẫn được.

### Task 1: Policy số liên hệ và trạng thái hồ sơ

**Files:** Create shared/phone-confirmation.ts, shared/phone-confirmation.test.ts; modify server/email-verification-utils.ts, src/utils/email-verification.ts and their tests.

**Interfaces:** normalizeVietnamPhone(value: string): string|null; hasPhoneConfirmation(profile: unknown): boolean. Profile cần phoneNumber, confirmedPhoneNumber, phoneConfirmationVersion=1, phoneConfirmationMethod=email_otp, phoneConfirmedAt và emailOtpVerifiedAt hợp lệ.

- [ ] Viết assert normalize(' +84 912 345 678 ')==='+84912345678'; số sai độ dài/đầu số/toàn một chữ số/chuỗi liên tiếp trả null; số lặp một phần hợp lệ được giữ.
- [ ] Viết assert hồ sơ cũ chỉ có emailOtpVerifiedAt, số trống và số hiện tại khác số khóa đều false; hồ sơ đầy đủ và số nội địa tương đương true; phiên bản/phương thức sai false.
- [ ] Chạy node_modules/.bin/tsx shared/phone-confirmation.test.ts: phải FAIL vì thiếu policy.
- [ ] Kiểm chứng danh sách đầu số với nguồn chính thức; triển khai policy thuần dùng chung, cập nhật utilities để tránh khác quy tắc giữa frontend/server.
- [ ] Chạy test mới và utils hiện có: PASS; commit feat: define contact confirmation policy.

### Task 2: OTP nguyên tử và lịch sử server

**Files:** Create server/phone-confirmation-store.ts and server/phone-confirmation-store.test.ts; modify api/email-verification.ts, server/email-verification.test.ts.

**Interfaces:** createPhoneConfirmationStore(db: Firestore) trả reserveSend(uid, phone, email, challengeId, otpHash, now), markDelivered(uid, challengeId), verify(uid, email, codeHash, now). Các thao tác dùng transaction; lỗi có status/code/cooldownSeconds. Tiêu thụ challenge trả profile xác nhận; endpoint gửi response chứa profile cho frontend.

- [ ] Viết test store bằng Firestore emulator/adapter transaction có retry, assert 2 verify đồng thời chỉ một sự kiện và một lần consume; 2 send cùng UID trong 60 giây chỉ một reservation; replay bị từ chối.
- [ ] Viết test 5 lần/giờ, 10 lần/24 giờ; rollover; OTP 10 phút; 5 lần sai; email thay đổi; số khóa khác; SMTP lỗi không xác nhận; claim lỗi sau commit không ghi lặp. Chạy: FAIL vì chưa có store mới.
- [ ] Thực hiện transaction đọc user/challenge/hạn mức trước khi ghi. Lưu sendTimes giữ cửa sổ 24 giờ; challengeId ngẫu nhiên, delivered=false đến khi gửi thành công; OTP băm và không trả OTP trong response.
- [ ] Verify kiểm tra email hiện tại, delivered, expiry, attempts và policy số. Transaction cập nhật số khóa/profile, phoneConfirmations/{challengeId}, consume challenge nhưng giữ bộ đếm gửi. Không ghi vào planType/pricingPlan/planExpiresAt/status.
- [ ] Endpoint send dùng email từ Firebase account; hoàn thành SMTP rồi markDelivered. Verify cập nhật custom claims tương thích theo best effort sau transaction; lỗi claim không biến commit thành thất bại.
- [ ] Phát hiện trùng số bằng truy vấn confirmedPhoneNumber trong thao tác đọc lịch sử admin; không lưu cờ có thể lỗi thời hoặc lộ số tài khoản khác cho user.
- [ ] Chạy store và endpoint tests: PASS; commit feat: lock contact number with atomic email confirmation.

### Task 3: Guard và Firestore rules

**Files:** Modify server/auth-guard.ts, server/auth-guard.test.ts, firestore.rules; create test/phone-confirmation-rules.test.ts, firebase.json (chỉ cấu hình rules/emulator nếu chưa có).

**Interfaces:** verifyAuthAndApproval giữ chữ ký hiện tại; dùng hasPhoneConfirmation(profile). Đọc đầy đủ trường profile qua Admin/REST hợp lệ. GET history dùng action=history trong email-verification, Firebase ID token và quyền admin xác minh phía server, nhận targetUid; trả sự kiện và duplicatePhone boolean, không trả OTP.

- [ ] Viết test unsigned JWT bị 401, profile cũ/thiếu/sai số bị 403, user/admin đầy đủ được phép; tài khoản rejected vẫn bị chặn. Chạy: FAIL cho profile cũ/unsigned token.
- [ ] Loại bỏ nhánh chỉ decode JWT; giữ các cách xác thực chữ ký chính thức. Áp dụng policy chung cho guard AI/MarkItDown; không áp dụng trên webhook/check thanh toán.
- [ ] Viết rules emulator test: client không sửa trường xác nhận, số khóa, lịch sử/OTP; sửa tên/ngày sinh được; admin đọc lịch sử được, user khác không đọc được; create không tự tạo profile đã xác nhận. Chạy: FAIL trên rules cũ.
- [ ] Bảo vệ trường server quản lý trong create/update users, phoneConfirmations và email_verifications, kể cả owner wildcard; bảo vệ phoneHistory khỏi ghi mới ở client. Sau có số khóa thì phoneNumber bất biến từ client.
- [ ] History endpoint chỉ admin xác minh quyền từ email owner hoặc dữ liệu role/admins đáng tin; không tin role gửi trong body. Test user bị 403, admin nhận lịch sử/trùng số.
- [ ] Chạy guard/endpoint/rules tests: PASS; commit fix: enforce contact confirmation at trust boundaries.

### Task 4: Gate, cài đặt, thành viên và nâng cấp

**Files:** Modify src/components/EmailVerificationGate.tsx, src/App.tsx; create src/utils/upgrade-policy.ts and src/utils/upgrade-policy.test.ts.

**Interfaces:** Gate props email, lockedPhone?: string, onVerified(profile: confirmed profile): Promise<void>|void. getUpgradeVisibility(plan: string, expiresAt?: number) trả sidebar/main booleans; Free true/true, Trial/Plus false/true, Pro false/false; hết hạn như Free.

- [ ] Viết assertions các gói Free/Trial/Plus/Pro và hết hạn; chạy: FAIL vì thiếu helper.
- [ ] Đổi sidebar CTA mở pricing; dùng visibility chung cho sidebar/topbar/màn hình chính; giữ ngoại lệ quản trị hiện có.
- [ ] Gate dùng policy mới, lockedPhone chỉ đọc khi có; nêu rõ xác nhận thông tin qua email và khóa số. Callback dùng profile server/snapshot, refresh token; không tự dựng trạng thái tin cậy. Cho sửa số trước hoàn thành challenge nếu chưa khóa, nhưng phải yêu cầu mã mới.
- [ ] Cài đặt không ghi phoneNumber/phoneHistory, hiển thị số chỉ đọc và nhãn. Modal thành viên tải history qua endpoint khi chọn avatar; có loading/error, thứ tự mới nhất, lịch sử cũ tách nhãn và cảnh báo trùng số.
- [ ] Chạy policy tests, build và browser trên local: gate thiếu/sai số, thông báo lỗi, cài đặt khóa, admin modal và từng gói. Không gọi send đến email thật nếu chưa có tài khoản thử được cho phép. Commit feat: update contact confirmation and upgrade UI.

### Task 5: Kiểm tra toàn bộ, review và triển khai

**Files:** Plan ledger và các file sửa cần thiết theo kết quả kiểm tra.

- [ ] Chạy mọi test .test.ts hiện có bằng tsx từng file, rules emulator, npm run build, git diff --check. Ghi rõ lỗi có sẵn và hạn chế môi trường nếu có; không tuyên bố test chưa chạy là pass.
- [ ] Review toàn bộ diff bằng reviewer riêng theo skill executing-plans; sửa findings nghiêm trọng bằng RED→GREEN. Kiểm tra lại thanh toán bằng tests signature/subscription, không tạo giao dịch tiền mới.
- [ ] Deploy rules và backend tương thích trước frontend. Tách commit server/rules và UI để điều khiển thứ tự phát hành; nếu chưa truy cập được Firebase deployment, giữ frontend chưa push cho đến khi rules được xác nhận hoạt động.
- [ ] Push/deploy Vercel trong phạm vi user đã cho phép, chờ Ready; kiểm tra gate thực và log. Nếu cần OTP thực, giữ tab để người dùng nhập mã thay vì đọc email ngoài phạm vi.
- [ ] Lưu ảnh bằng chứng giao diện, báo kết quả phân biệt unit/emulator/build/browser và email thực. Không báo hoàn thành khóa số nếu rules production chưa áp dụng.
