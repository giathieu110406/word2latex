import React, { useState, useMemo } from 'react';
import {
  Inbox,
  MessageSquare,
  Bell,
  Search,
  Plus,
  Send,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bug,
  Sparkles,
  MessageCircle,
  User,
  Mail,
  Calendar,
  PauseCircle,
  PlayCircle,
  Vote,
  X,
  Loader2,
  Image as ImageIcon,
  Star,
  ExternalLink,
  Users,
  Check,
  Megaphone,
  Radio,
  FileText,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export interface AdminCommunicationsHubProps {
  feedbacks: any[];
  notifications: any[];
  users: any[];
  currentUser: any;
  currentUserDoc?: any;
  triggerToast?: (msg: string, success?: boolean) => void;
  onPreviewImage?: (url: string) => void;
  onSelectFeedbackForFixNotice?: (fb: any) => void;
}

type FeedFilterType = 'all' | 'feedbacks' | 'notifications';
type FeedbackSubFilter = 'all' | 'unreplied' | 'bug' | 'request' | 'suggestion';
type NotificationSubFilter = 'all' | 'system' | 'custom' | 'poll';

export const AdminCommunicationsHub: React.FC<AdminCommunicationsHubProps> = ({
  feedbacks = [],
  notifications = [],
  users = [],
  currentUser,
  currentUserDoc,
  triggerToast = () => {},
  onPreviewImage,
}) => {
  // Navigation & Filter State
  const [activeTab, setActiveTab] = useState<FeedFilterType>('all');
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackSubFilter>('all');
  const [notifFilter, setNotifFilter] = useState<NotificationSubFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selection & Composer State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'feedback' | 'notification' | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingNotifId, setEditingNotifId] = useState<string | null>(null);

  // Feedback Reply State
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [deletingNotifId, setDeletingNotifId] = useState<string | null>(null);

  // Notification Composer Form State
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeTarget, setNoticeTarget] = useState<'all' | 'custom'>('all');
  const [noticeSelectedUids, setNoticeSelectedUids] = useState<string[]>([]);
  const [noticeUserSearch, setNoticeUserSearch] = useState('');
  const [noticeHasPoll, setNoticeHasPoll] = useState(false);
  const [noticePollQuestion, setNoticePollQuestion] = useState('');
  const [noticePollOptions, setNoticePollOptions] = useState<string[]>([
    'Đồng ý / Hài lòng',
    'Không đồng ý / Cần cải thiện',
  ]);
  const [noticeAllowComment, setNoticeAllowComment] = useState(true);
  const [noticeRequireResponse, setNoticeRequireResponse] = useState(true);
  const [noticeIsPollClosed, setNoticeIsPollClosed] = useState(false);
  const [isSubmittingNotice, setIsSubmittingNotice] = useState(false);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const unrepliedCount = feedbacks.filter((f) => !f.replyText).length;
    const bugCount = feedbacks.filter((f) => f.type === 'bug').length;
    const requestCount = feedbacks.filter((f) => f.type === 'request').length;
    const suggestionCount = feedbacks.filter((f) => f.type === 'suggestion' || !f.type).length;
    const activePollsCount = notifications.filter((n) => n.hasPoll && !n.isPollClosed && !n.pollClosed).length;

    return {
      totalFeedbacks: feedbacks.length,
      unrepliedCount,
      bugCount,
      requestCount,
      suggestionCount,
      totalNotifs: notifications.length,
      activePollsCount,
    };
  }, [feedbacks, notifications]);

  // Danh sách hợp nhất và lọc
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // 1. Lọc Feedbacks
    let fbList = feedbacks.map((fb) => ({
      ...fb,
      __kind: 'feedback' as const,
      __timestamp: fb.createdAt ? new Date(fb.createdAt).getTime() : 0,
    }));

    if (feedbackFilter === 'unreplied') {
      fbList = fbList.filter((fb) => !fb.replyText);
    } else if (feedbackFilter !== 'all') {
      fbList = fbList.filter((fb) => fb.type === feedbackFilter);
    }

    if (q) {
      fbList = fbList.filter(
        (fb) =>
          (fb.displayName || '').toLowerCase().includes(q) ||
          (fb.email || '').toLowerCase().includes(q) ||
          (fb.feedbackText || '').toLowerCase().includes(q)
      );
    }

    // 2. Lọc Notifications
    let notifList = notifications.map((n) => ({
      ...n,
      __kind: 'notification' as const,
      __timestamp: n.createdAt ? new Date(n.createdAt).getTime() : 0,
    }));

    if (notifFilter === 'system') {
      notifList = notifList.filter((n) => n.targetUid === 'all' || n.type === 'system');
    } else if (notifFilter === 'custom') {
      notifList = notifList.filter((n) => n.targetUid !== 'all' && n.type !== 'system');
    } else if (notifFilter === 'poll') {
      notifList = notifList.filter((n) => n.hasPoll);
    }

    if (q) {
      notifList = notifList.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(q) ||
          (n.content || '').toLowerCase().includes(q) ||
          (n.targetEmail || '').toLowerCase().includes(q)
      );
    }

    // 3. Kết hợp theo tab
    if (activeTab === 'feedbacks') return fbList.sort((a, b) => b.__timestamp - a.__timestamp);
    if (activeTab === 'notifications') return notifList.sort((a, b) => b.__timestamp - a.__timestamp);

    const merged = [...fbList, ...notifList];
    return merged.sort((a, b) => b.__timestamp - a.__timestamp);
  }, [feedbacks, notifications, activeTab, feedbackFilter, notifFilter, searchQuery]);

  // Selected item reference
  const selectedItem = useMemo(() => {
    if (!selectedId || !selectedType) return null;
    if (selectedType === 'feedback') {
      return feedbacks.find((f) => f.id === selectedId) || null;
    }
    return notifications.find((n) => n.id === selectedId) || null;
  }, [selectedId, selectedType, feedbacks, notifications]);

  // Kiểm tra xem trên mobile có đang xem màn hình chi tiết hoặc soạn thảo hay không
  const isViewingDetailOnMobile = isComposerOpen || (!!selectedId && !!selectedItem);

  // Mở soạn thông báo mới
  const handleOpenNewComposer = (prefillTitle = '', prefillContent = '') => {
    setEditingNotifId(null);
    setNoticeTitle(prefillTitle);
    setNoticeContent(prefillContent);
    setNoticeTarget('all');
    setNoticeSelectedUids([]);
    setNoticeHasPoll(false);
    setNoticePollQuestion('');
    setNoticePollOptions(['Đồng ý / Hài lòng', 'Không đồng ý / Cần cải thiện']);
    setNoticeAllowComment(true);
    setNoticeRequireResponse(true);
    setNoticeIsPollClosed(false);
    setIsComposerOpen(true);
  };

  // Mở chỉnh sửa thông báo có sẵn
  const handleEditNotification = (notif: any) => {
    setEditingNotifId(notif.id);
    setNoticeTitle(notif.title || '');
    setNoticeContent(notif.content || '');
    const isCustom = notif.targetUid !== 'all' && notif.type !== 'system';
    setNoticeTarget(isCustom ? 'custom' : 'all');
    const uids = Array.isArray(notif.targetUids)
      ? notif.targetUids
      : notif.targetUid && notif.targetUid !== 'all'
      ? [notif.targetUid]
      : [];
    setNoticeSelectedUids(uids);
    setNoticeHasPoll(!!notif.hasPoll);
    setNoticePollQuestion(notif.pollQuestion || notif.title || '');
    setNoticePollOptions(
      Array.isArray(notif.pollOptions) && notif.pollOptions.length > 0
        ? [...notif.pollOptions]
        : ['Đồng ý / Hài lòng', 'Không đồng ý / Cần cải thiện']
    );
    setNoticeAllowComment(notif.allowComment ?? true);
    setNoticeRequireResponse(notif.requireResponse ?? true);
    setNoticeIsPollClosed(!!(notif.isPollClosed || notif.pollClosed));
    setIsComposerOpen(true);
  };

  // Gửi hoặc cập nhật thông báo
  const handleSubmitNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      triggerToast('Vui lòng nhập đầy đủ tiêu đề và nội dung.', false);
      return;
    }

    const cleanOptions = noticePollOptions.map((o) => o.trim()).filter(Boolean);
    if (noticeHasPoll && cleanOptions.length === 0 && !noticeAllowComment) {
      triggerToast('Cuộc bình chọn cần ít nhất 1 phương án lựa chọn hoặc cho phép nhập ý kiến.', false);
      return;
    }

    if (noticeTarget === 'custom' && noticeSelectedUids.length === 0) {
      triggerToast('Vui lòng chọn ít nhất 1 thành viên nhận thông báo.', false);
      return;
    }

    setIsSubmittingNotice(true);
    try {
      let targetEmail = 'Tất cả thành viên';
      let targetUids: string[] = [];

      if (noticeTarget === 'custom') {
        targetUids = [...noticeSelectedUids];
        const selectedUsers = users.filter((u) => targetUids.includes(u.uid));
        if (selectedUsers.length === 1) {
          targetEmail = selectedUsers[0].displayName
            ? `${selectedUsers[0].displayName} (${selectedUsers[0].email})`
            : selectedUsers[0].email || 'Thành viên';
        } else {
          targetEmail = `${selectedUsers.length} thành viên (${selectedUsers
            .map((u) => u.displayName || u.email || 'Thành viên')
            .slice(0, 2)
            .join(', ')}${selectedUsers.length > 2 ? '...' : ''})`;
        }
      }

      const payload = {
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        type: noticeTarget === 'all' ? 'system' : 'user',
        targetUid: noticeTarget === 'all' ? 'all' : targetUids.length === 1 ? targetUids[0] : 'multiple',
        targetUids: noticeTarget === 'all' ? [] : targetUids,
        targetEmail,
        senderName: currentUser?.displayName || 'Trần Gia Thiều (Admin)',
        hasPoll: !!noticeHasPoll,
        pollQuestion: noticePollQuestion.trim() || noticeTitle.trim(),
        pollOptions: noticeHasPoll ? (cleanOptions.length > 0 ? cleanOptions : ['Đồng ý', 'Không đồng ý']) : [],
        allowComment: noticeHasPoll ? noticeAllowComment : false,
        requireResponse: noticeHasPoll ? noticeRequireResponse : false,
        isPollClosed: noticeIsPollClosed,
      };

      if (editingNotifId) {
        await updateDoc(doc(db, 'notifications', editingNotifId), payload);
        triggerToast('Đã cập nhật thông báo thành công!');
      } else {
        await addDoc(collection(db, 'notifications'), {
          ...payload,
          createdAt: new Date().toISOString(),
          votes: {},
        });
        triggerToast('Đã phát thông báo mới thành công!');
      }

      setIsComposerOpen(false);
      setEditingNotifId(null);
    } catch (err) {
      console.error('Lỗi lưu thông báo:', err);
      triggerToast('Có lỗi xảy ra khi lưu thông báo.', false);
    } finally {
      setIsSubmittingNotice(false);
    }
  };

  // Trả lời góp ý người dùng
  const handleSendReply = async () => {
    if (!selectedItem || selectedType !== 'feedback') return;
    if (!replyText.trim()) {
      triggerToast('Vui lòng nhập nội dung phản hồi.', false);
      return;
    }

    setIsSubmittingReply(true);
    try {
      const fbId = selectedItem.id;
      const targetUid = selectedItem.uid;
      const targetEmail = selectedItem.email;

      // 1. Cập nhật câu trả lời vào feedback
      await updateDoc(doc(db, 'feedbacks', fbId), {
        replyText: replyText.trim(),
        replyAt: new Date().toISOString(),
      });

      // 2. Gửi thông báo trực tiếp đến tài khoản người dùng
      if (targetUid) {
        await addDoc(collection(db, 'notifications'), {
          title: 'Phản hồi từ Admin về đóng góp ý kiến',
          content: `Admin đã phản hồi góp ý của bạn: "${replyText.trim()}"`,
          type: 'feedback_reply',
          targetUid: targetUid,
          targetEmail: targetEmail || 'Thành viên',
          senderName: currentUser?.displayName || 'Trần Gia Thiều (Admin)',
          createdAt: new Date().toISOString(),
          hasPoll: false,
        });
      }

      triggerToast('Đã gửi phản hồi thành công tới thành viên!');
      setReplyText('');
    } catch (err) {
      console.error('Lỗi gửi phản hồi feedback:', err);
      triggerToast('Không thể gửi phản hồi.', false);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Xóa Feedback
  const handleDeleteFeedback = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'feedbacks', id));
      triggerToast('Đã xóa ý kiến đóng góp.');
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedType(null);
      }
      setDeletingFeedbackId(null);
    } catch (err) {
      console.error('Lỗi xóa feedback:', err);
      triggerToast('Lỗi khi xóa ý kiến.', false);
    }
  };

  // Xóa Notification
  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      triggerToast('Đã xóa thông báo.');
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedType(null);
      }
      setDeletingNotifId(null);
    } catch (err) {
      console.error('Lỗi xóa thông báo:', err);
      triggerToast('Lỗi khi xóa thông báo.', false);
    }
  };

  // Toggle trạng thái bình chọn (Đóng / Mở lại)
  const handleTogglePollStatus = async (notif: any) => {
    try {
      const isCurrentlyClosed = !!(notif.isPollClosed || notif.pollClosed);
      await updateDoc(doc(db, 'notifications', notif.id), {
        isPollClosed: !isCurrentlyClosed,
        pollClosed: !isCurrentlyClosed,
        pollClosedAt: !isCurrentlyClosed ? new Date().toISOString() : null,
      });
      triggerToast(!isCurrentlyClosed ? 'Đã tạm ngưng cuộc bình chọn.' : 'Đã mở lại cuộc bình chọn.');
    } catch (err) {
      console.error('Lỗi đổi trạng thái poll:', err);
      triggerToast('Không thể thay đổi trạng thái bình chọn.', false);
    }
  };

  return (
    <div className="bg-white/85 backdrop-blur-xl border border-white/60 shadow-[0_12px_45px_rgba(100,100,160,.09)] rounded-2xl sm:rounded-[28px] overflow-hidden flex-1 flex flex-col h-[calc(100dvh-80px)] sm:h-[calc(100vh-100px)] min-h-[520px]">
      {/* =========================================================================
          TOP COMMAND HEADER (Responsive gọn gàng cho điện thoại)
      ========================================================================= */}
      <div className="px-3.5 sm:px-5 py-3 border-b border-slate-100 bg-white/70 flex items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20 shrink-0">
            <Megaphone className="w-4 sm:w-5 h-4 sm:h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 truncate">
              <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight truncate">
                Trung tâm Tương tác
              </h1>
              {stats.unrepliedCount > 0 && (
                <span className="hidden xs:inline-flex px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black bg-rose-500 text-white animate-pulse shrink-0">
                  {stats.unrepliedCount} mới
                </span>
              )}
            </div>
            <p className="hidden sm:block text-xs text-slate-500 font-medium truncate">
              Hợp nhất Hộp thư Góp ý &amp; Hệ thống Phát thông báo, Khảo sát thành viên
            </p>
          </div>
        </div>

        {/* Action Button: Phát thông báo mới */}
        <button
          type="button"
          onClick={() => handleOpenNewComposer()}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4 stroke-[2.5]" />
          <span className="hidden xs:inline">Phát thông báo</span>
          <span className="xs:hidden">Tạo mới</span>
        </button>
      </div>

      {/* =========================================================================
          RESPONSIVE WORKSPACE CONTAINER:
          - Desktop (lg:): 3 Cột song song mượt mà
          - Mobile (< lg): Chuyển màn hình phân cấp (Master-Detail Drill-down)
      ========================================================================= */}
      <div className="flex-1 flex overflow-hidden divide-x divide-slate-100 bg-slate-50/40 min-h-0">
        {/* =======================================================================
            CỘT 1: NAV & SMART FILTERS (Ẩn trên mobile, hiện ở desktop lg:)
        ======================================================================= */}
        <aside className="hidden lg:flex w-56 shrink-0 bg-white/70 p-3.5 flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            {/* View Switcher: Tất cả / Góp ý / Thông báo */}
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 block mb-1.5">
                Kênh giao tiếp
              </span>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('all');
                    setIsComposerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Inbox className="w-3.5 h-3.5" />
                    <span>Tất cả luồng</span>
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                      activeTab === 'all' ? 'bg-indigo-700/80 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {stats.totalFeedbacks + stats.totalNotifs}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('feedbacks');
                    setIsComposerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === 'feedbacks'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ý kiến người dùng</span>
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                      activeTab === 'feedbacks'
                        ? 'bg-indigo-700/80 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {stats.totalFeedbacks}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('notifications');
                    setIsComposerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === 'notifications'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5" />
                    <span>Bảng tin thông báo</span>
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                      activeTab === 'notifications'
                        ? 'bg-indigo-700/80 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {stats.totalNotifs}
                  </span>
                </button>
              </div>
            </div>

            {/* Sub-filter cho Feedbacks */}
            {(activeTab === 'all' || activeTab === 'feedbacks') && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 block mb-1.5">
                  Lọc ý kiến
                </span>
                <div className="space-y-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFeedbackFilter('all')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                      feedbackFilter === 'all'
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Tất cả ý kiến</span>
                    <span className="text-[10px] text-slate-400">{stats.totalFeedbacks}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackFilter('unreplied')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                      feedbackFilter === 'unreplied'
                        ? 'bg-rose-50 text-rose-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-rose-600">
                      <Clock className="w-3 h-3" />
                      <span>Chưa phản hồi</span>
                    </span>
                    <span className="text-[10px] font-extrabold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                      {stats.unrepliedCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackFilter('bug')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                      feedbackFilter === 'bug'
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Bug className="w-3 h-3 text-rose-500" />
                      <span>Báo lỗi (Bug)</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{stats.bugCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackFilter('request')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                      feedbackFilter === 'request'
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-sky-500" />
                      <span>Đề xuất tính năng</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{stats.requestCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackFilter('suggestion')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                      feedbackFilter === 'suggestion'
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="w-3 h-3 text-emerald-500" />
                      <span>Góp ý trải nghiệm</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{stats.suggestionCount}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sub-filter cho Notifications */}
            {(activeTab === 'all' || activeTab === 'notifications') && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 block mb-1.5">
                  Lọc thông báo
                </span>
                <div className="space-y-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setNotifFilter('all')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                      notifFilter === 'all'
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Tất cả thông báo</span>
                    <span className="text-[10px] text-slate-400">{stats.totalNotifs}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('poll')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                      notifFilter === 'poll'
                        ? 'bg-purple-50 text-purple-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-purple-700">
                      <Vote className="w-3 h-3" />
                      <span>Có bình chọn</span>
                    </span>
                    <span className="text-[10px] font-extrabold bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded">
                      {stats.activePollsCount} mở
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('system')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                      notifFilter === 'system'
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Radio className="w-3 h-3 text-amber-500" />
                      <span>Toàn hệ thống</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('custom')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                      notifFilter === 'custom'
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-blue-500" />
                      <span>Gửi nhóm/Cá nhân</span>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mini Footnote */}
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
            <span>Admin Console v4.5</span>
          </div>
        </aside>

        {/* =======================================================================
            CỘT 2: FEED LIST
            - Desktop (lg:): Chiếm 360-380px cố định
            - Mobile (< lg): Hiện 100% khi chưa chọn item; ẩn đi khi đang xem chi tiết
        ======================================================================= */}
        <section
          className={`${
            isViewingDetailOnMobile ? 'hidden lg:flex' : 'flex'
          } w-full lg:w-80 xl:w-96 shrink-0 bg-white flex-col overflow-hidden`}
        >
          {/* Search Bar Header */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm người gửi, email, nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-400 font-medium transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mobile Filter Chips (Thanh cuộn ngang trên điện thoại) */}
            <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  setFeedbackFilter('all');
                  setNotifFilter('all');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 text-[11px] transition-colors cursor-pointer ${
                  activeTab === 'all' && feedbackFilter === 'all' && notifFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({stats.totalFeedbacks + stats.totalNotifs})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('feedbacks');
                  setFeedbackFilter('unreplied');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === 'feedbacks' && feedbackFilter === 'unreplied'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Chưa phản hồi ({stats.unrepliedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('feedbacks');
                  setFeedbackFilter('bug');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === 'feedbacks' && feedbackFilter === 'bug'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Bug className="w-3 h-3 text-rose-500" />
                <span>Lỗi Bug ({stats.bugCount})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('notifications');
                  setNotifFilter('all');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === 'notifications' && notifFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Bell className="w-3 h-3 text-indigo-500" />
                <span>Thông báo ({stats.totalNotifs})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('notifications');
                  setNotifFilter('poll');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === 'notifications' && notifFilter === 'poll'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                <Vote className="w-3 h-3" />
                <span>Bình chọn ({stats.activePollsCount})</span>
              </button>
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 font-semibold">
              <span>{filteredItems.length} mục</span>
              <span>Sắp xếp: Mới nhất</span>
            </div>
          </div>

          {/* Feed Items Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const isSelected = selectedId === item.id;
              const isFeedback = item.__kind === 'feedback';

              if (isFeedback) {
                const fb = item;
                const isReplied = !!fb.replyText;
                const dateStr = fb.createdAt
                  ? new Date(fb.createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Gần đây';

                return (
                  <div
                    key={fb.id}
                    onClick={() => {
                      setSelectedId(fb.id);
                      setSelectedType('feedback');
                      setIsComposerOpen(false);
                      setReplyText('');
                    }}
                    className={`p-3.5 cursor-pointer transition-all text-left relative active:bg-indigo-50/50 ${
                      isSelected
                        ? 'bg-indigo-50/70 border-l-4 border-indigo-600 shadow-2xs'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            fb.type === 'bug'
                              ? 'bg-rose-500'
                              : fb.type === 'request'
                              ? 'bg-sky-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span className="font-extrabold text-xs text-slate-800 truncate">
                          {fb.displayName || fb.email?.split('@')[0] || 'Thành viên'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {dateStr}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium line-clamp-2 leading-relaxed mb-2">
                      {fb.feedbackText}
                    </p>

                    <div className="flex items-center justify-between gap-1.5 text-[10px]">
                      <div className="flex items-center gap-1">
                        <span
                          className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                            fb.type === 'bug'
                              ? 'bg-rose-50 text-rose-700'
                              : fb.type === 'request'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {fb.type === 'bug' ? 'Bug' : fb.type === 'request' ? 'Đề xuất' : 'Góp ý'}
                        </span>
                        {fb.feedbackImage && (
                          <span className="text-slate-400 flex items-center gap-0.5" title="Có ảnh đính kèm">
                            <ImageIcon className="w-3 h-3 text-indigo-500" />
                          </span>
                        )}
                      </div>

                      {isReplied ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Đã phản hồi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-1.5 py-0.2 rounded">
                          <Clock className="w-2.5 h-2.5" />
                          Chờ xử lý
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              // Notification Item
              const n = item;
              const isPoll = !!n.hasPoll;
              const isSystem = n.type === 'system' || n.targetUid === 'all';
              const dateStr = n.createdAt
                ? new Date(n.createdAt).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Gần đây';

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    setSelectedId(n.id);
                    setSelectedType('notification');
                    setIsComposerOpen(false);
                  }}
                  className={`p-3.5 cursor-pointer transition-all text-left relative active:bg-indigo-50/50 ${
                    isSelected
                      ? 'bg-indigo-50/70 border-l-4 border-indigo-600 shadow-2xs'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                      <Megaphone className="w-2.5 h-2.5" />
                      Thông báo
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{dateStr}</span>
                  </div>

                  <h4 className="font-extrabold text-xs text-slate-900 line-clamp-1 mb-1">
                    {n.title}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-2 font-medium">
                    {n.content}
                  </p>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-medium truncate max-w-[150px]">
                      {isSystem ? '📢 Toàn hệ thống' : `👥 ${n.targetEmail || 'Người dùng'}`}
                    </span>
                    {isPoll && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-bold bg-purple-50 text-purple-700">
                        <Vote className="w-2.5 h-2.5" />
                        Bình chọn
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <Inbox className="w-8 h-8 text-slate-300 stroke-1" />
                <span>Không có dữ liệu phù hợp với bộ lọc</span>
              </div>
            )}
          </div>
        </section>

        {/* =======================================================================
            CỘT 3: INTERACTIVE WORKSPACE
            - Desktop (lg:): Chiếm toàn bộ phần còn lại bên phải
            - Mobile (< lg): Hiện 100% khi đang xem chi tiết hoặc soạn thảo; có nút Back
        ======================================================================= */}
        <main
          className={`${
            isViewingDetailOnMobile ? 'flex' : 'hidden lg:flex'
          } flex-1 bg-slate-50/50 flex-col overflow-y-auto`}
        >
          {/* TRƯỜNG HỢP 1: COMPOSER FORM (Phát thông báo mới hoặc Sửa thông báo) */}
          {isComposerOpen ? (
            <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4 sm:space-y-5">
              {/* Mobile Back Button */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(false)}
                    className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg active:bg-slate-200 cursor-pointer"
                    title="Quay lại"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-slate-900 truncate">
                      {editingNotifId ? 'Chỉnh sửa thông báo' : 'Soạn thông báo & Khảo sát'}
                    </h2>
                    <p className="hidden xs:block text-[11px] text-slate-500 font-medium truncate">
                      Phát sóng tức thì tới toàn bộ hoặc nhóm thành viên
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="hidden lg:block p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitNotice} className="space-y-4">
                {/* Chọn đối tượng nhận */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Đối tượng nhận thông báo:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNoticeTarget('all')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        noticeTarget === 'all'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Toàn hệ thống (Mọi người)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoticeTarget('custom')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        noticeTarget === 'custom'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Chọn thành viên {noticeSelectedUids.length > 0 ? `(${noticeSelectedUids.length})` : ''}</span>
                    </button>
                  </div>

                  {/* Picker thành viên nếu chọn custom */}
                  {noticeTarget === 'custom' && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs mt-2">
                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Tìm thành viên theo tên hoặc email..."
                          value={noticeUserSearch}
                          onChange={(e) => setNoticeUserSearch(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none focus:bg-white"
                        />
                      </div>

                      <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-100">
                        {users
                          .filter((u) => {
                            if (!noticeUserSearch) return true;
                            const s = noticeUserSearch.toLowerCase();
                            return (
                              (u.displayName || '').toLowerCase().includes(s) ||
                              (u.email || '').toLowerCase().includes(s)
                            );
                          })
                          .map((u) => {
                            const isChecked = noticeSelectedUids.includes(u.uid);
                            return (
                              <label
                                key={u.uid}
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-slate-50 ${
                                  isChecked ? 'bg-indigo-50/50' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNoticeSelectedUids((prev) => [...prev, u.uid]);
                                    } else {
                                      setNoticeSelectedUids((prev) => prev.filter((id) => id !== u.uid));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                />
                                <div className="truncate flex-1">
                                  <span className="font-bold text-slate-800 text-[11px] block truncate">
                                    {u.displayName || 'Thành viên'}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block truncate">{u.email}</span>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tiêu đề & Nội dung */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Tiêu đề thông báo:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Cập nhật tính năng mới hoặc Thông báo bảo trì..."
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Nội dung thông báo chi tiết:
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Nhập nội dung đầy đủ..."
                    value={noticeContent}
                    onChange={(e) => setNoticeContent(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500 shadow-2xs leading-relaxed"
                  />
                </div>

                {/* Kèm khảo sát / bình chọn */}
                <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={noticeHasPoll}
                      onChange={(e) => setNoticeHasPoll(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                    />
                    <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                      <Vote className="w-4 h-4 text-indigo-600" />
                      Kèm cuộc bình chọn / Khảo sát ý kiến
                    </span>
                  </label>

                  {noticeHasPoll && (
                    <div className="space-y-3 pt-2 border-t border-indigo-100">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">
                          Câu hỏi khảo sát:
                        </label>
                        <input
                          type="text"
                          placeholder="Nếu để trống sẽ lấy theo tiêu đề..."
                          value={noticePollQuestion}
                          onChange={(e) => setNoticePollQuestion(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">
                          Các lựa chọn bình chọn:
                        </label>
                        {noticePollOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNoticePollOptions((prev) => {
                                  const next = [...prev];
                                  next[idx] = val;
                                  return next;
                                });
                              }}
                              className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none"
                            />
                            {noticePollOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setNoticePollOptions((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => setNoticePollOptions((prev) => [...prev, `Phương án ${prev.length + 1}`])}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer pt-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm phương án</span>
                        </button>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-indigo-100 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={noticeAllowComment}
                            onChange={(e) => setNoticeAllowComment(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-indigo-600"
                          />
                          <span className="text-[11px] font-semibold text-slate-700">
                            Cho phép nhập ý kiến chi tiết
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={noticeRequireResponse}
                            onChange={(e) => setNoticeRequireResponse(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-rose-600"
                          />
                          <span className="text-[11px] font-bold text-rose-700">
                            Khóa bắt buộc bình chọn trước khi được đóng thông báo
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingNotice}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingNotice && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingNotifId ? 'Cập nhật' : 'Phát thông báo ngay'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : selectedType === 'feedback' && selectedItem ? (
            /* TRƯỜNG HỢP 2: CHI TIẾT Ý KIẾN GÓP Ý & KHUNG TRẢ LỜI */
            <div className="p-3.5 sm:p-6 max-w-3xl mx-auto w-full space-y-4 sm:space-y-5">
              {/* Mobile Back Button Navigation */}
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setSelectedType(null);
                }}
                className="lg:hidden inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 p-1 -ml-1 rounded-lg active:bg-indigo-50 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại danh sách</span>
              </button>

              {/* Top Meta Info */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm shrink-0">
                      {(selectedItem.displayName || selectedItem.email || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm truncate">
                          {selectedItem.displayName || 'Thành viên'}
                        </h3>
                        <span
                          className={`px-2 py-0.2 rounded text-[10px] font-black uppercase tracking-wider ${
                            selectedItem.type === 'bug'
                              ? 'bg-rose-50 text-rose-700 border border-rose-100'
                              : selectedItem.type === 'request'
                              ? 'bg-sky-50 text-sky-700 border border-sky-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}
                        >
                          {selectedItem.type === 'bug' ? 'Lỗi (Bug)' : selectedItem.type === 'request' ? 'Đề xuất' : 'Góp ý'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{selectedItem.email}</span>
                        {selectedItem.version && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded shrink-0">
                            {selectedItem.version}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delete Option */}
                  <div className="flex items-center gap-2">
                    {deletingFeedbackId === selectedItem.id ? (
                      <div className="flex items-center gap-1.5 bg-rose-50 p-1 rounded-xl border border-rose-200">
                        <span className="text-[11px] font-bold text-rose-700 px-1">Chắc chắn xóa?</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteFeedback(selectedItem.id)}
                          className="px-2 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 cursor-pointer"
                        >
                          Xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingFeedbackId(null)}
                          className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingFeedbackId(selectedItem.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Xóa ý kiến này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Rating Stars */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Đánh giá sao:</span>
                  <div className="flex items-center text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < (selectedItem.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Content Box */}
                <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-100 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedItem.feedbackText}
                </div>

                {/* Screenshot Attachment */}
                {selectedItem.feedbackImage && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                      Ảnh chụp màn hình đính kèm:
                    </span>
                    <div className="relative inline-block border border-slate-200 rounded-xl overflow-hidden shadow-xs group max-w-full">
                      <img
                        src={selectedItem.feedbackImage}
                        alt="Feedback Screenshot"
                        className="max-h-60 max-w-full object-contain cursor-zoom-in"
                        onClick={() => onPreviewImage && onPreviewImage(selectedItem.feedbackImage)}
                      />
                      <button
                        type="button"
                        onClick={() => onPreviewImage && onPreviewImage(selectedItem.feedbackImage)}
                        className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/70 hover:bg-black text-white text-[10px] font-bold rounded-lg flex items-center gap-1 backdrop-blur-xs cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Phóng to
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action: 1-Click Convert to Fix Announcement */}
              <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                <div className="text-xs">
                  <span className="font-bold text-indigo-900 block">Đã khắc phục xong vấn đề này?</span>
                  <span className="text-[11px] text-slate-500">
                    Phát thông báo hệ thống thông báo cập nhật bản vá tới toàn bộ người dùng.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const titlePrefill = `Cập nhật khắc phục: ${selectedItem.feedbackText?.slice(0, 40)}...`;
                    const contentPrefill = `Hệ thống đã khắc phục thành công vấn đề theo đóng góp của bạn:\n"${selectedItem.feedbackText}"\n\nCảm ơn bạn đã luôn đồng hành cùng Word2LaTeX!`;
                    handleOpenNewComposer(titlePrefill, contentPrefill);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer"
                >
                  <Megaphone className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Phát thông báo fix lỗi</span>
                </button>
              </div>

              {/* Reply Conversation Section */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3.5">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-indigo-600" />
                  {selectedItem.replyText ? 'Phản hồi gửi thành viên' : 'Gửi phản hồi trực tiếp cho thành viên'}
                </h4>

                {selectedItem.replyText && (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-emerald-800 font-bold">
                      <span>Admin đã phản hồi:</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {selectedItem.replyAt ? new Date(selectedItem.replyAt).toLocaleString('vi-VN') : 'Gần đây'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap font-medium leading-relaxed">
                      {selectedItem.replyText}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <textarea
                    rows={3}
                    placeholder="Gõ nội dung giải đáp, cảm ơn hoặc hướng dẫn thành viên..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:bg-white focus:border-indigo-500 shadow-2xs leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={isSubmittingReply || !replyText.trim()}
                      onClick={handleSendReply}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer w-full sm:w-auto justify-center"
                    >
                      {isSubmittingReply ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Gửi tin nhắn phản hồi</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedType === 'notification' && selectedItem ? (
            /* TRƯỜNG HỢP 3: CHI TIẾT THÔNG BÁO / KHẢO SÁT */
            <div className="p-3.5 sm:p-6 max-w-3xl mx-auto w-full space-y-4 sm:space-y-5">
              {/* Mobile Back Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setSelectedType(null);
                }}
                className="lg:hidden inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 p-1 -ml-1 rounded-lg active:bg-indigo-50 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại danh sách</span>
              </button>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
                {/* Header Action */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          selectedItem.type === 'system' || selectedItem.targetUid === 'all'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {selectedItem.type === 'system' || selectedItem.targetUid === 'all'
                          ? 'Toàn hệ thống'
                          : 'Gửi nhóm/Cá nhân'}
                      </span>
                      {selectedItem.hasPoll && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-50 text-purple-800 border border-purple-200">
                          <Vote className="w-3 h-3" />
                          Khảo sát ý kiến
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900">{selectedItem.title}</h2>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Đã phát vào {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString('vi-VN') : 'Gần đây'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleEditNotification(selectedItem)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Sửa
                    </button>
                    {selectedItem.hasPoll && (
                      <button
                        type="button"
                        onClick={() => handleTogglePollStatus(selectedItem)}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          selectedItem.isPollClosed || selectedItem.pollClosed
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        {selectedItem.isPollClosed || selectedItem.pollClosed ? 'Mở lại' : 'Tạm ngưng'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteNotification(selectedItem.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      title="Xóa thông báo này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3.5 sm:p-4 bg-slate-50/70 rounded-xl border border-slate-100 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedItem.content}
                </div>

                {/* Poll Results (Nếu có poll) */}
                {selectedItem.hasPoll && (
                  <div className="p-3.5 sm:p-4 bg-purple-50/50 rounded-xl border border-purple-100 space-y-3">
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-purple-900 flex items-center justify-between flex-wrap gap-1">
                      <span className="flex items-center gap-1.5">
                        <Vote className="w-4 h-4 text-purple-700" />
                        {selectedItem.pollQuestion || selectedItem.title}
                      </span>
                      <span className="text-[10px] font-semibold text-purple-600 lowercase">
                        {selectedItem.isPollClosed || selectedItem.pollClosed ? '(Đã ngưng)' : '(Đang mở)'}
                      </span>
                    </h4>

                    {/* Danh sách các lựa chọn */}
                    <div className="space-y-2 pt-1">
                      {Array.isArray(selectedItem.pollOptions) &&
                        selectedItem.pollOptions.map((opt: string, idx: number) => {
                          const votesMap = selectedItem.votes || {};
                          const totalVotes = Object.keys(votesMap).length;
                          const countForThis = Object.values(votesMap).filter((v: any) =>
                            typeof v === 'number' ? v === idx : v?.optionIndex === idx
                          ).length;
                          const percent = totalVotes > 0 ? Math.round((countForThis / totalVotes) * 100) : 0;

                          return (
                            <div key={idx} className="bg-white p-2.5 sm:p-3 rounded-lg border border-purple-100 shadow-3xs space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                <span className="truncate pr-2">{opt}</span>
                                <span className="text-purple-700 shrink-0">
                                  {countForThis} phiếu ({percent}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* EMPTY STATE */
            <div className="m-auto text-center p-6 sm:p-8 max-w-sm flex flex-col items-center justify-center gap-3">
              <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-2xl sm:rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                <Inbox className="w-6 sm:w-7 h-6 sm:h-7 stroke-[1.8]" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-sm">Chưa chọn nội dung nào</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Chọn một góp ý từ danh sách bên trái để đọc chi tiết và trả lời thành viên, hoặc bấm nút dưới để phát thông báo mới.
              </p>
              <button
                type="button"
                onClick={() => handleOpenNewComposer()}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Phát thông báo mới</span>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
