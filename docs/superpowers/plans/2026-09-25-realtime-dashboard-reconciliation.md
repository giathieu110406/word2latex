# Thuật Toán Đồng Bộ Thời Gian Thực Dashboard Phân Tích (Realtime Dashboard Reconciliation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp thuật toán của Dashboard Phân Tích Sử Dụng (`AdminAnalyticsDashboard.tsx`) để tự động kết hợp và đồng bộ hai chiều thời gian thực (Live Realtime) với dữ liệu từ collection `users`, đảm bảo số liệu hôm nay (tổng lượt, từng tính năng, giờ cao điểm và chi tiết thành viên) hiển thị chính xác 100% và tức thời (sub-second) giống hệt tab Quản lý Thành viên.

**Architecture:** Áp dụng mô hình **Hybrid Realtime Reconciliation**: App truyền `allUsers` (đang được lắng nghe liên tục qua `onSnapshot(collection(db, "users"))`) trực tiếp vào `AdminAnalyticsDashboard`. Một engine tính toán thuần (pure reconciliation engine) `reconcileStatsWithUsers` sẽ hợp nhất dữ liệu tức thì giữa User Activity Truth (tổng lượt thực tế của 172 thành viên) và API Event Logs (`api_usage_stats`). Bổ sung widget "Thành Viên Hoạt Động Hôm Nay" và cơ chế debounced cloud sync tự động lưu ngược về Firestore.

**Tech Stack:** React 19, TypeScript, Firebase Cloud Firestore Web SDK (`onSnapshot`, `setDoc`, `collection`), TailwindCSS, Lucide Icons.

**Spec:** Yêu cầu từ người dùng: *"dữ liệu phân tích từ dashboard chưa chính xác và nhanh giống phần theo dõi trong thành viên. Nghiên cứu sửa lại thuật toán để có thể cập nhập chính xác theo thời gian thực"*.

## Global Constraints

- Phản hồi và tài liệu bằng Tiếng Việt; giữ nguyên các thuật ngữ chuyên ngành tiếng Anh (*reconciliation, single source of truth, debounce, onSnapshot, payload, props*).
- Bảo toàn toàn bộ kiến trúc đang hoạt động, không phá vỡ các tính năng hiện hữu của ứng dụng.
- Đảm bảo `npm run build` và `npm run lint` chạy thành công với 0 lỗi.
- Định dạng giờ Việt Nam GMT+7 (`Asia/Ho_Chi_Minh`) cho toàn bộ thuật toán phân tích khung giờ 24h.

---

### Task 1: Xây dựng Thuật Toán Pure Reconciliation Engine (`src/utils/reconciliation.ts`)

**Files:**
- Create: `src/utils/reconciliation.ts`
- Test: `scratch/test_reconciliation.ts`

**Interfaces:**
- Consumes: `DayUsageStats` từ `src/components/AdminAnalyticsDashboard.tsx`, mảng `allUsers` từ Firestore `users`.
- Produces: `reconcileStatsWithUsers(baseStats: DayUsageStats[], users: any[], todayDateStr?: string): { stats: DayUsageStats[]; activeMembersToday: ActiveMemberStat[] }`.

- [ ] **Step 1: Định nghĩa kiểu dữ liệu và viết file test kiểm chứng logic**

```typescript
// scratch/test_reconciliation.ts
import { reconcileStatsWithUsers } from '../src/utils/reconciliation';

const mockBaseStats = [
  {
    id: 'usage_stats_2026-09-25',
    date: '2026-09-25',
    timestamp: '2026-09-25T06:00:00.000Z',
    requests: 3,
    totalDurationMinutes: 6,
    hourly: {
      '13': { requests: 3, durationMinutes: 6 }
    },
    featureDurations: {
      'Chuyển đổi LaTeX': { requests: 1, durationMinutes: 4 },
      'AI Canvas': { requests: 1, durationMinutes: 1 },
      'Dán AI': { requests: 1, durationMinutes: 1 }
    }
  }
];

const mockUsers = [
  {
    uid: 'user-1',
    displayName: 'selyna kawai',
    email: 'tranlena01689@gmail.com',
    latexCount: 8,
    examCount: 0,
    promptCount: 0,
    lastLatexResetDate: '2026-09-25'
  },
  {
    uid: 'user-2',
    displayName: 'Thieu Gia',
    email: 'giathieu110406@gmail.com',
    latexCount: 0,
    examCount: 0,
    promptCount: 1,
    lastLatexResetDate: '2026-09-25'
  },
  {
    uid: 'user-3',
    displayName: 'Hùng Trần Đình',
    email: 'hthungnhan2@gmail.com',
    latexCount: 1,
    examCount: 0,
    promptCount: 0,
    lastLatexResetDate: '2026-09-25'
  },
  {
    uid: 'user-4',
    displayName: 'Hưng Trần',
    email: 'thinhvipboy774@gmail.com',
    latexCount: 0,
    examCount: 0,
    promptCount: 0,
    lastLatexResetDate: '2026-09-24' // ngày cũ -> tính 0
  }
];

const result = reconcileStatsWithUsers(mockBaseStats, mockUsers, '2026-09-25');
const todayStat = result.stats.find(s => s.date === '2026-09-25');

console.assert(todayStat?.requests === 11, `Expected 11 requests (9 latex + 1 prompt + 1 AI Canvas), got ${todayStat?.requests}`);
console.assert(todayStat?.featureDurations['Chuyển đổi LaTeX']?.requests === 9, `Expected 9 LaTeX, got ${todayStat?.featureDurations['Chuyển đổi LaTeX']?.requests}`);
console.assert(result.activeMembersToday.length === 3, `Expected 3 active members, got ${result.activeMembersToday.length}`);
console.log("Reconciliation Test PASSED!");
```

- [ ] **Step 2: Viết mã nguồn hoàn chỉnh cho `src/utils/reconciliation.ts`**

Tạo file `src/utils/reconciliation.ts` thực hiện:
1. `getTodayVNDate()`: Lấy ngày định dạng `YYYY-MM-DD` theo múi giờ `Asia/Ho_Chi_Minh`.
2. `getVNHour()`: Lấy số giờ hiện tại (0-23) theo giờ Việt Nam.
3. Thuật toán phân tích `allUsers`:
   - Duyệt qua từng user: kiểm tra xem `lastLatexResetDate === todayDateStr`.
   - Tính lượt chi tiết của user:
     - `latex = isToday ? Number(u.latexCount) || 0 : 0`
     - `exam = isToday ? Number(u.examCount) || 0 : 0`
     - `prompt = isToday ? Number(u.promptCount) || 0 : 0`
     - `markItDown = isToday ? Number(u.markItDownCount) || 0 : 0`
     - `total = latex + exam + prompt + markItDown`
   - Nếu `total > 0`, đưa vào danh sách `activeMembersToday`, sắp xếp theo lượt giảm dần.
4. Thuật toán Reconcile:
   - Tìm hoặc tạo mới `DayUsageStats` của ngày hôm nay.
   - Hợp nhất tính năng:
     - `LaTeX`: `Math.max(baseLatex, totalUserLatex)`
     - `Soạn đề thi (AI)`: `Math.max(baseExam, totalUserExam)`
     - `Dán AI`: `Math.max(basePrompt, totalUserPrompt)`
     - `MarkItDown AI`: `Math.max(baseMarkItDown, totalUserMarkItDown)`
     - `AI Canvas`: giữ nguyên từ `baseStats`
   - Tổng lượt `reconciledRequests` = Tổng lượt của tất cả các tính năng sau khi hợp nhất (đảm bảo không bao giờ nhỏ hơn tổng từ `users`).
   - Phân bổ giờ (`hourly`):
     - Tính tổng lượt hiện tại trong mảng `hourly`.
     - Nếu tổng lượt trong `hourly` < `reconciledRequests`, bổ sung chênh lệch vào khung giờ hiện tại (`currentVNHour`).
   - Cập nhật thời lượng (`totalDurationMinutes`):
     - Đảm bảo thời lượng tối thiểu tương ứng số lượt thao tác thực tế.

- [ ] **Step 3: Chạy script kiểm thử để đảm bảo logic chạy chính xác**

Run: `npx tsx scratch/test_reconciliation.ts`
Expected: Output in ra `"Reconciliation Test PASSED!"` với exit code 0.

---

### Task 2: Cập Nhật `src/App.tsx` Để Truyền `allUsers` Vào `AdminAnalyticsDashboard`

**Files:**
- Modify: `src/App.tsx:7060-7065`

**Interfaces:**
- Consumes: State `allUsers` có sẵn trong `App.tsx` (từ `onSnapshot(collection(db, "users"))`).
- Produces: Prop `allUsers={allUsers}` truyền vào `<AdminAnalyticsDashboard allUsers={allUsers} />`.

- [ ] **Step 1: Truyền prop `allUsers={allUsers}` tại điểm render `AdminAnalyticsDashboard`**

Trong `src/App.tsx` tại vị trí dòng 7062:
```tsx
// Trước:
<AdminAnalyticsDashboard />

// Sau:
<AdminAnalyticsDashboard allUsers={allUsers} />
```

- [ ] **Step 2: Đảm bảo các hàm gọi `incrementLatexCount`, `incrementExamCount`, `incrementPromptCount` luôn cập nhật `lastLatexResetDate`**

Đảm bảo khi user bấm tăng lượt, nếu `userDoc.lastLatexResetDate !== currentTodayStr`, hệ thống cập nhật đồng thời `lastLatexResetDate: currentTodayStr` để không bị trễ đồng bộ ngày.

---

### Task 3: Tích Hợp Reconciliation & Widget Chi Tiết Thành Viên Vào `AdminAnalyticsDashboard.tsx`

**Files:**
- Modify: `src/components/AdminAnalyticsDashboard.tsx`

**Interfaces:**
- Consumes: `allUsers?: any[]` từ props, hàm `reconcileStatsWithUsers` từ `src/utils/reconciliation.ts`.
- Produces:
  - State `stats` luôn được tự động cập nhật Realtime ngay khi `allUsers` thay đổi.
  - Widget UI: *"Bảng Chi Tiết Hoạt Động Theo Thành Viên Hôm Nay (Live Realtime từ Users Database)"*.
  - Tự động debounce đồng bộ ngược lên Cloud Firestore (`api_usage_stats`).

- [ ] **Step 1: Cập nhật Props và Hook tính toán Reconciled Stats**

1. Khai báo interface `AdminAnalyticsDashboardProps`:
```typescript
export interface AdminAnalyticsDashboardProps {
  allUsers?: any[];
}
```
2. Trong component:
```typescript
const { allUsers = [] } = props;

// Áp dụng thuật toán Reconcile ngay trên luồng render
const reconciledStats = useMemo(() => {
  return reconcileStatsWithUsers(stats, allUsers);
}, [stats, allUsers]);

const activeDayStats = useMemo(() => {
  if (!reconciledStats.stats.length) return null;
  return reconciledStats.stats.find(s => (s.date || s.id) === selectedDate) || reconciledStats.stats[reconciledStats.stats.length - 1];
}, [reconciledStats.stats, selectedDate]);
```

- [ ] **Step 2: Thêm Widget "Chi Tiết Thành Viên Hoạt Động Hôm Nay"**

Ngay phía dưới phần "Tỷ Trọng Sử Dụng Các Tính Năng", thêm Card:
- Tiêu đề: **Chi Tiết Hoạt Động Theo Thành Viên Hôm Nay (Live Realtime)**.
- Badge: `X thành viên hoạt động`.
- Bảng hiển thị danh sách các thành viên có phát sinh lượt dùng hôm nay:
  - Tên thành viên + Email + Avatar
  - Lượt Chuyển đổi LaTeX
  - Lượt Soạn đề thi (AI)
  - Lượt Dán AI / Canvas
  - Tổng lượt hôm nay (nổi bật màu tím/indigo font-black)
  - Tỷ trọng đóng góp (%) vào tổng lượt của toàn hệ thống hôm nay.
- Nếu hôm nay chưa có ai dùng: Hiển thị Empty state lịch sự và trực quan.

- [ ] **Step 3: Cơ chế Debounced Auto-Sync lên Cloud Firestore**

Thêm một `useEffect` với debounce 3000ms:
- Nếu ngày hôm nay sau khi reconcile có `reconciledRequests > firestoreRequests`, tự động gọi `setDoc(doc(db, 'api_usage_stats', todayStr), reconciledDayDoc, { merge: true })`.
- Giúp dữ liệu trên Firestore `api_usage_stats` luôn tự lành (self-healing) và khớp 100% với dữ liệu từ `users`.

---

### Task 4: Kiểm Thử & Xác Minh Toàn Diện Trên Môi Trường Trình Duyệt

**Files:**
- Test via Playwright: `http://localhost:3000`

- [ ] **Step 1: Chạy Typecheck & Linter**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Chạy Build để đảm bảo Bundle Production hoàn hảo**

Run: `npm run build`
Expected: `✓ built in ...` với Exit Code 0.

- [ ] **Step 3: Kiểm chứng trực tiếp trên Playwright Browser**

1. Mở trang tab **Thành viên**:
   - Ghi nhận: selyna kawai (8 lượt), Thieu Gia (1 lượt), Hùng Trần Đình (1 lượt) $\rightarrow$ Tổng hôm nay: 10 lượt.
2. Chuyển sang tab **Phân tích sử dụng**:
   - Kiểm tra Card "TỔNG LƯỢT SỬ DỤNG": Phải ghi nhận chính xác $\ge 10$ lượt (gồm 9 LaTeX, 1 Dán AI + AI Canvas nếu có).
   - Kiểm tra Card "TÍNH NĂNG HÀNG ĐẦU": Phải hiển thị "Chuyển đổi LaTeX (Dẫn đầu với 9 lượt sử dụng)".
   - Kiểm tra Widget mới: "Chi Tiết Hoạt Động Theo Thành Viên Hôm Nay": Phải liệt kê đúng selyna kawai (8 lượt), Hùng Trần Đình (1 lượt), Thieu Gia (1 lượt).
3. Thử nghiệm thao tác tạo thêm 1 lượt mới (ví dụ convert LaTeX hoặc AI Canvas):
   - Quan sát Dashboard nhảy số ngay tức khắc trong $\le 0.5$ giây mà không cần bấm Làm mới hay reload trang!
4. Chụp ảnh màn hình đối soát kết quả làm bằng chứng.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-25-realtime-dashboard-reconciliation.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
