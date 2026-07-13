import { logApiUsage } from "./utils/logger";
import React, { useState, useRef, useEffect, startTransition } from "react";
import {
  HelpCircle,
  FileText,
  HardDrive,
  Upload,
  Check,
  X,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  LogOut,
  Bell,
  MessageSquare,
  Settings,
  Camera,
  Image,
  Trash2,
  ZoomIn,
  ArrowRight,
  Home,
  Folder,
  Users,
  Diamond,
  Search, Pin, PinOff, Mail,
  Menu, Filter, ChevronDown, Plus, Pencil, ChevronLeft, ChevronRight, UserPlus, UserCog, User, Info, Save,
  Paperclip, Layout, Laptop, Wifi, BrainCircuit
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import katex from "katex";
import { marked } from "marked";
import { LatexConverter } from "./components/LatexConverter";
import { MarkItDown } from "./components/MarkItDown";
import { QBuilder } from "./components/QBuilder";

// Firebase integrations
import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  where,
  deleteDoc,
  increment,
} from "firebase/firestore";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to escape HTML safely for attributes
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// LaTeX special character escape for normal text blocks in the Overleaf document template
function escapeLaTeX(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

// Module-level cache to make KaTeX MathML generation instant during Word download/copy
const mathmlCache = new Map<string, string>();

// Helper functions to protect URLs from being mangled by formatting or KaTeX regexes
interface ProtectedUrl {
  placeholder: string;
  original: string;
  isBare: boolean;
}

function protectUrls(text: string): {
  protectedText: string;
  urls: ProtectedUrl[];
} {
  if (!text) return { protectedText: "", urls: [] };

  const urls: ProtectedUrl[] = [];
  const URL_RE = /https?:\/\/[^\s<>\"{}]+[^.,;:!?\s<>\"){}]/gi;

  let match;
  let lastIndex = 0;
  let protectedText = "";

  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    const original = match[0];
    const index = match.index;

    const beforeStr = text.slice(Math.max(0, index - 10), index);
    const isBare =
      !beforeStr.endsWith("](") &&
      !beforeStr.includes("href=") &&
      !beforeStr.includes("src=") &&
      !beforeStr.endsWith("<");

    const placeholder = `@@@URL_PLACE_HOLDER_${urls.length}@@@`;
    urls.push({ placeholder, original, isBare });

    protectedText += text.slice(lastIndex, index) + placeholder;
    lastIndex = URL_RE.lastIndex;
  }
  protectedText += text.slice(lastIndex);

  return { protectedText, urls };
}

function restoreUrls(
  text: string,
  urls: ProtectedUrl[],
  forceOriginal: boolean = false,
): string {
  let restored = text;
  for (const item of urls) {
    if (item.isBare && !forceOriginal) {
      // Convert bare URLs into Markdown links so marked can render them as clickable links
      restored = restored.replace(
        item.placeholder,
        `[${item.original}](${item.original})`,
      );
    } else {
      // Restore as original for pre-existing markdown links, html, or if forced
      restored = restored.replace(item.placeholder, item.original);
    }
  }
  return restored;
}

// Smart formatting to fix run-on sentences or stuck equations, numbers, percentages, quotes, etc.
function applySmartFormatting(text: string): string {
  if (!text) return "";

  // 1. Mask math blocks and code blocks first to protect them from being modified
  const placeholders: string[] = [];
  const PROTECT_RE = /```[\s\S]*?```|`[^`\n]+`|\$\{[\s\S]*?\}|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\ref\{[^}]+\}|\\label\{[^}]+\}|\$(?!\$)[\s\S]*?(?<!\\)\$/g;

  let protectedText = text.replace(PROTECT_RE, (match) => {
    const ph = `___SMART_FORMAT_PLACEHOLDER_${placeholders.length}___`;
    placeholders.push(match);
    return ph;
  });

  // 2. Original formatting rules:
  // - Nhận dạng in đậm thiếu dấu sao ở đầu: *Đáp án đúng:** -> **Đáp án đúng**
  protectedText = protectedText.replace(/(?<!\*)\*(?!\s)([^\*\n]+?)\*\*/g, '**$1**');

  // - Nhận dạng in nghiêng thiếu dấu sao ở đầu cho mục danh sách: * Nội dung*: -> * *Nội dung*:
  protectedText = protectedText.replace(/^(\s*\*\s+)([^\*\n]+?)\*(?!\*)/gm, '$1*$2*');

  // 3. AUTO-RECOGNIZE EXPONENTS (SUPERSCRIPTS) AND SUBSCRIPTS ON NORMAL LETTERS:
  
  // A. Unicode superscript characters on single letters (or simple variable names):
  // Superscript characters: ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ
  const supMap: { [key: string]: string } = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', 'ⁿ': 'n'
  };
  protectedText = protectedText.replace(/([a-zA-Z])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+)/g, (match, letter, sups) => {
    let power = '';
    for (let i = 0; i < sups.length; i++) {
      power += supMap[sups[i]] || sups[i];
    }
    const formattedPower = power.length > 1 ? `{${power}}` : power;
    return `$${letter}^${formattedPower}$`;
  });

  // B. Unicode subscript characters on single letters (or simple variable names):
  // Subscript characters: ₀₁₂₃₄₅₆₇₈₉₊₋ₐₑₒₓᵢⱼᵤᵥ
  const subMap: { [key: string]: string } = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '₊': '+', '₋': '-', 'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ᵢ': 'i', 'ⱼ': 'j', 'ᵤ': 'u', 'ᵥ': 'v'
  };
  protectedText = protectedText.replace(/([a-zA-Z])([₀₁₂₃₄₅₆₇₈₉₊₋ₐₑₒₓᵢⱼᵤᵥ]+)/g, (match, letter, subs) => {
    let index = '';
    for (let i = 0; i < subs.length; i++) {
      index += subMap[subs[i]] || subs[i];
    }
    const formattedIndex = index.length > 1 ? `{${index}}` : index;
    return `$${letter}_${formattedIndex}$`;
  });

  // C. Plain text caret/underscore notation: e.g. x^2, x_1, y_n, a_{i+1}, a^x, etc.
  protectedText = protectedText.replace(/\b([a-zA-Z])\^([0-9a-zA-Z+\-]+|\{[^}]+\})/g, (match, letter, power) => {
    return `$${letter}^${power}$`;
  });

  protectedText = protectedText.replace(/\b([a-zA-Z])_([0-9a-zA-Z+\-]+|\{[^}]+\})/g, (match, letter, index) => {
    return `$${letter}_${index}$`;
  });

  // D. Very common plain combinations (single math letters followed immediately by a digit, e.g. x1, x2, y1, y2, u1, v2, a1, b2, c0...)
  // We strictly target typical math variables (x, y, z, t, u, v, a, b, c, s, n, m) to avoid false positives.
  protectedText = protectedText.replace(/\b([xyztuvabcnsm])([0-9])\b/gi, (match, letter, digit) => {
    return `$${letter}_${digit}$`;
  });

  // 4. Restore the masked math/code blocks
  let restoredText = protectedText;
  for (let i = 0; i < placeholders.length; i++) {
    restoredText = restoredText.replace(`___SMART_FORMAT_PLACEHOLDER_${i}___`, placeholders[i]);
  }

  return restoredText;
}

// Bộ lọc tối ưu hóa kiểm tra xem một cụm có thực sự là công thức toán học cần LaTeX không
// hay chỉ là các con số đơn lẻ, ngày tháng, phần trăm hoặc ký tự thông thường vô lý.
function isRealMathLaTeX(str: string): boolean {
  // Always recognize inline math enclosed by $...$ as a math equation directly, with no error-correction blocks
  return str.trim().length > 0;
}

// Normalize LaTeX helper inside mathematical formulas for MS Word rendering and KaTeX compatibility
function normalizeLaTeX(latex: string, isInline: boolean = false): string {
  // Do not perform automatic normalization/manipulation to preserve exact user latex formulas
  return latex;
}

// Check for unclosed/unpaired dollar tags ($) in input text
function hasUnclosedDollar(text: string): boolean {
  if (!text) return false;
  // Exclude double dollars and escaped dollars
  let cleaned = text.replace(/\$\$/g, "");
  cleaned = cleaned.replace(/\\\$/g, "");
  const matches = cleaned.match(/\$/g);
  return matches ? matches.length % 2 !== 0 : false;
}

interface ParsedQuestion {
  questionBody: string;
  options: { label: string; text: string }[];
}

function parseMultipleChoice(text: string): ParsedQuestion {
  if (!text) return { questionBody: "", options: [] };

  const lines = text.split("\n");
  const questionLines: string[] = [];
  const options: { label: string; text: string }[] = [];

  const optionRegex = /^\s*([A-D])[\.\)\/]\s*(.*)$/;
  // Các dòng bắt đầu bằng đánh số danh sách, bullet, ký hiệu đặc biệt hoặc từ khóa đề mục
  const nonOptionContinuationRegex =
    /^\s*(?:\d+[\.\)\/\s-]|[\-\*•]|\b(?:Bài|Yêu cầu|Biết rằng|Ghi chú|Lưu ý|Chú ý|Đề số|Mã số|Thời gian)\b)/i;

  let currentOption: { label: string; text: string } | null = null;
  const postQuestionLines: string[] = []; // Chứa các dòng không phải option nằm sau khi các option bắt đầu

  for (const line of lines) {
    const match = line.match(optionRegex);
    if (match) {
      if (currentOption) {
        options.push(currentOption);
      }
      currentOption = {
        label: match[1].toUpperCase(),
        text: match[2].trim(),
      };
    } else {
      if (currentOption) {
        // Nếu đã có option đang chạy, nhưng dòng hiện tại trống hoặc bắt đầu bằng số/bullet/từ khóa đề mục
        // thì ta ngắt option đó và coi dòng này thuộc về phần nội dung sau option (sẽ được nối vào questionBody)
        if (!line.trim() || nonOptionContinuationRegex.test(line)) {
          options.push(currentOption);
          currentOption = null;
          postQuestionLines.push(line);
        } else {
          // Ngược lại thì vẫn tiếp tục gộp vào option hiện tại
          currentOption.text += "\n" + line.trim();
        }
      } else {
        if (options.length > 0) {
          // Đã xong các option trước đó, dòng này là nội dung xuất hiện sau các option
          postQuestionLines.push(line);
        } else {
          // Chưa bắt đầu option nào, dòng này thuộc về đề bài
          questionLines.push(line);
        }
      }
    }
  }

  if (currentOption) {
    options.push(currentOption);
  }

  let questionBody = questionLines.join("\n").trim();
  if (postQuestionLines.length > 0) {
    questionBody += "\n\n" + postQuestionLines.join("\n").trim();
  }

  if (options.length >= 2) {
    return {
      questionBody: questionBody.trim(),
      options,
    };
  }

  // If we couldn't parse 2 distinct options from separate lines, try inline parsing (e.g., A. $1$ B. $2$ C. $3$ D. $4$)
  const inlineRegex =
    /([A-D])[\.\)\/]\s*([\s\S]*?)(?=\s*[A-D][\.\)\/]|(?:\s*$))/g;
  const plainText = text;
  const firstOptionIdx = plainText.search(/\b[A-D][\.\)\/]/);

  if (firstOptionIdx !== -1) {
    const questionBodyInline = plainText.substring(0, firstOptionIdx).trim();
    const optionsPart = plainText.substring(firstOptionIdx);

    const foundOptions: { label: string; text: string }[] = [];
    let m;
    while ((m = inlineRegex.exec(optionsPart)) !== null) {
      foundOptions.push({
        label: m[1].toUpperCase(),
        text: m[2].trim(),
      });
    }

    if (foundOptions.length >= 2) {
      return {
        questionBody: questionBodyInline,
        options: foundOptions,
      };
    }
  }

  return {
    questionBody: text.trim(),
    options: [],
  };
}

function checkIsOwnerEmail(user: any): boolean {
  const email = user?.email || user?.providerData?.[0]?.email;
  if (!email) return false;
  return email.toLowerCase().trim() === "giathieu110406@gmail.com";
}

function isAdminByRole(userDoc: any): boolean {
  return userDoc?.role === "admin";
}

function isAdminUser(user: any, userDoc: any): boolean {
  return checkIsOwnerEmail(user) || isAdminByRole(userDoc);
}

function getTodayStr(): string {
  const offsetDate = new Date();
  // Trừ đi 5 tiếng để mốc reset đổi ngày mới rơi vào đúng 5:00 sáng
  offsetDate.setHours(offsetDate.getHours() - 5);
  return offsetDate.toLocaleDateString("vi-VN");
}

export default function App() {
  // --- AUTH & CONTROL STATE ---
  const [user, setUser] = useState<FirebaseUser | null>(() => {
    try {
      const cached = localStorage.getItem("q_builder_cached_user");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [userDoc, setUserDoc] = useState<any | null>(() => {
    try {
      const cached = localStorage.getItem("q_builder_cached_user_doc");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });


  const [authLoading, setAuthLoading] = useState<boolean>(() => {
    try {
      const cachedUser = localStorage.getItem("q_builder_cached_user");
      const cachedDoc = localStorage.getItem("q_builder_cached_user_doc");
      return !(cachedUser && cachedDoc);
    } catch {
      return true;
    }
  });
  const [authError, setAuthError] = useState<string | null>(null);

  // --- ADMIN STATE ---
  const [adminTab, setAdminTab] = useState<"tool" | "admin">("tool");
  const [sidebarView, setSidebarView] = useState<string>("overview");
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [showAiChat, setShowAiChat] = useState<boolean>(false);
  const [aiChatMessages, setAiChatMessages] = useState<{role: 'user'|'model', text: string}[]>([]);
  const [aiChatInput, setAiChatInput] = useState<string>("");
  const [isAiChatLoading, setIsAiChatLoading] = useState<boolean>(false);
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChatMessages, showAiChat]);
  const sidebarExpanded = isMenuOpen;

  const handleSidebarNav = (view: string) => {
    setSidebarView(view);
    setIsMenuOpen(false);
  };
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [dismissingAll, setDismissingAll] = useState<boolean>(false);
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState<string>("");
  const [newMemberName, setNewMemberName] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<string>("user");
  const [newMemberStatus, setNewMemberStatus] = useState<string>("approved");
  const [memberPage, setMemberPage] = useState<number>(1);
  const [allFeedbacks, setAllFeedbacks] = useState<any[]>([]);
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState<string>("");
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState<string>("all");
  const [adminSubTab, setAdminSubTab] = useState<"members" | "feedbacks" | "notify">("members");

  // Notification creation form state for admin
  const [generalNoticeTitle, setGeneralNoticeTitle] = useState<string>("");
  const [generalNoticeContent, setGeneralNoticeContent] = useState<string>("");
  const [generalNoticeTarget, setGeneralNoticeTarget] = useState<string>("all");
  const [isSendingGeneralNotice, setIsSendingGeneralNotice] = useState<boolean>(false);

  // States for viewing, editing, and deleting notifications (Admin only)
  const [allNotifications, setAllNotifications] = useState<any[]>([]);
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);
  const [editingNoticeTitle, setEditingNoticeTitle] = useState<string>("");
  const [editingNoticeContent, setEditingNoticeContent] = useState<string>("");
  const [editingNoticeTarget, setEditingNoticeTarget] = useState<string>("all");
  const [isUpdatingGeneralNotice, setIsUpdatingGeneralNotice] = useState<boolean>(false);

  // Reply form state
  const [activeReplyFeedbackId, setActiveReplyFeedbackId] = useState<string | null>(null);
  const [feedbackReplyText, setFeedbackReplyText] = useState<string>("");
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);

  // --- FEEDBACK STATE ---
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>("");
  const [feedbackType, setFeedbackType] = useState<
    "bug" | "request" | "suggestion" | "other"
  >("suggestion");
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [isSubmittingFeedback, setIsSubmittingFeedback] =
    useState<boolean>(false);
  const [feedbackImage, setFeedbackImage] = useState<string>("");
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null);
  const [showShuffleConfirm, setShowShuffleConfirm] = useState<boolean>(false);
  const [showProUpgradeModal, setShowProUpgradeModal] = useState<boolean>(false);

  // --- SETTINGS STATE ---
  const [settingsDisplayName, setSettingsDisplayName] = useState<string>("");
  const [settingsPhoneNumber, setSettingsPhoneNumber] = useState<string>("");
  const [settingsBirthDate, setSettingsBirthDate] = useState<string>("");
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Synchronize settings form state with userDoc
  useEffect(() => {
    if (userDoc) {
      setSettingsDisplayName(userDoc.displayName || user?.displayName || "");
      setSettingsPhoneNumber(userDoc.phoneNumber || "");
      setSettingsBirthDate(userDoc.birthDate || "");
    }
  }, [userDoc, user]);

  // --- NOTIFICATION STATE ---
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] =
    useState<boolean>(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  const [archivedNotificationIds, setArchivedNotificationIds] = useState<
    string[]
  >([]);

  // Load and save read/archived notification state per user from localStorage
  useEffect(() => {
    if (!user) {
      setReadNotificationIds([]);
      setArchivedNotificationIds([]);
      return;
    }
    const storedRead = localStorage.getItem(`read_notifs_${user.uid}`);
    const storedArchived = localStorage.getItem(`archived_notifs_${user.uid}`);
    if (storedRead) {
      try {
        setReadNotificationIds(JSON.parse(storedRead));
      } catch (e) {
        console.error(e);
      }
    } else {
      setReadNotificationIds([]);
    }
    if (storedArchived) {
      try {
        setArchivedNotificationIds(JSON.parse(storedArchived));
      } catch (e) {
        console.error(e);
      }
    } else {
      setArchivedNotificationIds([]);
    }
  }, [user]);

  const markNotificationAsRead = (notifId: string) => {
    if (!user) return;
    setReadNotificationIds((prev) => {
      if (prev.includes(notifId)) return prev;
      const updated = [...prev, notifId];
      localStorage.setItem(`read_notifs_${user.uid}`, JSON.stringify(updated));
      return updated;
    });
  };

  const markAllNotificationsAsRead = () => {
    if (!user) return;
    const allIds = notifications.map((n) => n.id);
    setReadNotificationIds(allIds);
    localStorage.setItem(`read_notifs_${user.uid}`, JSON.stringify(allIds));
    triggerToast("Đã đánh dấu tất cả thông báo là đã đọc!", true);
  };

  const archiveNotification = (notifId: string) => {
    if (!user) return;
    setArchivedNotificationIds((prev) => {
      if (prev.includes(notifId)) return prev;
      const updated = [...prev, notifId];
      localStorage.setItem(
        `archived_notifs_${user.uid}`,
        JSON.stringify(updated),
      );
      return updated;
    });
    // Also mark it as read when archiving to keep badges clean
    markNotificationAsRead(notifId);
    triggerToast("Đã ẩn thông báo thành công.");
  };

  // Auto-read notifications when bell is opened
  useEffect(() => {
    if (isNotificationsOpen && user && notifications.length > 0) {
      const visible = notifications.filter(
        (n) => !archivedNotificationIds.includes(n.id),
      );
      const unreadIds = visible
        .map((n) => n.id)
        .filter((id) => !readNotificationIds.includes(id));
      if (unreadIds.length > 0) {
        setReadNotificationIds((prev) => {
          const updated = [...new Set([...prev, ...unreadIds])];
          localStorage.setItem(
            `read_notifs_${user.uid}`,
            JSON.stringify(updated),
          );
          return updated;
        });
      }
    }
  }, [isNotificationsOpen, notifications, user, archivedNotificationIds]);

  const visibleNotifications = notifications.filter(
    (n) => !archivedNotificationIds.includes(n.id),
  );
  const unreadCount = visibleNotifications.filter(
    (n) => !readNotificationIds.includes(n.id),
  ).length;

  const [inputText, setInputText] = useState<string>("");
  const [isCanvasMaximized, setIsCanvasMaximized] = useState<boolean>(false);

  const insertAtCursor = (before: string, after: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selectedText = currentVal.substring(start, end);

    const replacement = before + (selectedText || after) + (selectedText ? after : "");
    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);

    setInputText(newVal);
    
    // Focus and select back
    setTimeout(() => {
      textarea.focus();
      const cursorOffset = start + before.length + (selectedText ? selectedText.length + after.length : 0);
      textarea.setSelectionRange(cursorOffset, cursorOffset);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    const pairs: Record<string, string> = {
      "$": "$",
      "{": "}",
      "[": "]",
      "(": ")",
      '"': '"',
      "'": "'"
    };

    const char = e.key;
    if (pairs[char] !== undefined) {
      e.preventDefault();
      const closeChar = pairs[char];
      
      // If there's selected text, wrap it
      if (start !== end) {
        const selected = value.substring(start, end);
        const newVal = value.substring(0, start) + char + selected + closeChar + value.substring(end);
        setInputText(newVal);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, end + 1);
        }, 0);
      } else {
        // If no selected text, insert both and place cursor in middle
        const newVal = value.substring(0, start) + char + closeChar + value.substring(end);
        setInputText(newVal);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, start + 1);
        }, 0);
      }
    } else if (char === "Backspace" && start === end && start > 0) {
      // If backspace is pressed, and we have a matching pair right around the cursor, delete both!
      const prevChar = value[start - 1];
      const nextChar = value[start];
      if (
        (prevChar === "$" && nextChar === "$") ||
        (prevChar === "{" && nextChar === "}") ||
        (prevChar === "[" && nextChar === "]") ||
        (prevChar === "(" && nextChar === ")") ||
        (prevChar === '"' && nextChar === '"') ||
        (prevChar === "'" && nextChar === "'")
      ) {
        e.preventDefault();
        const newVal = value.substring(0, start - 1) + value.substring(start + 1);
        setInputText(newVal);
        setTimeout(() => {
          textarea.setSelectionRange(start - 1, start - 1);
        }, 0);
      }
    }
  };
  const [showAiCanvas, setShowAiCanvas] = useState<boolean>(false);
  const [aiCanvasPrompt, setAiCanvasPrompt] = useState<string>("");
  const [isProcessingCanvas, setIsProcessingCanvas] = useState<boolean>(false);
  const [smartNewline, setSmartNewline] = useState<boolean>(true);
  const [wordFont, setWordFont] = useState<string>(
    "'Times New Roman', Times, serif",
  );
  const [activeTab, setActiveTab] = useState<"word" | "latex">("word");

  // Clean states for processed HTML and Overleaf document
  const [processedHtml, setProcessedHtml] = useState<string>("");
  const [overleafCode, setOverleafCode] = useState<string>("");

  // Toast for visual feedbacks
  const [toast, setToast] = useState<{
    show: boolean;
    msg: string;
    success: boolean;
  }>({
    show: false,
    msg: "",
    success: true,
  });

  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Note: Selection prevention on Word preview container was removed to allow users to highlight text.
  useEffect(() => {
    // Legacy behavior removed
  }, [processedHtml, activeTab]);

  // --- STATE FOR DOCUMENT BUILDER (v3.4) ---
  const [docQuestions, setDocQuestions] = useState<any[]>([
    {
      id: "sample_1",
      type: "trac_nghiem",
      questionText:
        "Câu 1. Cho hàm số $f(x) = x^3 - 3x^2 + 2$. Tính đạo hàm $f'(x)$ tại điểm $x_0 = 1$.\nA. $f'(1) = 0$\nB. $f'(1) = -3$\nC. $f'(1) = 3$\nD. $f'(1) = -1$",
      columns: 4,
    },
    {
      id: "sample_2",
      type: "tu_luan",
      questionText:
        "Câu 2. Giải phương trình vi phân sau đây:\n$$\\frac{dy}{dx} + 2xy = xe^{-x^2}$$",
      answerText:
        "Nhân hai vế với thừa số tích phân $I(x) = e^{\\int 2x dx} = e^{x^2}$:\n$$e^{x^2}\\frac{dy}{dx} + 2xe^{x^2}y = x \\implies \\frac{d}{dx}\\left(ye^{x^2}\\right) = x$$\nTích phân hai vế ta được:\n$$ye^{x^2} = \\frac{1}{2}x^2 + C \\implies y(x) = \\left(\\frac{1}{2}x^2 + C\\right)e^{-x^2}$$",
    },
  ]);
  const [newQuestionType, setNewQuestionType] = useState<
    "trac_nghiem" | "trac_nghiem_dung_sai" | "trac_nghiem_tra_loi_ngan" | "tu_luan"
  >("trac_nghiem");
  const [tracNghiemText, setTracNghiemText] = useState<string>("");
  const [tracNghiemAnswerText, setTracNghiemAnswerText] = useState<string>("");
  const [newTracNghiemColumns, setNewTracNghiemColumns] = useState<number>(4);
  const [dungSaiText, setDungSaiText] = useState<string>("");
  const [dungSaiAnswerText, setDungSaiAnswerText] = useState<string>("");
  const [traLoiNganText, setTraLoiNganText] = useState<string>("");
  const [traLoiNganAnswerText, setTraLoiNganAnswerText] = useState<string>("");
  const [tuLuanQuestionText, setTuLuanQuestionText] = useState<string>("");
  const [tuLuanAnswerText, setTuLuanAnswerText] = useState<string>("");
  const [showSmartPasteModal, setShowSmartPasteModal] = useState<boolean>(false);
  const [isAIShuffleEnabled, setIsAIShuffleEnabled] = useState<boolean>(false);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [smartPasteText, setSmartPasteText] = useState<string>("");
  const [smartPasteStep, setSmartPasteStep] = useState<1 | 2>(1);
  const [isSmartPasteParsing, setIsSmartPasteParsing] = useState<boolean>(false);
  const [parsedPreviewQuestions, setParsedPreviewQuestions] = useState<any[]>([]);
  const [docTitle, setDocTitle] = useState<string>(
    "ĐỀ KIỂM TRA ĐỊNH KỲ MÔN TOÁN SỐ HỌC & GIẢI TÍCH",
  );
  const [docSubtitle, setDocSubtitle] = useState<string>(
    "Thời gian làm bài: 90 phút (Không kể thời gian phát đề) - Đề số 1",
  );
  const [docHeaderStyle, setDocHeaderStyle] = useState<"centered" | "split">(
    "centered",
  );
  const [docStudentInfoFormat, setDocStudentInfoFormat] = useState<string>(
    `Họ và tên: ....................................................\nLớp: ................... STT: .........`,
  );
  const [docTimeLimit, setDocTimeLimit] = useState<string>(
    "90 phút (Không kể thời gian phát đề)",
  );
  const [docExamCode, setDocExamCode] = useState<string>("101");
  const [docSchoolName, setDocSchoolName] = useState<string>(
    "TRƯỜNG THPT CHUYÊN QUỐC GIA",
  );
  const [docExamName, setDocExamName] = useState<string>(
    "KỲ THI THỬ TỐT NGHIỆP THPT",
  );
  const [docSubjectName, setDocSubjectName] =
    useState<string>("Môn thi: TOÁN HỌC");
  const docPreviewRef = useRef<HTMLDivElement>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [savedQuestionTab, setSavedQuestionTab] = useState<"all" | "trac_nghiem" | "trac_nghiem_dung_sai" | "trac_nghiem_tra_loi_ngan" | "tu_luan">("all");

  const tracNghiemList = docQuestions.filter((q) => q.type === "trac_nghiem");
  const dungSaiList = docQuestions.filter((q) => q.type === "trac_nghiem_dung_sai");
  const traLoiNganList = docQuestions.filter((q) => q.type === "trac_nghiem_tra_loi_ngan");
  const tuLuanList = docQuestions.filter((q) => q.type === "tu_luan");
  
  let sectionIndex = 1;
  const toRoman = (num: number) => {
    switch(num) {
        case 1: return "I";
        case 2: return "II";
        case 3: return "III";
        case 4: return "IV";
        default: return "";
    }
  }

  const labelTracNghiem = tracNghiemList.length > 0 ? `${toRoman(sectionIndex++)}. PHẦN TRẮC NGHIỆM NHIỀU LỰA CHỌN` : "";
  const labelDungSai = dungSaiList.length > 0 ? `${toRoman(sectionIndex++)}. PHẦN TRẮC NGHIỆM ĐÚNG/SAI` : "";
  const labelTraLoiNgan = traLoiNganList.length > 0 ? `${toRoman(sectionIndex++)}. PHẦN TRẮC NGHIỆM TRẢ LỜI NGẮN` : "";
  const labelTuLuan = tuLuanList.length > 0 ? `${toRoman(sectionIndex++)}. PHẦN TỰ LUẬN` : "";

  const handleUpdateQuestionColumns = (id: string, columns: number) => {
    setDocQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, columns } : q)),
    );
  };

  const handleStartEditQuestion = (q: any) => {
    setEditingQuestionId(q.id);
    setNewQuestionType(q.type);

    // Auto strip the "Câu X." pattern for clean insertion into textarea
    const cleanText = getCleanQuestionBody(q.questionText);

    switch (q.type) {
      case "trac_nghiem":
        setTracNghiemText(cleanText);
        setNewTracNghiemColumns(q.columns || 4);
        setTracNghiemAnswerText(q.answerText || "");
        break;
      case "trac_nghiem_dung_sai":
        setDungSaiText(cleanText);
        setDungSaiAnswerText(q.answerText || "");
        break;
      case "trac_nghiem_tra_loi_ngan":
        setTraLoiNganText(cleanText);
        setTraLoiNganAnswerText(q.answerText || "");
        break;
      case "tu_luan":
        setTuLuanQuestionText(cleanText);
        setTuLuanAnswerText(q.answerText || "");
        break;
    }

    // Smooth scroll to input section for immediate focus
    const formSection = document.getElementById("question-input-section");
    if (formSection) {
      formSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    triggerToast("Đã tải câu hỏi vào khung nhập để chỉnh sửa!", true);
  };

  const handleAddQuestion = () => {
    let typeToUse = newQuestionType;
    let questionTextRaw = "";
    let answerTextRaw = "";
    let columns = newTracNghiemColumns;

    switch (typeToUse) {
      case "trac_nghiem":
        questionTextRaw = tracNghiemText;
        answerTextRaw = tracNghiemAnswerText;
        break;
      case "trac_nghiem_dung_sai":
        questionTextRaw = dungSaiText;
        answerTextRaw = dungSaiAnswerText;
        break;
      case "trac_nghiem_tra_loi_ngan":
        questionTextRaw = traLoiNganText;
        answerTextRaw = traLoiNganAnswerText;
        break;
      case "tu_luan":
        questionTextRaw = tuLuanQuestionText;
        answerTextRaw = tuLuanAnswerText;
        break;
    }

    const questionText = getCleanQuestionBody(normalizeInputText(questionTextRaw));
    const answerText = normalizeInputText(answerTextRaw).trim();

    if (!questionText) {
      triggerToast("Nội dung câu hỏi không được để trống!", false);
      return;
    }

    if (editingQuestionId) {
      const idx = docQuestions.findIndex((q) => q.id === editingQuestionId);
      if (idx !== -1) {
        setDocQuestions((prev) => {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            type: typeToUse,
            questionText: questionText,
            answerText: answerText,
            columns: typeToUse === "trac_nghiem" ? columns : undefined,
          };
          return renumberQuestions(next);
        });
        setEditingQuestionId(null);
        triggerToast("Đã cập nhật câu hỏi thành công!", true);
      } else {
        triggerToast("Không tìm thấy câu hỏi để cập nhật!", false);
      }
    } else {
      const newId = "q_" + Date.now();
      setDocQuestions((prev) => {
        const next = [
          ...prev,
          {
            id: newId,
            type: typeToUse,
            questionText: questionText,
            answerText: answerText,
            columns: typeToUse === "trac_nghiem" ? columns : undefined,
          },
        ];
        return renumberQuestions(next);
      });
      triggerToast("Đã thêm câu hỏi thành công!", true);
    }

    // Clear inputs
    switch (typeToUse) {
      case "trac_nghiem":
        setTracNghiemText("");
        setTracNghiemAnswerText("");
        setNewTracNghiemColumns(4);
        break;
      case "trac_nghiem_dung_sai":
        setDungSaiText("");
        setDungSaiAnswerText("");
        break;
      case "trac_nghiem_tra_loi_ngan":
        setTraLoiNganText("");
        setTraLoiNganAnswerText("");
        break;
      case "tu_luan":
        setTuLuanQuestionText("");
        setTuLuanAnswerText("");
        break;
    }
  };

  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === docQuestions.length - 1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    setDocQuestions((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIdx];
      updated[targetIdx] = temp;

      // Update prefixes to reflect new positions by type
      let tnCount = 0;
      let tlCount = 0;
      return updated.map((q) => {
        const cleanContent = getCleanQuestionBody(q.questionText);
        if (q.type === "trac_nghiem") {
          tnCount++;
          return {
            ...q,
            questionText: `Câu ${tnCount}. ` + cleanContent,
          };
        } else {
          tlCount++;
          return {
            ...q,
            questionText: `Câu ${tlCount}. ` + cleanContent,
          };
        }
      });
    });
  };

  const handleDeleteQuestion = (id: string) => {
    setDocQuestions((prev) => {
      const filtered = prev.filter((q) => q.id !== id);
      // Re-index remaining questions by type
      let tnCount = 0;
      let tlCount = 0;
      return filtered.map((q) => {
        const cleanContent = getCleanQuestionBody(q.questionText);
        if (q.type === "trac_nghiem") {
          tnCount++;
          return {
            ...q,
            questionText: `Câu ${tnCount}. ` + cleanContent,
          };
        } else {
          tlCount++;
          return {
            ...q,
            questionText: `Câu ${tlCount}. ` + cleanContent,
          };
        }
      });
    });
    if (editingQuestionId === id) {
      setEditingQuestionId(null);
      setTracNghiemText("");
      setTracNghiemAnswerText("");
      setDungSaiText("");
      setDungSaiAnswerText("");
      setTraLoiNganText("");
      setTraLoiNganAnswerText("");
      setTuLuanQuestionText("");
      setTuLuanAnswerText("");
    }
    triggerToast("Đã xóa câu hỏi.");
  };

  const detectQuestionTypeFromBlockContent = (
    qText: string,
    fallbackType: "trac_nghiem" | "trac_nghiem_dung_sai" | "trac_nghiem_tra_loi_ngan" | "tu_luan"
  ): "trac_nghiem" | "trac_nghiem_dung_sai" | "trac_nghiem_tra_loi_ngan" | "tu_luan" => {
    const cleanText = qText.trim().toLowerCase();
    
    // Check for A., B., C., D. options (for Multiple Choice)
    const hasA = /^[A-D][.\s\)-]/m.test(qText) || /(?:\s|^|\n)A[.\s\)-]/m.test(qText) || /a\.\s/i.test(qText);
    const hasB = /^[A-D][.\s\)-]/m.test(qText) || /(?:\s|^|\n)B[.\s\)-]/m.test(qText) || /b\.\s/i.test(qText);
    const hasC = /^[A-D][.\s\)-]/m.test(qText) || /(?:\s|^|\n)C[.\s\)-]/m.test(qText) || /c\.\s/i.test(qText);
    const hasD = /^[A-D][.\s\)-]/m.test(qText) || /(?:\s|^|\n)D[.\s\)-]/m.test(qText) || /d\.\s/i.test(qText);
    
    // If we have at least A, B, C, D options, it's definitely trac_nghiem
    if (hasA && hasB && hasC && hasD) {
      return "trac_nghiem";
    }

    // Check for True/False (đúng sai): a) Đúng. b) Sai.
    const hasDungSaiKeywords = cleanText.includes("đúng sai") || cleanText.includes("đúng/sai") || cleanText.includes("đúng hay sai") || cleanText.includes("mệnh đề sau");
    const hasDungSaiOptions = /^[a-d][\s.\)\-]*\s*(?:đúng|sai)\b/mi.test(cleanText) || /[\s\n][a-d][\s.\)\-]*\s*(?:đúng|sai)\b/mi.test(cleanText);
    if (hasDungSaiKeywords || hasDungSaiOptions) {
      return "trac_nghiem_dung_sai";
    }

    // Check for short answer keywords
    const hasShortAnswerKeywords = cleanText.includes("trả lời ngắn") || cleanText.includes("đáp số") || cleanText.includes("điền vào");
    if (hasShortAnswerKeywords) {
      return "trac_nghiem_tra_loi_ngan";
    }

    // If fallback is not tu_luan, we can respect fallback if it's not a clear essay
    // But we should double check if fallback is trac_nghiem and we didn't find ABCD options, then maybe it's actually tu_luan
    if (fallbackType === "trac_nghiem" && (!hasA || !hasB)) {
      return "tu_luan";
    }

    return fallbackType;
  };

  const processMultipleQuestionsText = (text: string) => {
    if (!text) return;

    // 1. Chuẩn hoá văn bản đầu vào chuẩn Unicode & Dấu câu giống hệt LaTeX Converter
    let normalizedInput = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/^\uFEFF/, "")
      .normalize("NFC")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2013/g, "--")
      .replace(/\u2014/g, "---")
      .replace(/\u2026/g, "...")
      .replace(/\u00A0/g, " ")
      .replace(/\u200B/g, "")
      .replace(/\u200C/g, "");

    // 2. Tự động chuyển đổi tab thành bảng Markdown
    let convertedText = convertTabTableToMarkdown(normalizedInput);

    // 3. Áp dụng thuật toán Định dạng thông minh chuẩn (bao gồm xử lý dính chữ, dính số, dính ngoặc...) của LaTeX Converter
    let formattedText = applySmartFormatting(convertedText);

    // Fix logic bugs in markdown
    const fixMarkdown = (t: string) => {
      let result = t.replace(/(^|[ \t])\*[ \t]+\*(.*?)\*\*/g, '$1**$2**');
      result = result.replace(/\*[ \t]+\*\*/g, '***');
      result = result.replace(/\*\*[ \t]+\*/g, '***');
      result = result.replace(/^#[ \t]+#/gm, '##');
      result = result.replace(/\*[ \t]+\*(.*?)\*[ \t]+\*/g, '**$1**');
      return result;
    };

    const fixedText = fixMarkdown(formattedText);
    const lines = fixedText.split('\n');
    
    let blocks: {text: string, typeContext: "trac_nghiem" | "trac_nghiem_dung_sai" | "trac_nghiem_tra_loi_ngan" | "tu_luan"}[] = [];
    let currentBlock = "";
    let currentTypeContext = newQuestionType;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineTrimmed = line.trim();
        const lowerLine = lineTrimmed.toLowerCase();
        
        // Nhận diện câu hỏi an toàn: Tránh các dòng trống, lệnh LaTeX (\begin, \section), hoặc dòng bảng biểu (|)
        const isTableLine = lineTrimmed.startsWith("|");
        const isLaTeXCommand = lineTrimmed.startsWith("\\");
        
        const isNewQuestion = !isTableLine && !isLaTeXCommand && /^(?:[\-\*•\+]\s*)?(?:\*\s*\*|\*\*|\*)?\s*(?:Câu|Bài)\s*(?:hỏi)?\s*(?:\d+)?\s*(?:[:.\-|\*]|$)/i.test(lineTrimmed);
        const isNewSection = /^Phần\s+\d+/i.test(lineTrimmed);

        if (isNewQuestion || isNewSection) {
            if (currentBlock.trim()) blocks.push({ text: currentBlock, typeContext: currentTypeContext });
            
            if (isNewSection) {
                currentBlock = "";
            } else {
                currentBlock = line + '\n';
            }
        } else {
            currentBlock += line + '\n';
        }
    }
    if (currentBlock.trim()) blocks.push({ text: currentBlock, typeContext: currentTypeContext });
    
    blocks = blocks.filter(b => /^(?:[\-\*•\+]\s*)?(?:\*\s*\*|\*\*|\*)?\s*(?:Câu|Bài)/i.test(b.text.trim()));
    
    if (blocks.length === 0) {
        blocks.push({ text: fixedText, typeContext: currentTypeContext });
    }
    
    const parsedQuestions = blocks.map(blockObj => {
        const block = blockObj.text;
        let qLines: string[] = [];
        let aLines: string[] = [];
        let isAnswer = false;
        
        const blockLines = block.split('\n');
        for (let i = 0; i < blockLines.length; i++) {
            const lower = blockLines[i].toLowerCase().trim();
            const plain = lower.replace(/\*/g, '').trim();
            
            if (
                plain.startsWith('đáp án:') || 
                plain.startsWith('đáp án') || 
                plain.startsWith('hướng dẫn giải') || 
                plain.startsWith('lời giải') || 
                plain.startsWith('giải thích') ||
                plain.match(/^--+$/)
            ) {
                isAnswer = true;
            }
            
            if (isAnswer) {
                aLines.push(blockLines[i]);
            } else {
                qLines.push(blockLines[i]);
            }
        }
        
        const questionContent = qLines.join('\n').trim();
        const detectedType = detectQuestionTypeFromBlockContent(questionContent, blockObj.typeContext);
        
        return {
           type: detectedType,
           q: questionContent,
           a: aLines.join('\n').trim()
        };
    });
    
    if (parsedQuestions.length > 0) {
        setDocQuestions((prev) => {
          const updated = [...prev];
          
          parsedQuestions.forEach(item => {
              updated.push({
                  id: "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
                  type: item.type,
                  questionText: getCleanQuestionBody(item.q),
                  columns: item.type === "trac_nghiem" ? newTracNghiemColumns : undefined,
                  answerText: getCleanAnswerBody(item.a),
              });
          });
          
          // Re-number them properly
          return renumberQuestions(updated);
        });
        
        triggerToast(`Đã tự động phân tách và thêm ${parsedQuestions.length} câu hỏi vào đề thi!`, true);
    }
  };

  const handleSmartPasteProcess = async () => {
    if (!smartPasteText.trim()) {
      triggerToast("Nội dung dán không được để trống!", false);
      return;
    }
    const currentPromptCount = userDoc?.promptCount || 0;
    if (!isApproved && currentPromptCount >= 10) {
      triggerToast(
        "Bạn đã tới giới hạn tính năng dán thông minh (AI). Hãy liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
        false,
      );
      return;
    }

    if (smartPasteStep === 1) {
      setIsSmartPasteParsing(true);
      try {
        const response = await fetch("/api/ai?action=smart-paste-parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: smartPasteText }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Lỗi xử lý dán thông minh bằng AI");
        }

        const data = await response.json();
        if (data.success && data.questions && data.questions.length > 0) {
          logApiUsage("Dán AI");
          const previewList = data.questions.map((q: any) => ({
            id: q.id || "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
            type: q.type || "trac_nghiem",
            questionText: getCleanQuestionBody(q.questionRawText || ""),
            answerText: getCleanAnswerBody(q.answerRawText || ""),
            columns: q.type === "trac_nghiem" ? newTracNghiemColumns : undefined,
          }));
          setParsedPreviewQuestions(previewList);
          setSmartPasteStep(2);
          triggerToast("Đã phân tách thông minh bằng AI thành công! Hãy xem trước kết quả.", true);
        } else {
          // Fallback to client-side heuristic parser
          const previewList = parseMultipleQuestionsTextToPreview(smartPasteText);
          if (previewList.length === 0) {
            triggerToast("Không nhận diện được câu hỏi nào. Vui lòng kiểm tra lại định dạng!", false);
            return;
          }
          setParsedPreviewQuestions(previewList);
          setSmartPasteStep(2);
          triggerToast("Đã phân tách thành công (sử dụng thuật toán dự phòng)!", true);
        }
      } catch (error: any) {
        console.error("Lỗi dán thông minh AI:", error);
        // Fallback to client-side heuristic parser
        const previewList = parseMultipleQuestionsTextToPreview(smartPasteText);
        if (previewList.length === 0) {
          triggerToast("Không thể phân tách nội dung. Vui lòng kiểm tra lại định dạng!", false);
          return;
        }
        setParsedPreviewQuestions(previewList);
        setSmartPasteStep(2);
        triggerToast("Đã phân tách thành công (sử dụng thuật toán dự phòng do lỗi kết nối AI)!", true);
      } finally {
        setIsSmartPasteParsing(false);
      }
    } else {
      if (parsedPreviewQuestions.length === 0) {
        triggerToast("Không có câu hỏi nào để nhập!", false);
        return;
      }
      setDocQuestions((prev) => {
        const updated = [...prev, ...parsedPreviewQuestions];
        return renumberQuestions(updated);
      });
      incrementPromptCount();
      triggerToast(`Đã tự động thêm ${parsedPreviewQuestions.length} câu hỏi vào đề thi!`, true);
      
      // Reset state and close modal
      setSmartPasteText("");
      setParsedPreviewQuestions([]);
      setSmartPasteStep(1);
      setShowSmartPasteModal(false);
    }
  };

  const closeSmartPasteModal = () => {
    setShowSmartPasteModal(false);
    setSmartPasteStep(1);
    setParsedPreviewQuestions([]);
  };

  const handleShuffleExam = async () => {
    if (docQuestions.length === 0) {
      triggerToast("Không có câu hỏi nào để trộn đề thi!", false);
      return;
    }

    setIsShuffling(true);
    try {
      // 1. Shuffle order first
      const shuffled = [...docQuestions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      if (isAIShuffleEnabled) {
        const currentPromptCount = userDoc?.promptCount || 0;
        if (!isApproved && currentPromptCount >= 10) {
          triggerToast(
            "Bạn đã tới giới hạn tính năng AI thay thế số liệu. Hãy liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
            false
          );
          setIsShuffling(false);
          return;
        }

        // Send to backend for AI variation
        const response = await fetch("/api/ai?action=shuffle-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questions: shuffled.map(q => ({
              id: q.id,
              type: q.type,
              questionText: q.questionText
            }))
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Lỗi máy chủ khi đảo số liệu");
        }

        const data = await response.json();
        if (data.success && Array.isArray(data.questions)) {
          logApiUsage("AI thay thế số liệu");
          const updated = shuffled.map(q => {
            const aiQ = data.questions.find((item: any) => item.id === q.id);
            return {
              ...q,
              questionText: aiQ ? aiQ.questionText : q.questionText,
              answerText: "" // Ensure all answers are deleted
            };
          });
          const renumbered = renumberQuestions(updated);
          setDocQuestions(renumbered);
          await incrementPromptCount();
          triggerToast("Đã đảo thứ tự câu và thay số bằng AI thành công!", true);
        } else {
          throw new Error("Không nhận được dữ liệu hợp lệ từ AI");
        }
      } else {
        const updated = shuffled.map(q => ({
          ...q,
          answerText: "" // Ensure all answers are deleted
        }));
        const renumbered = renumberQuestions(updated);
        setDocQuestions(renumbered);
        triggerToast("Đã đảo thứ tự câu hỏi và ẩn đáp án thành công!", true);
      }
    } catch (error: any) {
      console.error(error);
      triggerToast(`Có lỗi xảy ra: ${error.message || "Không thể trộn đề"}`, false);
    } finally {
      setIsShuffling(false);
    }
  };

  const copyDocToWord = async () => {
    if (docQuestions.length === 0) {
      triggerToast("Không có nội dung để sao chép cho Word!", false);
      return;
    }

    const currentExamCount = userDoc?.examCount || 0;
    if (!isApproved && currentExamCount >= 5) {
      triggerToast(
        "Bạn đã đạt giới hạn tính năng tạo tài liệu đề thi trong ngày (tối đa 5 lượt/ngày). Vui lòng liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
        false,
      );
      return;
    }

    if (!docPreviewRef.current) return;

    const clone = docPreviewRef.current.cloneNode(true) as HTMLDivElement;
    injectMathML(clone);
    injectInlineStyles(clone);

    const bodyHtml = clone.innerHTML;

    const wordDoc = `<html>
    <head>
    <meta charset="UTF-8">
    <meta name="ProgId" content="Word.Document">
    <style>
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: ${wordFont};
            font-size: 13pt;
            line-height: 1.15;
            color: #000000;
            margin: 0;
        }
        h1, h2, h3, h4, h5, h6, h1, h2, h3, h4, h5, h6, p, li, span, select, tr, td, th {
            font-family: ${wordFont} !important;
            font-size: 13pt !important;
            line-height: 1.15 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
        }
        div, table {
            font-family: ${wordFont} !important;
            font-size: 13pt !important;
            line-height: 1.15 !important;
        }
        div.doc-display-math {
            margin-top: 6pt !important;
            margin-bottom: 6pt !important;
            text-align: center !important;
        }
        table.doc-answer-table {
            margin-top: 16pt !important;
            margin-bottom: 12pt !important;
            border: 1px solid #10b981 !important;
            background-color: #ecfdf5 !important;
        }
        table.doc-answer-table th, table.doc-answer-table td {
            border: none !important;
            padding: 10pt !important;
        }
        table.doc-options-table, table.doc-options-table th, table.doc-options-table td {
            border: none !important;
        }
        table.doc-header-table, table.doc-header-table th, table.doc-header-table td {
            border: none !important;
        }
        table.doc-question-table, table.doc-question-table tr, table.doc-question-table td {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: none !important;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 12pt !important;
            margin-bottom: 12pt !important;
        }
        table th, table td {
            border: 1px solid #475569 !important;
            padding: 6px !important;
        }
        table th {
            font-weight: bold !important;
            background-color: transparent !important;
        }
    </style>
    </head>
    <body>
    ${bodyHtml}
    </body>
    </html>`;

    const tempDiv = document.createElement("div");
    tempDiv.contentEditable = "true";
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.innerHTML = bodyHtml;
    document.body.appendChild(tempDiv);

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    selection.removeAllRanges();
    selection.addRange(range);

    const copyListener = (e: ClipboardEvent) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData("text/html", wordDoc);
        e.clipboardData.setData(
          "text/plain",
          docPreviewRef.current?.innerText || "",
        );
      }
    };

    document.addEventListener("copy", copyListener);
    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (err) {
      console.error(err);
    }
    document.removeEventListener("copy", copyListener);

    selection.removeAllRanges();
    document.body.removeChild(tempDiv);

    if (success) {
      triggerToast("Đã sao chép tài liệu! Hãy mở Word và nhấn Ctrl+V.");
      await incrementExamCount();
    } else {
      triggerToast(
        "Sao chép lỗi. Vui lòng tự bôi đen ở căn lề xem trước để copy.",
        false,
      );
    }
  };

  const downloadDocAsWord = async () => {
    if (docQuestions.length === 0) {
      triggerToast("Không có nội dung để tải về!", false);
      return;
    }

    const currentExamCount = userDoc?.examCount || 0;
    if (!isApproved && currentExamCount >= 5) {
      triggerToast(
        "Bạn đã đạt giới hạn tính năng tạo tài liệu đề thi trong ngày (tối đa 5 lượt/ngày). Vui lòng liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
        false,
      );
      return;
    }

    if (!docPreviewRef.current) return;

    const clone = docPreviewRef.current.cloneNode(true) as HTMLDivElement;
    injectMathML(clone);
    injectInlineStyles(clone);

    const bodyHtml = clone.innerHTML;

    const wordDoc = `<html>
    <head>
    <meta charset="UTF-8">
    <meta name="ProgId" content="Word.Document">
    <style>
        @page {
            size: A4;
            margin: 2.5cm;
        }
        body {
            font-family: ${wordFont};
            font-size: 13pt;
            line-height: 1.5;
            color: #000000;
            margin: 0;
        }
        p {
            font-family: ${wordFont} !important;
            font-size: 13pt !important;
            line-height: 1.5 !important;
            margin-top: 6pt !important;
            margin-bottom: 6pt !important;
        }
        li, span, select, tr, td, th {
            font-family: ${wordFont} !important;
            font-size: 13pt !important;
            line-height: 1.2 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
        }
        div, table {
            font-family: ${wordFont} !important;
            font-size: 13pt !important;
            line-height: 1.15 !important;
        }
        div.doc-display-math {
            margin-top: 6pt !important;
            margin-bottom: 6pt !important;
            text-align: center !important;
        }
        table.doc-answer-table {
            margin-top: 16pt !important;
            margin-bottom: 12pt !important;
            border: 1px solid #10b981 !important;
            background-color: #ecfdf5 !important;
        }
        table.doc-answer-table th, table.doc-answer-table td {
            border: none !important;
            padding: 10pt !important;
        }
        table.doc-options-table, table.doc-options-table th, table.doc-options-table td {
            border: none !important;
        }
        table.doc-header-table, table.doc-header-table th, table.doc-header-table td {
            border: none !important;
        }
        table.doc-question-table, table.doc-question-table tr, table.doc-question-table td {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: none !important;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 12pt !important;
            margin-bottom: 12pt !important;
        }
        table th, table td {
            border: 1px solid #475569 !important;
            padding: 6px !important;
        }
        table th {
            font-weight: bold !important;
            background-color: transparent !important;
        }
    </style>
    </head>
    <body>
    ${bodyHtml}
    </body>
    </html>`;

    const blob = new Blob(["\ufeff" + wordDoc], {
      type: "application/msword;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Tai_Lieu_Tu_Luan_Trac_Nghiem.doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast("Đã tạo và tải file Word (.doc) thành công!");
    await incrementExamCount();
  };

  const normalizeInputText = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/^\uFEFF/, "")
      .normalize("NFC")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2013/g, "--")
      .replace(/\u2014/g, "---")
      .replace(/\u2026/g, "...")
      .replace(/\u00A0/g, " ")
      .replace(/\u200B/g, "")
      .replace(/\u200C/g, "");
  };

  const mergeAdjacentBoldBlocks = (text: string): string => {
    if (!text) return "";
    let merged = text;
    let previous;
    do {
      previous = merged;
      // Merge '**A** <math> **B**' into '**A <math> B**'
      merged = merged.replace(/\*\*(.*?)\*\*([ \t]*)(\$[^\$]+\$|\\\(.*?\\\))([ \t]*)\*\*(.*?)\*\*/g, '**$1$2$3$4$5**');
    } while (merged !== previous);
    return merged;
  };

  const getCleanQuestionBody = (text: string): string => {
    if (!text) return "";
    let clean = mergeAdjacentBoldBlocks(normalizeInputText(text)).trim();
    
    // Clean any leading list bullets or punctuation that appear before the question prefix
    const qMatch = clean.match(/(?:Câu|Bài)\s*(?:\d+|[IVXLCDM]+)\b/i);
    if (qMatch && qMatch.index !== undefined) {
      const idx = qMatch.index;
      const prefix = clean.substring(0, idx);
      // count number of * in prefix
      const starCount = (prefix.match(/\*/g) || []).length;
      // If there are stars, we want to keep them.
      const newPrefix = "*".repeat(starCount);
      clean = newPrefix + clean.substring(idx);
    } else {
      let preCleaned = true;
      while (preCleaned) {
        preCleaned = false;
        if (clean.startsWith("**") && !clean.startsWith("***")) {
          // It starts with a bold indicator, so don't strip
          break;
        }
        
        const firstChar = clean[0];
        if (firstChar && "-+•–—o*›»■▪●:.~>".includes(firstChar)) {
          if (firstChar === "*") {
            if (/^\*\s+/.test(clean)) {
              clean = clean.substring(1).trim();
              preCleaned = true;
            }
          } else {
            clean = clean.substring(1).trim();
            preCleaned = true;
          }
        }
      }
    }
    
    let changed = true;
    while (changed) {
      changed = false;
      
      // Pattern 1: Bold prefix like **Câu 1:** or **Câu 1.** or **Câu 1**
      const boldPrefixRegex = /^\s*\*\*\s*(?:Câu|Bài)\s*\d+\s*[:.\-]*\s*\*\*\s*(?:\s*\d+\s*[:.\-]\s*)?/i;
      if (boldPrefixRegex.test(clean)) {
        clean = clean.replace(boldPrefixRegex, "").trim();
        changed = true;
        continue;
      }
      
      // Pattern 2: Normal prefix like Câu 1: or Câu 1. or Câu 1 - or Bài 1: or Câu 1: 1.
      const normalPrefixRegex = /^\s*(?:Câu|Bài)\s*\d+\s*[:.\-]*\s*(?:\s*\d+\s*[:.\-]\s*)?/i;
      if (normalPrefixRegex.test(clean)) {
        clean = clean.replace(normalPrefixRegex, "").trim();
        changed = true;
        continue;
      }
      
      // Pattern 3: Number prefix like 1. or 1: or 1-
      const numberPrefixRegex = /^\s*\d+\s*[:.\-]\s*/;
      if (numberPrefixRegex.test(clean)) {
        clean = clean.replace(numberPrefixRegex, "").trim();
        changed = true;
        continue;
      }
      
      // Pattern 4: Bold sentence starting with Câu X: inside bold, e.g. **Câu 1: Tìm cực đại**
      const boldSentencePrefixRegex = /^\s*\*\*\s*(?:Câu|Bài)\s*\d+\s*[:.\-]\s*/i;
      if (boldSentencePrefixRegex.test(clean)) {
        clean = clean.replace(/^\s*\*\*\s*(?:Câu|Bài)\s*\d+\s*[:.\-]\s*/i, "**").trim();
        changed = true;
        continue;
      }
      
      // Pattern 5: Bold sentence starting with number prefix inside bold, e.g. **1. Tìm cực đại**
      const boldNumberPrefixRegex = /^\s*\*\*\s*\d+\s*[:.\-]\s*/i;
      if (boldNumberPrefixRegex.test(clean)) {
        clean = clean.replace(/^\s*\*\*\s*\d+\s*[:.\-]\s*/i, "**").trim();
        changed = true;
        continue;
      }
    }
    
    clean = clean.replace(/^\s*\*\*\s*\*\*\s*/, "").trim();
    return clean;
  };

  const getCleanAnswerBody = (text: string): string => {
    return text ? text.trim() : "";
  };

  const hasQuestionPrefix = (text: string): boolean => {
    if (!text) return false;
    return /^\s*(?:[\-\*•\+]\s*)?(?:\**|\*)\s*(?:Câu|Bài)\s*\d+/i.test(text.trim());
  };

  const parseMultipleQuestionsTextToPreview = (text: string): any[] => {
    if (!text) return [];

    let normalizedInput = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/^\uFEFF/, "")
      .normalize("NFC")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2013/g, "--")
      .replace(/\u2014/g, "---")
      .replace(/\u2026/g, "...")
      .replace(/\u00A0/g, " ")
      .replace(/\u200B/g, "")
      .replace(/\u200C/g, "");

    let convertedText = convertTabTableToMarkdown(normalizedInput);
    let formattedText = applySmartFormatting(convertedText);

    const fixMarkdown = (t: string) => {
      let result = t.replace(/(^|[ \t])\*[ \t]+\*(.*?)\*\*/g, '$1**$2**');
      result = result.replace(/\*[ \t]+\*\*/g, '***');
      result = result.replace(/\*\*[ \t]+\*/g, '***');
      result = result.replace(/^#[ \t]+#/gm, '##');
      result = result.replace(/\*[ \t]+\*(.*?)\*[ \t]+\*/g, '**$1**');
      return result;
    };

    const fixedText = fixMarkdown(formattedText);
    const lines = fixedText.split('\n');
    
    let blocks: {text: string, typeContext: "trac_nghiem" | "trac_nghiem_dung_sai" | "trac_nghiem_tra_loi_ngan" | "tu_luan"}[] = [];
    let currentBlock = "";
    let currentTypeContext = newQuestionType;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineTrimmed = line.trim();
        const lowerLine = lineTrimmed.toLowerCase();
        
        const isTableLine = lineTrimmed.startsWith("|");
        const isLaTeXCommand = lineTrimmed.startsWith("\\");
        
        const isNewQuestion = !isTableLine && !isLaTeXCommand && /^(?:[\-\*•\+]\s*)?(?:\*\s*\*|\*\*|\*)?\s*(?:Câu|Bài)\s*(?:hỏi)?\s*(?:\d+)?\s*(?:[:.\-|\*]|$)/i.test(lineTrimmed);
        const isNewSection = /^Phần\s+\d+/i.test(lineTrimmed);

        if (isNewQuestion || isNewSection) {
            if (currentBlock.trim()) blocks.push({ text: currentBlock, typeContext: currentTypeContext });
            
            if (isNewSection) {
                currentBlock = "";
            } else {
                currentBlock = line + '\n';
            }
        } else {
            currentBlock += line + '\n';
        }
    }
    if (currentBlock.trim()) blocks.push({ text: currentBlock, typeContext: currentTypeContext });
    
    blocks = blocks.filter(b => /^(?:[\-\*•\+]\s*)?(?:\*\s*\*|\*\*|\*)?\s*(?:Câu|Bài)/i.test(b.text.trim()));
    
    if (blocks.length === 0) {
        blocks.push({ text: fixedText, typeContext: currentTypeContext });
    }
    
    const parsedQuestions = blocks.map(blockObj => {
        const block = blockObj.text;
        let qLines: string[] = [];
        let aLines: string[] = [];
        let isAnswer = false;
        
        const blockLines = block.split('\n');
        for (let i = 0; i < blockLines.length; i++) {
            const lower = blockLines[i].toLowerCase().trim();
            const plain = lower.replace(/\*/g, '').trim();
            
            if (
                plain.startsWith('đáp án:') || 
                plain.startsWith('đáp án') || 
                plain.startsWith('hướng dẫn giải') || 
                plain.startsWith('lời giải') || 
                plain.startsWith('giải thích') ||
                plain.match(/^--+$/)
            ) {
                isAnswer = true;
            }
            
            if (isAnswer) {
                aLines.push(blockLines[i]);
            } else {
                qLines.push(blockLines[i]);
            }
        }
        
        const questionContent = qLines.join('\n').trim();
        const detectedType = detectQuestionTypeFromBlockContent(questionContent, blockObj.typeContext);
        
        return {
           type: detectedType,
           q: questionContent,
           a: aLines.join('\n').trim()
        };
    });
    
    return parsedQuestions.map(item => ({
        id: "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        type: item.type,
        questionText: getCleanQuestionBody(item.q),
        columns: item.type === "trac_nghiem" ? newTracNghiemColumns : undefined,
        answerText: getCleanAnswerBody(item.a),
    }));
  };

  const renumberQuestions = (questions: any[]) => {
    let counts: Record<string, number> = {
      trac_nghiem: 0,
      trac_nghiem_dung_sai: 0,
      trac_nghiem_tra_loi_ngan: 0,
      tu_luan: 0
    };
    return questions.map((q) => {
      counts[q.type] = (counts[q.type] || 0) + 1;
      const currentNum = counts[q.type];
      const text = q.questionText || "";
      
      const prefixRegex = /^(\s*(?:[\-\*•\+]\s*)?)(\**|\*)\s*(Câu|Bài)\s*(\d+)\s*([:.\-]*\s*(?:\**|\*)\s*[:.\-]*|[:.\-]*)/i;
      
      if (prefixRegex.test(text)) {
        const newText = text.replace(prefixRegex, (match, bullet, starsBefore, word, num, after) => {
          return `${bullet || ""}${starsBefore || ""}${word} ${currentNum}${after || ""}`;
        });
        return { ...q, questionText: newText };
      } else {
        return { ...q, questionText: `Câu ${currentNum}. ` + text };
      }
    });
  };

  const convertTabTableToMarkdown = (text: string): string => {
    if (!text) return "";
    const lines = text.split("\n");
    const result: string[] = [];
    let inTable = false;
    let tableRows: string[][] = [];

    const renderCurrentTable = (rows: string[][]): string => {
      if (rows.length === 0) return "";
      const maxCols = Math.max(...rows.map((r) => r.length));
      if (maxCols < 2) {
        // If it has only 1 column, it is not a real table, return as plain text lines
        return rows.map((r) => r.join(" ")).join("\n");
      }

      const header = rows[0].map((c) => c || " ");
      while (header.length < maxCols) header.push(" ");

      const separator = Array(maxCols).fill("---");

      let md = "\n| " + header.join(" | ") + " |\n";
      md += "| " + separator.join(" | ") + " |\n";

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i].map((c) => c || " ");
        while (row.length < maxCols) row.push(" ");
        md += "| " + row.join(" | ") + " |\n";
      }
      md += "\n";
      return md;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hasTabs = line.includes("\t");

      if (hasTabs) {
        inTable = true;
        const cols = line.split("\t").map((c) => c.trim());
        tableRows.push(cols);
      } else {
        if (inTable && tableRows.length > 0) {
          result.push(renderCurrentTable(tableRows));
          tableRows = [];
          inTable = false;
        }
        result.push(line);
      }
    }

    if (inTable && tableRows.length > 0) {
      result.push(renderCurrentTable(tableRows));
    }

    return result.join("\n");
  };

  const renderContentWithMath = (text: string): string => {
    if (!text) return "";

    // Bước 1: Normalize input (NFC, loại bỏ BOM, chuẩn hoá smart quotes)
    let normalizedInput = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/^\uFEFF/, "")
      .normalize("NFC")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2013/g, "--")
      .replace(/\u2014/g, "---")
      .replace(/\u2026/g, "...")
      .replace(/\u00A0/g, " ")
      .replace(/\u200B/g, "")
      .replace(/\u200C/g, "");

    // Auto convert tab-separated values pasted from Word/Excel to markdown tables
    let convertedText = convertTabTableToMarkdown(normalizedInput);

    // Protect URLs from being mangled or broken by applySmartFormatting or KaTeX parsing
    const { protectedText, urls } = protectUrls(convertedText);
    let input = protectedText;

    const codeRanges: [number, number][] = [];
    const CODE_BLOCK_REGEX = /```[\s\S]*?```|`[^`\n]+`/g;
    let codeMatch;
    CODE_BLOCK_REGEX.lastIndex = 0;
    while ((codeMatch = CODE_BLOCK_REGEX.exec(input)) !== null) {
      codeRanges.push([codeMatch.index, codeMatch.index + codeMatch[0].length]);
    }

    const DISPLAY_MATH_REGEX =
       "\\$\\$([\\s\\S]*?)\\$\\$|\\\\\\[([\\s\\S]*?)\\\\\\]|\\\\begin\\{(equation|align|gather|multline|eqnarray|alignat|flalign|split|cases|aligned|alignedat|pmatrix|bmatrix|vmatrix|Bmatrix|Vmatrix|matrix|array)(\\*?)\\}([\\s\\S]*?)\\\\end\\{(?:equation|align|gather|multline|eqnarray|alignat|flalign|split|cases|aligned|alignedat|pmatrix|bmatrix|vmatrix|Bmatrix|Vmatrix|matrix|array)\\*?\\}";
    const INLINE_MATH_REGEX =
      "(?<!\\$)\\$(?!\\$)((?:[^$\\n\\\\]|\\\\[\\s\\S])*?)(?<!\\$)\\$(?!\\$)";
    const INLINE_PAREN_REGEX = "\\\\\\([\\s\\S]*?\\\\\\)";

    const MATH_COMBINED_RE = new RegExp(
      `${DISPLAY_MATH_REGEX}|${INLINE_PAREN_REGEX}|${INLINE_MATH_REGEX}`,
      "g",
    );

    const mathBlocks: string[] = [];
    let mdText = "";
    let lastIdx = 0;
    let m;

    MATH_COMBINED_RE.lastIndex = 0;
    while ((m = MATH_COMBINED_RE.exec(input)) !== null) {
      const isInsideCode = codeRanges.some(
        ([start, end]) => m!.index >= start && m!.index < end,
      );

      if (isInsideCode) {
        if (m.index > lastIdx) {
          mdText += input.slice(lastIdx, m.index + m[0].length);
        } else if (m.index === lastIdx) {
          mdText += m[0];
        }
        lastIdx = m.index + m[0].length;
        continue;
      }

      if (m.index > lastIdx) {
        mdText += input.slice(lastIdx, m.index);
      }

      const raw = m[0];
      const isDisplay =
        raw.startsWith("$$") ||
        raw.startsWith("\\[") ||
        raw.startsWith("\\begin");
      let latex = "";

      if (raw.startsWith("$$")) latex = raw.slice(2, -2);
      else if (raw.startsWith("\\[")) latex = raw.slice(2, -2);
      else if (raw.startsWith("\\(")) latex = raw.slice(2, -2);
      else if (raw.startsWith("\\begin"))
        latex = raw; // KaTeX cần toàn bộ thẻ \begin...\end
      else latex = raw.slice(1, -1);

      // Nếu không phải là block math và là inline math bọc bởi dấu '$' đơn
      // đồng thời nội dung bên trong KHÔNG PHẢI là một công thức toán thực sự (ví dụ: chỉ là số 10, 20%, ngày tháng, bài toán...)
      if (!isDisplay && raw.startsWith("$") && !isRealMathLaTeX(latex)) {
        mdText += "$";
        MATH_COMBINED_RE.lastIndex = m.index + 1;
        lastIdx = m.index + 1;
        continue;
      }

      let mathHtml = "";
      try {
        let normalized = normalizeLaTeX
          ? normalizeLaTeX(latex.trim(), !isDisplay)
          : latex.trim();
        normalized = restoreUrls(normalized, urls, true);
        const rendered = katex.renderToString(normalized, {
          displayMode: isDisplay,
          output: "html",
          throwOnError: false,
          errorColor: "#f43f5e",
          strict: "ignore",
          trust: true,
        });

        const tag = "span";
        mathHtml = `<${tag} class="katex-custom-wrapper" data-latex="${escHtml(normalized)}" data-display="${isDisplay}" style="${isDisplay ? "display: block; text-align: center; margin: 0.8em 0;" : ""}">${rendered}</${tag}>`;
      } catch (e: any) {
        mathHtml = `<span style="color:#f43f5e">${escHtml(raw)}</span>`;
      }

      const blockIdx = mathBlocks.length;
      mathBlocks.push(mathHtml);
        if (isDisplay) {
        mdText += `\n\n@@@MATH_BLOCK_${blockIdx}@@@\n\n`;
      } else {
        mdText += `@@@MATH_BLOCK_${blockIdx}@@@`;
      }
      lastIdx = m.index + raw.length;
    }

    if (lastIdx < input.length) {
      mdText += input.slice(lastIdx);
    }

    if (smartNewline) {
      mdText = applySmartFormatting(mdText);
    }

    // Restore URLs with linkification for bare ones just before passing to marked.parse
    mdText = restoreUrls(mdText, urls, false);

    // Parse Markdown synchronously using marked
    let htmlContent = "";
    try {
      htmlContent = marked.parse(mdText) as string;
    } catch {
      htmlContent = mdText;
    }

    // Ensure all links open in a new tab and are styled beautifully
    htmlContent = htmlContent.replace(
      /<a\s+href=/g,
      '<a target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline cursor-pointer font-medium" href=',
    );

  // Khôi phục công thức khối và loại bỏ thẻ <p> bao ngoài nếu đứng riêng lẻ
    htmlContent = htmlContent.replace(
      /<p>(?:\s|<br\s*\/?>)*@@@MATH_BLOCK_(\d+)@@@(?:\s|<br\s*\/?>)*<\/p>/g,
      (match, idStr) => {
        const block = mathBlocks[+idStr] || "";
        const isDisplay = block.includes('data-display="true"');
        return isDisplay ? block : match;
      }
    );

    // Replace equations back an toàn không tiêu thụ ký tự kế tiếp
    htmlContent = htmlContent.replace(
      /@@@MATH_BLOCK_(\d+)@@@/g,
      (match, idStr, offset, fullStr) => {
        const block = mathBlocks[+idStr] || "";
        if (!block) return "";
        const isDisplay = block.includes('data-display="true"');
        if (isDisplay) return block;
        // Thêm khoảng cách nếu inline math liền kề với từ thông thường phía sau
        const nextSlice = fullStr.slice(offset + match.length);
        const nextWordMatch = nextSlice.match(/^(?:[\s\u00a0\u200b]|&nbsp;)*([^.,;:!?\)\}\]”’"`\s<@])/);
        if (nextWordMatch && !nextSlice.startsWith(" ")) {
          return block + " ";
        }
        return block;
      },
    );

    return htmlContent;
  };

  // --- SYNCHRONIZE LOCAL CACHE ---
  useEffect(() => {
    try {
      if (user) {
        const serializableUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        localStorage.setItem(
          "q_builder_cached_user",
          JSON.stringify(serializableUser),
        );
      } else {
        localStorage.removeItem("q_builder_cached_user");
        localStorage.removeItem("q_builder_cached_user_doc");
      }
    } catch (e) {
      console.error("Lỗi đồng bộ cache user:", e);
    }
  }, [user]);

  useEffect(() => {
    try {
      if (userDoc) {
        localStorage.setItem(
          "q_builder_cached_user_doc",
          JSON.stringify(userDoc),
        );
      } else {
        localStorage.removeItem("q_builder_cached_user_doc");
      }
    } catch (e) {
      console.error("Lỗi đồng bộ cache userDoc:", e);
    }
  }, [userDoc]);

  // --- TRACKING DEVICE FINGERPRINT ---
  useEffect(() => {
    if (!user) return;
    const trackDevice = async () => {
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json").catch(() => null);
        const ipData = ipRes ? await ipRes.json() : { ip: "unknown" };
        const ip = ipData.ip || "unknown";
        
        // Sử dụng một ID thiết bị lưu trong localStorage để phân biệt chính xác
        // Giúp tránh báo động nhầm (false positive) khi nhiều người dùng có cùng loại máy và độ phân giải
        let deviceId = localStorage.getItem("device_tracking_id");
        if (!deviceId) {
          deviceId = "dev_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
          localStorage.setItem("device_tracking_id", deviceId);
        }
        
        // Kết hợp ID với một phần user agent và kích thước màn hình
        const browserHint = navigator.userAgent.split(' ')[0] || "unknown";
        const fp = `${deviceId}_${browserHint}_${window.screen.width}x${window.screen.height}`;
        
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { 
            lastIp: ip, 
            deviceFingerprint: fp,
            lastLoginAt: new Date().toISOString()
        }).catch(() => {});
      } catch (e) {}
    };
    const t = setTimeout(trackDevice, 3000); // give time for user doc creation
    return () => clearTimeout(t);
  }, [user]);

  // --- FIREBASE EFFETS & CONTROLLERS ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserDoc(null);
        setAuthLoading(false);
      }
    });
    return unsubscribeAuth;
  }, []);

  // Listen to current user's profile document dynamically
  useEffect(() => {
    if (!user) return;
    const todayStr = getTodayStr();

    console.log("[USER AUTH] Đăng nhập:", {
      originalEmail: user.email,
      cleanEmail: user.email?.trim().toLowerCase() || "",
      uid: user.uid,
    });

    // Đặt bộ đếm thời gian tối đa 1.2 giây để tránh bị kẹt loading do kết nối Firestore chậm
    const loadingTimeout = setTimeout(() => {
      setAuthLoading((currentLoading) => {
        if (currentLoading) {
          console.warn(
            "[USER AUTH] Đang tải chậm hơn bình thường, tự động kích hoạt giao diện nhanh fallback...",
          );
          setUserDoc((currentDoc) => {
            if (!currentDoc) {
              const isOwner = checkIsOwnerEmail(user);
              const targetRole = isOwner ? "admin" : "user";
              return {
                uid: user.uid,
                email: user.email || "",
                displayName:
                  user.displayName || user.email?.split("@")[0] || "Người dùng",
                role: targetRole,
                status: isOwner ? "approved" : "pending",
                queryCount: 0,
                latexCount: 0,
                examCount: 0,
                promptCount: 0,
                markItDownCount: 0,
                createdAt: new Date().toISOString(),
                lastLatexResetDate: todayStr,
              };
            }
            return currentDoc;
          });
          return false;
        }
        return currentLoading;
      });
    }, 1200);

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeDoc = onSnapshot(
      userDocRef,
      (docSnap) => {
        clearTimeout(loadingTimeout);

        if (docSnap.exists()) {
          const data = docSnap.data();
          let needsUpdate = false;
          const updateData: any = {};

          const currentEmail = user.email || user.providerData?.[0]?.email || "";
          if (currentEmail && data.email !== currentEmail) {
            updateData.email = currentEmail;
            needsUpdate = true;
          }

          if (user.displayName && !data.displayName) {
            updateData.displayName = user.displayName;
            needsUpdate = true;
          }

          if (user.photoURL && !data.photoURL) {
            updateData.photoURL = user.photoURL;
            needsUpdate = true;
          }

          if (data.lastLatexResetDate !== todayStr) {
            updateData.latexCount = 0;
            updateData.promptCount = 0;
            updateData.examCount = 0;
            updateData.markItDownCount = 0;
            updateData.lastLatexResetDate = todayStr;
            needsUpdate = true;
          }

          const isOwner = checkIsOwnerEmail(user);

          if (needsUpdate && !(window as any)._hasAttemptedProfileUpdate) {
            (window as any)._hasAttemptedProfileUpdate = true;
            updateDoc(userDocRef, updateData).catch((err) => {
              console.error("Lỗi tự động cập nhật quyền lợi:", err);
            });
          }

          const mergedProfile = { ...data, ...updateData };
          if (isOwner) {
            mergedProfile.role = "admin";
            mergedProfile.status = "approved";
          }
          setUserDoc(mergedProfile);
          setAuthLoading(false);
        } else {
          const isOwner = checkIsOwnerEmail(user);
          const targetRole = isOwner ? "admin" : "user";
          const currentEmail = user.email || user.providerData?.[0]?.email || "";
          const initialProfile = {
            uid: user.uid,
            email: currentEmail,
            displayName:
              user.displayName || currentEmail.split("@")[0] || "Người dùng",
            photoURL: user.photoURL || "",
            phoneNumber: user.phoneNumber || "",
            birthDate: "",
            role: targetRole,
            status: isOwner ? "approved" : "pending",
            queryCount: 0,
            latexCount: 0,
            examCount: 0,
            promptCount: 0,
            markItDownCount: 0,
            createdAt: new Date().toISOString(),
            lastLatexResetDate: todayStr,
          };
          setDoc(userDocRef, initialProfile)
            .then(() => {
              setUserDoc(initialProfile);
              setAuthLoading(false);
            })
            .catch((err) => {
              console.error("Lỗi tạo hồ sơ:", err);
              setUserDoc(initialProfile);
              setAuthLoading(false);
            });
        }
      },
      (err) => {
        clearTimeout(loadingTimeout);
        console.error("Lỗi theo dõi hồ sơ:", err);
        const isOwner = checkIsOwnerEmail(user);
        const currentEmail = user.email || user.providerData?.[0]?.email || "";
        const fallbackProfile = {
          uid: user.uid,
          email: currentEmail,
          displayName: user.displayName || "Người dùng",
          photoURL: user.photoURL || "",
          phoneNumber: "",
          birthDate: "",
          role: isOwner ? "admin" : "user",
          status: isOwner ? "approved" : "pending",
          queryCount: 0,
          latexCount: 0,
          examCount: 0,
          promptCount: 0,
          markItDownCount: 0,
          createdAt: new Date().toISOString(),
          lastLatexResetDate: todayStr,
        };
        setUserDoc(fallbackProfile);
        setAuthLoading(false);
      },
    );

    return () => {
      clearTimeout(loadingTimeout);
      unsubscribeDoc();
    };
  }, [user]);

  // Load user's notifications in real-time
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const notificationsQuery = collection(db, "notifications");
    const q = query(
      notificationsQuery,
      where("targetUid", "in", ["all", user.uid]),
    );
    const unsubscribeNotifications = onSnapshot(
      q,
      (querySnap) => {
        const list: any[] = [];
        querySnap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        list.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setNotifications(list);
      },
      (err) => {
        console.error("Lỗi tải danh sách thông báo:", err);
      },
    );
    return unsubscribeNotifications;
  }, [user]);

  // Synchronize all users for the admin console
  useEffect(() => {
    const isAdmin = isAdminUser(user, userDoc);
    if (!user || !isAdmin) {
      setAllUsers([]);
      return;
    }

    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (querySnap) => {
        const list: any[] = [];
        querySnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (checkIsOwnerEmail({ uid: docSnap.id, email: data.email, displayName: data.displayName } as any)) {
            data.role = "admin";
            data.status = "approved";
          }
          list.push({ uid: docSnap.id, ...data });
        });
        // Sort users by email alphabetically
        list.sort((a, b) => {
          const emailA = a.email || "";
          const emailB = b.email || "";
          return emailA.localeCompare(emailB);
        });
        setAllUsers(list);
      },
      (err) => {
        console.warn("Cảnh báo đồng bộ danh sách thành viên (có thể do độ trễ cập nhật rule):", err);
      }
    );

    return unsubscribeUsers;
  }, [user, userDoc]);

  // Synchronize all feedbacks for the admin console
  useEffect(() => {
    const isAdmin = isAdminUser(user, userDoc);
    if (!user || !isAdmin) {
      setAllFeedbacks([]);
      return;
    }

    const unsubscribeFeedbacks = onSnapshot(
      collection(db, "feedbacks"),
      (querySnap) => {
        const list: any[] = [];
        querySnap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        list.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setAllFeedbacks(list);
      },
      (err) => {
        console.warn("Cảnh báo đồng bộ danh sách phản hồi (có thể do độ trễ cập nhật rule):", err);
      }
    );

    return unsubscribeFeedbacks;
  }, [user, userDoc]);

  // Synchronize all notifications for the admin console
  useEffect(() => {
    const isAdmin = isAdminUser(user, userDoc);
    if (!user || !isAdmin) {
      setAllNotifications([]);
      return;
    }

    const unsubscribeNotifications = onSnapshot(
      collection(db, "notifications"),
      (querySnap) => {
        const list: any[] = [];
        querySnap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        list.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setAllNotifications(list);
      },
      (err) => {
        console.warn("Cảnh báo đồng bộ danh sách thông báo:", err);
      }
    );

    return unsubscribeNotifications;
  }, [user, userDoc]);
  // --- ADMIN PANEL HANDLERS ---
  const handleUpdateUserStatus = async (targetUid: string, status: "approved" | "pending" | "rejected") => {
    try {
      await updateDoc(doc(db, "users", targetUid), { status });
      triggerToast(`Đã chuyển đổi trạng thái thành ${status === "approved" ? "Đã duyệt" : status === "pending" ? "Chờ duyệt" : "Khóa"}!`);
    } catch (e) {
      triggerToast("Lỗi thay đổi trạng thái thành viên.", false);
    }
  };

  const handleUpdateUserRole = async (targetUid: string, role: "admin" | "user") => {
    try {
      await updateDoc(doc(db, "users", targetUid), { role });
      triggerToast(`Đã chuyển đổi vai trò thành ${role === "admin" ? "Quản trị viên" : "Thành viên"}!`);
    } catch (e) {
      triggerToast("Lỗi thay đổi vai trò thành viên.", false);
    }
  };

  const handleResetUserUsage = async (targetUid: string) => {
    try {
      await updateDoc(doc(db, "users", targetUid), {
        latexCount: 0,
        queryCount: 0,
        examCount: 0,
        promptCount: 0,
        markItDownCount: 0,
        lastLatexResetDate: getTodayStr(),
      });
      triggerToast("Đã thiết lập lại (reset) số lượt sử dụng của thành viên!");
    } catch (e) {
      triggerToast("Lỗi thiết lập lại số lượt sử dụng.", false);
    }
  };

  const handleAdjustUserLimit = async (targetUid: string, field: "latexCount" | "queryCount" | "examCount" | "promptCount", value: number) => {
    try {
      await updateDoc(doc(db, "users", targetUid), {
        [field]: value,
        lastLatexResetDate: getTodayStr(),
      });
      triggerToast("Đã điều chỉnh chỉ số sử dụng thành công!");
    } catch (e) {
      triggerToast("Lỗi điều chỉnh chỉ số sử dụng.", false);
    }
  };

  const handleSendFeedbackReply = async (fbId: string, targetUid: string, targetEmail: string) => {
    if (!feedbackReplyText.trim()) {
      triggerToast("Vui lòng nhập nội dung phản hồi.", false);
      return;
    }
    setIsSendingReply(true);
    try {
      await updateDoc(doc(db, "feedbacks", fbId), {
        replyText: feedbackReplyText.trim(),
        replyAt: new Date().toISOString(),
      });

      await addDoc(collection(db, "notifications"), {
        title: "Phản hồi từ Admin về đóng góp ý kiến",
        content: `Admin đã phản hồi góp ý của bạn: "${feedbackReplyText.trim()}"`,
        type: "feedback_reply",
        targetUid,
        targetEmail: targetEmail || "Thành viên",
        senderName: "Trần Gia Thiều (Admin)",
        createdAt: new Date().toISOString(),
      });

      triggerToast("Gửi phản hồi thành công!");
      setFeedbackReplyText("");
      setActiveReplyFeedbackId(null);
    } catch (e) {
      console.error("Lỗi gửi phản hồi:", e);
      triggerToast("Lỗi gửi phản hồi và thông báo.", false);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleSendGeneralNotification = async () => {
    if (!generalNoticeTitle.trim() || !generalNoticeContent.trim()) {
      triggerToast("Vui lòng nhập đầy đủ tiêu đề và nội dung.", false);
      return;
    }
    setIsSendingGeneralNotice(true);
    try {
      let targetEmail = "Tất cả thành viên";
      if (generalNoticeTarget !== "all") {
        const found = allUsers.find((u) => u.uid === generalNoticeTarget);
        targetEmail = found ? found.email || "Người dùng" : "Thành viên được chỉ định";
      }

      await addDoc(collection(db, "notifications"), {
        title: generalNoticeTitle.trim(),
        content: generalNoticeContent.trim(),
        type: generalNoticeTarget === "all" ? "system" : "user",
        targetUid: generalNoticeTarget,
        targetEmail: targetEmail,
        senderName: "Trần Gia Thiều (Admin)",
        createdAt: new Date().toISOString(),
      });

      triggerToast("Đã phát thông báo thành công!");
      setGeneralNoticeTitle("");
      setGeneralNoticeContent("");
      setGeneralNoticeTarget("all");
    } catch (e) {
      console.error("Lỗi phát thông báo:", e);
      triggerToast("Lỗi gửi thông báo hệ thống.", false);
    } finally {
      setIsSendingGeneralNotice(false);
    }
  };

  const handleUpdateGeneralNotification = async () => {
    if (!editingNotificationId) return;
    if (!editingNoticeTitle.trim() || !editingNoticeContent.trim()) {
      triggerToast("Vui lòng nhập đầy đủ tiêu đề và nội dung.", false);
      return;
    }
    setIsUpdatingGeneralNotice(true);
    try {
      let targetEmail = "Tất cả thành viên";
      if (editingNoticeTarget !== "all") {
        const found = allUsers.find((u) => u.uid === editingNoticeTarget);
        targetEmail = found ? found.email || "Người dùng" : "Thành viên được chỉ định";
      }

      await updateDoc(doc(db, "notifications", editingNotificationId), {
        title: editingNoticeTitle.trim(),
        content: editingNoticeContent.trim(),
        type: editingNoticeTarget === "all" ? "system" : "user",
        targetUid: editingNoticeTarget,
        targetEmail: targetEmail,
      });

      triggerToast("Đã cập nhật thông báo thành công!");
      setEditingNotificationId(null);
      setEditingNoticeTitle("");
      setEditingNoticeContent("");
      setEditingNoticeTarget("all");
    } catch (e) {
      console.error("Lỗi cập nhật thông báo:", e);
      triggerToast("Lỗi khi cập nhật thông báo.", false);
    } finally {
      setIsUpdatingGeneralNotice(false);
    }
  };

  const handleDeleteGeneralNotification = async (noticeId: string) => {
    try {
      await deleteDoc(doc(db, "notifications", noticeId));
      triggerToast("Xóa thông báo thành công.");
      if (editingNotificationId === noticeId) {
        setEditingNotificationId(null);
        setEditingNoticeTitle("");
        setEditingNoticeContent("");
        setEditingNoticeTarget("all");
      }
    } catch (e) {
      console.error("Lỗi khi xóa thông báo:", e);
      triggerToast("Lỗi khi xóa thông báo.", false);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    try {
      await deleteDoc(doc(db, "feedbacks", feedbackId));
      triggerToast("Xóa phản hồi thành công.");
    } catch (e) {
      triggerToast("Lỗi khi xóa phản hồi.", false);
    }
  };

  const handleDeleteUserRecord = async (targetUid: string) => {
    try {
      await deleteDoc(doc(db, "users", targetUid));
      triggerToast("Đã xóa bản ghi thành viên.");
    } catch (e) {
      triggerToast("Lỗi khi xóa bản ghi.", false);
    }
  };

  const handleAddNewMember = async () => {
    if (!newMemberEmail.trim()) {
      triggerToast("Vui lòng nhập Email thành viên.", false);
      return;
    }
    try {
      const emailLower = newMemberEmail.trim().toLowerCase();
      const existing = allUsers.find(u => (u.email || "").toLowerCase() === emailLower);
      if (existing) {
        triggerToast("Thành viên với email này đã tồn tại trong danh sách!", false);
        return;
      }

      const randomId = "user_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const docRef = doc(db, "users", randomId);
      
      const newProfile = {
        uid: randomId,
        email: emailLower,
        displayName: newMemberName.trim() || emailLower.split("@")[0],
        role: newMemberRole,
        status: newMemberStatus,
        queryCount: 0,
        latexCount: 0,
        examCount: 0,
        promptCount: 0,
        markItDownCount: 0,
        createdAt: new Date().toISOString(),
        lastLatexResetDate: getTodayStr(),
      };

      await setDoc(docRef, newProfile);
      triggerToast("Thêm thành viên thành công!");
      setShowAddMemberModal(false);
      setNewMemberEmail("");
      setNewMemberName("");
      setNewMemberRole("user");
      setNewMemberStatus("approved");
    } catch (err: any) {
      console.error(err);
      triggerToast("Có lỗi xảy ra khi thêm thành viên: " + err.message, false);
    }
  };

  const handleSaveEditedMember = async () => {
    if (!editingUser) return;
    try {
      const docRef = doc(db, "users", editingUser.uid);
      await updateDoc(docRef, {
        displayName: editingUser.displayName || "",
        status: editingUser.status,
        role: editingUser.role,
        latexCount: Number(editingUser.latexCount) || 0,
        examCount: Number(editingUser.examCount) || 0,
        promptCount: Number(editingUser.promptCount) || 0,
        queryCount: Number(editingUser.queryCount) || 0,
        lastLatexResetDate: editingUser.lastLatexResetDate || getTodayStr(),
      });
      triggerToast("Cập nhật thông tin thành viên thành công!");
      setShowEditMemberModal(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error(err);
      triggerToast("Lỗi khi cập nhật thông tin thành viên: " + err.message, false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      triggerToast("Vui lòng đăng nhập để lưu cài đặt.", false);
      return;
    }
    setIsSavingSettings(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName: settingsDisplayName.trim(),
        phoneNumber: settingsPhoneNumber.trim(),
        birthDate: settingsBirthDate,
      });
      triggerToast("Đã cập nhật thông tin cá nhân thành công!", true);
    } catch (err: any) {
      console.error("Lỗi cập nhật cài đặt:", err);
      triggerToast("Cập nhật cài đặt thất bại: " + err.message, false);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Auth Operations
  const handleGoogleLogin = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      await signInWithPopup(auth, provider);
      triggerToast("Đăng nhập bằng Google thành công!", true);
    } catch (err: any) {
      if (err.code !== "auth/cancelled-popup-request" && err.code !== "auth/popup-closed-by-user") {
        console.error(err);
      }
      if (err.code === "auth/popup-blocked") {
        setAuthError(
          "Trình duyệt đã chặn cửa sổ bật lên (popup). Vui lòng cấp quyền bật popup hoặc mở trang web trong tab mới.",
        );
      } else if (err.code === "auth/cancelled-popup-request" || err.code === "auth/popup-closed-by-user") {
        // User cancelled, do nothing
      } else {
        setAuthError(err.message || "Đăng nhập bằng Google thất bại.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      setAdminTab("tool");
      await signOut(auth);
      triggerToast("Đã đăng xuất tài khoản!");
    } catch (err) {
      console.error("Đăng xuất lỗi:", err);
    }
  };

  // --- FEEDBACK SUBMISSION & DELETION ---
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      triggerToast("Vui lòng đăng nhập để gửi phản hồi.", false);
      return;
    }
    if (!feedbackText.trim()) {
      triggerToast("Vui lòng nhập nội dung góp ý phản hồi.", false);
      return;
    }
    setIsSubmittingFeedback(true);
    try {
      await addDoc(collection(db, "feedbacks"), {
        uid: user.uid,
        email: user.email || "",
        displayName:
          userDoc?.displayName ||
          user.displayName ||
          user.email?.split("@")[0] ||
          "Người dùng",
        feedbackText: feedbackText.trim(),
        type: feedbackType,
        rating: feedbackRating,
        feedbackImage: feedbackImage || "",
        createdAt: new Date().toISOString(),
        version: "v3.7",
      });
      triggerToast("Cám ơn bạn đã gửi ý kiến đóng góp!", true);
      setFeedbackText("");
      setFeedbackRating(5);
      setFeedbackType("suggestion");
      setFeedbackImage("");
      setIsFeedbackOpen(false);
    } catch (err) {
      console.error("Lỗi gửi phản hồi:", err);
      triggerToast("Gửi ý kiến phản hồi không thành công.", false);
      handleFirestoreError(err, OperationType.CREATE, "feedbacks");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleFeedbackDeleteAction = async (fbId: string) => {
    try {
      await deleteDoc(doc(db, "feedbacks", fbId));
      triggerToast("Đã xóa phản hồi thành công.");
    } catch (err) {
      console.error(err);
      triggerToast("Lỗi khi xóa phản hồi.", false);
    }
  };

  // Helper to increment user query logs
  const incrementUserQuery = async () => {
    if (user && userDoc) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          queryCount: increment(1),
        });
      } catch (err) {
        console.error("Lỗi đếm số truy vấn:", err);
      }
    }
  };

  const incrementLatexCount = async () => {
    if (user && userDoc) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          latexCount: increment(1),
          queryCount: increment(1),
        });
      } catch (err) {
        console.error("Lỗi đếm số truy cập LaTeX:", err);
      }
    }
  };

  const incrementExamCount = async () => {
    if (user && userDoc) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          examCount: increment(1),
          queryCount: increment(1),
        });
      } catch (err) {
        console.error("Lỗi đếm số lần biên soạn đề:", err);
      }
    }
  };

  const incrementPromptCount = async () => {
    if (user && userDoc) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          promptCount: increment(1),
          queryCount: increment(1),
        });
      } catch (err) {
        console.error("Lỗi đếm số lượt dán thông minh AI:", err);
      }
    }
  };

  const handleMarkItDownUsage = async () => {
    if (user && userDoc) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          markItDownCount: increment(1),
          promptCount: increment(1),
          queryCount: increment(1),
        });
      } catch (err) {
        console.error("Lỗi đếm số lượt dùng MarkItDown AI:", err);
      }
    }
  };

  // Parse HTML string to Markdown recursively
  const nodeToMarkdown = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as HTMLElement;
    const style = element.getAttribute("style") || "";
    if (style.includes("display: none") || style.includes("display:none")) {
      return "";
    }

    let childContent = "";
    node.childNodes.forEach((child) => {
      childContent += nodeToMarkdown(child);
    });

    const tagName = element.tagName.toLowerCase();
    const isBold =
      tagName === "strong" ||
      tagName === "b" ||
      style.includes("font-weight: bold") ||
      style.includes("font-weight: 700");
    const isItalic =
      tagName === "em" ||
      tagName === "i" ||
      style.includes("font-style: italic");

    let content = childContent;

    if (isBold && content.trim()) {
      const trimmed = content.trim();
      if (!trimmed.startsWith("**") && !trimmed.endsWith("**")) {
        content = `**${trimmed}**`;
      }
    }
    if (isItalic && content.trim()) {
      const trimmed = content.trim();
      if (!trimmed.startsWith("*") && !trimmed.endsWith("*")) {
        content = `*${trimmed}*`;
      }
    }

    switch (tagName) {
      case "table": {
        const rows = Array.from(element.querySelectorAll("tr"));
        if (rows.length === 0) return "";

        let markdownTable = "\n\n";
        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll("th, td"));
          const cellContents = cells.map((cell) => {
            let cellText = nodeToMarkdown(cell).trim();
            cellText = cellText.replace(/\|/g, "\\|");
            cellText = cellText.replace(/\r?\n/g, " ");
            return cellText || " ";
          });

          markdownTable += "| " + cellContents.join(" | ") + " |\n";

          if (rowIndex === 0) {
            const separators = cellContents.map(() => "---");
            markdownTable += "| " + separators.join(" | ") + " |\n";
          }
        });
        return markdownTable + "\n";
      }
      case "p":
      case "div":
        return `\n${content.trim()}\n`;
      case "br":
        return "\n";
      case "h1":
        return `\n# ${content.trim()}\n`;
      case "h2":
        return `\n## ${content.trim()}\n`;
      case "h3":
        return `\n### ${content.trim()}\n`;
      case "h4":
      case "h5":
      case "h6":
        return `\n#### ${content.trim()}\n`;
      case "li": {
        const trimmedContent = content.trim();
        // Kiểm tra xem nội dung li đã có sẵn ký tự đánh dấu danh sách ở đầu hay chưa
        const matchNumbered = trimmedContent.match(
          /^\s*(?:(?:Bài\s+)?(\d+)|([a-zA-Z]))[\.\)\/\s-]\s*(.*)$/i,
        );
        const matchBullet = trimmedContent.match(/^\s*([\-\*•·o])\s*(.*)$/);

        if (matchNumbered) {
          const num = matchNumbered[1] || matchNumbered[2];
          const separator = trimmedContent.includes(")") ? ")" : ".";
          const isBai = trimmedContent.toLowerCase().startsWith("bài");
          const prefix = isBai ? `Bài ${num}` : num;
          return `\n${prefix}${separator} ${matchNumbered[3].trim()}\n`;
        } else if (matchBullet) {
          const bulletChar =
            matchBullet[1] === "·" || matchBullet[1] === "o"
              ? "•"
              : matchBullet[1];
          return `\n${bulletChar} ${matchBullet[2].trim()}\n`;
        } else {
          const parent = element.parentNode as HTMLElement | null;
          const isOrdered = parent && parent.tagName.toLowerCase() === "ol";
          if (isOrdered) {
            const siblings = Array.from(parent.children);
            const idx = siblings.indexOf(element) + 1;
            return `\n${idx}. ${trimmedContent}\n`;
          } else {
            return `\n- ${trimmedContent}\n`;
          }
        }
      }
      case "a": {
        const href = element.getAttribute("href") || "";
        if (href) {
          return `[${content.trim()}](${href})`;
        }
        return content;
      }
      case "ul":
      case "ol":
        return `\n${content.trim()}\n`;
      case "blockquote":
        return `\n> ${content.trim()}\n`;
      case "code":
        return ` \`${content.trim()}\` `;
      case "pre":
        return `\n\`\`\`\n${content.trim()}\n\`\`\`\n`;
      default:
        return content;
    }
  };

  // Convert rich HTML to Markdown
  const convertHtmlToMarkdown = (htmlString: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");

    const isWord =
      htmlString.includes("mso-") ||
      htmlString.includes("MsoNormal") ||
      htmlString.includes("urn:schemas-microsoft-com:office");
    if (isWord) {
      // 1. Loại bỏ các thẻ rác, xml, style của Word
      doc
        .querySelectorAll("style, script, xml, meta, link, o\\:p")
        .forEach((el) => el.remove());

      // 2. Xử lý các thẻ li có chứa span mso-list:Ignore để tránh trùng lặp đánh số
      doc.querySelectorAll("li").forEach((li) => {
        const ignoreSpan = li.querySelector(
          '[style*="mso-list:Ignore"], [style*="mso-list: ignore"]',
        );
        if (ignoreSpan) {
          ignoreSpan.remove();
        }
      });

      // 3. Xử lý các đoạn văn MsoListParagraph có mso-list:Ignore của Word
      doc
        .querySelectorAll('.MsoListParagraph, [style*="mso-list:"]')
        .forEach((el) => {
          const ignoreSpan = el.querySelector(
            '[style*="mso-list:Ignore"], [style*="mso-list: ignore"]',
          );
          if (ignoreSpan) {
            let bulletText = ignoreSpan.textContent || "";
            bulletText = bulletText.replace(/\s+/g, " ").trim();
            if (bulletText) {
              if (
                /^[\u00b7\u2022\u25aa\u25fc\u25cf\u2023\-o\*]$/.test(
                  bulletText,
                ) ||
                bulletText.charCodeAt(0) === 183 ||
                bulletText.charCodeAt(0) === 8226
              ) {
                ignoreSpan.textContent = "• ";
              } else {
                ignoreSpan.textContent = bulletText + " ";
              }
            }
          }
        });
    }

    // 1. Recover Katex formulas
    const katexElements = doc.querySelectorAll(".katex, .katex-display");
    katexElements.forEach((el) => {
      const annotation = el.querySelector(
        'annotation[encoding="application/x-tex"]',
      );
      if (annotation) {
        const latex = annotation.textContent?.trim() || "";
        const isDisplay =
          el.classList.contains("katex-display") || el.tagName === "DIV";
        const replacement = isDisplay ? `\n$$${latex}$$\n` : `$${latex}$`;
        el.replaceWith(doc.createTextNode(replacement));
      } else {
        const mathMl = el.querySelector("math");
        if (mathMl && mathMl.getAttribute("alttext")) {
          const latex = mathMl.getAttribute("alttext") || "";
          const isDisplay = el.classList.contains("katex-display");
          const replacement = isDisplay ? `\n$$${latex}$$\n` : `$${latex}$`;
          el.replaceWith(doc.createTextNode(replacement));
        }
      }
    });

    // 2. Handle MathJax script types if present
    doc.querySelectorAll(".MathJax, .MathJax_Display").forEach((el) => {
      const script = el.querySelector('script[type^="math/tex"]');
      if (script) {
        const latex = script.textContent?.trim() || "";
        const isDisplay =
          script.getAttribute("type")?.includes("mode=display") || false;
        const replacement = isDisplay ? `\n$$${latex}$$\n` : `$${latex}$`;
        el.replaceWith(doc.createTextNode(replacement));
      }
    });

    return nodeToMarkdown(doc.body).trim();
  };

  // HTML to Overleaf Compiler recursively
  const nodeToLaTeX = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeLaTeX(node.nodeValue || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as HTMLElement;

    // Fast-path extract of custom raw KaTeX elements saved dynamically
    if (element.classList.contains("katex-custom-wrapper")) {
      const latex = element.getAttribute("data-latex") || "";
      const isDisplay = element.getAttribute("data-display") === "true";
      if (isDisplay) {
        return `\n\\begin{equation*}\n${latex.trim()}\n\\end{equation*}\n`;
      } else {
        return `$${latex.trim()}$`;
      }
    }

    let childContent = "";
    node.childNodes.forEach((child) => {
      childContent += nodeToLaTeX(child);
    });

    const tagName = element.tagName.toLowerCase();
    switch (tagName) {
      case "table": {
        const rows = Array.from(element.querySelectorAll("tr"));
        if (rows.length === 0) return "";

        let maxCols = 0;
        const rowsData = rows.map((row) => {
          const cells = Array.from(row.querySelectorAll("th, td"));
          if (cells.length > maxCols) {
            maxCols = cells.length;
          }
          return cells.map((cell) => {
            let cellContent = "";
            cell.childNodes.forEach((child) => {
              cellContent += nodeToLaTeX(child);
            });
            return cellContent.trim();
          });
        });

        if (maxCols === 0) return "";

        const colSpec = "|" + "c|".repeat(maxCols);
        let latexTable =
          "\n\\begin{table}[h]\n\\centering\n\\begin{tabular}{" +
          colSpec +
          "}\n\\hline\n";

        rowsData.forEach((rowCells) => {
          const paddedCells = [...rowCells];
          while (paddedCells.length < maxCols) {
            paddedCells.push("");
          }
          latexTable += paddedCells.join(" & ") + " \\\\ \\hline\n";
        });

        latexTable += "\\end{tabular}\n\\end{table}\n";
        return latexTable;
      }
      case "p":
      case "div":
        return `\n\n${childContent.trim()}\n\n`;
      case "br":
        return " \\\\\n";
      case "h1":
         return `\n\\section*{${childContent.trim()}}\n`;
      case "h2":
        return `\n\\subsection*{${childContent.trim()}}\n`;
      case "h3":
         return `\n\\subsubsection*{${childContent.trim()}}\n`;
      case "h4":
      case "h5":
      case "h6":
        return `\n\\paragraph{${childContent.trim()}}\n`;
      case "strong":
      case "b":
        return `\\textbf{${childContent.trim()}}`;
      case "em":
      case "i":
        return `\\textit{${childContent.trim()}}`;
      case "a": {
        const href = element.getAttribute("href") || "";
        const linkText = childContent.trim();
        if (href) {
          if (linkText === href || !linkText) {
            return `\\url{${href}}`;
          }
          return `\\href{${href}}{${linkText}}`;
        }
        return linkText;
      }
      case "li":
        return `  \\item ${childContent.trim()}\n`;
      case "ul":
        return `\n\\begin{itemize}\n${childContent.trim()}\n\\end{itemize}\n`;
      case "ol":
        return `\n\\begin{enumerate}\n${childContent.trim()}\n\\end{enumerate}\n`;
      case "blockquote":
        return `\n\\begin{quote}\n${childContent.trim()}\n\\end{quote}\n`;
      case "code":
        return `\\texttt{${childContent.trim()}}`;
      case "pre":
        return `\n\\begin{verbatim}\n${element.textContent?.trim()}\n\\end{verbatim}\n`;
      default:
        return childContent;
    }
  };

  const generateOverleafDocument = (bodyLaTeX: string): string => {
    const cleanedBody = bodyLaTeX.trim().replace(/\n{3,}/g, "\n\n");
    return `\\documentclass[12pt, a4paper]{article}

% =========================================================================
% CẤU HÌNH TIẾNG VIỆT & PHÔNG CHỮ CHUẨN OVERLEAF (pdfLaTeX)
% =========================================================================
\\usepackage[T5]{fontenc}      % BẮT BUỘC: Encode ký tự tiếng Việt cho pdfLaTeX
\\usepackage[utf8]{inputenc}   % Đọc file nguồn UTF-8
\\usepackage[vietnamese]{babel} % Đảm bảo hiển thị đúng dấu tiếng Việt

% =========================================================================
% CÁC GÓI TOÁN HỌC KHÔNG THỂ THIẾU
% =========================================================================
\\usepackage{amsmath, amssymb, amsfonts} % Hỗ trợ định dạng và ký hiệu toán cao cấp

% =========================================================================
% CẤU HÌNH TRÌNH BÀY & TRANG TRÍ LỀ HỌC THUẬT
% =========================================================================
\\usepackage{geometry}
\\geometry{a4paper, margin=2.5cm} % Thiết lập khoảng cách lề chuẩn học thuật

\\usepackage{hyperref}
\\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    filecolor=magenta,      
    urlcolor=cyan,
}

\\begin{document}

${cleanedBody}

\\end{document}`;
  };

  // Perform processing whenever inputs or settings change
  useEffect(() => {
    // Bước 1: Normalize input (NFC, loại bỏ BOM, chuẩn hoá smart quotes) - Dựa theo thuật toán từ tài liệu
    let normalizedInput = inputText;
    if (normalizedInput) {
      normalizedInput = normalizedInput
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/^\uFEFF/, "")
        .normalize("NFC")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2013/g, "--")
        .replace(/\u2014/g, "---")
        .replace(/\u2026/g, "...")
        .replace(/\u00A0/g, " ")
        .replace(/\u200B/g, "")
        .replace(/\u200C/g, "");
    }

    // Protect URLs from being mangled or broken by applySmartFormatting or KaTeX parsing
    const { protectedText, urls } = protectUrls(normalizedInput);
    let input = protectedText;

    if (!inputText.trim()) {
      setProcessedHtml(
        '<p class="text-slate-400 italic font-medium">Kết quả học thuật sẽ hiển thị trực quan tại đây...</p>',
      );
      setOverleafCode("");
      return;
    }

    // Bước 2: Loại bỏ LaTeX trong code blocks
    const codeRanges: [number, number][] = [];
    const CODE_BLOCK_REGEX = /```[\s\S]*?```|`[^`\n]+`/g;
    let codeMatch;
    // We must reset lastIndex in case it was used elsewhere
    CODE_BLOCK_REGEX.lastIndex = 0;
    while ((codeMatch = CODE_BLOCK_REGEX.exec(input)) !== null) {
      codeRanges.push([codeMatch.index, codeMatch.index + codeMatch[0].length]);
    }

    // Bước 3: Thuật toán nhận diện LaTeX tiên tiến (hỗ trợ nested environments và tránh greedy fail)
    const DISPLAY_MATH_REGEX =
       "\\$\\$([\\s\\S]*?)\\$\\$|\\\\\\[([\\s\\S]*?)\\\\\\]|\\\\begin\\{(equation|align|gather|multline|eqnarray|alignat|flalign|split|cases|aligned|alignedat|pmatrix|bmatrix|vmatrix|Bmatrix|Vmatrix|matrix|array)(\\*?)\\}([\\s\\S]*?)\\\\end\\{(?:equation|align|gather|multline|eqnarray|alignat|flalign|split|cases|aligned|alignedat|pmatrix|bmatrix|vmatrix|Bmatrix|Vmatrix|matrix|array)\\*?\\}";
    const INLINE_MATH_REGEX =
      "(?<!\\$)\\$(?!\\$)((?:[^$\\n\\\\]|\\\\[\\s\\S])*?)(?<!\\$)\\$(?!\\$)";
    const INLINE_PAREN_REGEX = "\\\\\\([\\s\\S]*?\\\\\\)";

    const MATH_COMBINED_RE = new RegExp(
      `${DISPLAY_MATH_REGEX}|${INLINE_PAREN_REGEX}|${INLINE_MATH_REGEX}`,
      "g",
    );

    const mathBlocks: string[] = [];
    let mdText = "";
    let lastIdx = 0;
    let m;

    MATH_COMBINED_RE.lastIndex = 0;
    while ((m = MATH_COMBINED_RE.exec(input)) !== null) {
      const isInsideCode = codeRanges.some(
        ([start, end]) => m!.index >= start && m!.index < end,
      );

      if (isInsideCode) {
        if (m.index > lastIdx) {
          mdText += input.slice(lastIdx, m.index + m[0].length);
        } else if (m.index === lastIdx) {
          mdText += m[0];
        }
        lastIdx = m.index + m[0].length;
        continue;
      }

      if (m.index > lastIdx) {
        mdText += input.slice(lastIdx, m.index);
      }

      const raw = m[0];
      const isDisplay =
        raw.startsWith("$$") ||
        raw.startsWith("\\[") ||
        raw.startsWith("\\begin");
      let latex = "";

      if (raw.startsWith("$$")) latex = raw.slice(2, -2);
      else if (raw.startsWith("\\[")) latex = raw.slice(2, -2);
      else if (raw.startsWith("\\(")) latex = raw.slice(2, -2);
      else if (raw.startsWith("\\begin"))
        latex = raw; // KaTeX cần toàn bộ thẻ \begin...\end
      else latex = raw.slice(1, -1);

      // Nếu không phải là block math và là inline math bọc bởi dấu '$' đơn
      // đồng thời nội dung bên trong KHÔNG PHẢI là một công thức toán thực sự (ví dụ: chỉ là số 10, 20%, ngày tháng, bài toán...)
      if (!isDisplay && raw.startsWith("$") && !isRealMathLaTeX(latex)) {
        mdText += "$";
        MATH_COMBINED_RE.lastIndex = m.index + 1;
        lastIdx = m.index + 1;
        continue;
      }

      let mathHtml = "";
      try {
        let normalized = normalizeLaTeX(latex.trim(), !isDisplay);
        normalized = restoreUrls(normalized, urls, true);
        const rendered = katex.renderToString(normalized, {
          displayMode: isDisplay,
          output: "html",
          throwOnError: false,
          errorColor: "#f43f5e",
          strict: "ignore",
          trust: true,
        });

        const tag = "span";
        mathHtml = `<${tag} class="katex-custom-wrapper" data-latex="${escHtml(normalized)}" data-display="${isDisplay}" style="${isDisplay ? "display: block; text-align: center; margin: 0.8em 0;" : ""}">${rendered}</${tag}>`;
      } catch (e: any) {
        mathHtml = `<span style="color:#f43f5e" title="${escHtml(e.message || "Error")}">${escHtml(raw)}</span>`;
      }

      const blockIdx = mathBlocks.length;
      mathBlocks.push(mathHtml);
        if (isDisplay) {
        mdText += `\n\n@@@MATH_BLOCK_${blockIdx}@@@\n\n`;
      } else {
        mdText += `@@@MATH_BLOCK_${blockIdx}@@@`;
      }
      lastIdx = m.index + raw.length;
    }

    if (lastIdx < input.length) {
      mdText += input.slice(lastIdx);
    }

    if (smartNewline) {
      mdText = applySmartFormatting(mdText);
    }

    // Restore URLs with linkification for bare ones just before passing to marked.parse
    mdText = restoreUrls(mdText, urls, false);

    // Parse Markdown synchronously using marked
    let htmlContent = "";
    try {
      htmlContent = marked.parse(mdText) as string;
    } catch {
      htmlContent = mdText;
    }

    // Ensure all links open in a new tab and are styled beautifully
    htmlContent = htmlContent.replace(
      /<a\s+href=/g,
      '<a target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline cursor-pointer font-medium" href=',
    );

  // Khôi phục công thức khối và loại bỏ thẻ <p> bao ngoài nếu đứng riêng lẻ
    htmlContent = htmlContent.replace(
      /<p>(?:\s|<br\s*\/?>)*@@@MATH_BLOCK_(\d+)@@@(?:\s|<br\s*\/?>)*<\/p>/g,
      (match, idStr) => {
        const block = mathBlocks[+idStr] || "";
        const isDisplay = block.includes('data-display="true"');
        return isDisplay ? block : match;
      }
    );

    // Replace equations back an toàn không tiêu thụ ký tự kế tiếp
    htmlContent = htmlContent.replace(
      /@@@MATH_BLOCK_(\d+)@@@/g,
      (match, idStr, offset, fullStr) => {
        const block = mathBlocks[+idStr] || "";
        if (!block) return "";
        const isDisplay = block.includes('data-display="true"');
        if (isDisplay) return block;
        const nextSlice = fullStr.slice(offset + match.length);
        const nextWordMatch = nextSlice.match(/^(?:[\s\u00a0\u200b]|&nbsp;)*([^.,;:!?\)\}\]”’"`\s<@])/);
        if (nextWordMatch && !nextSlice.startsWith(" ")) {
          return block + " ";
        }
        return block;
      },
    );

    setProcessedHtml(htmlContent);

    // Make temporary element to calculate Overleaf output
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = htmlContent;
    const generatedLaTeXBody = nodeToLaTeX(tempContainer);
    setOverleafCode(generateOverleafDocument(generatedLaTeXBody));
  }, [inputText, smartNewline]);

  const triggerToast = (msg: string, success: boolean = true) => {
    setToast({ show: true, msg, success });
  };

  const handleManualAutoFix = async () => {
    if (!inputText.trim()) {
      triggerToast("Vui lòng nhập văn bản trước để sửa dính chữ!", false);
      return;
    }
    const currentLatexCount = userDoc?.latexCount || 0;
    if (!isApproved && currentLatexCount >= 30) {
      triggerToast(
        "Bạn đã đạt giới hạn tính năng chuyển đổi LaTeX trong ngày (tối đa 30 lượt/ngày). Hãy liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
        false,
      );
      return;
    }
    const fixedText = applySmartFormatting(inputText);
    if (fixedText === inputText) {
      triggerToast("Văn bản đã chuẩn, không phát hiện lỗi dính chữ!", true);
    } else {
      setInputText(fixedText);
      triggerToast(
        "Đã tự động sửa lỗi dính chữ triệt để cho cả khung nhập và khung hiển thị đầu ra!",
        true,
      );
      await incrementLatexCount();
    }
  };

  const insertTextAroundSelection = (prefix: string, suffix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const selected = text.substring(start, end);
    const replacement = prefix + selected + suffix;
    const newText =
      text.substring(0, start) + replacement + text.substring(end);
    setInputText(newText);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length,
      );
    }, 0);
  };

  const handleBold = () => {
    insertTextAroundSelection("**", "**");
  };

  const handleItalic = () => {
    insertTextAroundSelection("*", "*");
  };

  const handlePasteGeneric = (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    setter: (val: string) => void,
    bypassAutoProcess?: boolean,
  ) => {
    const htmlData = e.clipboardData.getData("text/html");
    let markdown = "";

    if (htmlData) {
      e.preventDefault();
      markdown = convertHtmlToMarkdown(htmlData);
    } else {
      const plainText = e.clipboardData.getData("text/plain");
      if (plainText) {
        e.preventDefault();
        markdown = plainText;
      } else {
        return;
      }
    }

    // Bước 1: Normalize input (NFC, loại bỏ BOM, chuẩn hoá smart quotes)
    markdown = markdown
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/^\uFEFF/, "")
      .normalize("NFC")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2013/g, "--")
      .replace(/\u2014/g, "---")
      .replace(/\u2026/g, "...")
      .replace(/\u00A0/g, " ")
      .replace(/\u200B/g, "")
      .replace(/\u200C/g, "");

    markdown = markdown.replace(/\n{3,}/g, "\n\n");

    // Auto convert tab-separated values pasted from Word/Excel to markdown tables
    markdown = convertTabTableToMarkdown(markdown);

    // Collapse consecutive word whitespaces (spaces/mso tabs) on non-table lines
    markdown = markdown
      .split("\n")
      .map((line) => {
        if (line.trim().startsWith("|")) return line;
        return line.replace(
          /[ \t\u00a0\u2000-\u200a\u202f\u205f\u3000]{2,}/g,
          " ",
        );
      })
      .join("\n");

    // Auto-apply smart formatting on paste to fix stuck words/numbers/delimiters instantly
    markdown = applySmartFormatting(markdown);

    // Xử lý thông minh: Nếu người dùng dán nhiều câu hỏi cùng lúc, tự động phân tách và nạp vào đề!
    const lines = markdown.split('\n');
    let cauCount = 0;
    for (const line of lines) {
      if (/^(?:Câu|Bài)\s*(?:hỏi)?\s*(?:\d+)?\s*(?:[:.\-|\*]|$)/i.test(line.trim())) {
        cauCount++;
      }
    }
    
    // Nếu có từ 2 câu trở lên, chạy tính năng "Dán thông minh" ẩn danh (nếu không bypass)
    if (!bypassAutoProcess && cauCount >= 2) {
      const currentPromptCount = userDoc?.promptCount || 0;
      if (!isApproved && currentPromptCount >= 10) {
        triggerToast(
          "Bạn đã tới giới hạn tính năng dán thông minh (AI). Hãy liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
          false,
        );
        return;
      }
      processMultipleQuestionsText(markdown);
      incrementPromptCount();
      // Xóa nội dung trong khung nhập hiện tại để tránh lưu trùng lặp
      setter("");
      return;
    }

    const textEl = e.currentTarget;
    const start = textEl.selectionStart;
    const end = textEl.selectionEnd;
    const originalVal = textEl.value;

    const updatedVal =
      originalVal.slice(0, start) + markdown + originalVal.slice(end);
    setter(updatedVal);

    // Delay selection setting to wait for React state update
    setTimeout(() => {
      textEl.selectionStart = textEl.selectionEnd = start + markdown.length;
    }, 0);

    triggerToast(
      "Đã tự động chuyển đổi và tối ưu hóa nội dung dán từ Word/AI!",
      true,
    );
  };

  const handlePasteChange = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    handlePasteGeneric(e, setInputText);
  };

  // Copy code handler
  const handleCopyAction = async () => {
    if (activeTab === "word") {
      await copyToWord();
    } else {
      await copyRawLaTeX();
    }
  };

  const copyRawLaTeX = async () => {
    const rawText = overleafCode.trim();
    if (!rawText) {
      triggerToast("Chưa có nội dung để sao chép!", false);
      return;
    }

    const currentLatexCount = userDoc?.latexCount || 0;
    if (!isApproved && currentLatexCount >= 30) {
      triggerToast(
        "Bạn đã đạt giới hạn tính năng chuyển đổi LaTeX trong ngày (tối đa 30 lượt/ngày). Hãy liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
        false,
      );
      return;
    }

    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = rawText;
    tempTextArea.style.position = "absolute";
    tempTextArea.style.left = "-9999px";
    document.body.appendChild(tempTextArea);
    tempTextArea.select();

    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (e) {
      console.error(e);
    }
    document.body.removeChild(tempTextArea);

    if (success) {
      triggerToast("Đã sao chép tài liệu LaTeX hoàn chỉnh!");
      await incrementLatexCount();
    } else {
      triggerToast("Sao chép thất bại. Vui lòng tự bôi đen và copy.", false);
    }
  };

  const downloadAsPdf = async () => {
    const rawText = overleafCode.trim();
    if (!rawText) {
      triggerToast("Chưa có nội dung để tải về!", false);
      return;
    }

    const currentLatexCount = userDoc?.latexCount || 0;
    if (!isApproved && currentLatexCount >= 30) {
      triggerToast(
        "Bạn đã đạt giới hạn tính năng tải tài liệu trong ngày (tối đa 30 lượt/ngày). Hãy liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
        false,
      );
      return;
    }

    triggerToast("Đang chuẩn bị xuất PDF...", true);

    try {
      // === PHƯƠNG PHÁP: Print-to-PDF qua iframe ẩn ===
      // Hoạt động ổn định trên mọi môi trường (GitHub Pages, tên miền thực)
      // Không cần mở tab mới, không bị popup blocker chặn, không phụ thuộc dịch vụ ngoài.

      // Lấy nội dung HTML đã được render (giống hàm downloadAsWord)
      if (!previewRef.current) {
        triggerToast("Không tìm thấy nội dung để xuất PDF!", false);
        return;
      }

      const clone = previewRef.current.cloneNode(true) as HTMLDivElement;
      injectMathML(clone);
      injectInlineStyles(clone);
      const bodyHtml = clone.innerHTML;

      // Tạo HTML đầy đủ cho trang in PDF
      const printHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tài liệu - PDF</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: ${wordFont};
      font-size: 13pt;
      line-height: 1.15;
      color: #000;
      margin: 0;
      padding: 0;
      background: white;
    }
    h1, h2, h3, h4, h5, h6, p, li, span, select, tr, td, th {
      font-family: ${wordFont} !important;
      font-size: 13pt !important;
      line-height: 1.15 !important;
      margin-top: 0 !important;
      margin-bottom: 0 !important;
    }
    div, table {
      font-family: ${wordFont} !important;
      font-size: 13pt !important;
      line-height: 1.15 !important;
    }
    div.doc-display-math {
      margin-top: 6pt !important;
      margin-bottom: 6pt !important;
      text-align: center !important;
    }
    table.doc-answer-table {
      margin-top: 16pt !important;
      margin-bottom: 12pt !important;
      border: 1px solid #475569 !important;
      background-color: transparent !important;
    }
    table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
    table th, table td { border: 1px solid #000; padding: 4pt 6pt; font-size: 13pt; }
    table th { font-weight: bold; background: #f5f5f5; }
    .katex { font-size: 1em; }
    .katex-display { margin: 8pt 0; text-align: center; overflow-x: auto; }
    img { max-width: 100%; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

      // Tạo iframe ẩn để in
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.visibility = "hidden";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        triggerToast("Trình duyệt không hỗ trợ xuất PDF. Hãy thử cách khác!", false);
        return;
      }

      iframeDoc.open();
      iframeDoc.write(printHtml);
      iframeDoc.close();

      // Đợi tài nguyên (fonts, katex CSS) được tải xong
      await new Promise<void>((resolve) => {
        if (iframe.contentWindow) {
          iframe.contentWindow.onload = () => resolve();
          // Fallback timeout nếu onload không fire
          setTimeout(resolve, 1200);
        } else {
          setTimeout(resolve, 1200);
        }
      });

      triggerToast("Đang mở hộp thoại in — chọn 'Save as PDF' để lưu file!", true);

      // Gọi print dialog của trình duyệt (Ctrl+P)
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      // Cleanup iframe sau khi in xong
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);

      await incrementLatexCount();
    } catch (error) {
      console.error("Lỗi khi xuất PDF:", error);
      triggerToast("Có lỗi xảy ra khi xuất PDF. Vui lòng thử lại!", false);
    }
  };

  const injectInlineStyles = (root: HTMLDivElement) => {
    root.querySelectorAll("h1").forEach((el) => {
      const element = el as HTMLElement;
      element.style.margin = "0";
      element.style.fontFamily = wordFont;
      element.style.fontSize = "18pt";
      element.style.fontWeight = "bold";
      element.style.lineHeight = "1.2";
    });
    root.querySelectorAll("h2").forEach((el) => {
      const element = el as HTMLElement;
      element.style.margin = "0";
      element.style.fontFamily = wordFont;
      element.style.fontSize = "16pt";
      element.style.fontWeight = "bold";
      element.style.lineHeight = "1.2";
    });
    root.querySelectorAll("h3").forEach((el) => {
      const element = el as HTMLElement;
      element.style.margin = "0";
      element.style.fontFamily = wordFont;
      element.style.fontSize = "14pt";
      element.style.fontWeight = "bold";
      element.style.lineHeight = "1.2";
    });
    root.querySelectorAll("h4, h5, h6").forEach((el) => {
      const element = el as HTMLElement;
      element.style.margin = "0";
      element.style.fontFamily = wordFont;
      element.style.fontSize = "13pt";
      element.style.fontWeight = "bold";
      element.style.lineHeight = "1.2";
    });
    root.querySelectorAll("p").forEach((el) => {
      const element = el as HTMLElement;
      element.style.margin = "0";
      element.style.fontFamily = wordFont;
      element.style.fontSize = "13pt";
      element.style.lineHeight = "1.15";
    });
    root.querySelectorAll("strong, b").forEach((el) => {
      const element = el as HTMLElement;
      element.style.fontWeight = "bold";
      element.style.fontFamily = wordFont;
    });
    root.querySelectorAll("em, i").forEach((el) => {
      const element = el as HTMLElement;
      element.style.fontStyle = "italic";
      element.style.fontFamily = wordFont;
    });
    // Chuyển đổi toàn bộ danh sách có thứ tự (ol) thành các đoạn văn thường có thụt lề treo (hanging indent)
    // để tránh hiện tượng Word tự động đánh số (automatic numbered list) gây lỗi nhảy số thứ tự đề mục
    const olist = Array.from(root.querySelectorAll("ol"));
    olist.reverse().forEach((ol) => {
      const paragraphs: HTMLElement[] = [];
      const children = Array.from(ol.children);
      children.forEach((li, index) => {
        const liClone = li.cloneNode(true) as HTMLElement;
        liClone.querySelectorAll("p").forEach((pEl) => {
          const span = document.createElement("span");
          span.innerHTML = pEl.innerHTML;
          pEl.parentNode?.replaceChild(span, pEl);
        });

        const p = document.createElement("p");
        p.style.margin = "0 0 0 20pt";
        p.style.paddingLeft = "20pt";
        p.style.textIndent = "-20pt";
        p.style.fontFamily = wordFont;
        p.style.fontSize = "13pt";
        p.style.lineHeight = "1.15";

        p.innerHTML = `<span style="font-family: ${wordFont}; font-size: 13pt; font-weight: bold; color: #111827;">${index + 1}.</span>&#9;&#8203;${liClone.innerHTML}`;
        paragraphs.push(p);
      });

      paragraphs.forEach((p) => {
        ol.parentNode?.insertBefore(p, ol);
      });
      ol.remove();
    });

    // Chuyển đổi danh sách không thứ tự (ul) thành các đoạn văn thường có ký hiệu bullet tĩnh
    const ulist = Array.from(root.querySelectorAll("ul"));
    ulist.reverse().forEach((ul) => {
      const paragraphs: HTMLElement[] = [];
      const children = Array.from(ul.children);
      children.forEach((li) => {
        const liClone = li.cloneNode(true) as HTMLElement;
        liClone.querySelectorAll("p").forEach((pEl) => {
          const span = document.createElement("span");
          span.innerHTML = pEl.innerHTML;
          pEl.parentNode?.replaceChild(span, pEl);
        });

        const p = document.createElement("p");
        p.style.margin = "0 0 0 15pt";
        p.style.paddingLeft = "15pt";
        p.style.textIndent = "-15pt";
        p.style.fontFamily = wordFont;
        p.style.fontSize = "13pt";
        p.style.lineHeight = "1.15";

        p.innerHTML = `<span style="font-family: ${wordFont}; font-size: 13pt; font-weight: bold; color: #111827;">•</span>&#9;&#8203;${liClone.innerHTML}`;
        paragraphs.push(p);
      });

      paragraphs.forEach((p) => {
        ul.parentNode?.insertBefore(p, ul);
      });
      ul.remove();
    });
    root.querySelectorAll("br").forEach((el) => {
      el.setAttribute("style", "mso-special-character:line-break");
    });

    // Custom document segments to match preview design exactly when exported to MS Word
    root.querySelectorAll(".doc-header-block").forEach((el) => {
      const element = el as HTMLElement;
      if (!element.querySelector("table")) {
        element.style.textAlign = "center";
      }
      element.style.borderBottom = "3px double #1e293b";
      element.style.paddingBottom = "12pt";
      element.style.marginBottom = "0";
      element.style.marginTop = "0";
    });
    root.querySelectorAll(".doc-title-text").forEach((el) => {
      const element = el as HTMLElement;
      element.style.fontSize = "16pt";
      element.style.fontWeight = "800";
      element.style.textAlign = "center";
      element.style.color = "#111827";
      element.style.margin = "0";
      element.style.display = "block";
    });
    root.querySelectorAll(".doc-subtitle-text").forEach((el) => {
      const element = el as HTMLElement;
      element.style.fontSize = "13pt"; // Minimum 13pt
      element.style.fontStyle = "italic";
      element.style.fontWeight = "600";
      element.style.color = "#4b5563";
      element.style.textAlign = "center";
      element.style.margin = "0";
      element.style.display = "block";
    });
    root.querySelectorAll(".doc-section-header").forEach((el) => {
      const element = el as HTMLElement;
      element.style.fontWeight = "bold";
      element.style.color = "#111827";
      element.style.fontSize = "14pt";
      element.style.borderBottom = "2px solid #111827";
      element.style.paddingBottom = "4pt";
      element.style.marginTop = "0";
      element.style.marginBottom = "0";
      element.style.display = "block";
    });

    root.querySelectorAll(".doc-question-item").forEach((el) => {
      const element = el as HTMLElement;
      element.style.paddingBottom = "8pt";
      element.style.borderBottom = "none";
      element.style.marginBottom = "0";
      element.style.marginTop = "0";

      // Tối ưu hóa hiển thị cho Word: Prepend badge ("Câu X.") trực tiếp vào thẻ p đầu tiên của câu hỏi
      // Tránh lỗi lồng thẻ p bất hợp lệ, không dùng bảng, giữ nội dung và câu hỏi thẳng hàng hoàn hảo
      const flexDiv = element.querySelector(".flex.items-start");
      if (flexDiv) {
        const badge = flexDiv.querySelector(".doc-type-badge");
        const contentDiv = flexDiv.querySelector("div:not(.doc-type-badge)");
        if (badge && contentDiv) {
          const badgeText = (badge.textContent || "").trim();

          const firstP = contentDiv.querySelector("p");
          if (firstP) {
            firstP.innerHTML = `<span style="font-family: ${wordFont}; font-size: 13pt; font-weight: bold; color: #111827; margin-right: 6px;">${badgeText}</span> ${firstP.innerHTML}`;
          } else {
            contentDiv.innerHTML = `<p style="margin: 0 0 4pt 0; font-family: ${wordFont}; font-size: 13pt; color: #111827; line-height: 1.5;"><span style="font-family: ${wordFont}; font-size: 13pt; font-weight: bold; color: #111827; margin-right: 6px;">${badgeText}</span> ${contentDiv.innerHTML}</p>`;
          }

          // Thay thế style cho toàn bộ thẻ p con (nếu có)
          contentDiv.querySelectorAll("p").forEach((childP) => {
            const cp = childP as HTMLElement;
            cp.style.margin = "0 0 4pt 0";
            cp.style.padding = "0";
            cp.style.fontFamily = wordFont;
            cp.style.fontSize = "13pt";
            cp.style.lineHeight = "1.5";
            cp.style.color = "#111827";
          });

          // Thay thế flexDiv bằng div chứa contentDiv.innerHTML
          const wrapper = document.createElement("div");
          wrapper.innerHTML = contentDiv.innerHTML;
          flexDiv.parentNode?.replaceChild(wrapper, flexDiv);
        }
      }
    });
    root.querySelectorAll(".doc-type-badge").forEach((el) => {
      const element = el as HTMLElement;
      element.style.fontWeight = "bold";
      element.style.color = "#111827";
      element.style.marginRight = "6px";
    });

    // Convert .doc-options-container into Word-compatible HTML table based on selected columns count
    root.querySelectorAll(".doc-options-container").forEach((el) => {
      const container = el as HTMLElement;
      const columns = parseInt(
        container.getAttribute("data-columns") || "4",
        10,
      );

      const optionItems = container.querySelectorAll(".doc-option-item");
      const optionsArray: { label: string; textHtml: string }[] = [];
      optionItems.forEach((item) => {
        const labelEl = item.querySelector(".doc-option-label");
        const textEl = item.querySelector(".doc-option-text");
        if (labelEl && textEl) {
          optionsArray.push({
            label: labelEl.textContent?.trim().replace(/\.$/, "") || "",
            textHtml: textEl.innerHTML,
          });
        }
      });

      if (optionsArray.length > 0) {
        const rows: { label: string; textHtml: string }[][] = [];
        let currentRow: { label: string; textHtml: string }[] = [];
        for (let i = 0; i < optionsArray.length; i++) {
          currentRow.push(optionsArray[i]);
          if (currentRow.length === columns) {
            rows.push(currentRow);
            currentRow = [];
          }
        }
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }

        const tdWidth = Math.floor(100 / columns) + "%";
        let tableHtml = `<table class="doc-options-table" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; margin-top: 0; margin-bottom: 0; border: none !important;">`;
        for (const row of rows) {
          tableHtml += `<tr>`;
          for (let c = 0; c < columns; c++) {
            if (c < row.length) {
              const opt = row[c];

              // Clean any wrapping paragraph/block tags inside option text to prevent jumping to a new line inside Word cell
              let cleanTextHtml = opt.textHtml.trim();
              if (
                cleanTextHtml.startsWith("<p>") &&
                cleanTextHtml.endsWith("</p>")
              ) {
                cleanTextHtml = cleanTextHtml.slice(3, -4);
              } else if (
                cleanTextHtml.startsWith("<p ") &&
                cleanTextHtml.endsWith("</p>")
              ) {
                const closeIdx = cleanTextHtml.indexOf(">");
                if (closeIdx !== -1) {
                  cleanTextHtml = cleanTextHtml.slice(closeIdx + 1, -4);
                }
              }

              // Convert inner p or div blocks to inline span elements so they do not start a new paragraph in Word
              cleanTextHtml = cleanTextHtml
                .replace(
                  /<p\b[^>]*>/gi,
                  '<span style="display:inline; margin:0; padding:0;">',
                )
                .replace(/<\/p>/gi, "</span>")
                .replace(
                  /<div\b[^>]*>/gi,
                  '<span style="display:inline; margin:0; padding:0;">',
                )
                .replace(/<\/div>/gi, "</span>");

              tableHtml += `<td valign="top" style="width: ${tdWidth}; padding: 3pt 6pt 3pt 0; font-family: ${wordFont}; font-size: 13pt; line-height: 1.15; margin: 0; border: none !important;">`;
              tableHtml += `<strong style="color: #4f46e5; margin-right: 4pt; font-size: 13pt;">${opt.label}.</strong> ${cleanTextHtml}`;
              tableHtml += `</td>`;
            } else {
              tableHtml += `<td style="width: ${tdWidth}; padding: 3pt 6pt 3pt 0; margin: 0; border: none !important;"></td>`;
            }
          }
          tableHtml += `</tr>`;
        }
        tableHtml += `</table>`;

        const tempTableDiv = document.createElement("div");
        tempTableDiv.innerHTML = tableHtml.trim();
        const newTable = tempTableDiv.firstElementChild;
        if (newTable) {
          container.parentNode?.replaceChild(newTable, container);
        }
      }
    });

    // Convert .doc-answer-block into single-cell tables inside exported Word document
    // to strictly limit the background coloring within the frame and prevent background spill issues in MS Word
    root.querySelectorAll(".doc-answer-block").forEach((el) => {
      const originalBlock = el as HTMLElement;
      const titleEl = originalBlock.querySelector(".doc-answer-title");
      const bodyEl = originalBlock.querySelector(".doc-answer-body");

      const titleText = titleEl
        ? titleEl.textContent?.trim() || ""
        : "ĐÁP ÁN / HƯỚNG DẪN GIẢI CHI TIẾT:";
      const bodyHtml = bodyEl ? bodyEl.innerHTML : "";

      const tableHtml = `
        <table class="doc-answer-table" border="1" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; border: 1px solid #10b981; margin-top: 16pt; margin-bottom: 12pt; background-color: #ecfdf5; margin-left: 20pt;">
          <tr>
            <td style="padding: 10pt; border: none !important; font-family: ${wordFont}; margin: 0; background-color: #ecfdf5;">
              <span style="font-family: ${wordFont}; font-size: 13pt; font-weight: bold; color: #047857; margin-bottom: 4pt; letter-spacing: 0.05em; text-transform: uppercase; display: block; line-height: 1.15;">
                ${titleText}
              </span>
              <div style="font-family: ${wordFont}; font-size: 13pt; color: #065f46; margin: 0; line-height: 1.15;">
                ${bodyHtml}
              </div>
            </td>
          </tr>
        </table>
      `;

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = tableHtml.trim();
      const newTable = tempDiv.firstElementChild;
      if (newTable) {
        originalBlock.parentNode?.replaceChild(newTable, originalBlock);
      }
    });

    root.querySelectorAll(".doc-footer").forEach((el) => {
      const element = el as HTMLElement;
      element.style.textAlign = "center";
      element.style.borderTop = "1px solid #cbd5e1";
      element.style.paddingTop = "12pt";
      element.style.marginTop = "18pt";
    });
    root.querySelectorAll(".doc-footer p").forEach((el) => {
      const element = el as HTMLElement;
      element.style.fontSize = "9pt";
      element.style.color = "#94a3b8";
      element.style.fontWeight = "bold";
      element.style.letterSpacing = "0.1em";
      element.style.textAlign = "center";
      element.style.margin = "0";
    });
  };

  const injectMathML = (root: HTMLDivElement) => {
    root.querySelectorAll(".katex-custom-wrapper").forEach((wrapper) => {
      const latex = wrapper.getAttribute("data-latex");
      const isDisplay = wrapper.getAttribute("data-display") === "true";
      if (!latex) return;

      const cacheKey = `${isDisplay ? "block" : "inline"}:${latex}`;
      let mml = mathmlCache.get(cacheKey);

      if (!mml) {
        try {
          mml = katex.renderToString(latex, {
            displayMode: isDisplay,
            output: "mathml",
            throwOnError: false,
            strict: "ignore",
            trust: true,
          });
          mathmlCache.set(cacheKey, mml);
        } catch (e) {
          console.error(e);
          return;
        }
      }

      const temp = document.createElement("div");
      temp.innerHTML = mml.trim();
      const mathEl = temp.querySelector("math");

      if (mathEl) {
        mathEl.setAttribute("xmlns", "http://www.w3.org/1998/Math/MathML");
        mathEl.querySelectorAll("annotation").forEach((ann) => ann.remove());

        mathEl.querySelectorAll("mo").forEach((mo) => {
          const op = mo.textContent?.trim() || "";
          if (/^[=<>\u2248\u2261\u2264\u2265]/.test(op)) {
            mo.setAttribute("lspace", "0.278em");
            mo.setAttribute("rspace", "0.278em");
          } else if (/^[+\u2212\u00b1\u2213\u22c5\u00d7\u00f7]/.test(op)) {
            mo.setAttribute("lspace", "0.222em");
            mo.setAttribute("rspace", "0.222em");
          }
        });

        mathEl.querySelectorAll("[href]").forEach((node) => {
          const href = node.getAttribute("href");
          node.removeAttribute("href");
          if (href) {
            const a = document.createElement("a");
            a.setAttribute("href", href);
            a.style.textDecoration = "none";
            node.parentNode?.insertBefore(a, node);
            a.appendChild(node);
          }
        });

        // Smart spaces (Word requires non-breaking space '\u00a0' strictly to avoid compacting formulas!)
        const prevNode = wrapper.previousSibling;
           if (!isDisplay) {
          if (prevNode) {
            if (prevNode.nodeType === Node.TEXT_NODE) {
              let text = prevNode.nodeValue || "";
              if (/\s$/.test(text)) {
                prevNode.nodeValue = text.trimEnd() + "\u00a0";
              } else {
                const lastNonSpaceChar = text.trim()[text.trim().length - 1];
                const endsWithNoSpaceChar = /^[\(\{\[“‘]/.test(lastNonSpaceChar);
                if (!endsWithNoSpaceChar && lastNonSpaceChar) {
                  prevNode.nodeValue = text + "\u00a0";
                }
              }
            } else if (prevNode.nodeType === Node.ELEMENT_NODE) {
              const htmEl = prevNode as HTMLElement;
              const text = htmEl.textContent || "";
              const lastNonSpaceChar = text.trim()[text.trim().length - 1];
              const endsWithNoSpaceChar = /^[\(\{\[“‘]/.test(lastNonSpaceChar);
                   if (
                !endsWithNoSpaceChar &&
                lastNonSpaceChar &&
                htmEl.tagName.toLowerCase() !== "br"
              ) {
                const spaceNode = document.createTextNode("\u00a0");
                wrapper.parentNode?.insertBefore(spaceNode, wrapper);
              }
            }
          } else {
            // If the inline math is the first element of its block (e.g. start of a paragraph or list item),
            // insert a zero-width space (\u200b) to prevent Word from importing it as a block/display equation.
            const zeroWidthSpaceNode = document.createTextNode("\u200b");
            wrapper.parentNode?.insertBefore(zeroWidthSpaceNode, wrapper);
          }
        }

        const nextNode = wrapper.nextSibling;
        if (nextNode && !isDisplay) {
          if (nextNode.nodeType === Node.TEXT_NODE) {
            let text = nextNode.nodeValue || "";
            if (/^\s/.test(text)) {
              nextNode.nodeValue = "\u00a0" + text.trimStart();
            } else {
              const firstNonSpaceChar = text.trim()[0];
              const startsWithPunctuation = /^[.,;:!?]/.test(firstNonSpaceChar);
              if (!startsWithPunctuation && firstNonSpaceChar) {
                nextNode.nodeValue = "\u00a0" + text;
              }
            }
          } else if (nextNode.nodeType === Node.ELEMENT_NODE) {
            const htmEl = nextNode as HTMLElement;
            const text = htmEl.textContent || "";
            const firstNonSpaceChar = text.trim()[0];
            const startsWithPunctuation = /^[.,;:!?]/.test(firstNonSpaceChar);
            if (
              !startsWithPunctuation &&
              firstNonSpaceChar &&
              htmEl.tagName.toLowerCase() !== "br"
            ) {
              const spaceNode = document.createTextNode("\u00a0");
              wrapper.parentNode?.insertBefore(spaceNode, wrapper.nextSibling);
            }
          }
        }

        if (isDisplay) {
          const container = document.createElement("div");
          container.className = "doc-display-math";
          container.style.textAlign = "center";
          container.style.margin = "6pt 0";
          container.appendChild(mathEl);
          wrapper.replaceWith(container);
        } else {
          wrapper.replaceWith(mathEl);
        }
      }
    });
  };

  const copyToWord = async () => {
    if (!inputText.trim()) {
      triggerToast("Không có nội dung để sao chép cho Word!", false);
      return;
    }

    const currentLatexCount = userDoc?.latexCount || 0;
    if (!isApproved && currentLatexCount >= 30) {
      triggerToast(
        "Bạn đã đạt giới hạn tính năng chuyển đổi LaTeX trong ngày (tối đa 30 lượt/ngày). Hãy liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
        false,
      );
      return;
    }

    if (!previewRef.current) return;

    // Create an isolated copy to parse and prepare Word specific namespaces
    const clone = previewRef.current.cloneNode(true) as HTMLDivElement;
    injectMathML(clone);
    injectInlineStyles(clone);

    const bodyHtml = clone.innerHTML;

    const wordDoc = `<html>
    <head>
    <meta charset="UTF-8">
    <meta name="ProgId" content="Word.Document">
    <style>
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: ${wordFont};
            font-size: 13pt;
            line-height: 1.15;
            color: #000000;
            margin: 0;
        }
        p, li, span, select, tr, td, th {
            font-family: ${wordFont} !important;
            font-size: 13pt !important;
            line-height: 1.15 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
        }
        div, table {
            font-family: ${wordFont} !important;
            font-size: 13pt !important;
            line-height: 1.15 !important;
        }
        div.doc-display-math {
            margin-top: 6pt !important;
            margin-bottom: 6pt !important;
            text-align: center !important;
        }
        table.doc-answer-table {
            margin-top: 16pt !important;
            margin-bottom: 12pt !important;
            border: 1px solid #10b981 !important;
            background-color: #ecfdf5 !important;
        }
        table.doc-answer-table th, table.doc-answer-table td {
            border: none !important;
            padding: 10pt !important;
        }
        table.doc-options-table, table.doc-options-table th, table.doc-options-table td {
            border: none !important;
        }
        table.doc-header-table, table.doc-header-table th, table.doc-header-table td {
            border: none !important;
        }
        table.doc-question-table, table.doc-question-table tr, table.doc-question-table td {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: none !important;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 12pt !important;
            margin-bottom: 12pt !important;
        }
        table th, table td {
                  border: 1px solid #cbd5e1 !important;
            padding: 6px !important;
        }
        table th {
            font-weight: bold !important;
            background-color: #f3f4f6 !important;
        }
    </style>
    </head>
    <body>
    ${bodyHtml}
    </body>
    </html>`;

    const tempDiv = document.createElement("div");
    tempDiv.contentEditable = "true";
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.innerHTML = bodyHtml;
    document.body.appendChild(tempDiv);

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    selection.removeAllRanges();
    selection.addRange(range);

    const copyListener = (e: ClipboardEvent) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData("text/html", wordDoc);
        e.clipboardData.setData(
          "text/plain",
          previewRef.current?.innerText || "",
        );
      }
    };

    document.addEventListener("copy", copyListener);
    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (err) {
      console.error(err);
    }
    document.removeEventListener("copy", copyListener);

    selection.removeAllRanges();
    document.body.removeChild(tempDiv);

    if (success) {
      triggerToast(
        "Đã sao chép! Hãy mở Word và nhấn Ctrl+V (hoặc dán giữ nguyên định dạng gốc).",
      );
      await incrementLatexCount();
    } else {
      triggerToast(
        "Sao chép lỗi. Vui lòng tự bôi đen ở khung xem trước và copy.",
        false,
      );
    }
  };

  const downloadAsWord = async () => {
    if (!inputText.trim()) {
      triggerToast("Không có nội dung để tải về!", false);
      return;
    }

    const currentLatexCount = userDoc?.latexCount || 0;
    if (!isApproved && currentLatexCount >= 30) {
      triggerToast(
        "Bạn đã đạt giới hạn tính năng chuyển đổi LaTeX trong ngày (tối đa 30 lượt/ngày). Hãy liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
        false,
      );
      return;
    }

    if (!previewRef.current) return;

    // Create an isolated copy to parse and prepare Word specific namespaces
    const clone = previewRef.current.cloneNode(true) as HTMLDivElement;
    injectMathML(clone);
    injectInlineStyles(clone);

    const bodyHtml = clone.innerHTML;

    const wordDoc = `<html>
    <head>
    <meta charset="UTF-8">
    <meta name="ProgId" content="Word.Document">
    <style>
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: ${wordFont};
            font-size: 13pt;
            line-height: 1.15;
            color: #000000;
            margin: 0;
        }
        p, li, span, select, tr, td, th {
            font-family: ${wordFont} !important;
            font-size: 13pt !important;
            line-height: 1.15 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
        }
        div, table {
            font-family: ${wordFont} !important;
            font-size: 13pt !important;
            line-height: 1.15 !important;
        }
        div.doc-display-math {
            margin-top: 6pt !important;
            margin-bottom: 6pt !important;
            text-align: center !important;
        }
        table.doc-answer-table {
            margin-top: 16pt !important;
            margin-bottom: 12pt !important;
            border: 1px solid #10b981 !important;
            background-color: #ecfdf5 !important;
        }
        table.doc-answer-table th, table.doc-answer-table td {
            border: none !important;
            padding: 10pt !important;
        }
        table.doc-options-table, table.doc-options-table th, table.doc-options-table td {
            border: none !important;
        }
        table.doc-header-table, table.doc-header-table th, table.doc-header-table td {
            border: none !important;
        }
        table.doc-question-table, table.doc-question-table tr, table.doc-question-table td {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: none !important;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 12pt !important;
            margin-bottom: 12pt !important;
        }
        table th, table td {
                    border: 1px solid #cbd5e1 !important;
            padding: 6px !important;
        }
        table th {
            font-weight: bold !important;
            background-color: #f3f4f6 !important;
        }
    </style>
    </head>
    <body>
    ${bodyHtml}
    </body>
    </html>`;

    // Add Byte Order Mark (BOM) for proper UTF-8 decoding in Microsoft Word
    const blob = new Blob(["\ufeff" + wordDoc], {
      type: "application/msword;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "LaTeX_Sang_Word_Equation.doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast("Đã tạo và tải file Word (.doc) thành công!");
    await incrementLatexCount();
  };

  const handleCallAiCanvas = async (customPrompt?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (isProcessingCanvas) return;

    const promptToSend = customPrompt || aiCanvasPrompt;
    if (!promptToSend.trim()) {
      triggerToast("Vui lòng nhập hoặc chọn yêu cầu cho Trợ lý AI Canvas!", false);
      return;
    }

    const currentPromptCount = userDoc?.promptCount || 0;
    if (!isApproved && currentPromptCount >= 10) {
      triggerToast(
        "Bạn đã tới giới hạn tính năng Trợ lý AI Canvas. Hãy liên hệ Admin qua email giathieu110406@gmail.com để được cấp quyền không giới hạn!",
        false,
      );
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const isSelected = start !== end;
    
    const textToProcess = isSelected ? inputText.substring(start, end) : inputText;

    triggerToast("Trợ lý AI Canvas đang thực hiện yêu cầu của bạn...", true);
    setIsProcessingCanvas(true);

    try {
      const res = await fetch("/api/ai?action=gemini-canvas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textToProcess,
          prompt: promptToSend,
        }),
      });

      let errorMessage = "Không thể kết nối đến Trợ lý AI Canvas";
      if (!res.ok) {
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errorMessage = `Lỗi trợ lý AI: ${errData.error}`;
          }
        } catch (e) {
         // Fallback if not JSON (e.g., Vercel returns HTML error page)
          errorMessage = `Lỗi máy chủ (${res.status}): Không thể nhận phản hồi JSON từ API. Vui lòng kiểm tra xem bạn đã cấu hình biến môi trường GEMINI_API_KEY trên Vercel Dashboard chưa.`;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      if (data.success && data.fixedText) {
        logApiUsage("AI canvas");
        const resultText = data.fixedText;
        if (isSelected) {
          const newText = inputText.substring(0, start) + resultText + inputText.substring(end);
          setInputText(newText);
          setTimeout(() => {
            textarea.setSelectionRange(start, start + resultText.length);
            textarea.focus();
          }, 0);
          triggerToast("Trợ lý AI đã cập nhật vùng chọn trên Canvas!", true);
        } else {
          setInputText(resultText);
          triggerToast("Trợ lý AI đã cập nhật toàn bộ Canvas!", true);
        }
        
        // Clear the prompt input if it was submitted manually
        if (!customPrompt) {
          setAiCanvasPrompt("");
        }
        
        await incrementPromptCount();
      } else {
        throw new Error(data.error || "Lỗi phản hồi từ AI Canvas");
      }
    } catch (err: any) {
      console.error("Lỗi trợ lý AI Canvas:", err);
      triggerToast(err.message || "Gặp sự cố kết nối Trợ lý AI Canvas. Vui lòng thử lại!", false);
    } finally {
      setIsProcessingCanvas(false);
    }
  };

  const handleClear = () => {
    setInputText("");
    triggerToast("Đã xóa trắng trình soạn thảo.");
  };

  // --- CONDITIONAL STATE SCREENS ---
  if (authLoading) {
    return (
      <div
        className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center font-sans"
        id="auth-loading-screen"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium text-sm animate-pulse">
            Đang kết nối hệ thống bảo mật & dữ liệu...
          </p>
        </div>
      </div>
    );
  }

  if (user && !userDoc) {
    return (
      <div
        className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center font-sans"
        id="userdoc-loading-screen"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium text-sm animate-pulse">
            Đang đồng bộ cấu hình bảo mật tài khoản...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-tr from-slate-900 via-slate-950 to-blue-950 text-slate-100 flex items-center justify-center p-4 antialiased font-sans">
        <div
          className="max-w-md w-full bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800 p-6 md:p-8 shadow-2xl relative overflow-hidden"
          id="login-container"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-linear-to-r from-blue-500 via-indigo-500 to-emerald-500"></div>

          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img
                src="/logo.svg"
                alt="Late2Word Converter Logo"
                className="w-20 h-20 rounded-2xl shadow-xl border border-slate-700/50 object-contain hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-1.5 font-display">
              Late2Word Converter
            </h2>
            <p className="text-xs text-slate-400">
              Hệ thống chuyển đổi định dạng và kiểm soát chất lượng dữ liệu
            </p>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold select-none">
              Tác giả: Trần Gia Thiều - Giathieu110406@gmail.com
            </p>
          </div>

          {/* Extremely Prominent Official Website Callout Banner */}
          <div className="mb-6 relative overflow-hidden bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 border border-indigo-500/40 rounded-xl p-4 text-center group transition-all hover:border-indigo-500/60 shadow-lg shadow-indigo-500/5">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 animate-pulse"></div>
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-black text-indigo-300 tracking-widest uppercase flex items-center gap-1">
                ⚡ TRANG WEB CHÍNH THỨC ⚡
              </span>
              <a
                href="https://word2latex.io.vn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl md:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 hover:scale-105 hover:brightness-110 active:scale-95 transition-all tracking-wide select-all"
              >
                word2latex.io.vn
              </a>
              <p className="text-[10px] text-slate-300 max-w-xs mt-0.5 font-medium">
                Truy cập trực tiếp tại đây để có trải nghiệm mượt mà và đầy đủ nhất!
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {authError && (
              <div
                id="auth-error-block"
                className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-lg text-rose-400 text-xs font-semibold flex items-center gap-2"
              >
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs text-center text-slate-400 leading-relaxed px-2">
                Hệ thống yêu cầu xác thực bằng dịch vụ Google bảo mật cao. Bạn
                sẽ được tự động đưa vào danh sách xem xét cấp quyền sau khi xác
                thực thành công.
              </p>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg tracking-wider shadow-lg shadow-blue-650/15 transition-all outline-none cursor-pointer flex items-center justify-center gap-2.5 hover:scale-[1.01]"
                title="Đăng ký hoặc đăng nhập siêu nhanh qua tài khoản Google"
              >
                <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="currentColor"
                    fillOpacity="0.9"
                  />
                  <path
                    d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22.81-.6z"
                    fill="currentColor"
                    fillOpacity="0.8"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z"
                    fill="currentColor"
                    fillOpacity="0.95"
                  />
                </svg>
                TIẾP TỤC VỚI GOOGLE
              </button>
            </div>

            <div className="bg-slate-950/40 border border-slate-800/80 p-3.5 rounded-lg text-[11px] text-slate-400 space-y-1.5">
              <span className="font-bold text-slate-200 block">
                Lưu ý thiết yếu:
              </span>
              <p className="leading-relaxed">
                • Trang web chính thức:{" "}
                <a
                  href="https://word2latex.io.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline font-bold"
                >
                  word2latex.io.vn
                </a>
              </p>
              <p className="leading-relaxed">
                • Nếu nút đăng nhập Google bị chặn do chế độ iFrame của AI
                Studio, vui lòng dùng tab{" "}
                <strong className="text-blue-400">"Tài khoản Email"</strong> để
                đăng ký/đăng nhập trực tiếp không cần popup.
              </p>
              <p className="leading-relaxed">
                • Tài khoản của bạn sẽ được hệ thống tự động kích hoạt chế độ
                đăng ký chờ duyệt ngay lập tức và gửi yêu cầu đến quản trị viên.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine user constraints
  const isOwner = checkIsOwnerEmail(user);
  const isApproved = isOwner || userDoc?.status === "approved";
  const isRejected = !isApproved && userDoc?.status === "rejected";

  const getUserAvatar = () => {
    if (user?.photoURL) {
      return user.photoURL;
    }
    const name =
      userDoc?.displayName ||
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "User";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f1f5f9&color=4f46e5&bold=true&size=128`;
  };

  if (isRejected) {
    return (
      <div className="min-h-screen bg-linear-to-tr from-slate-900 via-slate-950 to-blue-950 text-slate-100 flex items-center justify-center p-4 antialiased font-sans">
        <div
          className="max-w-md w-full bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800 p-6 md:p-8 shadow-2xl text-center relative overflow-hidden"
          id="rejected-container"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500"></div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2 font-display">
            Tài Khoản Bị Từ Chối
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Yêu cầu truy cập hệ thống của bạn đã bị người quản trị từ chối. Vui
            lòng liên hệ Admin qua email{" "}
            <strong className="text-blue-400">giathieu110406@gmail.com</strong>{" "}
            để biết thêm chi tiết.
          </p>

          <button
            onClick={handleLogout}
            className="flex items-center font-bold text-xs text-slate-400 hover:text-slate-200 transition-colors mx-auto px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-950/25 rounded-lg cursor-pointer"
          >
            QUAY LẠI HỆ THỐNG
          </button>
        </div>
      </div>
    );
  }

  // --- APPROVED USERS WORKSPACE ---
  
  const handleAiChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiChatInput.trim() || isAiChatLoading) return;

    const userMsg = aiChatInput.trim();
    setAiChatInput("");
    setAiChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiChatLoading(true);

    try {
      const response = await fetch('/api/ai?action=chat-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...aiChatMessages, { role: 'user', text: userMsg }] })
      });
      const data = await response.json();
      if (data.success) {
        logApiUsage("AI hỏi đáp");
        setAiChatMessages(prev => [...prev, { role: 'model', text: data.text }]);
      } else {
        triggerToast(data.error || "Lỗi khi gọi AI", false);
      }
    } catch (err: any) {
      triggerToast("Lỗi kết nối AI", false);
    } finally {
      setIsAiChatLoading(false);
    }
  };

  const extractTextFromImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      triggerToast("Vui lòng chọn hoặc dán file hình ảnh!", false);
      return;
    }
    
    setIsExtractingText(true);
    setIsAiChatLoading(true);
    triggerToast("Đang trích xuất văn bản từ hình ảnh...", true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = (reader.result as string).split(',')[1];
      try {
        const res = await fetch("/api/ai?action=extract-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Image, mimeType: file.type }),
        });
        
        if (!res.ok) {
          throw new Error("Lỗi máy chủ khi trích xuất");
        }

        const data = await res.json();
        if (data.success && data.text) {
          logApiUsage("Trích xuất văn bản");
          setAiChatInput(prev => prev + (prev ? "\n" : "") + data.text);
          triggerToast("Trích xuất văn bản thành công!", true);
        } else {
          triggerToast(data.error || "Không thể trích xuất văn bản từ hình ảnh này", false);
        }
      } catch (err: any) {
        console.error("Lỗi trích xuất văn bản:", err);
        triggerToast("Lỗi khi kết nối đến dịch vụ trích xuất văn bản!", false);
      } finally {
        setIsExtractingText(false);
        setIsAiChatLoading(false);
      }
    };
    reader.onerror = () => {
      triggerToast("Không thể đọc file hình ảnh!", false);
      setIsExtractingText(false);
      setIsAiChatLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await extractTextFromImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        hasImage = true;
        break;
      }
    }

    if (hasImage) {
      e.preventDefault(); // Chặn hoàn toàn hành vi dán văn bản mặc định để tránh dán thừa câu hỏi hoặc text cũ
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            await extractTextFromImage(file);
          }
        }
      }
    }
  };

  return (
    <div 
      className="h-[100dvh] w-full text-slate-800 antialiased font-sans flex flex-row overflow-hidden relative"
      style={{
        background: `
          radial-gradient(circle at 10% 90%, rgba(165,255,228,.45), transparent 45%),
          radial-gradient(circle at 90% 10%, rgba(210,180,255,.35), transparent 45%),
          radial-gradient(circle at 50% 50%, rgba(255,245,200,.20), transparent 50%),
          #FAFBFF
        `
      }}
    >
      {/* Toast message wrapper with exit animations */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            onAnimationComplete={() => {
              // Hide toast after 4s
              setTimeout(() => {
                setToast((prev) => ({ ...prev, show: false }));
              }, 4000);
            }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-full shadow-xl text-white font-medium text-xs md:text-sm flex items-center gap-2.5 z-50 ${
              toast.success
                ? "bg-slate-900 border border-slate-800"
                : "bg-red-600 border border-red-500"
            }`}
          >
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Premium Navigation Bar - sậm màu (trừ màu đen), sang trọng */}
      
      
      
      {/* MOBILE OVERLAY */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            onClick={() => setIsMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* LEFT SIDEBAR WRAPPER */}
      <div className={`fixed top-0 left-0 h-full z-[70] shrink-0 transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} w-64`}>
        <aside 
            className={`bg-white/90 backdrop-blur-md border-r border-white/60 flex-col flex h-full absolute left-0 top-0 transition-all duration-300 overflow-hidden w-64 shadow-[0_0_30px_rgba(120,120,180,.08)]`}
        >
          <div className={`p-6 flex items-center shrink-0 group gap-3 justify-between`}>
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center shadow-lg shrink-0 overflow-hidden p-1.5">
                    <img src="/logo.svg" alt="Word2LaTeX" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                 </div>
                 <div>
                    <div className="font-bold text-slate-800 text-[15px] leading-tight">Word2LaTeX.io.vn</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Chuyển đổi LaTeX sang Word</div>
                 </div>
             </div>
             
             {/* Close button */}
             <button onClick={() => setIsMenuOpen(false)} className={`p-1 text-slate-400 hover:text-slate-600 transition-colors`}>
                <X className="w-5 h-5" />
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-3 px-3 overflow-x-hidden w-full select-none">
              <div className="w-full shrink-0">
                  <button onClick={() => handleSidebarNav('overview')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-sm transition-all ${sidebarView === 'overview' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-white/50'}`}>
                      <Home className="w-4 h-4 shrink-0" /> <span className="truncate whitespace-nowrap">Tổng quan</span>
                  </button>
              </div>
              
              <div className="w-full shrink-0 flex flex-col gap-1">
                  <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1 px-3 uppercase truncate">Workspace</div>
                  <button onClick={() => handleSidebarNav('latex')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-sm transition-all ${sidebarView === 'latex' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-white/50'}`}>
                      <Sparkles className="w-4 h-4 shrink-0" /> <span className="truncate whitespace-nowrap">Chuyển đổi LaTeX</span>
                  </button>
                  <button onClick={() => handleSidebarNav('qbuilder')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-sm transition-all ${sidebarView === 'qbuilder' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-white/50'}`}>
                      <FileText className="w-4 h-4 shrink-0" /> <span className="truncate whitespace-nowrap">Soạn đề thi (AI)</span>
                  </button>
                  <button onClick={() => handleSidebarNav('markitdown')} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold text-sm transition-all ${sidebarView === 'markitdown' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-white/50'}`}>
                      <div className="flex items-center gap-3 truncate">
                          <Layout className="w-4 h-4 shrink-0 text-indigo-500" /> <span className="truncate whitespace-nowrap">MarkItDown AI</span>
                      </div>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md shrink-0">PRO</span>
                  </button>
              </div>

              <div className="w-full shrink-0 flex flex-col gap-1">
                  <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1 mt-2 px-3 uppercase truncate">Cài đặt</div>
                  <button onClick={() => handleSidebarNav('settings')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-sm transition-all ${sidebarView === 'settings' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-white/50'}`}>
                      <Settings className="w-4 h-4 shrink-0" /> <span className="truncate whitespace-nowrap">Cài đặt cá nhân</span>
                  </button>
              </div>

              {isAdminUser(user, userDoc) && (
                <div className="w-full shrink-0 flex flex-col gap-1">
                  <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1 mt-2 px-3 uppercase truncate">Quản trị</div>
                  <button onClick={() => handleSidebarNav('members')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-sm transition-all ${sidebarView === 'members' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-white/50'}`}>
                      <Users className="w-4 h-4 shrink-0" /> <span className="truncate whitespace-nowrap">Thành viên</span>
                  </button>
                  <button onClick={() => handleSidebarNav('tracking')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-sm transition-all ${sidebarView === 'tracking' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-white/50'}`}>
                      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" /> <span className="truncate whitespace-nowrap">Theo dõi</span>
                  </button>
                  <button onClick={() => handleSidebarNav('feedbacks')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-sm transition-all ${sidebarView === 'feedbacks' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-white/50'}`}>
                      <MessageSquare className="w-4 h-4 shrink-0" /> <span className="truncate whitespace-nowrap">Góp ý & Phản hồi</span>
                  </button>
                  <button onClick={() => handleSidebarNav('notify')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-sm transition-all ${sidebarView === 'notify' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-white/50'}`}>
                      <Bell className="w-4 h-4 shrink-0" /> <span className="truncate whitespace-nowrap">Thông báo</span>
                  </button>
                </div>
              )}
          </div>
          
          {!isApproved && (
            <div className="p-4 mt-auto w-full shrink-0">
                <div className="bg-[#F8F9FE] rounded-2xl p-4 border border-indigo-50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-200/40 to-transparent rounded-full -mr-12 -mt-12"></div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-xs uppercase">PRO PLAN</span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 mb-1">Mở khóa toàn bộ tính năng</div>
                    <div className="text-[10px] text-slate-500 mb-3 leading-relaxed">Trải nghiệm không giới hạn.</div>
                    <button 
                      onClick={() => setShowProUpgradeModal(true)}
                      className="w-full bg-white text-indigo-600 rounded-xl py-2 text-xs font-bold shadow-sm border border-slate-100 flex justify-center items-center gap-1 hover:shadow-md transition-all group cursor-pointer animate-pulse"
                    >
                       Nâng cấp <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/>
                    </button>
                </div>
            </div>
          )}
          <div className="text-[10px] text-slate-400 font-medium px-6 pb-6 pt-2 whitespace-nowrap truncate w-full shrink-0">© 2026 Word2LaTeX.io.vn</div>
      </aside>
      </div>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-y-auto">
          {/* TOPBAR */}
          <div className="sticky top-0 z-30 w-full bg-[#F8F9FD]/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                  <button 
                    onClick={() => setIsMenuOpen(true)}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-xs shrink-0"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowAiChat(true)}
                    className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl px-4 py-2.5 transition-all shadow-xs"
                  >
                      <Sparkles className="w-4 h-4" />
                      <span className="hidden sm:inline">Hỏi đáp AI</span>
                  </button>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                  {!isApproved && (
                    <button 
                      onClick={() => setShowProUpgradeModal(true)}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-colors border border-indigo-100 shadow-xs cursor-pointer shrink-0"
                    >
                        <Diamond className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">Nâng cấp PRO</span>
                        <span className="sm:hidden">PRO</span>
                    </button>
                  )}
                  <button onClick={() => setIsNotificationsOpen(true)} className="relative p-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-xs">
                      <Bell className="w-4 h-4" />
                      {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>}
                  </button>
                  
                  <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-xs cursor-pointer hover:bg-slate-50 transition-colors shrink-0" onClick={handleLogout}>
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 shrink-0">
                          <img src={getUserAvatar()} alt="User avatar" className="w-full h-full object-cover" />
                      </div>
                      <span className="font-bold text-xs text-slate-700 hidden sm:block truncate max-w-[100px]">{userDoc?.displayName || user?.displayName || user?.email?.split("@")[0]}</span>
                      {isAdminUser(user, userDoc) || isApproved ? (
                          <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase hidden sm:inline-block">PRO</span>
                      ) : null}
                  </div>
              </div>
          </div>


      <div className="flex-1 flex flex-col">
      <div className="max-w-full w-full px-4 sm:px-6 md:px-8 lg:px-10 py-2 md:py-4 flex-1 flex flex-col gap-4 md:gap-6 overflow-x-hidden">
        {(sidebarView === "members" || sidebarView === "feedbacks" || sidebarView === "notify" || sidebarView === "tracking") && isAdminUser(user, userDoc) && (
          <div 
            className="space-y-4 sm:space-y-6 flex-1 flex flex-col p-2 sm:p-6 rounded-2xl sm:rounded-[32px] overflow-hidden relative" 
            id="admin-panel-viewport"
          >
            {/* Sub-tab 1: Members Management */}
            {sidebarView === "members" && (() => {
              const totalMembers = allUsers.length;
              const activeMembers = allUsers.filter(u => u.status === "approved" || !u.status).length;
              const pendingMembers = allUsers.filter(u => u.status === "pending").length;
              
              const currentTodayStr = getTodayStr();
              const totalLatexCount = allUsers.reduce((sum, u) => {
                const isReset = u.lastLatexResetDate !== currentTodayStr;
                return sum + (isReset ? 0 : (Number(u.latexCount) || 0));
              }, 0);
              const totalPromptCount = allUsers.reduce((sum, u) => {
                const isReset = u.lastLatexResetDate !== currentTodayStr;
                return sum + (isReset ? 0 : (Number(u.promptCount) || 0));
              }, 0);

              const filteredUsers = allUsers.filter((u) => {
                const name = (u.displayName || "").toLowerCase();
                const email = (u.email || u.providerData?.[0]?.email || "").toLowerCase();
                const query = userSearchQuery.toLowerCase();
                if (filterStatus !== 'all' && u.status !== filterStatus && !(filterStatus === 'approved' && !u.status)) return false;
                return name.includes(query) || email.includes(query);
              });

              const itemsPerPage = 8;
              const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
              const currentPage = Math.min(Math.max(memberPage, 1), totalPages);
              const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

              return (
                <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] p-4 md:p-6 lg:p-8 flex-1 flex flex-col">
                  {/* Header */}
                  <div className="flex items-center gap-3.5 mb-6">
                    <div className="w-11 h-11 bg-white/50 rounded-xl flex items-center justify-center shrink-0 border border-white/50">
                      <Users className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold tracking-tight text-slate-800 font-sans">Quản lý thành viên</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Cấp quyền, điều chỉnh lượt dùng và quản trị danh sách người dùng hệ thống.</p>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white/50 border border-white/50 rounded-xl p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all duration-200">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50/50 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-lg font-black text-slate-800">{totalMembers}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng thành viên</div>
                      </div>
                    </div>
                    <div className="bg-white/50 border border-white/50 rounded-xl p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all duration-200">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50/50 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} />
                      </div>
                      <div>
                        <div className="text-lg font-black text-slate-800">{activeMembers}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đang hoạt động</div>
                      </div>
                    </div>
                    <div className="bg-white/50 border border-white/50 rounded-xl p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all duration-200">
                      <div className="w-10 h-10 rounded-lg bg-amber-50/50 flex items-center justify-center shrink-0">
                        <UserCog className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <div className="text-lg font-black text-slate-800">{pendingMembers}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chờ duyệt</div>
                      </div>
                    </div>
                    <div className="bg-white/50 border border-white/50 rounded-xl p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all duration-200">
                      <div className="w-10 h-10 rounded-lg bg-blue-50/50 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-lg font-black text-slate-800">
                          {totalLatexCount} <span className="text-slate-400 text-[10px] font-bold">/ 100</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">LaTeX đã dùng</div>
                      </div>
                    </div>
                    <div className="bg-white/50 border border-white/50 rounded-xl p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all duration-200 col-span-2 sm:col-span-1">
                      <div className="w-10 h-10 rounded-lg bg-rose-50/50 flex items-center justify-center shrink-0">
                        <span className="font-black text-rose-600 text-xs tracking-tight">AI</span>
                      </div>
                      <div>
                        <div className="text-lg font-black text-slate-800">
                          {totalPromptCount} <span className="text-slate-400 text-[10px] font-bold">/ 20</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dàn AI đã dùng</div>
                      </div>
                    </div>
                  </div>

                  {/* Table Card */}
                  <div className="bg-white/72 backdrop-blur-lg border border-white/50 rounded-[28px] flex-1 flex flex-col overflow-hidden shadow-[0_10px_40px_rgba(120,120,180,.08)]">
                    {/* Toolbar */}
                    <div className="p-5 border-b border-white/50 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/50">
                      <div className="flex items-center gap-3 w-full sm:w-auto flex-1 justify-end sm:justify-start">
                        {/* Left toolbar elements if any */}
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-[260px]">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Tìm tên hoặc email..."
                            value={userSearchQuery}
                            onChange={(e) => {
                              setUserSearchQuery(e.target.value);
                              setMemberPage(1);
                            }}
                            className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-full pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-700 placeholder-slate-400 outline-none transition-all duration-200 focus:border-[#6B5CFF] focus:bg-white focus:ring-4 focus:ring-[#6B5CFF]/10"
                          />
                        </div>
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#E8EBF3] hover:bg-[#F9F9FF] rounded-full text-xs font-bold text-slate-600 transition-all duration-200 shadow-2xs"
                          >
                            <Filter className="w-3.5 h-3.5" />
                            Bộ lọc
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          {showFilterDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-[#EEF2F7] rounded-2xl shadow-xl z-50 overflow-hidden py-1">
                              <button onClick={() => { setFilterStatus('all'); setShowFilterDropdown(false); setMemberPage(1); }} className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors ${filterStatus === 'all' ? 'text-[#6B5CFF] font-bold bg-[#F3F1FF]' : 'text-slate-700 font-medium'}`}>Tất cả trạng thái</button>
                              <button onClick={() => { setFilterStatus('approved'); setShowFilterDropdown(false); setMemberPage(1); }} className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors ${filterStatus === 'approved' ? 'text-[#6B5CFF] font-bold bg-[#F3F1FF]' : 'text-slate-700 font-medium'}`}>Đang hoạt động</button>
                              <button onClick={() => { setFilterStatus('pending'); setShowFilterDropdown(false); setMemberPage(1); }} className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors ${filterStatus === 'pending' ? 'text-[#6B5CFF] font-bold bg-[#F3F1FF]' : 'text-slate-700 font-medium'}`}>Chờ duyệt</button>
                              <button onClick={() => { setFilterStatus('rejected'); setShowFilterDropdown(false); setMemberPage(1); }} className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors ${filterStatus === 'rejected' ? 'text-[#6B5CFF] font-bold bg-[#F3F1FF]' : 'text-slate-700 font-medium'}`}>Đã khóa</button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setShowAddMemberModal(true)}
                          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#7B5CFF] to-[#6A6CFF] text-white rounded-full text-xs font-bold transition-all duration-200 shadow-[0_8px_20px_rgba(107,92,255,0.2)] hover:shadow-[0_10px_24px_rgba(107,92,255,0.3)] hover:scale-[1.02] active:scale-[0.98] shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Thêm thành viên
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                          <tr className="bg-white border-b border-[#EEF2F7] text-[#7D8799] text-[10px] font-bold uppercase tracking-wider">
                            <th className="py-4 px-6 w-[25%]">Thành viên</th>
                            <th className="py-4 px-6 w-[25%]">Email</th>
                            <th className="py-4 px-6 w-[18%]">Trạng thái / Vai trò</th>
                            <th className="py-4 px-6 w-[14%]">Sử dụng</th>
                            <th className="py-4 px-6 w-[18%] text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EEF2F7]/50">
                          {paginatedUsers.map((u) => {
                            const isSelf = user && u.uid === user.uid;
                            const isApproved = u.status === "approved" || !u.status;
                            const isAdmin = u.role === "admin";
                            
                            // Generator for beautiful pastel initials backgrounds matching the image
                            const getInitialsStyle = (nameStr: string, emailStr: string) => {
                              const char = nameStr ? nameStr.charAt(0).toUpperCase() : (emailStr ? emailStr.charAt(0).toUpperCase() : 'U');
                              const code = char.charCodeAt(0) || 0;
                              const styles = [
                                { bg: "bg-[#EFF6FF] border border-[#EFF6FF]/20", text: "text-[#3B82F6]" },
                                { bg: "bg-[#F3F1FF] border border-[#F3F1FF]/20", text: "text-[#6B5CFF]" },
                                { bg: "bg-[#E6F9EE] border border-[#E6F9EE]/20", text: "text-[#22C55E]" },
                                { bg: "bg-[#FFFBEB] border border-[#FFFBEB]/20", text: "text-[#F59E0B]" },
                                { bg: "bg-[#FFF1F2] border border-[#FFF1F2]/20", text: "text-[#F43F5E]" },
                              ];
                              return { style: styles[code % styles.length], char };
                            };

                            const { style: avatarStyle, char: avatarChar } = getInitialsStyle(u.displayName, u.email);

                            return (
                              <tr key={u.uid} className="hover:bg-[#FCFCFF]/60 transition-colors group">
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden font-bold text-sm shadow-sm ${u.photoURL ? 'bg-slate-100' : avatarStyle.bg + ' ' + avatarStyle.text}`}>
                                      {u.photoURL ? (
                                        <img referrerPolicy="no-referrer" src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                                      ) : (
                                        <span>{avatarChar}</span>
                                      )}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <div className="font-extrabold text-[#1E2432] text-[13px] flex items-center gap-1.5 flex-wrap">
                                        <span className="truncate max-w-[130px]">{u.displayName || "Thành viên mới"}</span>
                                        {isSelf && (
                                          <span className="bg-[#F3F1FF] text-[#6B5CFF] text-[9px] font-black px-1.5 py-0.5 rounded-full border border-[#ECE8FF] tracking-wider uppercase">OWNER</span>
                                        )}
                                      </div>
                                      <div className="text-slate-400 font-mono text-[9px] mt-0.5 tracking-tight truncate max-w-[160px]">{u.uid}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="text-[#1E2432] font-semibold text-[13px] truncate max-w-[220px]">{u.email || "Không có email"}</div>
                                  <div className="text-slate-400 text-[11px] mt-0.5 font-medium">Tham gia: {u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "29/06/2026"}</div>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {u.status === "pending" && (
                                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#FFFBEB] text-[#F59E0B] border border-amber-100/50">
                                        CHỜ DUYỆT
                                      </span>
                                    )}
                                    {u.status === "rejected" && (
                                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#FFF1F2] text-[#F43F5E] border border-rose-100/50">
                                        BỊ KHÓA
                                      </span>
                                    )}
                                    {(u.status === "pending" || u.status === "rejected") && (
                                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200/50">
                                        {isAdmin ? "ADMIN" : "USER"}
                                      </span>
                                    )}
                                    
                                    {isApproved && (
                                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#E6F9EE] text-[#10B981] border border-emerald-100/50">
                                        {isAdmin ? "ADMIN" : "USER"}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-[12px]">
                                  {(isApproved || isAdmin) ? (
                                    <div className="flex flex-col">
                                      <span className="text-[#22C55E] font-bold text-sm">Không giới hạn</span>
                                      <div className="text-slate-400 font-medium text-[11px] mt-0.5">Tổng yêu cầu: {u.queryCount || 0}</div>
                                    </div>
                                  ) : (() => {
                                    const isReset = u.lastLatexResetDate !== getTodayStr();
                                    return (
                                      <div className="flex flex-col gap-0.5 text-slate-600 font-semibold text-[11px]">
                                        <div>LaTeX: <span className="font-extrabold text-[#1E2432]">{isReset ? 0 : (u.latexCount || 0)} / 30</span></div>
                                        <div>Đề thi: <span className="font-extrabold text-[#1E2432]">{isReset ? 0 : (u.examCount || 0)} / 5</span></div>
                                        <div>Dàn AI: <span className="font-extrabold text-[#1E2432]">{isReset ? 0 : (u.promptCount || 0)} / 10</span></div>
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="py-4 px-6 w-[18%] min-w-[160px]">
                                  <div className="flex items-center justify-end gap-2">
                                    {u.status === "pending" && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleUpdateUserStatus(u.uid, "approved"); }}
                                          className="w-8 h-8 rounded-full flex items-center justify-center bg-[#E6F9EE] text-[#10B981] hover:bg-[#d1f5de] transition-all duration-200 border border-emerald-100/50 shadow-xs cursor-pointer"
                                          title="Phê duyệt"
                                        >
                                          <Check className="w-4 h-4 pointer-events-none" strokeWidth={3} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleUpdateUserStatus(u.uid, "rejected"); }}
                                          className="w-8 h-8 rounded-full flex items-center justify-center bg-[#FFF1F2] text-[#F43F5E] hover:bg-[#ffe4e6] transition-all duration-200 border border-rose-100/50 shadow-xs cursor-pointer"
                                          title="Từ chối"
                                        >
                                          <X className="w-4 h-4 pointer-events-none" strokeWidth={3} />
                                        </button>
                                      </>
                                    )}
                                    
                                    {(isApproved || u.status === "rejected") && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const isReset = u.lastLatexResetDate !== getTodayStr();
                                          setEditingUser({
                                            ...u,
                                            latexCount: isReset ? 0 : (u.latexCount || 0),
                                            examCount: isReset ? 0 : (u.examCount || 0),
                                            promptCount: isReset ? 0 : (u.promptCount || 0),
                                            lastLatexResetDate: getTodayStr()
                                          });
                                          setShowEditMemberModal(true);
                                        }}
                                        className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-slate-500 hover:text-slate-700 hover:bg-[#F9F9FF] border border-[#E8EBF3] transition-all duration-200 shadow-xs cursor-pointer"
                                        title="Chỉnh sửa"
                                      >
                                        <Pencil className="w-3.5 h-3.5 pointer-events-none" />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (isSelf) {
                                          triggerToast("Bạn không thể tự xóa tài khoản của chính mình!", false);
                                          return;
                                        }
                                        if (window.confirm("Bạn có chắc chắn muốn xóa thành viên này?")) {
                                          try {
                                            await deleteDoc(doc(db, "users", u.uid));
                                            triggerToast("Xóa thành viên thành công!");
                                          } catch (e: any) {
                                            triggerToast("Có lỗi khi xóa: " + e.message, false);
                                          }
                                        }
                                      }}
                                      className="w-8 h-8 rounded-full flex items-center justify-center bg-[#FFF1F2] text-[#F43F5E] hover:bg-[#ffe4e6] transition-all duration-200 border border-rose-100/50 shadow-xs cursor-pointer"
                                      title="Xóa"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {paginatedUsers.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-12 text-center">
                                <div className="flex flex-col items-center justify-center text-[#7D8799]">
                                  <Users className="w-10 h-10 mb-3 opacity-20" />
                                  <p className="text-sm font-medium">Không tìm thấy thành viên nào</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Footer */}
                    {totalPages > 1 && (
                      <div className="px-6 py-4 border-t border-[#EEF2F7] flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/50">
                        <div className="text-xs font-semibold text-slate-500">
                          Hiển thị <span className="text-[#1E2432] font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-[#1E2432] font-bold">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> trong tổng số <span className="text-[#1E2432] font-bold">{filteredUsers.length}</span> thành viên
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setMemberPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className={`w-8 h-8 rounded-full flex items-center justify-center border border-[#E8EBF3] transition-all duration-200 ${
                              currentPage === 1
                                ? "text-slate-300 bg-slate-50/50 cursor-not-allowed"
                                : "text-slate-600 bg-white hover:bg-[#F9F9FF] hover:border-[#6B5CFF]/30 active:scale-95 cursor-pointer"
                            }`}
                            title="Trang trước"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                            if (
                              p === 1 ||
                              p === totalPages ||
                              Math.abs(p - currentPage) <= 1
                            ) {
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setMemberPage(p)}
                                  className={`w-8 h-8 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                                    currentPage === p
                                      ? "bg-gradient-to-r from-[#7B5CFF] to-[#6A6CFF] text-white shadow-md shadow-[#6B5CFF]/20"
                                      : "bg-white text-slate-600 border border-[#E8EBF3] hover:bg-[#F9F9FF] hover:border-[#6B5CFF]/30 active:scale-95"
                                  }`}
                                >
                                  {p}
                                </button>
                              );
                            }
                            if (
                              (p === 2 && currentPage > 3) ||
                              (p === totalPages - 1 && currentPage < totalPages - 2)
                            ) {
                              return (
                                <span key={p} className="text-slate-400 text-xs px-1 font-bold">
                                  ...
                                </span>
                              );
                            }
                            return null;
                          })}

                          <button
                            type="button"
                            onClick={() => setMemberPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className={`w-8 h-8 rounded-full flex items-center justify-center border border-[#E8EBF3] transition-all duration-200 ${
                              currentPage === totalPages
                                ? "text-slate-300 bg-slate-50/50 cursor-not-allowed"
                                : "text-slate-600 bg-white hover:bg-[#F9F9FF] hover:border-[#6B5CFF]/30 active:scale-95 cursor-pointer"
                            }`}
                            title="Trang sau"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Add Member Modal */}
                  <AnimatePresence>
                    {showAddMemberModal && (
                      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-white rounded-[28px] border border-[#EEF2F7] shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-6 gap-5"
                        >
                          <div className="flex items-center justify-between border-b border-[#EEF2F7] pb-4">
                            <div>
                              <h3 className="text-lg font-extrabold text-[#1E2432] font-sans">Thêm thành viên</h3>
                              <p className="text-xs text-[#7A8397] font-medium mt-0.5">Tạo tài khoản người dùng mới thủ công.</p>
                            </div>
                            <button
                              onClick={() => {
                                setShowAddMemberModal(false);
                                setNewMemberEmail("");
                                setNewMemberName("");
                                setNewMemberRole("user");
                                setNewMemberStatus("approved");
                              }}
                              className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center transition-colors"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-[#1E2432]">Họ và tên</label>
                              <input
                                type="text"
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                placeholder="Nhập họ và tên..."
                                className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF] focus:ring-4 focus:ring-[#6B5CFF]/10"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-[#1E2432]">Địa chỉ Email</label>
                              <input
                                type="email"
                                value={newMemberEmail}
                                onChange={(e) => setNewMemberEmail(e.target.value)}
                                placeholder="name@domain.com"
                                className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF] focus:ring-4 focus:ring-[#6B5CFF]/10"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#1E2432]">Vai trò</label>
                                <select
                                  value={newMemberRole}
                                  onChange={(e) => setNewMemberRole(e.target.value)}
                                  className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF]"
                                >
                                  <option value="user">User</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#1E2432]">Trạng thái</label>
                                <select
                                  value={newMemberStatus}
                                  onChange={(e) => setNewMemberStatus(e.target.value)}
                                  className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF]"
                                >
                                  <option value="approved">Hoạt động</option>
                                  <option value="pending">Chờ duyệt</option>
                                  <option value="rejected">Bị khóa</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-3 border-t border-[#EEF2F7] pt-4 mt-2">
                            <button
                              onClick={() => {
                                setShowAddMemberModal(false);
                                setNewMemberEmail("");
                                setNewMemberName("");
                                setNewMemberRole("user");
                                setNewMemberStatus("approved");
                              }}
                              className="px-5 py-2.5 border border-[#E8EBF3] hover:bg-slate-50 rounded-full text-xs font-bold text-slate-600 transition-all duration-200"
                            >
                              Hủy bỏ
                            </button>
                            <button
                              onClick={handleAddNewMember}
                              className="px-6 py-2.5 bg-gradient-to-r from-[#7B5CFF] to-[#6A6CFF] text-white rounded-full text-xs font-bold transition-all duration-200 shadow-[0_8px_20px_rgba(107,92,255,0.2)] hover:shadow-[0_10px_24px_rgba(107,92,255,0.3)]"
                            >
                              Thêm thành viên
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Edit Member Modal */}
                  <AnimatePresence>
                    {showEditMemberModal && editingUser && (
                      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-white rounded-[28px] border border-[#EEF2F7] shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-6 gap-5"
                        >
                          <div className="flex items-center justify-between border-b border-[#EEF2F7] pb-4">
                            <div>
                              <h3 className="text-lg font-extrabold text-[#1E2432] font-sans">Chỉnh sửa thành viên</h3>
                              <p className="text-xs text-[#7A8397] font-medium mt-0.5">Cập nhật thông tin và cấu hình hạn mức.</p>
                            </div>
                            <button
                              onClick={() => {
                                setShowEditMemberModal(false);
                                setEditingUser(null);
                              }}
                              className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center transition-colors"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-[#1E2432]">Họ và tên</label>
                              <input
                                type="text"
                                value={editingUser.displayName || ""}
                                onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                                placeholder="Nhập họ và tên..."
                                className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF] focus:ring-4 focus:ring-[#6B5CFF]/10"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#1E2432]">Vai trò</label>
                                <select
                                  value={editingUser.role || "user"}
                                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                                  className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF]"
                                >
                                  <option value="user">User</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#1E2432]">Trạng thái</label>
                                <select
                                  value={editingUser.status || "approved"}
                                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                                  className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF]"
                                >
                                  <option value="approved">Hoạt động</option>
                                  <option value="pending">Chờ duyệt</option>
                                  <option value="rejected">Bị khóa</option>
                                </select>
                              </div>
                            </div>

                            <div className="border-t border-[#EEF2F7] pt-3 flex flex-col gap-3">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hạn mức sử dụng (Lượt đã dùng)</span>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-bold text-[#1E2432]">LaTeX (Tối đa 30)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={30}
                                    value={editingUser.latexCount !== undefined ? editingUser.latexCount : 0}
                                    onChange={(e) => setEditingUser({ ...editingUser, latexCount: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF]"
                                  />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-bold text-[#1E2432]">Đề thi (Tối đa 5)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={5}
                                    value={editingUser.examCount !== undefined ? editingUser.examCount : 0}
                                    onChange={(e) => setEditingUser({ ...editingUser, examCount: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF]"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-bold text-[#1E2432]">Dàn AI (Tối đa 10)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={editingUser.promptCount !== undefined ? editingUser.promptCount : 0}
                                    onChange={(e) => setEditingUser({ ...editingUser, promptCount: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF]"
                                  />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-bold text-[#1E2432]">Tổng yêu cầu</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editingUser.queryCount !== undefined ? editingUser.queryCount : 0}
                                    onChange={(e) => setEditingUser({ ...editingUser, queryCount: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-[#6B5CFF]"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-3 border-t border-[#EEF2F7] pt-4 mt-2">
                            <button
                              onClick={() => {
                                setShowEditMemberModal(false);
                                setEditingUser(null);
                              }}
                              className="px-5 py-2.5 border border-[#E8EBF3] hover:bg-slate-50 rounded-full text-xs font-bold text-slate-600 transition-all duration-200"
                            >
                              Hủy bỏ
                            </button>
                            <button
                              onClick={handleSaveEditedMember}
                              className="px-6 py-2.5 bg-gradient-to-r from-[#7B5CFF] to-[#6A6CFF] text-white rounded-full text-xs font-bold transition-all duration-200 shadow-[0_8px_20px_rgba(107,92,255,0.2)] hover:shadow-[0_10px_24px_rgba(107,92,255,0.3)]"
                            >
                              Lưu thay đổi
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })()}

            {/* Sub-tab 2: Feedback Management */}
            {sidebarView === "feedbacks" && (
              <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] p-4 md:p-6 lg:p-8 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100">
                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-800 font-sans">Ý kiến góp ý</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Đọc đánh giá, phản hồi trực tiếp và tương tác hỗ trợ thành viên.</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bộ lọc góp ý:</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <select
                      value={feedbackTypeFilter}
                      onChange={(e) => setFeedbackTypeFilter(e.target.value)}
                      className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl py-2 px-3 cursor-pointer outline-none transition-all focus:border-indigo-400 hover:border-slate-300 font-medium shadow-2xs"
                    >
                      <option value="all">Tất cả phân loại</option>
                      <option value="bug">Bug / Lỗi hệ thống</option>
                      <option value="request">Đề xuất tính năng</option>
                      <option value="suggestion">Góp ý trải nghiệm</option>
                      <option value="other">Khác</option>
                    </select>

                    <div className="relative w-full sm:w-60">
                      <input
                        type="text"
                        placeholder="Tìm kiếm người gửi..."
                        value={feedbackSearchQuery}
                        onChange={(e) => setFeedbackSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3.5 py-2 text-xs outline-none transition-all focus:border-indigo-400 font-medium shadow-2xs"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px] pr-2">
                  {allFeedbacks
                    .filter((fb) => {
                      const emailMatch = (fb.email || "").toLowerCase().includes(feedbackSearchQuery.toLowerCase());
                      const nameMatch = (fb.displayName || "").toLowerCase().includes(feedbackSearchQuery.toLowerCase());
                      const typeMatch = feedbackTypeFilter === "all" || fb.type === feedbackTypeFilter;
                      return (emailMatch || nameMatch) && typeMatch;
                    })
                    .map((fb) => {
                      const ratingStars = Array(5).fill(0).map((_, i) => i < (fb.rating || 5));
                      return (
                        <div key={fb.id} className="bg-white border border-slate-200/80 rounded-xl p-4.5 relative transition-all hover:border-slate-300 shadow-2xs">
                          <div className="flex flex-wrap items-start md:items-center justify-between gap-2.5 mb-3 pr-24">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-slate-800 text-xs">{fb.displayName || "Thành viên"}</span>
                              <span className="text-[11px] text-slate-400 font-semibold">{fb.email}</span>
                              <span className="text-[9px] font-black tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{fb.version || "v1.0"}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {fb.createdAt ? new Date(fb.createdAt).toLocaleString("vi-VN") : "Gần đây"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              fb.type === "bug"
                                ? "bg-rose-550/10 text-rose-600 border border-rose-100"
                                : fb.type === "request"
                                  ? "bg-sky-550/10 text-sky-600 border border-sky-100"
                                  : "bg-emerald-550/10 text-emerald-600 border border-emerald-100"
                            }`}>
                              {fb.type === "bug" ? "Lỗi (Bug)" : fb.type === "request" ? "Đề xuất" : "Góp ý / Khác"}
                            </span>

                            <div className="flex items-center text-amber-400 gap-0.5 ml-1">
                              {ratingStars.map((isFilled, idx) => (
                                <span key={idx} className="text-xs leading-none">{isFilled ? "★" : "☆"}</span>
                              ))}
                            </div>
                          </div>

                          <div className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap bg-slate-50/50 border border-slate-100 rounded-lg p-3.5 mb-3.5">
                            {fb.feedbackText}
                          </div>

                          {fb.feedbackImage && (
                            <div className="mb-3.5">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                                Hình ảnh đính kèm:
                              </span>
                              <div className="relative group max-w-[200px] rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shadow-2xs">
                                <img
                                  src={fb.feedbackImage}
                                  alt="Hình ảnh đính kèm"
                                  className="w-full h-auto max-h-40 object-cover cursor-zoom-in group-hover:scale-[1.02] transition-transform duration-300"
                                  onClick={() => setPreviewImageSrc(fb.feedbackImage)}
                                />
                                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors pointer-events-none flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-sm" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Admin Reply area */}
                          {fb.replyText ? (
                            <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-lg p-3.5 text-xs text-indigo-900 leading-relaxed">
                              <div className="font-extrabold flex items-center gap-1.5 text-indigo-950 mb-1">
                                <span className="text-indigo-700">●</span> Phản hồi của bạn:
                                <span className="text-[10px] text-slate-400 font-bold">
                                  ({fb.replyAt ? new Date(fb.replyAt).toLocaleString("vi-VN") : "N/A"})
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-slate-600 font-medium leading-relaxed">{fb.replyText}</p>
                            </div>
                          ) : (
                            activeReplyFeedbackId !== fb.id && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setActiveReplyFeedbackId(fb.id)}
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg font-bold text-xs cursor-pointer transition-all border border-indigo-100"
                                >
                                  Phản hồi ý kiến
                                </button>
                              </div>
                            )
                          )}

                          {activeReplyFeedbackId === fb.id && (
                            <div className="space-y-2 mt-3 bg-indigo-50/20 border border-indigo-100/60 rounded-lg p-3.5">
                              <textarea
                                value={feedbackReplyText}
                                onChange={(e) => setFeedbackReplyText(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-indigo-400 placeholder:text-slate-400"
                                placeholder="Nhập câu trả lời gửi tới người dùng..."
                                rows={2.5}
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setActiveReplyFeedbackId(null)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                >
                                  Hủy
                                </button>
                                <button
                                  onClick={() => handleSendFeedbackReply(fb.id, fb.uid, fb.email)}
                                  disabled={isSendingReply}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                                >
                                  {isSendingReply && <Loader2 className="h-3 w-3 animate-spin" />}
                                  Gửi phản hồi
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Delete Feedback Option */}
                          <div className="absolute top-4.5 right-4.5 flex items-center gap-1.5 bg-white/95 rounded-lg p-1 border border-slate-100 shadow-2xs">
                            {deletingFeedbackId === fb.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={async () => {
                                    try {
                                      await deleteDoc(doc(db, "feedbacks", fb.id));
                                      triggerToast("Xóa phản hồi thành công.");
                                    } catch (e) {
                                      triggerToast("Lỗi khi xóa phản hồi.", false);
                                    } finally {
                                      setDeletingFeedbackId(null);
                                    }
                                  }}
                                  className="text-[9px] bg-rose-600 hover:bg-rose-700 text-white font-black px-2 py-1 rounded transition-colors cursor-pointer uppercase"
                                >
                                  Xóa
                                </button>
                                <button
                                  onClick={() => setDeletingFeedbackId(null)}
                                  className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2 py-1 rounded transition-colors cursor-pointer uppercase"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingFeedbackId(fb.id)}
                                className="text-[10px] text-rose-500 hover:text-rose-700 hover:bg-rose-50 font-bold cursor-pointer px-2 py-1 rounded transition-colors"
                                title="Xóa góp ý này"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {allFeedbacks.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic text-xs">
                      Chưa có đóng góp ý kiến nào từ người dùng.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-tab 3: Notification Broadcaster */}
            {sidebarView === "notify" && (
              <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] p-4 md:p-6 lg:p-8 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100">
                    <Bell className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-800 font-sans">Thông báo hệ thống</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Soạn thảo, quản lý và phát tin tức truyền thông nội bộ tới các thành viên.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Form column */}
                  <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 p-5 space-y-4 shadow-2xs">
                    <div>
                      <h2 className="text-sm font-black text-slate-800">
                        {editingNotificationId ? "✏️ Chỉnh sửa thông báo" : "📢 Phát thông báo mới"}
                      </h2>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {editingNotificationId 
                          ? "Cập nhật lại tiêu đề, nội dung hoặc đối tượng nhận tin."
                          : "Gửi tin nhắn phát sóng toàn bộ hoặc gửi riêng tới một người dùng cụ thể."}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đối tượng nhận:</label>
                        <select
                          value={editingNotificationId ? editingNoticeTarget : generalNoticeTarget}
                          onChange={(e) => {
                            if (editingNotificationId) {
                              setEditingNoticeTarget(e.target.value);
                            } else {
                              setGeneralNoticeTarget(e.target.value);
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 hover:border-slate-300 rounded-xl px-3 py-2.5 text-xs outline-none transition-all cursor-pointer font-semibold text-slate-750"
                        >
                          <option value="all">📢 Phát sóng toàn hệ thống</option>
                          {allUsers.map((u) => (
                            <option key={u.uid} value={u.uid}>
                              👤 {u.displayName || "Thành viên"} ({u.email})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tiêu đề:</label>
                        <input
                          type="text"
                          value={editingNotificationId ? editingNoticeTitle : generalNoticeTitle}
                          onChange={(e) => {
                            if (editingNotificationId) {
                              setEditingNoticeTitle(e.target.value);
                            } else {
                              setGeneralNoticeTitle(e.target.value);
                            }
                          }}
                          placeholder="Ví dụ: Cập nhật hệ thống v2.0..."
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all font-semibold placeholder:text-slate-400 text-slate-700"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nội dung chi tiết:</label>
                        <textarea
                          value={editingNotificationId ? editingNoticeContent : generalNoticeContent}
                          onChange={(e) => {
                            if (editingNotificationId) {
                              setEditingNoticeContent(e.target.value);
                            } else {
                              setGeneralNoticeContent(e.target.value);
                            }
                          }}
                          placeholder="Nhập nội dung đầy đủ của thông báo..."
                          rows={4}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all font-semibold placeholder:text-slate-400 text-slate-700"
                        />
                      </div>

                      {editingNotificationId ? (
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleUpdateGeneralNotification}
                            disabled={isUpdatingGeneralNotice}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            {isUpdatingGeneralNotice && <Loader2 className="h-3 w-3 animate-spin" />}
                            Cập nhật ngay
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNotificationId(null);
                              setEditingNoticeTitle("");
                              setEditingNoticeContent("");
                              setEditingNoticeTarget("all");
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 px-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer border border-slate-200"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendGeneralNotification}
                          disabled={isSendingGeneralNotice}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {isSendingGeneralNotice && <Loader2 className="h-3 w-3 animate-spin" />}
                          Gửi thông báo ngay
                        </button>
                      )}
                    </div>
                  </div>

                  {/* History list column */}
                  <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 p-5 flex flex-col shadow-2xs min-h-[400px]">
                    <div className="mb-4">
                      <h2 className="text-sm font-black text-slate-800">📋 Lịch sử đã gửi ({allNotifications.length})</h2>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Danh sách các tin tức đã phát đi trong hệ thống.</p>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {allNotifications.map((n) => {
                        const dateStr = n.createdAt
                          ? new Date(n.createdAt).toLocaleString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "N/A";

                        const isSystem = n.type === "system" || n.targetUid === "all";

                        return (
                          <div
                            key={n.id}
                            className={`p-3.5 rounded-lg border transition-all flex flex-col gap-2.5 ${
                              editingNotificationId === n.id
                                ? "bg-indigo-50/30 border-indigo-200 ring-1 ring-indigo-200/50"
                                : "bg-slate-50/50 hover:bg-slate-50 border-slate-100"
                            }`}
                          >
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                      isSystem
                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                        : "bg-blue-50 text-blue-700 border border-blue-200"
                                    }`}
                                  >
                                    {isSystem ? "Hệ thống" : "Cá nhân"}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-bold font-mono">{dateStr}</span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingNotificationId(n.id);
                                      setEditingNoticeTitle(n.title || "");
                                      setEditingNoticeContent(n.content || "");
                                      setEditingNoticeTarget(n.targetUid || "all");
                                      // Scroll to top if on mobile
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded font-bold transition-all cursor-pointer"
                                  >
                                    Sửa
                                  </button>
                                  {deletingNotificationId === n.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={async () => {
                                          await handleDeleteGeneralNotification(n.id);
                                          setDeletingNotificationId(null);
                                        }}
                                        className="text-[9px] text-white bg-rose-600 hover:bg-rose-700 px-1.5 py-0.5 rounded font-black uppercase transition-all cursor-pointer"
                                      >
                                        Xóa
                                      </button>
                                      <button
                                        onClick={() => setDeletingNotificationId(null)}
                                        className="text-[9px] text-slate-500 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer"
                                      >
                                        Hủy
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeletingNotificationId(n.id)}
                                      className="text-[10px] text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded font-bold transition-all cursor-pointer"
                                    >
                                      Xóa
                                    </button>
                                  )}
                                </div>
                              </div>

                              <h3 className="text-xs font-black text-slate-800 leading-snug">{n.title}</h3>
                              <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed break-words font-medium">{n.content}</p>

                              <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
                                <span>Người nhận:</span>{" "}
                                <span className="bg-white border border-slate-100 px-1.5 py-0.2 rounded text-slate-500 font-mono text-[9px]">
                                  {n.targetEmail || (isSystem ? "Tất cả" : "N/A")}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {allNotifications.length === 0 && (
                        <div className="py-12 text-center text-slate-400 italic text-xs">
                          Chưa phát thông báo nào.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Sub-tab 4: Tracking & Warnings */}
            {sidebarView === "tracking" && (() => {
              // 1. Group users by Device Fingerprint
              const deviceFingerprintGroups = new Map<string, any[]>();
              // 2. Group users by lastIp
              const ipGroups = new Map<string, any[]>();

              allUsers.forEach(u => {
                // Skip if dismissedAlert is true (user explicitly dismissed)
                if (u.dismissedAlert) return;

                if (u.deviceFingerprint) {
                  if (!deviceFingerprintGroups.has(u.deviceFingerprint)) {
                    deviceFingerprintGroups.set(u.deviceFingerprint, []);
                  }
                  deviceFingerprintGroups.get(u.deviceFingerprint)!.push(u);
                }
                if (u.lastIp && u.lastIp !== "unknown") {
                  if (!ipGroups.has(u.lastIp)) {
                    ipGroups.set(u.lastIp, []);
                  }
                  ipGroups.get(u.lastIp)!.push(u);
                }
              });

              // NÂNG CẤP HỆ THỐNG:
              // Chỉ coi là trùng khớp thiết bị thực tế nếu vân tay thiết bị có định dạng hiện đại (chứa "dev_")
              // Các dấu vân tay kiểu cũ (legacy) thiếu mã ngẫu nhiên, dẫn đến tỉ lệ báo động nhầm (false positive) cực kỳ cao
              // khi nhiều người dùng sử dụng cùng phiên bản trình duyệt và độ phân giải màn hình.
              const flaggedDeviceGroups = Array.from(deviceFingerprintGroups.entries())
                .map(([fp, group]) => [fp, group.filter(u => u.role !== "admin" && u.status !== "approved")] as [string, any[]])
                .filter(([fp, group]) => group.length > 1 && fp.includes("dev_"));

              const flaggedIpGroups = Array.from(ipGroups.entries())
                .map(([ip, group]) => {
                  const filteredGroup = group.filter(u => u.role !== "admin" && u.status !== "approved");
                  const uniqueFps = new Set(filteredGroup.map(u => u.deviceFingerprint).filter(Boolean));
                  
                  // Nếu tất cả tài khoản có chung một dấu vân tay duy nhất thì đã hiển thị ở nhóm trùng thiết bị rồi
                  if (uniqueFps.size === 1 && filteredGroup.length > 1) {
                    return [ip, []] as [string, any[]];
                  }
                  
                  return [ip, filteredGroup] as [string, any[]];
                })
                .filter(([ip, group]) => group.length > 1);

              const totalAlerts = flaggedDeviceGroups.length + flaggedIpGroups.length;

              // Đếm số tài khoản có dấu vân tay cũ bị bỏ qua để thông báo rõ ràng cho admin biết việc nâng cấp này
              let legacyUserCount = 0;
              deviceFingerprintGroups.forEach((group, fp) => {
                if (!fp.includes("dev_")) {
                  const unapproved = group.filter(u => u.role !== "admin" && u.status !== "approved");
                  if (unapproved.length > 1) {
                    legacyUserCount += unapproved.length;
                  }
                }
              });

              const handleDismissGroup = async (groupUsers: any[]) => {
                try {
                  const promises = groupUsers.map(u => 
                    updateDoc(doc(db, "users", u.uid), { dismissedAlert: true })
                  );
                  await Promise.all(promises);
                } catch (error) {
                  console.error("Lỗi khi bỏ qua cảnh báo nhóm:", error);
                }
              };

              const handleDismissAll = async () => {
                setDismissingAll(true);
                try {
                  const usersToDismiss = [
                    ...flaggedDeviceGroups.flatMap(([_, group]) => group),
                    ...flaggedIpGroups.flatMap(([_, group]) => group)
                  ];
                  
                  const promises = usersToDismiss.map(u => 
                    updateDoc(doc(db, "users", u.uid), { dismissedAlert: true })
                  );
                  await Promise.all(promises);
                } catch (error) {
                  console.error("Lỗi khi bỏ qua tất cả cảnh báo:", error);
                } finally {
                  setDismissingAll(false);
                }
              };

              return (
                <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] p-4 md:p-6 lg:p-8 flex-1 flex flex-col">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center shrink-0 border border-amber-100">
                        <ShieldAlert className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold tracking-tight text-slate-800">Hệ thống theo dõi & cảnh báo</h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Phân biệt và kiểm soát hành vi đăng nhập nhiều tài khoản</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {totalAlerts > 0 && (
                        <button
                          onClick={handleDismissAll}
                          disabled={dismissingAll}
                          className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl border border-amber-500 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-55 cursor-pointer"
                        >
                          {dismissingAll ? (
                            <span>Đang xử lý...</span>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Xóa tất cả cảnh báo hiện tại (Chỉ lần này)</span>
                            </>
                          )}
                        </button>
                      )}
                      
                      {totalAlerts > 0 && (
                        <span className="text-[11px] font-bold bg-amber-500/10 text-amber-600 px-3 py-2 rounded-xl border border-amber-500/20">
                          Phát hiện {totalAlerts} nhóm trùng khớp
                        </span>
                      )}
                    </div>
                  </div>



                  {/* Clarification Hub Box */}
                  <div className="mb-6 bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex gap-3 text-slate-700 text-xs leading-relaxed">
                    <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-bold text-slate-800 text-sm">Cẩm nang phân biệt dấu hiệu sử dụng hệ thống:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-xl">
                          <div className="flex items-center gap-1.5 font-bold text-rose-700 mb-1">
                            <Laptop className="w-3.5 h-3.5" />
                            <span>1. Dùng chung thiết bị (Fingerprint)</span>
                          </div>
                          <p className="text-slate-600 text-[11px]">
                            Nhiều tài khoản đăng nhập trên <strong>cùng một trình duyệt/thiết bị vật lý</strong>. 
                            Khả năng rất cao là một người tạo nhiều tài khoản clone để lạm dụng tài nguyên.
                          </p>
                        </div>
                        <div className="bg-amber-50/40 border border-amber-100 p-3 rounded-xl">
                          <div className="flex items-center gap-1.5 font-bold text-amber-700 mb-1">
                            <Wifi className="w-3.5 h-3.5" />
                            <span>2. Dùng chung mạng IP (IP Address)</span>
                          </div>
                          <p className="text-slate-600 text-[11px]">
                            Nhiều thiết bị khác nhau cùng kết nối từ <strong>một mạng Wi-Fi (Trường học, văn phòng, quán cafe...)</strong>. 
                            Đây là hành vi sử dụng chung mạng bình thường, <strong>không nên vội vã coi là gian lận/lạm dụng</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* SECTION 1: DEVICE SHARING */}
                    <div>
                      <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                        <Laptop className="w-4.5 h-4.5 text-rose-600" />
                        <h3 className="text-sm font-bold text-slate-800">Nhóm dùng chung thiết bị ({flaggedDeviceGroups.length})</h3>
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full ml-auto">Độ chính xác cao (v2.0)</span>
                      </div>

                      {flaggedDeviceGroups.length === 0 ? (
                        <div className="py-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-600">Hệ thống an toàn</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Không phát hiện nhiều tài khoản đăng nhập chung một thiết bị thực tế.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {flaggedDeviceGroups.map(([fp, group], idx) => (
                            <div key={idx} className="bg-rose-50/20 border border-rose-100 rounded-2xl p-4">
                              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                                  <span className="text-xs font-bold text-rose-950 uppercase">Cảnh báo: Trùng dấu vân tay thiết bị</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-mono text-rose-700 bg-rose-100/60 px-2 py-0.5 rounded-full font-bold">Fingerprint ID: {fp.substring(0, 16)}...</span>
                                  <button
                                    onClick={() => handleDismissGroup(group)}
                                    className="text-[10px] font-bold bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                                  >
                                    Bỏ qua cảnh báo nhóm này
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {group.map((u, i) => (
                                  <div key={i} className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-rose-100/50 hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                        <img src={u.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${u.displayName || u.email}&backgroundColor=c7d2fe`} alt="" className="w-full h-full object-cover"/>
                                      </div>
                                      <div>
                                        <div className="text-xs font-bold text-slate-800">{u.displayName} <span className="font-normal text-slate-500">({u.role === "admin" ? "Admin" : "Thành viên"})</span></div>
                                        <div className="text-[10px] text-slate-500 font-medium">{u.email}</div>
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-slate-500 text-right">
                                      <div className="font-semibold text-slate-700">Đăng nhập cuối:</div>
                                      <div>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("vi-VN") : "N/A"}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SECTION 2: IP SHARING */}
                    <div>
                      <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                        <Wifi className="w-4.5 h-4.5 text-amber-600" />
                        <h3 className="text-sm font-bold text-slate-800">Nhóm dùng chung mạng IP ({flaggedIpGroups.length})</h3>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-auto">Trùng mạng Wi-Fi (Bình thường)</span>
                      </div>

                      {flaggedIpGroups.length === 0 ? (
                        <div className="py-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-600">Không có trùng IP bên ngoài</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Mọi tài khoản truy cập từ các địa chỉ IP độc lập hoặc đã được nhóm thiết bị gom nhóm.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {flaggedIpGroups.map(([ip, group], idx) => (
                            <div key={idx} className="bg-amber-50/30 border border-amber-200/50 rounded-2xl p-4">
                              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <Info className="w-4 h-4 text-amber-600" />
                                  <span className="text-xs font-bold text-amber-950 uppercase">Ghi nhận: Truy cập chung mạng IP</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full font-bold">IP: {ip}</span>
                                  <button
                                    onClick={() => handleDismissGroup(group)}
                                    className="text-[10px] font-bold bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                                  >
                                    Bỏ qua cảnh báo IP này
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {group.map((u, i) => (
                                  <div key={i} className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-amber-100/50 hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                        <img src={u.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${u.displayName || u.email}&backgroundColor=c7d2fe`} alt="" className="w-full h-full object-cover"/>
                                      </div>
                                      <div>
                                        <div className="text-xs font-bold text-slate-800">{u.displayName} <span className="font-normal text-slate-500">({u.role === "admin" ? "Admin" : "Thành viên"})</span></div>
                                        <div className="text-[10px] text-slate-500 font-medium">{u.email}</div>
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-slate-500 text-right">
                                      <div className="font-semibold text-slate-700">Đăng nhập cuối:</div>
                                      <div>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("vi-VN") : "N/A"}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {sidebarView === 'settings' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6 flex-1 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3.5 pb-2">
              <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 shadow-sm">
                <Settings className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-800 font-sans">Cài đặt cá nhân</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Quản lý hồ sơ cá nhân và theo dõi thông tin tài khoản của bạn.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: Avatar and Account Summary Card */}
              <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] p-6 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                
                {/* Avatar container */}
                <div className="relative mt-4 mb-4 group">
                  <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-indigo-50 shadow-md bg-slate-100 flex items-center justify-center">
                    <img
                      referrerPolicy="no-referrer"
                      src={getUserAvatar()}
                      alt="User avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {(user?.photoURL || userDoc?.photoURL) && (
                    <span className="absolute bottom-1 right-1 bg-emerald-500 border-2 border-white rounded-full p-1 text-white" title="Đã liên kết Gmail">
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-slate-800 text-lg leading-tight">
                  {userDoc?.displayName || user?.displayName || user?.email?.split("@")[0]}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-1 font-medium select-all">{user?.uid}</p>

                {/* Badge Role */}
                <div className="mt-3.5 flex items-center gap-1.5 justify-center">
                  {isAdminUser(user, userDoc) ? (
                    <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">ADMINISTRATOR</span>
                  ) : isApproved ? (
                    <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">PRO MEMBER</span>
                  ) : (
                    <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">FREE MEMBER</span>
                  )}
                </div>

                <div className="w-full border-t border-slate-100 my-5"></div>

                {/* Usage statistics summary */}
                <div className="w-full space-y-3 text-left">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Thống kê sử dụng</h4>
                  
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>Số lần dùng LaTeX</span>
                      <span className="text-slate-800 font-black">
                        {isApproved || isAdminUser(user, userDoc) ? `${userDoc?.latexCount || 0} / ∞` : `${userDoc?.latexCount || 0} / 30`}
                      </span>
                    </div>
                    {!(isApproved || isAdminUser(user, userDoc)) && (
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, ((userDoc?.latexCount || 0) / 30) * 100)}%` }}
                        ></div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>Số lần soạn đề thi</span>
                      <span className="text-slate-800 font-black">
                        {isApproved || isAdminUser(user, userDoc) ? `${userDoc?.examCount || 0} / ∞` : `${userDoc?.examCount || 0} / 5`}
                      </span>
                    </div>
                    {!(isApproved || isAdminUser(user, userDoc)) && (
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-violet-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, ((userDoc?.examCount || 0) / 5) * 100)}%` }}
                        ></div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>Lượt dán thông minh AI</span>
                      <span className="text-slate-800 font-black">
                        {isApproved || isAdminUser(user, userDoc) ? `${userDoc?.promptCount || 0} / ∞` : `${userDoc?.promptCount || 0} / 10`}
                      </span>
                    </div>
                    {!(isApproved || isAdminUser(user, userDoc)) && (
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-rose-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, ((userDoc?.promptCount || 0) / 10) * 100)}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Profile Detail Form */}
              <div className="lg:col-span-2 bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] p-6">
                <h3 className="text-sm font-bold text-slate-800 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-500" /> Tài khoản & Thông tin cá nhân
                </h3>

                {/* Linked Google Account Details card to strictly satisfy the user prompt */}
                <div className="mb-6 p-4 bg-slate-50/50 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-250 bg-slate-100 shrink-0">
                      <img
                        referrerPolicy="no-referrer"
                        src={user?.photoURL || getUserAvatar()}
                        alt="Gmail avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Đăng nhập qua Google
                      </span>
                      <h4 className="text-xs font-bold text-slate-800 mt-1">
                        Tên Gmail: <span className="font-semibold text-slate-600">{user?.displayName || "Người dùng"}</span>
                      </h4>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        Email liên kết: <span className="font-semibold text-slate-600 font-mono select-all">{user?.email}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" strokeWidth={3} /> Đã đồng bộ an toàn
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Tên hiển thị */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        Tên hiển thị <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nhập tên hiển thị"
                        value={settingsDisplayName}
                        onChange={(e) => setSettingsDisplayName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all"
                      />
                    </div>

                    {/* Email (Read only) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        Địa chỉ Email (Định danh)
                      </label>
                      <input
                        type="email"
                        disabled
                        value={user?.email || ""}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-400 rounded-xl px-4 py-2.5 text-xs font-semibold outline-none cursor-not-allowed"
                      />
                    </div>

                    {/* Số điện thoại */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        Số điện thoại
                      </label>
                      <input
                        type="tel"
                        placeholder="Ví dụ: 0912345678"
                        value={settingsPhoneNumber}
                        onChange={(e) => setSettingsPhoneNumber(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all"
                      />
                    </div>

                    {/* Ngày sinh */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        Ngày sinh
                      </label>
                      <input
                        type="date"
                        value={settingsBirthDate}
                        onChange={(e) => setSettingsBirthDate(e.target.value)}
                        className="w-full bg-white border border-[#E8EBF3] hover:border-[#6B5CFF]/50 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-[#6B5CFF] focus:ring-4 focus:ring-[#6B5CFF]/10"
                      />
                    </div>
                  </div>

                  {/* Gmail Integration Note */}
                  <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50 flex items-start gap-3 mt-4">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-indigo-900">Liên kết thông tin cá nhân & Gmail</p>
                      <p className="text-[11px] text-indigo-700/80 leading-relaxed mt-0.5">
                        Hệ thống tự động sử dụng Tên và Ảnh đại diện từ tài khoản Google/Gmail của bạn làm ảnh đại diện mặc định để cá nhân hoá trải nghiệm. Bạn có thể tự do sửa đổi Tên hiển thị, Số điện thoại và Ngày sinh ở biểu mẫu trên bất cứ lúc nào.
                      </p>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                      {isSavingSettings ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Đang lưu...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          Lưu cài đặt
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}

        {sidebarView === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-5 flex-1 flex flex-col"
          >
            {/* Header Greeting */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] py-4 px-5 rounded-[28px]">
              <div>
                <h1 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  Chào mừng quay trở lại, <span className="text-indigo-600 font-black">{userDoc?.displayName || user?.displayName || user?.email?.split("@")[0]}</span>! 👋
                </h1>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Hệ thống số hóa công thức LaTeX và hỗ trợ soạn thảo đề thi thông minh.
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right hidden md:block">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái hệ thống</div>
                  <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1.5 justify-end mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Hoạt động tốt
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarView('latex')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 hover:shadow-md cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Bắt đầu ngay <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>



            {/* Quick Stats Grid based on Live User Doc Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {/* Stat 1: LaTeX conversions */}
              <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] p-5 rounded-[28px] hover:shadow-xs transition-all flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hạn mức LaTeX đã dùng</span>
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-1">
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, ((userDoc?.latexCount || 0) / 30) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">Tự động reset về 0 sau 5h sáng hằng ngày.</span>
              </div>

              {/* Stat 2: Exam builders */}
              <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] p-5 rounded-[28px] hover:shadow-xs transition-all flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lượt soạn đề bằng AI</span>
                  <div className="p-2 rounded-xl bg-violet-50 text-violet-600 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-1">
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="bg-violet-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, ((userDoc?.examCount || 0) / 5) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">Tự động reset về 0 sau 5h sáng hằng ngày.</span>
              </div>

              {/* Stat 3: Prompt tokens */}
              <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] p-5 rounded-[28px] hover:shadow-xs transition-all flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hạn mức tinh chỉnh AI</span>
                  <div className="p-2 rounded-xl bg-pink-50 text-pink-600 shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-1">
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="bg-pink-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, ((userDoc?.promptCount || 0) / 10) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">Tự động reset về 0 sau 5h sáng hằng ngày.</span>
              </div>

              {/* Stat 4: Account Type */}
              <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] p-5 rounded-[28px] hover:shadow-xs transition-all flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gói tài khoản của bạn</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                    <Diamond className="w-4 h-4 animate-pulse" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-800 flex items-center gap-1.5">
                    {isAdminUser(user, userDoc) ? "QUẢN TRỊ VIÊN" : isApproved ? "THÀNH VIÊN PRO" : "TÀI KHOẢN FREE"}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-2.5 leading-relaxed">
                    {isAdminUser(user, userDoc) || isApproved 
                      ? "Bạn đang sở hữu đặc quyền tối đa của hệ thống" 
                      : "Nâng cấp lên gói PRO để nhận thêm lượt chuyển đổi."}
                  </div>
                </div>
                {!isApproved && !isAdminUser(user, userDoc) && (
                  <button
                    type="button"
                    onClick={() => setShowProUpgradeModal(true)}
                    className="mt-1 text-left text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    Nâng cấp ngay <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Bento Grid: Core Modules & Quick Launch */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Module 1: Word to LaTeX Converter */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-200 hover:shadow-sm transition-all duration-200 flex flex-col justify-between group">
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl w-12 h-12 flex items-center justify-center font-bold">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 font-sans">
                      Chuyển đổi Word sang LaTeX
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                      Chuyển mã nhanh các tài liệu, bài báo khoa học chứa công thức toán hoặc bảng biểu phức tạp. Hỗ trợ hiển thị trực quan cấu trúc LaTeX trực tiếp trước khi sao chép.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarView('latex')}
                  className="mt-6 w-full py-2.5 border border-indigo-100 hover:bg-indigo-50/50 text-indigo-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer group-hover:border-indigo-300 animate-none"
                >
                  Mở công cụ <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Module 2: AI Exam Builder */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-violet-200 hover:shadow-sm transition-all duration-200 flex flex-col justify-between group">
                <div className="space-y-4">
                  <div className="p-3 bg-violet-50 text-violet-600 rounded-xl w-12 h-12 flex items-center justify-center font-bold">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 font-sans">
                      Soạn đề thi Trắc nghiệm AI
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                      Sử dụng Trí tuệ Nhân tạo để phân tích, tự động bóc tách danh sách câu hỏi trắc nghiệm, trích xuất tùy chọn A, B, C, D và sinh lời giải bằng LaTeX cực kỳ thông minh.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarView('qbuilder')}
                  className="mt-6 w-full py-2.5 border border-violet-100 hover:bg-violet-50/50 text-violet-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer group-hover:border-violet-300 animate-none"
                >
                  Mở trình soạn đề <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Module 3: MarkItDown AI */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-200 hover:shadow-sm transition-all duration-200 flex flex-col justify-between group">
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-12 h-12 flex items-center justify-center font-bold">
                    <Layout className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 font-sans">
                      MarkItDown AI (PRO)
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                      Chuyển đổi mọi loại tài liệu (PDF, Word, Excel, PowerPoint, HTML, Audio, Hình ảnh, YouTube) sang định dạng Markdown chuẩn xác bằng trí tuệ nhân tạo.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarView('markitdown')}
                  className="mt-6 w-full py-2.5 border border-emerald-100 hover:bg-emerald-50/50 text-emerald-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer group-hover:border-emerald-300 animate-none"
                >
                  Bắt đầu chuyển đổi <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {sidebarView === 'latex' && (
          <LatexConverter
            wordFont={wordFont}
            setWordFont={setWordFont}
            inputText={inputText}
            setInputText={setInputText}
            hasUnclosedDollar={hasUnclosedDollar}
            showAiCanvas={showAiCanvas}
            setShowAiCanvas={setShowAiCanvas}
            isProcessingCanvas={isProcessingCanvas}
            handleCallAiCanvas={handleCallAiCanvas}
            aiCanvasPrompt={aiCanvasPrompt}
            setAiCanvasPrompt={setAiCanvasPrompt}
            activeTab={activeTab}
            setActiveTab={(tab: string) => setActiveTab(tab as any)}
            copyToWord={copyToWord}
            downloadAsWord={downloadAsWord}
            copyRawLaTeX={copyRawLaTeX}
            downloadAsPdf={downloadAsPdf}
            overleafCode={overleafCode}
            processedHtml={processedHtml}
            previewRef={previewRef}
            textareaRef={textareaRef}
            triggerToast={triggerToast}
            handlePasteGeneric={handlePasteGeneric}
            handleClear={handleClear}
            isPro={isApproved || isAdminUser(user, userDoc)}
          />
        )}
        {sidebarView === 'qbuilder' && (
          <QBuilder
            wordFont={wordFont}
            setWordFont={setWordFont}
            docHeaderStyle={docHeaderStyle}
            setDocHeaderStyle={setDocHeaderStyle}
            docTitle={docTitle}
            setDocTitle={setDocTitle}
            docSubtitle={docSubtitle}
            setDocSubtitle={setDocSubtitle}
            docStudentInfoFormat={docStudentInfoFormat}
            setDocStudentInfoFormat={setDocStudentInfoFormat}
            docTimeLimit={docTimeLimit}
            setDocTimeLimit={setDocTimeLimit}
            docExamCode={docExamCode}
            setDocExamCode={setDocExamCode}
            docSchoolName={docSchoolName}
            setDocSchoolName={setDocSchoolName}
            docExamName={docExamName}
            setDocExamName={setDocExamName}
            docSubjectName={docSubjectName}
            setDocSubjectName={setDocSubjectName}
            editingQuestionId={editingQuestionId}
            setEditingQuestionId={setEditingQuestionId}
            docQuestions={docQuestions}
            tracNghiemText={tracNghiemText}
            setTracNghiemText={setTracNghiemText}
            tracNghiemAnswerText={tracNghiemAnswerText}
            setTracNghiemAnswerText={setTracNghiemAnswerText}
            dungSaiText={dungSaiText}
            setDungSaiText={setDungSaiText}
            dungSaiAnswerText={dungSaiAnswerText}
            setDungSaiAnswerText={setDungSaiAnswerText}
            traLoiNganText={traLoiNganText}
            setTraLoiNganText={setTraLoiNganText}
            traLoiNganAnswerText={traLoiNganAnswerText}
            setTraLoiNganAnswerText={setTraLoiNganAnswerText}
            tuLuanQuestionText={tuLuanQuestionText}
            setTuLuanQuestionText={setTuLuanQuestionText}
            tuLuanAnswerText={tuLuanAnswerText}
            setTuLuanAnswerText={setTuLuanAnswerText}
            newQuestionType={newQuestionType}
            setNewQuestionType={setNewQuestionType}
            setShowSmartPasteModal={setShowSmartPasteModal}
            newTracNghiemColumns={newTracNghiemColumns}
            setNewTracNghiemColumns={setNewTracNghiemColumns}
            handleAddQuestion={handleAddQuestion}
            savedQuestionTab={savedQuestionTab}
            setSavedQuestionTab={(tab: string) => setSavedQuestionTab(tab as any)}
            tracNghiemList={tracNghiemList}
            dungSaiList={dungSaiList}
            traLoiNganList={traLoiNganList}
            tuLuanList={tuLuanList}
            handleStartEditQuestion={handleStartEditQuestion}
            handleDeleteQuestion={handleDeleteQuestion}
            handleMoveQuestion={handleMoveQuestion}
            handleUpdateQuestionColumns={handleUpdateQuestionColumns}
            downloadDocAsWord={downloadDocAsWord}
            setShowShuffleConfirm={setShowShuffleConfirm}
            showShuffleConfirm={showShuffleConfirm}
            isShuffling={isShuffling}
            isAIShuffleEnabled={isAIShuffleEnabled}
            setIsAIShuffleEnabled={setIsAIShuffleEnabled}
            handleShuffleExam={handleShuffleExam}
            docPreviewRef={docPreviewRef}
            labelTracNghiem={labelTracNghiem}
            labelDungSai={labelDungSai}
            labelTraLoiNgan={labelTraLoiNgan}
            labelTuLuan={labelTuLuan}
            parseMultipleChoice={parseMultipleChoice}
            getCleanQuestionBody={getCleanQuestionBody}
            hasQuestionPrefix={hasQuestionPrefix}
            renderContentWithMath={renderContentWithMath}
            triggerToast={triggerToast}
            handlePasteGeneric={handlePasteGeneric}
          />
        )}

        
        {sidebarView === 'markitdown' && (
          <MarkItDown 
            triggerToast={triggerToast} 
            isPro={isApproved || isAdminUser(user, userDoc)}
            userDoc={userDoc}
            onMarkItDownUsage={handleMarkItDownUsage}
          />
        )}

        {/* Smart Paste Modal */}
        <AnimatePresence>
          {showSmartPasteModal && (
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
              style={{ padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col"
              >
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex justify-between items-center relative">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="font-bold text-slate-800 text-sm md:text-base tracking-tight">
                      Dán thông minh từ AI (Bước {smartPasteStep}/2)
                    </h3>
                  </div>
                  <button
                    onClick={closeSmartPasteModal}
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-5 md:p-6 flex-1 flex flex-col gap-4">
                  {smartPasteStep === 1 ? (
                    <>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        Hãy dán nguyên bản toàn bộ phản hồi từ AI (bao gồm cả đề bài, các đáp án và lời giải). Hệ thống sẽ tự động phân tách và sắp xếp chúng vào đúng các ô nhập liệu cho bạn. Các định dạng in đậm, in nghiêng và LaTeX sẽ được giữ nguyên.
                      </p>
                      <textarea
                        value={smartPasteText}
                        onChange={(e) => setSmartPasteText(e.target.value)}
                        onPaste={(e) => handlePasteGeneric(e, setSmartPasteText, true)}
                        placeholder="Dán (Ctrl+V) toàn bộ nội dung câu hỏi và đáp án từ ChatGPT/AI vào đây..."
                        className="w-full h-64 p-4 text-sm rounded-xl border border-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isSmartPasteParsing}
                      />
                      <div className="flex justify-end gap-3 mt-2">
                        <button
                          onClick={closeSmartPasteModal}
                          disabled={isSmartPasteParsing}
                          className="px-4 py-2 text-slate-600 font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          onClick={handleSmartPasteProcess}
                          disabled={isSmartPasteParsing}
                          className="px-5 py-2 text-white font-bold bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isSmartPasteParsing ? (
                            <>
                              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Đang phân tách bằng AI...</span>
                            </>
                          ) : (
                            "Phân tách & Xem trước"
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        Kết quả phân tách tự động dưới đây. Vui lòng xem trước các định dạng. Nếu đã chính xác, hãy bấm nút <strong>"Xác nhận nạp vào đề"</strong> để tiến hành nhập vào đề thi chính thức.
                      </p>
                      
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                        {parsedPreviewQuestions.map((q, index) => (
                          <div key={q.id || index} className="p-4 bg-white rounded-xl border border-slate-250 shadow-2xs text-left relative overflow-hidden">
                            <div className="flex justify-between items-center mb-2.5">
                              <span className="font-bold text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                Câu hỏi {index + 1} ({q.type === 'trac_nghiem' ? 'Trắc nghiệm' : q.type === 'trac_nghiem_dung_sai' ? 'Đúng/Sai' : q.type === 'trac_nghiem_tra_loi_ngan' ? 'Trả lời ngắn' : 'Tự luận'})
                              </span>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">📝 Nội dung câu hỏi:</span>
                                <div 
                                  className="text-xs md:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap select-all bg-slate-50/50 p-2.5 rounded-lg border border-slate-100"
                                  dangerouslySetInnerHTML={{ __html: renderContentWithMath(q.questionText) }}
                                />
                              </div>
                              {q.answerText && (
                                <div className="pt-2 border-t border-slate-100">
                                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">🔑 Đáp án / Lời giải:</span>
                                  <div 
                                    className="text-xs text-slate-750 leading-relaxed font-normal whitespace-pre-wrap select-all bg-indigo-50/20 p-2.5 rounded-lg border border-indigo-50/50"
                                    dangerouslySetInnerHTML={{ __html: renderContentWithMath(q.answerText) }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between gap-3 mt-2">
                        <button
                          onClick={() => setSmartPasteStep(1)}
                          className="px-4 py-2 text-slate-700 font-bold bg-slate-100 hover:bg-slate-200 border border-slate-250 rounded-lg text-sm transition-colors cursor-pointer"
                        >
                          ← Quay lại chỉnh sửa
                        </button>
                        <div className="flex gap-3">
                          <button
                            onClick={closeSmartPasteModal}
                            className="px-4 py-2 text-slate-600 font-semibold bg-slate-50 hover:bg-slate-100 rounded-lg text-sm transition-colors cursor-pointer"
                          >
                            Hủy bỏ
                          </button>
                          <button
                            onClick={handleSmartPasteProcess}
                            className="px-5 py-2 text-white font-bold bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm shadow-md transition-colors cursor-pointer"
                          >
                            Xác nhận nạp vào đề
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Feedback Modal Popup */}
        <AnimatePresence>
          {isFeedbackOpen && (
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
              id="feedback-rating-overlay"
            >
              <motion.div
                initial={{ scale: 0.98, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.98, opacity: 0, y: 10 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-lg w-full overflow-hidden flex flex-col my-8 max-h-[90vh]"
              >
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="font-extrabold text-sm md:text-base text-slate-800">
                      Gửi Phản Hồi & Ý Kiến Đóng Góp
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Bảo mật & Giúp cải tiến sản phẩm tốt hơn
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFeedbackOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Form container */}
                <form onSubmit={handleSubmitFeedback} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-80px)] flex-1">
                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                      Người gửi
                    </label>
                    <p className="text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      {user?.email}
                    </p>
                  </div>

                  {/* Rating selection (Interactive stars) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                      Đánh giá hệ thống
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setFeedbackRating(star)}
                          className={`p-0.5 text-xl transition-all cursor-pointer ${
                            star <= feedbackRating
                              ? "text-amber-500"
                              : "text-slate-300 hover:text-slate-400"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                      <span className="text-[11px] font-bold text-slate-500 block ml-2">
                        {feedbackRating === 5
                          ? "Tuyệt vời, 5 sao"
                          : feedbackRating === 4
                            ? "Tốt, 4 sao"
                            : feedbackRating === 3
                              ? "Bình thường, 3 sao"
                              : feedbackRating === 2
                                ? "Kém, 2 sao"
                                : "Rất tệ, 1 sao"}
                      </span>
                    </div>
                  </div>

                  {/* Feedback Type Tabs */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                      Phân loại ý kiến
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["suggestion", "bug", "request", "other"] as const).map(
                        (type) => (
                          <button
                            type="button"
                            key={type}
                            onClick={() => setFeedbackType(type)}
                            className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all cursor-pointer ${
                              feedbackType === type
                                ? "bg-indigo-50 border-indigo-500 text-indigo-600 shadow-2xs"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {type === "suggestion" && "Đóng góp"}
                            {type === "bug" && "Báo lỗi"}
                            {type === "request" && "Yêu cầu"}
                            {type === "other" && "Khác"}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Feedback Textarea Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                      Nội dung góp ý
                    </label>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      rows={4}
                      className="w-full p-3 border border-slate-250 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:outline-none focus:border-indigo-500 text-xs font-semibold text-slate-700 placeholder:text-slate-400 bg-white"
                      placeholder="Hãy ghi chi tiết trải nghiệm của bạn, các tính năng mong muốn, góp ý giao diện hoặc mô tả lỗi nếu có..."
                    />
                  </div>

                  {/* Image Attachment (Góp ý bằng hình) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                      Đính kèm hình ảnh minh họa (nếu có)
                    </label>
                    
                    {!feedbackImage ? (
                      <div className="relative group border-2 border-dashed border-slate-200 hover:border-indigo-500/50 rounded-xl p-4 transition-all bg-slate-50/50 hover:bg-indigo-50/10 flex flex-col items-center justify-center cursor-pointer min-h-[90px]">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                triggerToast("Kích thước ảnh tối đa 2MB", false);
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                  if (event.target?.result) {
                                  setFeedbackImage(event.target.result as string);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <Image className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 mb-1 transition-colors" />
                        <span className="text-xs font-semibold text-slate-600 group-hover:text-indigo-600 transition-colors">
                          Kéo thả hoặc nhấp để chọn ảnh
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Hỗ trợ PNG, JPG, JPEG (tối đa 2MB)
                        </span>
                      </div>
                    ) : (
                      <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={feedbackImage}
                            alt="Ảnh đính kèm"
                            className="w-14 h-14 object-cover rounded-lg border border-slate-150"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">
                              Hình ảnh đã chọn
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Đã đính kèm thành công
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFeedbackImage("")}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Gỡ ảnh này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Submit button */}
                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsFeedbackOpen(false)}
                      className="px-5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingFeedback || !feedbackText.trim()}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:opacity-60 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0"></span>
                          Đang gửi...
                        </>
                      ) : (
                        <>
                          <span>Gửi ý kiến đóng góp</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Notifications Modal Popup */}
        <AnimatePresence>
          {isNotificationsOpen && (
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
              id="notifications-list-overlay"
            >
              <motion.div
                initial={{ scale: 0.98, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.98, opacity: 0, y: 10 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-xl w-full overflow-hidden flex flex-col my-8"
              >
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="font-extrabold text-sm md:text-base text-slate-800">
                      Thông Báo Hệ Thống & Phản Hồi
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Cập nhật từ Ban Quản trị & Hệ thống
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {unreadCount > 0 && (
                  <div className="bg-indigo-50/50 border-b border-indigo-100/50 px-6 py-2.5 flex justify-between items-center text-xs">
                    <span className="text-indigo-800 font-bold">
                      Bạn có {unreadCount} thông báo chưa đọc
                    </span>
                    <button
                      type="button"
                      onClick={markAllNotificationsAsRead}
                      className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer text-[11px]"
                    >
                      Đã đọc tất cả
                    </button>
                  </div>
                )}

                <div className="p-6 overflow-y-auto max-h-[450px] space-y-4 bg-slate-50/30">
                  {visibleNotifications.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 italic text-xs font-medium">
                      Hộp thư trống. Không có thông báo hoặc phản hồi nào dành cho bạn.
                    </div>
                  ) : (
                    visibleNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="bg-white hover:bg-slate-50/40 border border-slate-200/60 rounded-xl p-4 flex flex-col justify-between transition-all shadow-2xs"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1.5">
                            <div>
                              <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-1.5 leading-snug">
                                <span
                                  className={`h-2 w-2 rounded-full shrink-0 ${!readNotificationIds.includes(notif.id) ? "bg-indigo-600 animate-pulse" : "bg-slate-300"}`}
                                />
                                {notif.title}
                              </h4>
                              <span className="text-[10px] text-slate-400 font-bold block mt-1 uppercase tracking-wide">
                                Người gửi: {notif.senderName || "Admin"} •{" "}
                                {notif.createdAt
                                  ? new Date(notif.createdAt).toLocaleString(
                                      "vi-VN",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        day: "2-digit",
                                        month: "2-digit",
                                      },
                                    )
                                  : "Mới đây"}
                              </span>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1.5">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                  notif.type === "system"
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200/50"
                                    : notif.type === "user"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-250/50"
                                      : "bg-blue-50 text-blue-750 border-blue-200/50"
                                }`}
                              >
                                {notif.type === "system"
                                  ? "Hệ thống"
                                  : notif.type === "user"
                                    ? "Cá nhân"
                                    : "Trả lời góp ý"}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60 leading-relaxed font-medium whitespace-pre-wrap mt-3 select-all">
                            {notif.content}
                          </p>
                        </div>

                        {/* User Action Footer */}
                        <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            {!readNotificationIds.includes(notif.id) && (
                              <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[8px] font-black rounded tracking-wide shrink-0">
                                MỚI
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (readNotificationIds.includes(notif.id)) {
                                  setReadNotificationIds((prev) =>
                                    prev.filter((id) => id !== notif.id),
                                  );
                                } else {
                                  markNotificationAsRead(notif.id);
                                }
                              }}
                              className="text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer"
                            >
                              {readNotificationIds.includes(notif.id)
                                ? "Đánh dấu chưa đọc"
                                : "Đánh dấu đã đọc"}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => archiveNotification(notif.id)}
                            className="text-slate-400 hover:text-rose-500 font-bold cursor-pointer transition-colors"
                            title="Ẩn thông báo khỏi hộp thư cá nhân của bạn"
                          >
                            Ẩn thông báo ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="px-5 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    Đóng lại
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Image Preview Lightbox Overlay */}
        <AnimatePresence>
          {previewImageSrc && (
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none cursor-zoom-out"
              onClick={() => setPreviewImageSrc(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setPreviewImageSrc(null)}
                  className="absolute top-4 right-4 z-50 p-2 bg-slate-950/80 hover:bg-slate-900 text-white rounded-full transition-colors cursor-pointer border border-slate-800 font-bold text-sm w-9 h-9 flex items-center justify-center"
                  title="Đóng xem ảnh"
                >
                  ✕
                </button>
                <img
                  src={previewImageSrc}
                  alt="Xem thử hình ảnh"
                  className="max-w-full max-h-[85vh] object-contain select-text"
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        
        {/* AI Chat Modal */}
        <AnimatePresence>
          {showAiChat && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-end sm:justify-center z-[100] p-0 sm:p-4">
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                className="bg-white w-full sm:w-[450px] sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh] sm:h-[600px] max-h-screen"
              >
                {/* Header */}
                <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between text-white shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-200" />
                    <div>
                      <h3 className="font-bold text-sm">Trợ lý AI Word2LaTeX</h3>
                      <p className="text-[10px] text-indigo-200">Giải đáp thắc mắc về hệ thống</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAiChat(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                  {aiChatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                        <Sparkles className="w-6 h-6 text-indigo-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">Xin chào! 👋</p>
                      <p className="text-xs text-slate-500 mt-1">Tôi có thể giúp gì cho bạn về hệ thống Word2LaTeX?</p>
                    </div>
                  ) : (
                    aiChatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'}`}>
                          <div className={msg.role === 'user' ? "" : "markdown-body text-xs"}>
                            {msg.role === 'user' ? msg.text : <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }} />}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isAiChatLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-bl-none px-4 py-3 bg-white border border-slate-200 text-slate-700 shadow-sm flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleAiChatSubmit} className="p-3 bg-white border-t border-slate-200 shrink-0 flex items-center gap-2">
                  <input
                    type="text"
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    onPaste={handlePaste}
                    placeholder={isExtractingText ? "Đang trích xuất văn bản từ hình ảnh..." : "Hỏi về hệ thống Word2LaTeX..."}
                    disabled={isExtractingText}
                    className="flex-1 bg-slate-100 border-none outline-none rounded-xl px-4 py-2.5 text-xs text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-shadow disabled:opacity-70"
                  />
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  <button 
                    type="button" 
                    disabled={isExtractingText || isAiChatLoading}
                    onClick={() => fileInputRef.current?.click()} 
                    className="text-slate-400 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed p-2 flex items-center justify-center"
                  >
                    {isExtractingText ? (
                      <span className="w-5 h-5 block border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Paperclip className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    type="submit"
                    disabled={!aiChatInput.trim() || isAiChatLoading || isExtractingText}
                    className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0 shadow-sm"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Pro Upgrade Contact Modal */}
        <AnimatePresence>
          {showProUpgradeModal && (
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto"
              id="pro-upgrade-overlay"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col my-8 max-h-[90vh]"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-5 text-white flex justify-between items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs text-white flex items-center justify-center shadow-inner">
                      <Diamond className="w-5 h-5 text-amber-300 fill-amber-300 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base md:text-lg tracking-tight">
                        Nâng Cấp Tài Khoản PRO
                      </h3>
                      <p className="text-[10px] text-indigo-100 font-semibold tracking-wider uppercase">
                        Mở khóa tối đa công suất
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProUpgradeModal(false)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer text-xs font-bold font-mono relative z-10 w-7 h-7 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Để nâng cấp tài khoản của bạn lên gói <strong className="text-indigo-600 font-black">PRO PLAN</strong> và sở hữu toàn bộ các đặc quyền cao cấp (Không giới hạn lượt chuyển đổi LaTeX, ưu tiên xây dựng đề thi siêu tốc bằng AI), vui lòng liên hệ trực tiếp với người sáng lập:
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50 space-y-3">
                      {/* Email info */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0 mt-0.5">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gửi Email trực tiếp</span>
                          <a href="mailto:giathieu110406@gmail.com" className="text-xs md:text-sm font-bold text-indigo-600 hover:underline select-all truncate block">
                            giathieu110406@gmail.com
                          </a>
                        </div>
                      </div>

                      {/* Feedback Form Link info */}
                      <div className="flex items-start gap-3 pt-1">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shrink-0 mt-0.5">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hòm thư góp ý hệ thống</span>
                          <p className="text-xs text-slate-600 leading-normal">
                            Hoặc gửi yêu cầu qua chức năng <span className="font-bold text-purple-600 cursor-pointer hover:underline" onClick={() => { setShowProUpgradeModal(false); setIsFeedbackOpen(true); }}>Góp ý & Phản hồi</span> ngay trên thanh công cụ.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProUpgradeModal(false);
                        setIsFeedbackOpen(true);
                      }}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl py-3 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" /> Gửi Góp Ý / Yêu Cầu
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProUpgradeModal(false)}
                      className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl py-3 transition-colors active:scale-95 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
      </div> {/* This closes max-w-[1600px] or inner container maybe? */}
      
      {/* Footer */}
      <footer className="w-full text-center py-4 bg-white/50 border-t border-slate-200/60 mt-auto shrink-0 select-none px-4">
        <div className="max-w-[1600px] mx-auto space-y-2 sm:space-y-1">
          <p className="text-xs text-slate-500 font-medium flex flex-col sm:block items-center justify-center gap-1 leading-relaxed">
            <span>Bản quyền thuộc về </span>
            <strong className="text-slate-800 font-semibold">
              Trần Gia Thiều - Giathieu110406@gmail.com
            </strong>
            <span className="hidden sm:inline"> · </span>
            <span className="block sm:inline mt-1 sm:mt-0">Phiên bản v3.7</span>
          </p>
          <p className="text-[11px] text-slate-400 font-medium px-2">
            © Q-Builder · Số hóa công thức LaTeX · Tự động hóa xây dựng đề thi ·
            Chính xác & Tốc độ.
          </p>
        </div>
      </footer>
    </div>
  </div>
  );
} 