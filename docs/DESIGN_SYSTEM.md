# Mobile App Design System — D4-PS1 ("CA in Your Pocket")

*Adapted reference: a "Meddoc" UI concept (credited to Daniel Rozhnov, © 2025) — colors, typography, and select interaction patterns only. This is not a copy of that app; its branding, copy, and exact screens are not part of this build.*

*Last updated: 2026-06-17 · Build target: React Native (Expo) · Validated directions referenced as [V00X]*

---

## 1. Design Tokens

### 1.1 Color

#### Core Palette

| Token | Value | Use |
|---|---|---|
| `color.primary` | `#045EFE` | Primary actions, active tab indicators, CTAs, structural accents |
| `color.surface` | `#FFFFFF` | Card backgrounds, screen backgrounds, modal surfaces |
| `color.ink` | `#000000` | Primary text, high-contrast nav labels |
| `color.ink.secondary` | `#444444` | Body text, descriptions, secondary labels |
| `color.ink.muted` | `#888888` | Placeholder text, timestamps, disabled labels |
| `color.border` | `#E5E5E5` | Card borders, dividers, input outlines |
| `color.background` | `#F4F6FA` | Screen-level background (behind cards) |

#### Severity Palette (Diagnosis Screen only)

| Token | Value | Use |
|---|---|---|
| `color.severity.blocked` | `#D32F2F` | Blocked ITC — supplier never filed or wrong GSTIN |
| `color.severity.blocked.bg` | `#FFF0F0` | Card background tint for blocked issues |
| `color.severity.pending` | `#E65100` | Needs follow-up — HSN mismatch, rate mismatch, correction pending |
| `color.severity.pending.bg` | `#FFF8F0` | Card background tint for pending issues |
| `color.severity.resolved` | `#2E7D32` | Clean match — no action needed |
| `color.severity.resolved.bg` | `#F0FFF1` | Card background tint for resolved items |

> **Design rule:** Primary blue (`#045EFE`) is structurally reserved — tabs, buttons, active states. **Never** use blue as a severity indicator. Red and amber must read as status signals against white/light card backgrounds without blue competing alongside them.

> ⚠️ **Open item:** Confirm whether `#045EFE` / white / black is the team's actual chosen identity or a placeholder carried over from the reference. Non-blocking for the hackathon build, but needs a deliberate decision before any production use.

#### Dark Mode

Not in scope for the hackathon build. If added later, severity tokens especially need re-validation — `#D32F2F` on a dark background requires contrast checking before use.

---

### 1.2 Typography

#### Typeface Pairing

| Context | Typeface | Notes |
|---|---|---|
| Latin / English UI | **Gilroy** | Geometric sans-serif. Free tier covers limited weights — fine for hackathon, confirm license before production. |
| Hindi / Devanagari UI | **Noto Sans Devanagari** | Gilroy has **no Devanagari glyphs**. Do not stretch Gilroy across both scripts. |
| ₹ amounts and numerals | **Gilroy (Latin numerals)** | Keep numerals in Gilroy regardless of current UI language. Consistent legibility of rupee amounts is non-negotiable. |

#### Type Scale

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `text.display` | 32sp | 700 | 40 | ₹ amounts on diagnosis cards |
| `text.heading1` | 24sp | 700 | 32 | Screen titles |
| `text.heading2` | 18sp | 600 | 26 | Section headings, card titles |
| `text.body` | 15sp | 400 | 22 | Body copy, card descriptions |
| `text.body.bold` | 15sp | 600 | 22 | Emphasis within body copy |
| `text.caption` | 12sp | 400 | 18 | Timestamps, metadata, helper text |
| `text.label` | 13sp | 500 | 18 | Buttons, tab labels, badges |

> **Hindi copy note:** Noto Sans Devanagari renders slightly larger visually at the same sp value than Gilroy. If body copy looks mismatched between Hindi and English screens, scale Devanagari down ~1–2sp to optically match. Test on-device before finalising.

---

### 1.3 Spacing

8-point base grid. All padding, margin, and gap values should be multiples of 8 (or 4 for tight internal spacing).

| Token | Value | Use |
|---|---|---|
| `space.xs` | 4px | Tight internal spacing (icon-to-label gaps) |
| `space.sm` | 8px | Inner card padding (tight), small gaps |
| `space.md` | 16px | Standard inner card padding, list item spacing |
| `space.lg` | 24px | Section spacing, card-to-card gap |
| `space.xl` | 32px | Screen-level vertical padding (top of content area) |
| `space.screen.h` | 20px | Horizontal screen margin (left/right safe area padding) |

---

### 1.4 Elevation / Shadow

| Token | CSS-equivalent | Use |
|---|---|---|
| `elevation.card` | `0 2px 8px rgba(0,0,0,0.08)` | Standard card shadow |
| `elevation.modal` | `0 8px 24px rgba(0,0,0,0.16)` | Bottom sheets, confirmation modals |
| `elevation.fab` | `0 4px 12px rgba(4,94,254,0.30)` | Floating action button (primary blue tint) |

---

### 1.5 Border Radius

| Token | Value | Use |
|---|---|---|
| `radius.card` | 16px | All card components |
| `radius.button` | 12px | Primary and secondary buttons |
| `radius.badge` | 20px | Severity badges, recognition tags |
| `radius.input` | 12px | Text inputs, file drop areas |
| `radius.thumbnail` | 8px | Invoice image thumbnails |

---

### 1.6 Iconography

Use a single icon library throughout — **Lucide** (MIT-licensed, well-maintained, available as `lucide-react-native`). Do not mix icon sets.

Key icons mapped to product concepts:

| Concept | Lucide icon |
|---|---|
| Upload / add documents | `Upload`, `FolderOpen` |
| Camera capture | `Camera` |
| Diagnosis / analysis | `ScanSearch` |
| ITC blocked (red) | `XCircle` |
| Needs follow-up (amber) | `AlertTriangle` |
| Resolved / clean (green) | `CheckCircle` |
| Rupee / money | `IndianRupee` |
| Invoice / document | `FileText` |
| Supplier | `Building2` |
| Language toggle | `Languages` |
| History | `Clock` |
| Settings / profile | `UserCircle` |

---

## 2. Components

### 2.1 Bottom Tab Navigation

Three tabs, fixed at screen bottom. Adapted from reference pattern #3.

```
[ Home ]  [ Reports ]  [ Profile ]
```

- Active tab: icon + label in `color.primary`, indicator dot or underline in `color.primary`
- Inactive tab: icon + label in `color.ink.muted`
- Tab bar background: `color.surface` with `elevation.modal` top shadow
- Safe area handling: respect device bottom inset (Expo's `SafeAreaView` or `react-native-safe-area-context`)
- Label font: `text.label`

**Tab destinations:**

| Tab | Icon | Destination |
|---|---|---|
| Home | `ScanSearch` | Upload / Capture screen (S2) or empty state if no session |
| Reports | `IndianRupee` | Diagnosis Results (S4) or most recent session results |
| Profile | `UserCircle` | Profile / Settings (S6) |

---

### 2.2 Primary Button

- Background: `color.primary`
- Label: `color.surface` (white), `text.label`, 15sp, weight 600
- Radius: `radius.button`
- Height: 52px
- Width: full-width within screen horizontal margins
- Pressed state: 90% opacity + slight scale-down (0.97)
- Disabled state: `color.border` background, `color.ink.muted` label

---

### 2.3 Secondary Button / Ghost Button

- Border: 1.5px `color.primary`
- Label: `color.primary`, `text.label`
- Background: transparent
- Same sizing as primary button
- Use for non-destructive secondary actions (e.g. "View original invoice" on a diagnosis card)

---

### 2.4 Severity Badge

Used on diagnosis cards and document history items.

```
[ ● Blocked ]   [ ● Follow-up ]   [ ● Matched ]
```

- Pill shape, `radius.badge`
- Horizontal padding: 10px; vertical: 4px
- Dot (●): 6px circle in severity color
- Label: `text.caption`, weight 600, severity color
- Background: severity `.bg` token (e.g. `color.severity.blocked.bg`)

---

### 2.5 Recognition Badge (Document Card)

Used on the document history list (S5) and recognition review screen (S3).

```
✓  Recognised   GSTIN detected
```

- Background: light blue tint (`#EBF2FF`)
- Icon: `CheckCircle` in `color.primary`, 14px
- Label: `text.caption`, `color.primary`, weight 500
- Sub-label (what was extracted): `text.caption`, `color.ink.muted`

**Unrecognised state:**

```
?  Could not read
```

- Background: `#FFF8F0`
- Icon: `AlertTriangle` in `color.severity.pending`
- Prompt: "Tap to retake photo"

---

### 2.6 Invoice Thumbnail Card (Document History — S5)

Adapted from reference pattern #1.

```
┌─────────────────────────────────┐
│  [thumbnail]  Supplier Name     │
│               INV-2024-001      │
│               14 Jun · ₹4,200   │
│               [✓ Recognised]    │
└─────────────────────────────────┘
```

- Card radius: `radius.card`; padding: `space.md`; shadow: `elevation.card`
- Thumbnail: 56×56px, `radius.thumbnail`, grey placeholder if image unavailable
- Supplier name: `text.body.bold`
- Invoice number + date: `text.caption`, `color.ink.muted`
- Amount: `text.body`, `color.ink`
- Recognition badge: see §2.5

---

### 2.7 Diagnosis Issue Card (Results Screen — S4)

The most important component in the product. Full spec — not a sketch.

```
┌─────────────────────────────────────┐
│  🔴  [Severity badge: Blocked]      │
│                                     │
│  ₹2,400                             │   ← text.display, color.ink
│  ITC blocked this month             │   ← text.caption, color.ink.muted
│                                     │
│  Ramesh Traders ने गलत HSN कोड      │   ← text.body, color.ink
│  लगाया है।                          │
│                                     │
│  Ramesh Traders को बोलें कि         │   ← text.body, color.ink.secondary
│  14 तारीख से पहले invoice           │
│  file करें।                         │
│                                     │
│  ──────────────────────────────     │
│  [View invoice]    [Copy message]   │   ← ghost buttons, text.label
└─────────────────────────────────────┘
```

**Anatomy:**

| Element | Token | Notes |
|---|---|---|
| Left border accent | 4px solid, severity color | Full card height; most visible severity signal |
| Severity badge | see §2.4 | Top-left |
| ₹ Amount | `text.display`, `color.ink` | Dominant — the first thing the eye lands on |
| Sub-label ("ITC blocked this month") | `text.caption`, `color.ink.muted` | Contextualises the amount |
| Reason sentence | `text.body`, `color.ink` | Hindi-first. One sentence max. |
| Action sentence | `text.body`, `color.ink.secondary` | One sentence max. Starts with a verb. |
| Divider | 1px `color.border` | Separates info from actions |
| "View invoice" | Ghost button, small (height 36px) | Opens the source invoice image/PDF |
| "Copy message" | Ghost button, small | Copies a pre-drafted WhatsApp-ready message to clipboard for the trader to forward to their supplier |

**Card background:** `color.severity.[state].bg` (very light tint — not the full severity color)
**Card border:** 1px `color.border` + left accent strip
**Card radius:** `radius.card`
**Card shadow:** `elevation.card`
**Card padding:** `space.md` (16px) all sides; extra 4px left to clear the accent strip

**Sort order:** Highest ₹ loss at top. Green/resolved cards always below all red/amber. Within the same severity tier, sort by ₹ descending.

**Empty / all-clear state:**
```
✓  सब कुछ ठीक है!
   इस महीने कोई ITC नहीं अटकी।
```
- Green `CheckCircle` icon, 48px, centered
- Heading: `text.heading2`, `color.severity.resolved`
- Sub-text: `text.body`, `color.ink.muted`

---

### 2.8 Upload Zone

Used on the Upload / Capture screen (S2).

**File picker zone (digital documents):**
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│  [FolderOpen icon]              │
│  फ़ाइलें चुनें                  │
│  WhatsApp images, PDFs          │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```
- Dashed border, 2px, `color.border`
- Radius: `radius.input`
- Background: `color.background`
- On tap: triggers `expo-document-picker` (multi-select, image + PDF types)
- Active/drag state: border becomes `color.primary`, background becomes `#EBF2FF`

**Camera zone (physical documents):**
```
┌─────────────────────────────────┐
│  [Camera icon]                  │
│  कैमरे से खींचें                │
│  Printed invoices, receipts     │
└─────────────────────────────────┘
```
- Solid border, 1px `color.border`; same radius, same background
- On tap: triggers `expo-camera` (single capture → returns to screen for next)
- Photo review step before adding to batch (accept / retake)

**GSTR-2B upload zone (separate, clearly labelled):**
```
┌─────────────────────────────────┐
│  [FileText icon]                │
│  GSTR-2B अपलोड करें             │
│  CSV या Excel · एक फ़ाइल         │
└─────────────────────────────────┘
```
- Distinct from invoice zone — GSTR-2B is one file, invoices are many
- On tap: triggers `expo-document-picker` (single-select, CSV/XLSX only)
- Accepted state: shows filename + green checkmark; tap to replace

---

## 3. Screen-by-Screen Specifications

### S1 — Splash / Welcome

**Purpose:** First impression, Hindi-first value prop, CTA to begin.

**Layout:**
- Full-screen, `color.surface` background
- Centered vertically and horizontally
- App wordmark / logo (top third)
- Headline: `text.heading1` — *"अपना GST खुद समझें"* ("Understand your own GST")
- Sub-headline: `text.body`, `color.ink.secondary` — *"हर महीने कितना ITC बचाया जा सकता है — जानिए 2 मिनट में"*
- Primary CTA button: *"शुरू करें"* ("Get started") → navigates to S2
- Language toggle link at bottom: *"Switch to English"*

**Tone note:** No CA / tax jargon on this screen. The user should feel the product is for them, not for an accountant.

---

### S2 — Upload / Capture

**Purpose:** Single bulk-upload action — GSTR-2B + invoice batch together. Two input methods feeding the same pipeline.

**Layout:**
- Screen title: *"दस्तावेज़ अपलोड करें"* / *"Upload Documents"*
- GSTR-2B zone (§2.8) at top with label: *"Step 1"* tag
- Invoice batch zone (file picker + camera) below with label: *"Step 2"* tag
- Running count badge: *"12 invoices added"* updates as files are added
- Primary button at bottom: *"जाँच शुरू करें"* / *"Start checking"* — disabled until both zones have at least one file; activates with count ≥ 1 in each
- The CTA button label updates: *"2 files + 12 invoices ready → Start"* once loaded

**UX note (from ideation Thread 003/004):** This is a one-time monthly moment, not a daily task. Design it to feel like a deliberate "month-end check" ritual, not a chore. Progress feedback matters — the trader should see files accumulating.

---

### S3 — Recognition Review / Confirm

**Purpose:** Show the trader what was extracted before processing starts. One confirm action, not per-item decisions. Adapted from reference pattern #2.

**Layout:**
- Screen title: *"क्या सही पहचाना?"* / *"Did we read these right?"*
- Scrollable list of invoice thumbnail cards (§2.6), each showing extracted fields
- GSTR-2B summary card at top: filename, period (e.g. "May 2026"), number of entries detected
- Unrecognised items clearly flagged with "Could not read" state (§2.5) — trader can retake photo
- Bottom: single primary button *"हाँ, आगे बढ़ें"* / *"Confirm & analyse"*
- Processing indicator after confirm: animated, with status text — *"Matching invoices..."* → *"Checking HSN codes..."* → *"Almost done..."*

**Design note:** Don't ask the trader to correct OCR errors here. The goal is confidence ("we got most of it"), not perfection. Errors surface as ambiguous items on the results screen.

---

### S4 — Diagnosis Results *(Critical Gap — Original Design)*

**Purpose:** Deliver the actual value. ₹-quantified, action-oriented, plain Hindi. This is the product.

**Layout:**

```
┌──────────────────────────────────────┐
│  ← Back      इस महीने की जाँच        │
├──────────────────────────────────────┤
│  Summary bar:                        │
│  ₹6,800 अटकी है  ·  3 समस्याएं       │
├──────────────────────────────────────┤
│  [Diagnosis Issue Card — Blocked]    │
│  [Diagnosis Issue Card — Pending]    │
│  [Diagnosis Issue Card — Pending]    │
│  [Diagnosis Issue Card — Resolved]   │
└──────────────────────────────────────┘
```

**Summary bar (pinned below header):**
- Background: `color.severity.blocked` (red) if any blocked issues exist; `color.severity.pending` (amber) if only pending; `color.severity.resolved` (green) if all clear
- Total ₹ at risk: `text.heading1`, white
- Issue count: `text.body`, white, `color.ink.muted` tint

**Issue cards:** See §2.7.

**Share / Export action (header right):** Share button → generates a simple text summary ("ITC report for May 2026: ₹6,800 blocked, 3 issues") — copyable or shareable via system share sheet. Useful for traders who want to forward the summary to a CA or family member helping with GST.

**GSTR-2A early-warning notice (if applicable):**
> If the diagnosis engine has visibility into GSTR-2A data (auto-populated from supplier filings, updates before the 2B lock), an informational banner can appear above the issue cards:
> *"2 suppliers haven't filed yet this month. Follow up before the 14th to protect your ITC."*
> This is additive, not a separate screen. See Open Items — GSTR-2A thread.

---

### S5 — Invoice / Document History

**Purpose:** Record of past uploads and extracted data. Builds trust and allows re-checking.

**Layout:**
- Screen title: *"पुराने दस्तावेज़"* / *"Document History"*
- Grouped by month (e.g. "June 2026", "May 2026")
- Each month group: summary line ("₹2,400 recovered · 8 issues resolved") + expandable list of invoice cards (§2.6)
- Empty state: *"अभी तक कोई दस्तावेज़ नहीं।"* with Upload CTA

---

### S6 — Profile / Settings

**Purpose:** Language toggle, session history summary, basic account info.

**Layout:**
- Language toggle: prominent, top of screen — *"हिंदी / English"* — switches all UI copy instantly (no reload)
- GSTIN display (read-only; trader enters once on first setup)
- Session history: list of past analysis runs with date + total ₹ impact
- App version / about section at bottom
- "Clear data" option (local session data only)

---

### L0 — Landing Page *(Judge-Facing — Not Part of In-App System)*

**Purpose:** Hackathon presentation surface. Judges, not traders, are the audience. Narrative + screenshots + install CTA.

**Not part of this design system** — separate build block (Day 3). However, some token alignment is desirable so it reads as the same product:

- Use `#045EFE` as the hero accent color
- Use Gilroy if available via web font; fall back to Inter or DM Sans — both are free and tonally similar
- Lead with the problem (*"₹2,400 blocked. You don't know why. Your CA does."*) before introducing the solution
- Show the diagnosis results screen (S4) as the hero screenshot — it's the most compelling visual and the most original design in the build
- Include the "try it" / install CTA prominently — judges may want to test on their own device

---

## 4. Copy Guidelines

### 4.1 Voice and Tone

The product talks to a kirana owner in Lucknow, not to a tax professional. The bar for every piece of UI copy:

> *Would this make sense to someone who passed Class 10 and uses WhatsApp daily, with no GST training?*

| ❌ Avoid | ✅ Use instead |
|---|---|
| "HSN code mismatch detected" | "गलत HSN कोड लगाया है" |
| "Input Tax Credit reconciliation" | "ITC — यानी वो tax जो आपको वापस मिलना चाहिए" |
| "GSTIN not found in GSTR-2B" | "इस supplier ने अभी तक invoice file नहीं की" |
| "Document recognised" | "पहचान लिया ✓" |
| "Unrecognised file type" | "यह फ़ाइल नहीं पढ़ सकते — दोबारा खींचें" |
| "Processing..." | "जाँच हो रही है..." |

### 4.2 Hindi-First, English-Accessible

- Default UI language: Hindi
- Language toggle (S6): switches all labels, cards, and system messages
- Amounts always in numerals (`₹2,400`) — never spelled out ("do hazaar chaar sau")
- Supplier names, invoice numbers, GSTINs stay in their original form regardless of UI language

### 4.3 Rupee Amounts

- Always show the `₹` symbol before the amount: `₹2,400` not `Rs 2400` or `2400 rupees`
- Use Indian number formatting: `₹1,00,000` not `₹100,000`
- On diagnosis cards, the amount is the first thing the eye sees — make it big, make it clear

### 4.4 Action Sentences

Every diagnosis card action must:
- Start with a verb (*"Ramesh Traders को बोलें..."* / *"Portal पर जाएं..."*)
- Name the specific actor if known (*"Ramesh Traders"*, not *"your supplier"*)
- Give a deadline if relevant (*"14 तारीख से पहले"*)
- Be one sentence — if it needs two, the issue needs to be split into two cards

### 4.5 "Copy Message" Feature

The "Copy message" button on diagnosis cards (§2.7) should produce a ready-to-forward WhatsApp message in Hindi that the trader can send directly to their supplier. Template:

> *"नमस्ते, मैंने देखा कि आपकी invoice [INV-001] GSTR-2B में नहीं आई है। क्या आप इसे इस महीने की 14 तारीख से पहले file कर सकते हैं? मेरी ₹2,400 की ITC अटकी हुई है। धन्यवाद।"*

This bridges the "directly actionable" requirement from the PS — the trader doesn't need to know what GSTR-2B is to use this feature. They just tap "Copy" and forward.

---

## 5. Interaction & Motion

### 5.1 Principles

- **Purposeful only.** No decorative animation. Motion serves feedback, not aesthetics.
- **Fast.** Target 200ms for UI transitions; 300ms for screen transitions.
- **Hindi-first users likely on mid-range devices.** Keep animations lightweight — avoid heavy spring physics or particle effects.

### 5.2 Key Interactions

| Interaction | Behaviour |
|---|---|
| Screen transition | Horizontal slide (React Navigation default stack) |
| Tab switch | Instant, no animation |
| Card tap (expand/collapse) | Smooth height expansion, 200ms ease-out |
| Processing state (S3) | Looping shimmer on card placeholders; text status updates every ~2s |
| Diagnosis card entrance | Staggered fade-in + 4px upward translate, 150ms each card, 50ms delay between cards |
| Severity badge | Pulse once on screen load (blocked items only) — draws attention without being annoying |
| "Copy message" tap | Brief haptic (if available) + button label changes to "Copied ✓" for 2s then resets |
| Language toggle | Immediate — all text re-renders without navigation |

### 5.3 Loading States

The processing step after S3 confirmation is the longest wait in the app (multimodal extraction can take seconds per invoice). Design for it, don't ignore it.

- Show a full-screen progress state (not just a spinner)
- Show what's happening: *"Invoice 7 of 12 पढ़ी जा रही है..."*
- Show progress numerically — traders don't trust black-box loading bars
- Estimated time if possible: *"लगभग 30 सेकंड बाकी"*
- Never leave the user staring at a blank screen or generic spinner

---

## 6. Accessibility

### 6.1 Contrast

All text must meet WCAG AA minimum contrast ratios:
- Body text on white: `#444444` on `#FFFFFF` = 9.7:1 ✅
- Primary blue on white: `#045EFE` on `#FFFFFF` = 4.6:1 ✅ (AA for large text; check for small text)
- Severity red on white: `#D32F2F` on `#FFFFFF` = 5.1:1 ✅
- White text on primary blue: `#FFFFFF` on `#045EFE` = 4.6:1 ✅

> ⚠️ Re-check severity colors against their `.bg` tint tokens — light tints may reduce contrast for body copy placed on them. Use `color.ink` for text, not the severity color itself, on tinted backgrounds.

### 6.2 Touch Targets

Minimum 44×44px for all interactive elements (Apple HIG / Android guidelines). Diagnosis card action buttons (36px height) compensate with extended tap area padding.

### 6.3 Devanagari Rendering

- Test on actual Android devices (mid-range preferred — Redmi, Moto G class) — Devanagari rendering varies across OEMs
- Noto Sans Devanagari is pre-installed on most Android devices but bundle it with the app via Expo's font loading (`expo-font`) to guarantee consistent rendering
- Avoid wrapping Hindi text in fixed-width containers — Devanagari script can reflow differently than Latin

---

## 7. Patterns Adapted From the Reference

> ⚠️ Caution: The reference (Meddoc UI concept, Daniel Rozhnov, © 2025) is adapted for colors, typography, and interaction patterns **only**. Branding, copy, and exact screens are not part of this build. Do not copy screen-for-screen or reproduce the reference's own name, copy, or assets.

### Pattern 1 — Document/Invoice Card with Recognition Badge → S5
Thumbnail + short label + a "Recognised" badge showing what the system auto-extracted (supplier, date, etc.). Maps directly onto the invoice-batch review after upload and the document history list.

### Pattern 2 — Bulk-Upload Confirmation Screen → S2/S3
Itemized thumbnails of everything picked up in one upload action; single confirm button at the bottom. Near-direct match for the V003 batch-upload flow: trader uploads GSTR-2B + invoice batch in one action, reviews what was recognised, confirms once before processing starts.

### Pattern 3 — Bottom Tab Navigation → All screens
Three-tab structure, relabelled: **Home / Reports / Profile**. Reusable as-is.

---

## 8. Open Items

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Confirm `#045EFE` / white / black as team's actual identity vs placeholder | 🟡 Open | Non-blocking for hackathon |
| 2 | Gilroy license for intended use | 🟡 Open | Fine for hackathon; check before production |
| 3 | Diagnosis screen needs a full design pass (not just this spec) | 🟡 Open | §2.7 and §3.4 cover component + layout; actual visual mock still needed |
| 4 | GSTR-2A early-warning banner — in scope or deferred? | 🟡 Open | Low-effort add if engine has 2A data access; see §3.4 note |
| 5 | Dark mode | 🟡 Open | Out of scope for hackathon; severity palette especially needs re-validation if added |
| 6 | "Copy message" WhatsApp template — Hindi copy review | 🟡 Open | Must be reviewed by a native Hindi speaker before demo; awkward translations undercut the plain-language promise |
| 7 | Devanagari rendering tested on actual mid-range Android device | 🟡 Open | Must happen before demo day; emulator is not sufficient |

---

*This document covers tokens, components, screen specs, copy guidelines, interaction design, and accessibility. It is a build-against spec, not a Figma deliverable. Sections marked "original design required" (primarily S4 and its card component §2.7) represent the highest-priority design work remaining.*

*KLEOS 2026 · D4-PS1 · "CA in Your Pocket" · Design System v2 · 2026-06-17*
