# Checkpoint analytics — 2026-10-09 (giờ Việt Nam)

## Điều kiện dừng / quyền
Người dùng cho phép tiếp tục sửa sau yêu cầu dừng trước, nhưng yêu cầu NGỪNG khi hạn mức Codex còn <=2% (usedPercent >=98). Lần đọc gần nhất: 5 giờ 97% dùng (còn 3%); tuần 60%. Kiểm tra get_usage_limits trước mọi bước dài. Không dùng reset/credit. Không push/deploy/reset/rollback. Bảo toàn dirty tree hiện có, nguồn drawing, tài liệu người dùng.

## Mục tiêu đã chốt
Review và sửa Phân tích + Chi tiết hoạt động; Firebase là nguồn chuẩn cho web/localhost/test, UID xác thực, thời gian server hiển thị Việt Nam, actor hệ thống cho webhook, chống trùng/retry, chỉ success khi server thành công. Mặc định tổng Website; có bộ lọc localhost/test/tất cả. Client báo cáo phải được phân biệt với bằng chứng server. Không dựng lịch sử thiếu. Đối chiếu quota/payments không bù số liệu bằng suy đoán. Test thật trong tab IAB người dùng đã đăng nhập (không dùng isolated Playwright để kết luận auth). Chỉ hoạt động test có nhãn, không thanh toán/cấp quyền thật.

## Findings đã truy nguyên
- src/utils/logger.ts cũ ghi đồng thời Firebase client và API, gây đếm trùng cho admin; người thường client bị rules chặn.
- /api/ai?action=log-usage cũ không auth, tăng số liệu vô danh, fallback file local và luôn success ngay cả Firebase lỗi.
- raw_ai_logs cũ dùng body.userId do client tự nhận.
- Dashboard cũ lấy api_usage_stats, reconcile với users rồi ghi ngược lên Firestore; reconciliation suy thời lượng 1/2/3 phút, có MarkItDown overlap promptCount; không có từng sự kiện actor/action/time.
- Quota reset 05:00 VN; event ngày lịch 00:00, không thể đối chiếu cộng ngang.
- Firebase Admin cũ mặc định database, client có named database env.
- Rules cũ owner wildcard cho phép bypass ghi các collection analytics.

## Đã sửa (CHƯA hoàn tất toàn nhiệm vụ)
Mới: shared/activity.ts (types, VN date/hour, nguồn, aggregate chỉ success, dedup id); server/activity.ts (transaction activity_events, timestamp server, hashed actor/request/action id, trạng thái started -> terminal, withActivity wrapper, nguồn test chỉ admin/owner hoặc server ACTIVITY_SOURCE=test).
Mới: api/activity.ts POST observations allowlist xác thực, không ghi success client; GET admin chuẩn Firebase, tối đa 31 ngày/5000 sự kiện báo truncated, profile display tên/email theo quyền, metadata lịch sử thiếu, usage/payments đối chiếu.
Đổi: index.ts mount /api/activity; server/admin-request.ts hỗ trợ admins doc tương ứng rules; server/firebase-admin.ts named database sanitization tương ứng client.
Đổi: api/ai.ts bỏ toàn bộ local logger/stats fallback, legacy actions trả410; raw logs dùng UID verifiedActivityAuth; default export withActivity map known actions. api/markitdown.ts + api/ve-hinh.ts default wrapper (drawing createDrawingHandler injection/tests không đổi).
Đổi: src/utils/api-client.ts phát X-Activity-Id UUID POST và giữ cùng ID khi retry401; src/utils/logger.ts chỉ authenticated client observations, không ghi Firestore/cộng request/thời lượng; startFeatureTracking chỉ observation (hiện action Xem tính năng chưa ghi feature, cần sửa cho rõ).
Đổi: src/components/AdminAnalyticsDashboard.tsx thay dashboard suy đoán bằng query /api/activity, poll30s honest label, nguồn mặc địnhweb, lọc người/ngày/trạng thái, tổng success/error/observations/pending, bảng actorUID/action/server-time/source/status, thiếu lịch sử rõ, quota/payments riêng không backfill, exportJSON.
Đổi: firestore.rules chỉ admin đọc activity_events/raw_ai_logs/api_usage_stats; client writes false và loại khỏi owner wildcard. RULES CHƯA DEPLOY, không tuyên bố cloud rules đã khóa.
Tests mới: tests/activity.test.ts.

## Kiểm tra đã chạy
RED: node --import tsx --test tests/activity.test.ts trước implementation: ERR_MODULE_NOT_FOUND shared/activity (expected new feature absent).
GREEN: node --import tsx --test tests/activity.test.ts tests/drawing-quota.test.ts server/payos-subscription.test.ts => 7 pass0fail. Timezone VN, môi trường, dedup/actor, no fabricated duration, existing quota/refund/expiry/payment regression.
npm run lint => exit0 (session97054 polled finished).
Chưa build sau analytics. Chưa browser analytics. Chưa kiểm tra server endpoint mới runtime. Chưa test wrapper auth/no-store/failed write/dedup execution bằng injection. Chưa toàn bộ regressions.

## Firebase thật/test
Không chủ động tạo hoạt động test analytics, chưa đọc/query activity_events trong browser hoặc Admin SDK. Không thao tác payment/quyền/gói thật. Code server dev tsx watch có thể reload; nếu user dùng AI/nav sau reload thì wrapper/logger mới có thể ghi started/terminal/observed (chưa kiểm chứng). AI drawing real0->1 và screenshot thuộc ĐỢT TRƯỚC, không là bằng chứng analytics mới.

## Việc còn lại / hạn chế cần sửa và xác minh
1. Kiểm tra usage; nếu >=98 dừng, chỉ cập nhật checkpoint/final. Nếu user cho phép resume với budget còn đủ tiếp tục.
2. Hoàn tất hệ thống/payment event trong activatePaidPlan transaction: actor hệ thống, targetUID/orderId, source từ req, deterministic id. Hiện payment pipeline CHƯA ghi activity_events; GET chỉ đối chiếu bản ghi payosPayments. Không thực hiện payment thật.
3. Admin grant-plan local inline index.ts khác Vercel api/admin/grant-plan.ts; cần ghi actor admin thành công có targetUID sau actual transaction, không tin client. Không tự thử cấp quyền thật.
4. Rà coverage client logs: MarkItDown cũ có log chung ngay cả partial errors nhưng giờ status observed, không success. Cần loại logs AI dư hoặc đổi action rõ, không trộn với server success. Xem tính năng cần tên cụ thể; drawing manual edit/apply/cancel có allowlist nhưng CHƯA bridge/instrument.
5. Event wrapper: started record failclosed503; terminal failed Firebase retains started and header X-Activity-Recorded=false; không retry business. req abort chưa xử lý: không tự coi success/cancel client, pending phải hiển thị chưa rõ. Id reuse terminal returns409, started duplicate409. Cần meaningful tests wrapper (verifiedUID,bodyspoof,statuserror,retry duplicate,endwritefail).
6. API query cap5000 hiện đọc theo date ASC, flagged incomplete; tests invalid date (Date.parse NaN chưa strict), payment activatedAt invalid có thể throw nên guard Number.isFinite, tránh một record hỏng làm toàn query503. Đối chiếu usage không phân nguồn nên UI có nhãn.
7. Shared aggregate collision action với reserved metrics có thể xảy ra chỉ allowlisted/server names an toàn; client writes cloudrules chưadeploy. Durations null cho system events nên không tự đo thời gian event không cóstart. writeActivity hiện end duration nếu start missing cóNaN (mọi caller hiện truyềnstart); sửa nếu cần system.
8. Old src/utils/reconciliation.ts/.test.ts còn tồn tại, dashboard KHÔNG import/call; không tự xóa tests vìdirty provenance. Không còn UI auto writes.
9. Chạy npm run lint/build và tests phù hợp, Firestore rules emulator nếu có (4 integration tests yêu cầu emulator không được chạy production).
10. IAB thực tế: qua mcp__cua_repl cua.getTab({url:'http://localhost:3000/'},{browser:'iab'}) entrypoint. Tab củauser đã đăng nhập, giữ nguyên. Reload code vì Vite HMR disabled; điều hướng Menu -> Phân tích. Browser evaluate import authFetch rồi POST /api/activity với X-Activity-Source:test, action:'Kiểm thử analytics', eventId UUID, xác minh duplicate giữ1 và APIGET row identity/serverdate/source/test. Không expose token/email/credentials tool outputs; print boolean/id/status counts only. Read actual Firestore matching id via AdminSDK hoặc adminquery, screenshot onlynecessary. Test server failure without provider có thể gọi /api/ai?action=fix-logic body invalid ->400 eventerror/test, không trừquota; xác minh đây không providerpaidrequest trướccall. Test defaultweb excludes local/test, testsourcefilter shows preciseactor/time.
11. Browser desktop/mobile bounds and fresh pageerrors; khôngphysicaldevice claims. Final report findings/fixes/runtimeFirebaseproof/limits; không hoàn tất nếu bất kỳrequiredwork còn.

## Lệnh tiếp tục
npm run dev (tsx watch index.ts), server trước đang session61396 localhost3000; probeHTTP trước mở thêm.
npm run lint
npm run build
node --import tsx --test tests/activity.test.ts tests/drawing-quota.test.ts server/payos-subscription.test.ts
rg --files -g '*test.ts' (exclude 4 Firestore emulator integration khi khôngconfig emulator; không bỏlặng mà báo)
git diff --check
Node/npm phải require_escalated prefix node/npm vì sandboxWindows userInfo ENOMEM, đãđượcchấpnhận. Chỉ filesystemworkspace allowed; chưa ghi memories. Không gửiparentchat nếu chưaexplicit humanpermission, final auto visibleparent.
## Đã dừng theo hạn mức
Lần kiểm tra sau khi lưu checkpoint: cửa sổ 5 giờ usedPercent=99 (còn 1%); tuần61%. Đã NGỪNG công việc theo mốc <=2% người dùng yêu cầu. Không bắt đầu kiểm thử/build/browser/Firebase tiếp theo. Thay đổi chưa commit được giữ nguyên. Không dùng reset/credit.


## Tiếp tục và hoàn tất phần mã/kiểm tra local
09/10/2026: đã resume sau hạn mức hồi phục. Payment/admin transaction events, wrapper tests, logger dedup, manual observations và dashboard đã hoàn tất; xem docs/verification-2026-10-09-analytics.md. 53tests pass, typecheck/build pass; Firebase thật và Chrome người dùng đã xác minh. Cổng3001, server session10937. Chưa push/deploy/rules deploy; các giới hạn nêu ở báo cáo. Các mục pending cũ bên trên là lịch sử checkpoint, không còn đại diện tiến trình hiện tại.

