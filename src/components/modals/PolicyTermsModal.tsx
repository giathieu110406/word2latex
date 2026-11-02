import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, FileText, CheckCircle2, Lock, Scale, Mail, Phone, ExternalLink } from 'lucide-react';

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
                  ? 'Chính Sách Bảo Mật & Quyền Riêng Tư'
                  : 'Điều Khoản Dịch Vụ & Sử Dụng'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Word2LaTeX · Áp dụng và cập nhật: Tháng 11/2026
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
            <span>Chính sách bảo mật</span>
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
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs sm:text-sm text-blue-900 leading-relaxed flex items-start gap-3">
                <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Cam kết bảo mật tuyệt đối:</strong> Word2LaTeX tuân thủ nghiêm ngặt các quy định pháp luật Việt Nam về an toàn thông tin mạng và bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP). Tài liệu giáo án, đề thi và hình ảnh của bạn là tài sản riêng của bạn.
                </div>
              </div>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">1</span>
                  Thu thập thông tin &amp; Dữ liệu người dùng
                </h3>
                <p>Để vận hành dịch vụ và hỗ trợ người dùng chu đáo, chúng tôi chỉ thu thập các thông tin tối thiểu cần thiết:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li><strong>Thông tin định danh tài khoản:</strong> Địa chỉ email (khi đăng nhập qua Google hoặc tạo tài khoản).</li>
                  <li><strong>Số điện thoại xác thực:</strong> Dùng để gửi mã OTP bảo mật và liên hệ khi có yêu cầu hỗ trợ gói dịch vụ.</li>
                  <li><strong>Lịch sử giao dịch:</strong> Mã đơn hàng, số tiền, trạng thái giao dịch nạp gói dịch vụ qua cổng thanh toán PayOS (chúng tôi <em>không lưu trữ</em> thông tin thẻ ngân hàng hoặc mã CVV).</li>
                  <li><strong>Thông tin kỹ thuật phiên:</strong> Mã thiết bị ẩn danh (device fingerprint), địa chỉ IP tạm thời để ngăn chặn lạm dụng bot và đảm bảo công bằng hạn mức sử dụng.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">2</span>
                  Bảo vệ tài liệu tải lên &amp; Xử lý 100% Client-Side
                </h3>
                <p>Chúng tôi thấu hiểu tài liệu giáo án, đề thi và luận văn là tài sản trí tuệ quan trọng của thầy cô và học sinh:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5">
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Biên tập PDF &amp; Vẽ hình Offline
                    </h4>
                    <p className="text-xs text-slate-600">
                      Tính năng Biên tập PDF (gộp, cắt trang, xoay, watermark, làm phẳng) và Không gian Vẽ hình chạy <strong>100% trực tiếp trên trình duyệt của bạn (Client-side)</strong>. File không bị tải lên bất kỳ máy chủ lưu trữ vĩnh viễn nào.
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5">
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 text-indigo-700">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      Xử lý AI Không Huấn Luyện (No Model Training)
                    </h4>
                    <p className="text-xs text-slate-600">
                      Khi sử dụng tính năng Soạn đề thi AI hoặc Nhận diện LaTeX, văn bản chỉ được gửi qua kết nối mã hóa SSL/TLS để trả kết quả theo phiên và bị xóa ngay sau đó. Dữ liệu của bạn <strong>tuyệt đối không bị dùng để đào tạo (train) mô hình AI</strong>.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">3</span>
                  An toàn giao dịch &amp; Cổng thanh toán PayOS
                </h3>
                <p>
                  Mọi khoản thanh toán nâng cấp gói dịch vụ đều được xử lý qua cổng thanh toán bảo mật <strong>PayOS</strong> liên kết trực tiếp với hệ thống ngân hàng Việt Nam (NAPAS / VietQR). Quá trình thanh toán diễn ra trực tiếp qua ứng dụng ngân hàng của bạn, đảm bảo không có rủi ro lộ số thẻ hoặc thông tin tài chính cá nhân.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">4</span>
                  Quyền hạn của Người Dùng đối với Dữ Liệu
                </h3>
                <p>Bạn luôn có toàn quyền kiểm soát dữ liệu cá nhân của mình:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li><strong>Quyền xem &amp; xuất dữ liệu:</strong> Bạn có thể xem lịch sử giao dịch và xuất toàn bộ đề thi, tài liệu Word/LaTeX bất cứ lúc nào.</li>
                  <li><strong>Quyền yêu cầu xóa tài khoản:</strong> Bạn có quyền gửi yêu cầu xóa vĩnh viễn tài khoản và toàn bộ thông tin liên quan khỏi cơ sở dữ liệu qua email hỗ trợ.</li>
                  <li><strong>Quyền từ chối nhận thông báo:</strong> Bạn có thể tùy chỉnh hoặc tắt các thông báo cập nhật hệ thống không bắt buộc.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">5</span>
                  Kênh liên hệ &amp; Tiếp nhận khiếu nại
                </h3>
                <p>Nếu bạn có bất kỳ câu hỏi nào về bảo mật hoặc cần hỗ trợ xử lý dữ liệu, vui lòng liên hệ:</p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <span>Email hỗ trợ: <strong>Giathieu110406@gmail.com</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-800">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>Hỗ trợ Zalo kỹ thuật: <strong>0335.784.563</strong> (Trần Gia Thiều)</span>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            /* ================= NỘI DUNG ĐIỀU KHOẢN DỊCH VỤ ================= */
            <div className="space-y-6">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs sm:text-sm text-amber-900 leading-relaxed flex items-start gap-3">
                <Scale className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Quy ước thỏa thuận:</strong> Bằng việc truy cập hoặc sử dụng các công cụ tại <strong>Word2LaTeX (https://word2latex.io.vn)</strong>, bạn xác nhận đã đọc, hiểu và đồng ý tuân thủ toàn bộ các điều khoản dịch vụ dưới đây.
                </div>
              </div>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">1</span>
                  Mục đích sử dụng &amp; Quyền hạn dịch vụ
                </h3>
                <p>
                  Word2LaTeX cung cấp bộ công cụ chuyên dụng hỗ trợ giáo viên, giảng viên, học sinh và nhà nghiên cứu soạn thảo đề thi, chuyển đổi công thức Toán - Lý - Hóa sang LaTeX/Word, vẽ hình học phẳng/không gian và biên tập tệp PDF.
                </p>
                <p>Người dùng cam kết sử dụng dịch vụ cho mục đích hợp pháp, không sử dụng hệ thống để:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li>Tải lên, phát tán mã độc, virus hoặc can thiệp trái phép vào hạ tầng máy chủ.</li>
                  <li>Khai thác tự động (spam requests, scraping) làm tắc nghẽn hoặc ảnh hưởng tới người dùng khác.</li>
                  <li>Tải lên nội dung vi phạm thuần phong mỹ tục, pháp luật Việt Nam hoặc xâm phạm quyền của bên thứ ba.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">2</span>
                  Quyền sở hữu trí tuệ &amp; Bản quyền tài liệu
                </h3>
                <p>
                  <strong>Toàn bộ tài liệu, giáo án, đề thi và sản phẩm bạn tạo ra</strong> (file Word, mã nguồn LaTeX, file PDF) hoàn toàn thuộc quyền sở hữu độc quyền của bạn. Word2LaTeX không giữ bất kỳ quyền sở hữu nào đối với nội dung bạn biên soạn.
                </p>
                <p>
                  Giao diện, mã nguồn, thuật toán chuyển đổi và thương hiệu <em>Word2LaTeX</em> thuộc sở hữu trí tuệ của tác giả phát triển dự án. Nghiêm cấm mọi hành vi sao chép trái phép giao diện hoặc thương mại hóa dịch vụ mà không có sự đồng ý bằng văn bản.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">3</span>
                  Gói dịch vụ, Hạn mức &amp; Chính sách hoàn tiền (Refund Policy)
                </h3>
                <p>Hệ thống cung cấp cả gói Miễn phí và các gói Nâng cấp (Plus, Pro) với các hạn mức số lượt soạn đề và xử lý tài liệu khác nhau:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li><strong>Kích hoạt dịch vụ:</strong> Sau khi thanh toán thành công qua PayOS, tài khoản sẽ được tự động kích hoạt hoặc cộng hạn mức trong vòng 30 giây đến 2 phút.</li>
                  <li><strong>Chính sách hoàn tiền:</strong> Trong trường hợp giao dịch ngân hàng đã trừ tiền nhưng hệ thống gặp sự cố kỹ thuật không thể kích hoạt gói dịch vụ sau 24 giờ và bộ phận hỗ trợ không thể xử lý, người dùng sẽ được hoàn trả 100% số tiền đã thanh toán.</li>
                  <li><strong>Không hoàn tiền với lỗi do người dùng:</strong> Không áp dụng hoàn tiền đối với trường hợp người dùng đã sử dụng phần lớn hạn mức gói hoặc đổi ý sau khi đã kích hoạt thành công.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">4</span>
                  Giới hạn trách nhiệm
                </h3>
                <p>
                  Mặc dù chúng tôi luôn nỗ lực tối đa để kết quả chuyển đổi công thức và soạn thảo đạt độ chính xác cao nhất (lên tới 99.8%), người dùng có trách nhiệm rà soát lại nội dung đề thi trước khi in ấn hoặc phân phát cho học sinh. Chúng tôi không chịu trách nhiệm đối với các sai sót phát sinh ngoài ý muốn do người dùng không kiểm tra lại tài liệu trước khi sử dụng thực tế.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">5</span>
                  Hiệu lực &amp; Thay đổi điều khoản
                </h3>
                <p>
                  Các điều khoản này có hiệu lực kể từ thời điểm đăng tải. Chúng tôi có quyền cập nhật, điều chỉnh các điều khoản để phù hợp với sự phát triển của công nghệ và quy định pháp luật. Mọi thay đổi quan trọng sẽ được thông báo trực tiếp trên giao diện ứng dụng.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Cần hỗ trợ? Zalo: <span className="font-semibold text-slate-800">0335.784.563</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
          >
            Đã hiểu &amp; Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
};
