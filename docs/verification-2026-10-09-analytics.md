# Phân tích và Chi tiết hoạt động — kiểm chứng 09/10/2026

## Kết quả và phạm vi
Đã thay dashboard và pipeline logging cũ bằng collection Firebase `activity_events`. Trang tổng và Chi tiết hoạt động cùng đọc API quản trị `/api/activity`; cùng bộ lọc ngày/người/nguồn/trạng thái, không đọc file local hoặc ghi số liệu suy đoán ngược vào Firebase. Mặc định Website, chọn Localhost/Kiểm thử/Tất cả khi cần. Tự đọc lại mỗi 30 giây (không quảng cáo subscription realtime). Giữ các sửa trước về Vẽ hình, quota, trang chủ, mascot, Pro và cleanup; không push/deploy.

## Review nguyên nhân
- Client cũ tăng `api_usage_stats` đồng thời API backend: admin có thể đếm hai lần; user thường bị rules chặn ghi client.
- API log cũ không xác thực, không có actor, fallback JSON local vẫn trả success.
- raw AI log lấy userId từ body, người gửi tự nhận actor.
- Dashboard reconcile bộ đếm users với logs rồi tự ghi trở lại Firestore; suy thời lượng 1/2/3 phút và cộng overlap promptCount/MarkItDown. Chi tiết chỉ có tổng theo thành viên, không có từng hành động/thời điểm.
- Firebase Admin chưa dùng cấu hình named database như client; owner wildcard có thể bypass match ghi analytics trong rules.

## Các sửa
- `shared/activity.ts`, `server/activity.ts`: ngày/giờ Việt Nam; server timestamp; UUID/request ID và hash của actor/action/id, transaction chống trùng. AI có started -> success/error, chỉ success sau kết quả handler thành công. Lỗi ghi terminal giữ started/chưa nhận kết quả, trả header X-Activity-Recorded=false, không tự chạy lại công việc.
- UID người dùng từ token đã xác minh; không lấy actor/time/status từ body. AI handlers giữ auth/entitlement cũ và dùng actor đã xác thực cho raw log. Request retry401 giữ ID; replay đã nhận trả409 trước khi chạy lại business action.
- AI parse-exam, smart-paste, fix-logic, canvas, shuffle, chat, MarkItDown, extract-text và Vẽ hình đều qua recorder server. Bỏ log AI client trùng; thao tác áp dụng trên UI có nhãn riêng và status observed.
- Client chỉ báo observation (manual/navigation/edit/apply) hoặc cancellation đề xuất, không được ghi success nhạy cảm. Endpoint observation dùng Firebase auth riêng, không bắt xác minh phone/quota AI cho vẽ thủ công. Source test do admin/owner hoặc cấu hình server ACTIVITY_SOURCE=test; client thường không thể tự nâng/đổi source sang production/test. Vercel được nhận nguồn web; loopback localhost/127.0.0.1/::1 nhận localhost.
- `activatePaidPlan`: sự kiện kích hoạt PayOS actor hệ thống, target UID/order ID cùng transaction với payment/profile. Webhook và check lặp không tạo thêm activation/event. Số liệu kích hoạt gói là đối chiếu bản ghi thật, không giả người thao tác từ người nhận tiền/gói.
- `server/admin-plan.ts`, API grant-plan: cấp gói/profile/payment/audit cùng transaction, actor UID admin, target UID, request ID chống trùng. Localhost dùng cùng handler Vercel thay bản inline cũ. Không thử cấp gói thật.
- Dashboard: tên/email từ hồ sơ Firebase theo quyền quản trị; actor UID luôn hiện; thời gian server theo UTC+7; source/status từng dòng. Quota reset05:00 khác ngày lịch00:00, chỉ hiển thị đối chiếu có nhãn, không cộng MarkItDown hai lần hoặc dùng quota bù sự kiện thiếu. Cảnh báo dữ liệu cũ, lỗi đọc/stale, cap5000, ngày<=31; tránh phản hồi cũ ghi đè khi đổi khoảng ngày. Chưa đọc dữ liệu hiển thị dấu — thay số tổng giả0.
- Rules source: admin đọc analytics, client không ghi activity_events/api_usage_stats/raw_ai_logs, loại khỏi wildcard owner. CHƯA DEPLOY RULES; không tuyên bố cloud rules đang áp dụng bản sửa.

## Bằng chứng Firebase thật và UI
Dùng Chrome của người dùng đã đăng nhập Firebase; không dùng fixture/isolated Playwright để kết luận auth. IAB hiện không còn tab. Cổng3000 có NotebookLM listener nên Word2LaTeX chạy riêng `http://localhost:3001/`, không dừng NotebookLM. Server dev session10937 còn chạy.

- API quản trị trả dữ liệu Firebase thật; UI mặc định Website không hiện local/test.
- Nút Kiểm tra ghi nhận tạo observation test và gửi lại cùng ID: API trả duplicate, một dòng trong dashboard.
- Sự kiện đầu `c441d956a5eee92c8fde8cac889fb2746fbc91606706cf05b10b164e39616e39`: Admin SDK đọc trực tiếp exists=true, actorHasRealProfile=true, action=Kiểm thử analytics, source=test, status=observed, occurredAt=2026-10-09T07:57:24.178Z, recordedAt có server timestamp, date=2026-10-09, durationMs=null. UI hiển thị 14:57:24 9/10/26 cùng tài khoản thật. Không xuất token/credential trong báo cáo.
- Source Localhost hiển thị Xem tính năng: Phân tích, Xem tính năng: Vẽ hình và Vẽ hình: chỉnh sửa. Tạo một điểm trên bảng trắng rồi Undo để giữ nguyên bảng người dùng. Các thao tác không được cộng vào server-success count.
- Đọc Admin SDK lúc15:10: có6 events (5localhost,1test), chưa có event web mới. Thao tác sau mốc đọc có thể tăng số này; đây không phải tổng cố định.
- Bộ lọc nguồn Website/Localhost/Kiểm thử được kiểm tra thật. Mobile Chromium viewport override: innerWidth391, documentWidth391, bảng có4dòng nguồn localhost, không cuộn ngang toàn trang. Không phải điện thoại thật; table cho phép scroll ngang nội bộ.
- Ảnh cuối: scratch/final-analytics-real-test.jpg, scratch/final-analytics-detail.jpg, scratch/final-analytics-mobile.jpg.

## Khoảng lịch sử thiếu
Firestore cũ có13 daily docs, từ2026-09-25 tới2026-10-09, nhưng không có provenance đủ để khôi phục chính xác actor/action/time/source. Nhật ký chuẩn hiện bắt đầu **14:57:01 ngày09/10/2026 (giờ Việt Nam)**. Trước mốc đó, bao gồm phần đầu ngày09/10, không có chi tiết chuẩn; không dựng lại lịch sử từ quota, không nhập số cũ vào tổng mới. Giữ daily docs và JSON local để bảo toàn dữ liệu. Không tuyên bố mọi con số cũ đều thực hoặc giả.

## Checks
- `npm run lint`: exit0 sau các sửa auth/logger cuối.
- `npm run build`: exit0, Vite/esbuild; cảnh báo chunk lớn sẵn có.
- Regression không cần emulator: **53pass,0fail**. Có recorder verifiedUID/bodyspoof, anonymous401, replay409 không rerun, error400, failure terminal Firebase không giả success, source/date/duration/dedup, admin grant replay và PayOS system actor/transaction, cùng quota/drawing/Word/LaTeX/auth/payment hiện có.
- Test schema drawing dùng createDrawingHandler để kiểm tra validation/provider; production securedHandler có kiểm tra riêng anonymous401. Không bỏ validation test do recorder yêu cầu auth trước.
- Bốn Firestore integration tests cần emulator chưa cấu hình: email-verification, phone-confirmation-store, phone-history, phone-confirmation-rules; không chạy trên production và không tuyên bố pass.

## Giới hạn
Không thử thanh toán thật/cấp quyền/gói thật; transaction payment/admin kiểm chứng bằng tests mô phỏng. Không gọi lại AI provider tính phí chỉ để thử analytics; success/error recorder kiểm chứng unit, real Firebase test dùng observation. Chưa kiểm tra website endpoint production hoặc deploy code/rules. Không có trigger backfill mọi mutation Firestore ngoài ứng dụng; hành động ngoài các pipeline được instrument, login/email approval link hoặc script ghi thẳng DB chưa có event chuẩn không được suy ra người thao tác. Nguồn anonymous không gán sai UID. Nếu process bị kill/timeout trước terminal write, started giữ trạng thái chưa nhận kết quả; không coi thành công hoặc hoàn tác billing theo suy đoán.

Test web source bằng policy/unit; chưa có hành động web production mới để khẳng định runtime. Admin không được hứa hệ thống không thể bị giả event qua client trên cloud cho tới khi rules mới được deploy. Các giới hạn này hiển thị/được báo rõ, không thay dữ liệu thiếu bằng ước lượng.
## Kiểm chứng cuối sau bản mã cuối
Nút Kiểm tra ghi nhận được chạy lần thứ hai lúc15:10:58 giờ Việt Nam: tạo thêm một event test riêng, retry mỗi lần không tạo bản trùng. UI cuối có2dòng test (14:57:24 và15:10:58), lọc đúng người/trạng thái observed vẫn2dòng. Bản đọc gần nhất15:13:16 không lỗi. git diff --check exit0 sau dọn khoảng trắng ở các dòng logger đã gỡ. Build cuối session89542 exit0, typecheck session12790 exit0, regression session62467:53pass0fail. Không chạy lại sau thay đổi chỉ xóa khoảng trắng.

