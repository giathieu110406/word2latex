# Xác nhận số liên hệ qua email và điều hướng nâng cấp

## Mục tiêu đã được đồng ý

Hai nút nâng cấp mở cùng trang đăng ký gói hiện có. Tài khoản Trial/Plus giữ nút nâng cấp trên màn hình chính nhưng không còn thẻ PRO ở sidebar. Người dùng phải nhập số di động Việt Nam hợp lệ và hoàn thành OTP email trước khi dùng workspace. Sau xác nhận, số được khóa và quản trị viên xem được lịch sử trong hộp thông tin thành viên.

OTP email chứng minh quyền truy cập email và xác nhận việc khai báo số liên hệ; không chứng minh quyền sở hữu hoặc tình trạng hoạt động của số điện thoại. Giao diện và dữ liệu phải thể hiện đúng giới hạn này.

## Điều hướng nâng cấp

- Tận dụng trang `pricing` trong App.tsx, không tạo trang đăng ký mới.
- Free: hiển thị thẻ sidebar và nút trên màn hình chính; cả hai mở pricing.
- Trial/Plus: ẩn thẻ sidebar, giữ nút trên màn hình chính mở pricing.
- Pro: ẩn lời mời nâng cấp PRO. Giữ nguyên quyền quản trị và các thao tác quản trị hiện có.
- Nếu gói đã hết hạn, quyết định hiển thị theo gói đang có hiệu lực, nhất quán với logic hạn dùng của ứng dụng.

## Chính sách xác nhận và tài khoản cũ

- Tất cả tài khoản, kể cả quản trị viên, cần hồ sơ xác nhận hợp lệ để dùng workspace. Đăng nhập, đăng xuất, gửi/nhập OTP và hỗ trợ vẫn hoạt động khi bị chặn.
- Hồ sơ hợp lệ cần ngày OTP email hợp lệ, số hiện tại hợp lệ, số đã xác nhận khớp số hiện tại sau chuẩn hóa và phiên bản xác nhận mới.
- Tài khoản cũ chỉ có emailOtpVerifiedAt chưa đủ: phải hoàn thành một lần xác nhận mới để thiết lập số khóa và lịch sử đáng tin cậy. Không thay đổi gói đã thanh toán, hạn dùng hoặc trạng thái phê duyệt.
- Sau xác nhận, không có luồng tự đổi/xóa số trong cài đặt. Hiển thị số chỉ đọc và nhãn “Số liên hệ đã xác nhận qua email”. Nếu hồ sơ cũ bị trống/sai/không khớp, mở lại gate; server chỉ cho khôi phục đúng số khóa nếu đã có số khóa hợp lệ.
- Không thêm ngoại lệ tự sửa số cho admin trong đợt này. Việc đổi số hợp lệ cần một yêu cầu quản trị riêng có lịch sử, thay vì chỉnh trực tiếp từ trình duyệt.

## Kiểm tra số và dấu hiệu đáng ngờ

- Dùng một hàm chuẩn hóa dùng chung frontend/server: chấp nhận dạng nội địa 0… hoặc +84…, khoảng trắng/dấu phân cách thông thường; lưu dạng +84….
- Kiểm tra 10 chữ số nội địa và danh sách đầu số di động Việt Nam được kiểm chứng từ nguồn chính thức khi triển khai. Đây là kiểm tra cấu trúc, không phải tra cứu thuê bao.
- Chặn phần thuê bao gồm toàn một chữ số và các chuỗi tăng/giảm liên tiếp rõ ràng. Thông báo chính xác rằng số có mẫu không được chấp nhận; không khẳng định số không tồn tại. Kiểm thử tránh chặn mẫu lặp một phần hợp lệ.
- Phát hiện số đã được tài khoản khác khai báo, ghi cờ “trùng số” để admin xem. Không coi một số trùng là bằng chứng gian lận và không tự khóa tài khoản chỉ vì dấu hiệu này.
- Giữ OTP 6 chữ số, hạn 10 phút, chờ 60 giây giữa lần gửi, tối đa 5 lần nhập sai. Thêm giới hạn gửi theo UID: tối đa 5 lần/giờ và 10 lần/24 giờ, lưu phía server để gửi lại không xóa bộ đếm.
- Không thêm dịch vụ SMS, tra cứu nhà mạng trả phí, fingerprint hoặc suy đoán danh tính.

## Dữ liệu và tính nguyên tử

Trong users/{uid}, giữ phoneNumber và emailOtpVerifiedAt để tương thích; thêm confirmedPhoneNumber, phoneConfirmationMethod='email_otp', phoneConfirmationVersion=1 và phoneConfirmedAt. Bản ghi số khóa là nguồn server quản lý.

Lưu lịch sử server quản lý tại users/{uid}/phoneConfirmations/{eventId}: số chuẩn hóa, email nhận OTP từ tài khoản Firebase, thời điểm, phương thức và phiên bản. Hiển thị lịch sử cũ phoneHistory với nhãn “Lịch sử khai báo cũ”, tách khỏi các lần hoàn thành OTP có thời điểm.

Tận dụng email_verifications/{uid} cho mã băm, thời hạn, lần nhập sai và hạn mức gửi. Không lưu mã OTP rõ. Gắn mỗi challenge với UID, email nhận và số; chỉ challenge hiện hành dùng được. Gửi mã thành công mới thông báo thành công. Dùng transaction để giới hạn đồng thời và hoàn thành challenge một lần: cập nhật profile, lịch sử và tiêu thụ challenge cùng một lần commit. Không thay đổi số hoặc tạo lịch sử khi OTP sai/hết hạn.

Custom claim hiện có chỉ phục vụ tương thích; quyền dùng tính năng dựa trên profile server, không chỉ dựa vào claim cũ. Lỗi cập nhật claim sau commit không được kích hoạt lại lịch sử hoặc kéo dài hạn gói.

## Bảo vệ truy cập

- Frontend gate chặn workspace khi profile chưa đáp ứng chính sách mới; cập nhật profile từ snapshot/response server sau OTP, không tự ghi trạng thái tin cậy ở client.
- AI và MarkItDown dùng guard chung với cùng điều kiện profile. Token phải được xác thực chữ ký qua Firebase Admin hoặc dịch vụ xác thực chính thức; loại bỏ fallback chỉ giải mã JWT không kiểm tra chữ ký, vì nó làm vô hiệu hóa gate.
- Firestore rules cấm client tự ghi số khóa, phương thức/phiên bản/ngày xác nhận, lịch sử xác nhận hoặc OTP. Sau khóa, client không được sửa phoneNumber. Các trường hồ sơ thông thường vẫn sửa được.
- Lịch sử chỉ admin được đọc; người dùng đọc trạng thái của chính mình qua profile. OTP và bộ đếm server không được đọc/ghi từ client.
- Webhook payOS và kiểm tra trạng thái thanh toán tiếp tục xử lý đơn đã trả tiền ngay cả khi user đang ở gate. Không áp dụng gate OTP lên webhook hoặc làm mất quyền lợi thanh toán.

## Giao diện

Tận dụng EmailVerificationGate, cài đặt cá nhân và modal thành viên đang có; giữ phong cách hiện tại. Gate nói rõ mã được gửi vào email tài khoản, số sẽ khóa sau khi xác nhận, và đây là xác nhận thông tin liên hệ qua email. Thông báo lỗi OTP/hạn mức/số khóa cụ thể. Modal avatar thành viên hiển thị số khóa, thời điểm, phương thức, dấu hiệu trùng số và lịch sử theo thời gian mới nhất.

## Kiểm thử và triển khai

- Kiểm thử chuẩn hóa/đầu số/mẫu giả; profile cũ, thiếu/sai/khác số, hợp lệ; OTP sai/hết hạn/gửi quá mức; gửi/xác nhận đồng thời; replay không tạo lịch sử; khóa số; JWT không có chữ ký hợp lệ bị từ chối.
- Kiểm thử rules cho sửa số/trạng thái/lịch sử trái phép và sửa hồ sơ bình thường. Chạy test thanh toán hiện có để bảo đảm không ảnh hưởng kích hoạt gói.
- Build và kiểm tra trình duyệt các trạng thái Free/Trial/Plus/Pro cùng modal thành viên. Không gắn nhãn test giả lập là email thực đã nhận.
- Deploy rules và server tương thích trước khi bật gate mới ở frontend; xác nhận rules đang hoạt động và Vercel Ready. Không tuyên bố khóa Firebase đã có hiệu lực chỉ từ sửa file rules local.
- Kiểm tra email thực bằng tài khoản thử nghiệm khi được phép; nếu cần người dùng cung cấp OTP thì giữ tab và báo rõ bước chờ, không đọc hộp thư ngoài phạm vi được cấp.

## Ngoài phạm vi

Không xác minh danh tính chủ thuê bao, không xác minh số đang hoạt động, không đổi số khóa, không sửa hệ thống thanh toán hay thiết kế toàn bộ giao diện.
