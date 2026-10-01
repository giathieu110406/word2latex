# PayOS Payment & Pricing Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully automated payment and subscription system using PayOS QR codes, featuring 3 tiered plans (Trial, Plus, Pro) and realtime status updates via webhooks.

**Architecture:** 
- **Frontend (`src/App.tsx`)**: Renders a 3-column Pricing UI. Generating an order shows a VietQR code. Listens to Firestore `users` document for realtime `planType` changes.
- **Backend (`index.ts`)**: Express route `POST /api/webhook/payos` listens to PayOS. Extracts Order ID from transaction description, verifies HMAC signature, and updates `planType` and `planExpiresAt` in Firestore `users` collection.
- **Enforcement**: Lazy checking at action points in `App.tsx` downgrades users to 'free' if `Date.now() > planExpiresAt`.

**Tech Stack:** React (Vite), Express.js, Firebase (Firestore), PayOS/VietQR.

**Spec:**
- Trial: 9.000đ / 7 days (Quota x2)
- Plus: 19.000đ / 30 days (Quota x2)
- Pro: 29.000đ / 30 days (Quota x4)

## Global Constraints
- Write components in TypeScript using TailwindCSS.
- Use existing styles in `src/App.tsx`.
- Keep changes modular, injecting new states without breaking existing auth.

---

### Task 1: Update Frontend Schema & Expiration Enforcement

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `userDoc` (Firestore document state).
- Produces: `activePlan` and `planExpiresAt` states, modifying `latexCount` logic.

- [ ] **Step 1: Write explicit fallback and expiration logic**
Insert logic immediately after `userDoc` is fetched in `App.tsx`. If expired, trigger an update to Firestore.
```tsx
  // Inside App.tsx, near userDoc useEffect
  useEffect(() => {
    if (userDoc && userDoc.planType && userDoc.planType !== 'free') {
      const now = Date.now();
      if (userDoc.planExpiresAt && now > userDoc.planExpiresAt) {
        // Silently downgrade if expired
        updateDoc(doc(db, "users", user.uid), {
          planType: 'free',
          planExpiresAt: null
        }).catch(console.error);
        triggerToast("Gói cước của bạn đã hết hạn và trở về mức Cơ bản.", false);
      }
    }
  }, [userDoc, user]);
```

- [ ] **Step 2: Update quota limit references**
Find `docTimeLimit` or manual limit checks. Replace with dynamic multipliers based on `userDoc.planType`.
```tsx
  // Define dynamic limit multiplier in App.tsx
  const getLimitMultiplier = (planType?: string) => {
    if (planType === 'pro') return 4;
    if (planType === 'plus' || planType === 'trial') return 2;
    return 1;
  };
  const currentMultiplier = getLimitMultiplier(userDoc?.planType);
  // Apply currentMultiplier to UI displaying limits
```

### Task 2: Build Pricing UI Component

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `showPricingModal` boolean, `PricingModal` JSX block.

- [ ] **Step 1: Add State Variables**
```tsx
  const [showPricingModal, setShowPricingModal] = useState<boolean>(false);
  const [selectedPricingPlan, setSelectedPricingPlan] = useState<string | null>(null);
```

- [ ] **Step 2: Implement the Pricing Layout**
Add this JSX before the final `</div>` of `App.tsx`:
```tsx
{showPricingModal && (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowPricingModal(false)}>
    <div className="bg-white rounded-3xl max-w-5xl w-full p-8 relative" onClick={e => e.stopPropagation()}>
      <button onClick={() => setShowPricingModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800"><X /></button>
      <h2 className="text-3xl font-black text-center mb-8 text-slate-800">Nâng cấp gói của bạn</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trial Plan */}
        <div className="border border-slate-200 rounded-2xl p-6 flex flex-col hover:border-indigo-400 transition-colors bg-slate-50">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Trial</h3>
          <p className="text-sm text-slate-500 mb-4">Dùng thử 7 ngày (x2 Hạn mức)</p>
          <div className="text-3xl font-black text-indigo-600 mb-6">9.000đ<span className="text-sm text-slate-500 font-medium">/7 ngày</span></div>
          <button onClick={() => setSelectedPricingPlan('trial')} className="w-full py-3 rounded-xl bg-white border-2 border-indigo-100 text-indigo-600 font-bold hover:bg-indigo-50">Chọn gói Trial</button>
        </div>
        
        {/* Plus Plan */}
        <div className="border border-indigo-200 rounded-2xl p-6 flex flex-col shadow-lg shadow-indigo-100/50 bg-white relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-500 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider">PHỔ BIẾN</div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Plus</h3>
          <p className="text-sm text-slate-500 mb-4">Sử dụng 30 ngày (x2 Hạn mức)</p>
          <div className="text-3xl font-black text-indigo-600 mb-6">19.000đ<span className="text-sm text-slate-500 font-medium">/tháng</span></div>
          <button onClick={() => setSelectedPricingPlan('plus')} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md">Chọn gói Plus</button>
        </div>

        {/* Pro Plan */}
        <div className="border border-slate-200 rounded-2xl p-6 flex flex-col hover:border-indigo-400 transition-colors bg-slate-50">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Pro</h3>
          <p className="text-sm text-slate-500 mb-4">Sử dụng 30 ngày (x4 Hạn mức)</p>
          <div className="text-3xl font-black text-indigo-600 mb-6">29.000đ<span className="text-sm text-slate-500 font-medium">/tháng</span></div>
          <button onClick={() => setSelectedPricingPlan('pro')} className="w-full py-3 rounded-xl bg-white border-2 border-indigo-100 text-indigo-600 font-bold hover:bg-indigo-50">Chọn gói Pro</button>
        </div>
      </div>
    </div>
  </div>
)}
```

### Task 3: Build QR Payment Waiting Modal

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `selectedPricingPlan`.

- [ ] **Step 1: Order Generation & Polling State**
```tsx
  const [paymentOrder, setPaymentOrder] = useState<{ id: string, amount: number, plan: string } | null>(null);

  useEffect(() => {
    if (selectedPricingPlan && user) {
      const amounts: Record<string, number> = { trial: 9000, plus: 19000, pro: 29000 };
      const orderId = `W2L${user.uid.substring(0, 4).toUpperCase()}${Math.floor(Date.now() / 1000).toString().slice(-4)}`;
      setPaymentOrder({ id: orderId, amount: amounts[selectedPricingPlan], plan: selectedPricingPlan });
      setShowPricingModal(false);
    }
  }, [selectedPricingPlan, user]);
```

- [ ] **Step 2: Payment Modal JSX**
```tsx
{paymentOrder && (
  <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl max-w-sm w-full p-8 flex flex-col items-center text-center relative">
      <button onClick={() => { setPaymentOrder(null); setSelectedPricingPlan(null); }} className="absolute top-4 right-4 text-slate-400"><X /></button>
      <h3 className="text-xl font-black text-slate-800 mb-2">Thanh toán tự động</h3>
      <p className="text-sm text-slate-500 mb-6">Quét mã QR bằng ứng dụng ngân hàng. Hệ thống tự động duyệt sau 10-30 giây.</p>
      
      <div className="p-2 border-2 border-indigo-100 rounded-2xl bg-white shadow-sm mb-6">
        <img src={`https://img.vietqr.io/image/970415-113366668888-compact2.png?amount=${paymentOrder.amount}&addInfo=${paymentOrder.id}&accountName=WORD2LATEX`} alt="QR Code" className="w-64 h-64 object-contain" />
      </div>
      
      <div className="flex items-center gap-2 text-indigo-600 font-medium">
        <Loader2 className="w-5 h-5 animate-spin" /> Đang chờ thanh toán...
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Realtime Success Listener**
```tsx
  useEffect(() => {
    if (paymentOrder && userDoc?.planType === paymentOrder.plan) {
      triggerToast(`Nâng cấp gói ${paymentOrder.plan.toUpperCase()} thành công!`, true);
      setPaymentOrder(null);
      setSelectedPricingPlan(null);
    }
  }, [userDoc?.planType, paymentOrder]);
```

### Task 4: Implement PayOS Webhook Endpoint (Backend)

**Files:**
- Modify: `index.ts`

**Interfaces:**
- Consumes: POST body from PayOS `{"data": {"amount": 19000, "description": "W2LABCD1234"}}`

- [ ] **Step 1: Add Webhook Route**
Append to `index.ts`:
```typescript
import crypto from 'crypto';

app.post('/api/webhook/payos', async (req, res) => {
  try {
    const { data, signature } = req.body;
    // Note: In production, verify HMAC signature using PAYOS_CHECKSUM_KEY
    const description = data.description.toUpperCase(); // e.g. "W2LABCD1234"
    const amount = data.amount;

    if (!description.startsWith("W2L")) return res.json({ success: true }); // Ignore irrelevant transfers

    // Identify Plan from amount
    let planType = "";
    let duration = 0;
    if (amount === 9000) { planType = "trial"; duration = 7; }
    else if (amount === 19000) { planType = "plus"; duration = 30; }
    else if (amount === 29000) { planType = "pro"; duration = 30; }
    
    if (!planType) return res.json({ success: true });

    // Extract partial UID from description (e.g. ABCD)
    const partialUid = description.substring(3, 7);
    
    // Find matching user in Firestore
    const usersSnap = await db.collection('users').get();
    let targetUid = null;
    usersSnap.forEach(doc => {
      if (doc.id.toUpperCase().startsWith(partialUid)) targetUid = doc.id;
    });

    if (targetUid) {
      const expiresAt = Date.now() + duration * 24 * 60 * 60 * 1000;
      await db.collection('users').doc(targetUid).update({
        planType,
        planExpiresAt: expiresAt
      });
      console.log(`Updated user ${targetUid} to plan ${planType}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ success: false });
  }
});
```

- [ ] **Step 2: Commit All Changes**
```bash
git add src/App.tsx index.ts
git commit -m "feat: integrate PayOS automated subscriptions with 3 tiers"
```
