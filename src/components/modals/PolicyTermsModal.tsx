import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, FileText, CheckCircle2, Lock, Scale, Mail, Phone, ExternalLink, AlertCircle, ShieldAlert } from 'lucide-react';

export interface PolicyTermsModalProps {
  isOpen: boolean;
  initialTab?: 'privacy' | 'terms';
  onClose: () => void;
}

export const PolicyTermsModal: React.FC<PolicyTermsModalProps> = ({
  isOpen,
  initialTab = 'privacy',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Đóng bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              {activeTab === 'privacy' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <Scale className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {activeTab === 'privacy'
                  ? 'Chính Sách Bảo Mật & Quyền Riêng Tư (PDPD)'
                  : 'Điều Khoản Dịch Vụ & Sử Dụng'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Word2LaTeX · Tuân thủ Nghị định 13/2023/NĐ-CP &amp; Luật An ninh mạng · Cập nhật 2026
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="Đóng hộp thoại (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switching Bar */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 flex items-center gap-2 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Chính sách bảo mật (Nghị định 13)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Điều khoản dịch vụ</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-600 leading-relaxed space-y-6">
          {activeTab === 'privacy' ? (
            /* ================= NỘI DUNG CHÍNH SÁCH BẢO MẬT ================= */
            <div className="space-y-6">
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 text-xs sm:text-sm text-blue-900 leading-relaxed flex items-start gap-3">
                <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Cam kết bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP:</strong> Word2LaTeX hoạt động với tư cách là Bên Kiểm Soát kiêm Bên Xử Lý Dữ Liệu Cá Nhân. Chúng tôi cam kết bảo vệ toàn vẹn, bảo mật tuyệt đối thông tin định danh và tài sản trí tuệ của người dùng theo đúng quy chuẩn pháp luật Việt Nam.
                </div>
              </div>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">1</span>
                  Các loại dữ liệu cá nhân thu thập &amp; Nguyên tắc tối thiểu
                </h3>
                <p>
                  Tuân thủ nguyên tắc giới hạn mục đích và thu thập tối thiểu (Điều 3 Nghị định 13/2023/NĐ-CP), hệ thống <strong>chỉ thu thập Dữ liệu cá nhân cơ bản</strong> cần thiết để vận hành và định danh tài khoản:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li><strong>Thông tin tài khoản:</strong> Họ tên hiển thị, địa chỉ email cung cấp khi đăng nhập bằng Google hoặc tài khoản.</li>
                  <li><strong>Số điện thoại liên hệ:</strong> Dùng để xác thực liên kết tài khoản, liên lạc hỗ trợ khi phát sinh vấn đề kỹ thuật hoặc tra cứu giao dịch nâng cấp gói.</li>
                  <li><strong>Lịch sử giao dịch thanh toán:</strong> Mã đơn hàng, số tiền, ngày giờ giao dịch, trạng thái nạp qua cổng PayOS/VietQR. Chúng tôi <em>tuyệt đối không thu thập hoặc lưu trữ</em> số tài khoản ngân hàng, mã PIN hoặc thông tin thẻ quốc tế của bạn.</li>
                  <li><strong>Dữ liệu kỹ thuật tạm thời:</strong> Địa chỉ IP, chuỗi User-Agent trình duyệt và mã thiết bị ẩn danh (device fingerprint) phục vụ bảo vệ hệ thống, chống spam bot và đảm bảo công bằng hạn mức tài khoản.</li>
                </ul>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Hệ thống <strong>không thu thập</strong> bất kỳ Dữ liệu cá nhân nhạy cảm nào (dữ liệu sinh trắc học, tài chính chuyên sâu, vị trí địa lý thời gian thực, quan điểm chính trị, tôn giáo...).</span>
                </div>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">2</span>
                  Mục đích &amp; Căn cứ pháp lý xử lý dữ liệu
                </h3>
                <p>Dữ liệu cá nhân chỉ được xử lý cho các mục đích hợp pháp sau:</p>
                <ol className="list-decimal pl-5 space-y-1 text-slate-700">
                  <li><strong>Cung cấp và duy trì dịch vụ:</strong> Định danh phiên làm việc, lưu trữ lịch sử chuyển đổi và số dư hạn mức của tài khoản.</li>
                  <li><strong>Bảo đảm an toàn thông tin &amp; Chống gian lận:</strong> Phát hiện và ngăn chặn các hành vi tạo tài khoản hàng loạt, tấn công từ chối dịch vụ (DDoS) hoặc lạm dụng tài nguyên máy chủ theo Luật An ninh mạng 2018.</li>
                  <li><strong>Chăm sóc khách hàng &amp; Đối soát:</strong> Hỗ trợ giải quyết thắc mắc, hoàn tiền và đối soát giao dịch nạp gói khi người dùng yêu cầu.</li>
                  <li><strong>Tuân thủ nghĩa vụ pháp lý:</strong> Lưu trữ hồ sơ giao dịch điện tử theo quy định của Luật Giao dịch điện tử và pháp luật kế toán - thuế Việt Nam.</li>
                </ol>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">3</span>
                  Bảo vệ tài liệu tải lên &amp; Cam kết không đào tạo mô hình AI
                </h3>
                <p>Chúng tôi thấu hiểu tài liệu giáo án, đề thi và luận văn là tài sản trí tuệ quan trọng của thầy cô và học sinh:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5">
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Biên tập PDF &amp; Vẽ hình 100% Client-Side
                    </h4>
                    <p className="text-xs text-slate-600">
                      Công cụ Biên tập PDF (gộp, cắt, xoay, thêm trang, watermark, làm phẳng) và Không gian Vẽ hình chạy <strong>100% trực tiếp trong bộ nhớ trình duyệt của bạn</strong>. File gốc của bạn không bị tải lên bất kỳ máy chủ nào.
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5">
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 text-indigo-700">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      Không dùng dữ liệu để Train mô hình AI
                    </h4>
                    <p className="text-xs text-slate-600">
                      Khi sử dụng tính năng AI (Soạn đề thi, Nhận diện LaTeX), nội dung chỉ truyền qua kênh mã hóa SSL/TLS 256-bit để tạo kết quả theo phiên và tự động hủy ngay sau đó. Dữ liệu của bạn <strong>tuyệt đối không bị lưu giữ để đào tạo (train/fine-tune) bất kỳ mô hình AI nào</strong>.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">4</span>
                  Quyền của Chủ thể dữ liệu theo Điều 9 Nghị định 13/2023/NĐ-CP
                </h3>
                <p>Người dùng được bảo đảm toàn bộ 11 quyền cơ bản đối với dữ liệu cá nhân của mình:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg"><strong>1. Quyền được biết:</strong> Được thông báo đầy đủ về hoạt động xử lý dữ liệu qua chính sách này.</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg"><strong>2. Quyền đồng ý:</strong> Được quyền đồng ý hoặc từ chối cung cấp dữ liệu khi đăng ký.</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg"><strong>3. Quyền truy cập &amp; chỉnh sửa:</strong> Được xem và chỉnh sửa thông tin số điện thoại trong mục Cài đặt.</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg"><strong>4. Quyền rút lại sự đồng ý:</strong> Có thể rút lại sự đồng ý bất cứ lúc nào qua văn bản yêu cầu.</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg"><strong>5. Quyền xóa dữ liệu:</strong> Yêu cầu xóa vĩnh viễn tài khoản và dữ liệu liên quan khỏi cơ sở dữ liệu.</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg"><strong>6. Quyền hạn chế xử lý:</strong> Yêu cầu tạm ngưng xử lý dữ liệu trong các trường hợp tranh chấp.</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg"><strong>7. Quyền cung cấp dữ liệu:</strong> Được yêu cầu trích xuất dữ liệu tài khoản và lịch sử giao dịch.</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg"><strong>8. Quyền phản đối xử lý:</strong> Ngăn chặn việc xử lý dữ liệu nhằm mục đích quảng cáo hoặc tiếp thị.</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg"><strong>9. Quyền khiếu nại, khởi kiện:</strong> Được quyền khiếu nại tới cơ quan quản lý nếu phát hiện vi phạm.</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg"><strong>10. Quyền yêu cầu bồi thường:</strong> Yêu cầu bồi thường thiệt hại theo luật định nếu xảy ra rò rỉ trái phép.</div>
                </div>
                <p className="text-xs text-slate-500 italic mt-1">
                  * Để thực hiện bất kỳ quyền nào ở trên, bạn chỉ cần gửi email tới <strong>Giathieu110406@gmail.com</strong>. Chúng tôi sẽ phản hồi và xử lý trong vòng 72 giờ làm việc.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">5</span>
                  Thời hạn lưu trữ &amp; Biện pháp tiêu hủy dữ liệu
                </h3>
                <p>
                  Dữ liệu cá nhân chỉ được lưu trữ trong thời gian tài khoản người dùng còn hoạt động trên hệ thống. Khi người dùng thực hiện quyền yêu cầu xóa tài khoản hoặc khi tài khoản ngừng hoạt động quá 24 tháng liên tục:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li>Toàn bộ thông tin định danh (Email, Số điện thoại) sẽ được xóa vĩnh viễn khỏi máy chủ cơ sở dữ liệu.</li>
                  <li>Dữ liệu nhật ký kỹ thuật tạm thời (Logs) được tự động ghi đè hoặc tiêu hủy định kỳ.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">6</span>
                  Kênh tiếp nhận &amp; Xử lý khiếu nại bảo vệ dữ liệu
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <span>Email tiếp nhận: <strong>Giathieu110406@gmail.com</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-800">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>Đại diện phụ trách dữ liệu (DPO): <strong>Trần Gia Thiều - 0335.784.563</strong></span>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            /* ================= NỘI DUNG ĐIỀU KHOẢN DỊCH VỤ ================= */
            <div className="space-y-6">
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-xs sm:text-sm text-amber-900 leading-relaxed flex items-start gap-3">
                <Scale className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Quy ước thỏa thuận sử dụng dịch vụ:</strong> Bằng việc truy cập hoặc sử dụng các công cụ tại <strong>Word2LaTeX (https://word2latex.io.vn)</strong>, bạn xác nhận đã đọc, hiểu và đồng ý chịu sự ràng buộc bởi các điều khoản dịch vụ này.
                </div>
              </div>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">1</span>
                  Mục đích dịch vụ &amp; Điều kiện tài khoản
                </h3>
                <p>
                  Word2LaTeX là nền tảng công nghệ hỗ trợ chuyển đổi tài liệu Word/PDF sang LaTeX, hỗ trợ biên tập PDF, vẽ hình học và soạn thảo công thức khoa học cho giáo viên, học sinh và cộng đồng học thuật.
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li>Người dùng phải cung cấp số điện thoại liên hệ thực tế và địa chỉ email chính chủ để xác thực quyền truy cập dịch vụ.</li>
                  <li>Người dùng có trách nhiệm tự bảo mật thông tin tài khoản đăng nhập Google, không chia sẻ quyền sử dụng tài khoản cho nhiều người cùng lúc hoặc cho thuê lại tài khoản thương mại.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">2</span>
                  Quyền sở hữu trí tuệ đối với tài liệu do người dùng tạo ra
                </h3>
                <p>
                  <strong>Bạn là chủ sở hữu duy nhất và toàn quyền</strong> đối với toàn bộ đề thi, giáo án, công thức, mã LaTeX, file PDF hoặc hình vẽ do bạn nhập vào hoặc xuất ra từ hệ thống. Word2LaTeX không có bất kỳ quyền sở hữu hoặc quyền sử dụng thương mại nào đối với sản phẩm của bạn.
                </p>
                <p>
                  Toàn bộ mã nguồn, giao diện, logo, thuật toán phân tích cú pháp và thương hiệu <em>Word2LaTeX</em> thuộc quyền sở hữu trí tuệ của tác giả phát triển dự án. Nghiêm cấm mọi hành vi sao chép trái phép, dịch ngược mã nguồn (reverse engineering) hoặc sao chép giao diện nhằm mục đích cạnh tranh không lành mạnh.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">3</span>
                  Các hành vi bị nghiêm cấm theo Luật An ninh mạng
                </h3>
                <p>Khi sử dụng Word2LaTeX, người dùng cam kết <strong>tuyệt đối không thực hiện</strong> các hành vi sau:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li>Tải lên các tài liệu có nội dung chống phá Nhà nước, vi phạm thuần phong mỹ tục hoặc xâm phạm an ninh quốc gia theo Luật An ninh mạng 2018.</li>
                  <li>Tải lên tài liệu chứa mã độc, virus, phần mềm gián điệp nhằm phá hoại hạ tầng máy chủ hoặc xâm nhập trái phép thiết bị người dùng khác.</li>
                  <li>Sử dụng các công cụ tự động (bot, script, scraper) để spam yêu cầu API, gây quá tải hoặc làm nghẽn hệ thống.</li>
                  <li>Tải lên tài liệu vi phạm bản quyền sở hữu trí tuệ của các tổ chức, tác giả hoặc nhà xuất bản khác mà không có quyền sử dụng hợp pháp.</li>
                </ul>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Tài khoản cố tình vi phạm sẽ bị khóa vĩnh viễn ngay lập tức mà không cần báo trước và không được hoàn lại bất kỳ chi phí gói dịch vụ nào.</span>
                </div>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">4</span>
                  Gói dịch vụ, Hạn mức &amp; Chính sách hoàn tiền (Refund Policy)
                </h3>
                <p>Hệ thống cung cấp cả gói Miễn phí và các gói Nâng cấp với hạn mức số lượt soạn đề và xử lý tài liệu mở rộng:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li><strong>Kích hoạt dịch vụ:</strong> Sau khi thanh toán thành công qua cổng PayOS/VietQR, tài khoản sẽ được cộng hạn mức tự động trong vòng 30 giây đến 2 phút.</li>
                  <li><strong>Chính sách hoàn tiền (Refund):</strong> Người dùng được hoàn lại 100% tiền thanh toán nếu hệ thống gặp sự cố kỹ thuật không thể kích hoạt gói sau 24 giờ kể từ khi thanh toán và bộ phận hỗ trợ kỹ thuật không thể khắc phục.</li>
                  <li><strong>Trường hợp không áp dụng hoàn tiền:</strong> Không giải quyết hoàn tiền khi người dùng đã sử dụng quá 20% hạn mức của gói hoặc đổi ý cá nhân sau khi gói đã được kích hoạt thành công.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">5</span>
                  Giới hạn trách nhiệm pháp lý (Disclaimer)
                </h3>
                <p>
                  Mặc dù chúng tôi liên tục tối ưu hóa thuật toán để đạt độ chính xác chuyển đổi công thức và trích xuất tài liệu cao nhất (lên tới 99.8%), người dùng có trách nhiệm kiểm tra, rà soát lại nội dung đề thi và công thức trước khi in ấn hoặc sử dụng trong giảng dạy, thi cử thực tế. Word2LaTeX không chịu trách nhiệm đối với bất kỳ thiệt hại gián tiếp nào phát sinh từ việc người dùng không rà soát lại tài liệu trước khi phân phát.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">6</span>
                  Luật điều chỉnh &amp; Giải quyết tranh chấp
                </h3>
                <p>
                  Các điều khoản này được điều chỉnh và giải thích theo quy định của pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam. Mọi tranh chấp phát sinh sẽ được ưu tiên giải quyết thông qua thương lượng, hòa giải thiện chí. Trường hợp không đạt được thỏa thuận, tranh chấp sẽ được đưa ra giải quyết tại Tòa án nhân dân có thẩm quyền tại Việt Nam.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Hỗ trợ pháp lý &amp; kỹ thuật Zalo: <span className="font-semibold text-slate-800">0335.784.563</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
          >
            Đã hiểu &amp; Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
};
