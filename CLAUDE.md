# GaviniDashboard — Claude Notes

Pure static HTML/CSS/JS app. No build step. Each page is self-contained.
Supabase sync via `db.js` (whole localStorage → one JSON blob, newest-wins).
Vercel serverless functions live in `api/`.

---

## Known bugs fixed — avoid repeating

### 1. Wrong Anthropic model ID (`finance.html`)
**Symptom:** "Import failed — The model did not return the expected structure."
**Cause:** `DEFAULT_MODEL` was `'claude-haiku-4-5'` (invalid ID).
**Fix:** Use `'claude-haiku-4-5-20251001'` (full model ID required).
**Rule:** Always use full model IDs. Check `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, etc.

### 2. `max_tokens` too low for Haiku 4.5 tool calls (`finance.html`)
**Symptom:** API call succeeds but returns no tool_use block; stop_reason is `max_tokens`.
**Cause:** `max_tokens: 500` — Haiku 4.5 uses thinking tokens before emitting a tool call, burning the budget before the tool response.
**Fix:** `max_tokens: 4096` for any Haiku 4.5 call that uses tools.

### 3. System prompt as array with `cache_control` (`finance.html`)
**Symptom:** API errors or missing structured output.
**Cause:** System prompt was passed as an array of blocks with `cache_control: { type: 'ephemeral' }` — format incompatible with this call pattern.
**Fix:** Pass `system` as a plain string: `system: SOME_SYSTEM_STRING`.

### 4. Missing `KIND_HINT` entry for new import kinds (`finance.html`)
**Symptom:** API error `messages.0.content.1.text.text: Field required`.
**Cause:** Adding a new import kind (e.g. `'txn'`) without adding it to `KIND_HINT` leaves `KIND_HINT[kind] === undefined`. The message content block becomes `{ type: 'text', text: undefined }` which the API rejects.
**Fix:** Every import kind must have an entry in `KIND_HINT`. When adding a new kind, update `KIND_HINT` at the same time.

### 5. `applyImport` guard silently drops new item schemas (`finance.html`)
**Symptom:** Import succeeds (API returns rows), but "Claude couldn't read any items" — count is 0.
**Cause:** `applyImport` opens with `if (!isFinite(Number(it.a))) return` — this runs before any kind-specific branch. New import kinds that don't use the `a` (amount) field (e.g. `txn` uses `db`/`cr`) have `it.a === undefined → NaN → filtered out`.
**Fix:** Handle kinds with a different schema at the TOP of the `forEach` with an early `return`, before the `it.a` guard. The `txn` branch is now first.

### 6. OCR decimal misread — `760.00` extracted as `76000` (`finance.html`)
**Symptom:** Transaction amounts ×100 for values ending in `.00` (e.g. PHP 760.00 → PHP 76,000).
**Cause:** Haiku's vision misreads the decimal point in financial table cells, producing `10000` instead of `100.00`. Prompt warnings alone (`"100.00 → 100 NOT 10000"`) did not fix it. Changing schema to `type:string` and parsing in JS also did not fix it — the model still output the wrong string.
**Root cause:** Haiku is not accurate enough for precise financial table OCR.
**Fix:** Txn imports use `claude-sonnet-4-6` hardcoded (not the user-configurable model). Sonnet reads the numbers correctly. Schema uses `type:string` for `db`/`cr` and `parseTxnAmt()` strips non-numeric chars and `parseFloat()`s.
**Rule:** For financial data where exact numbers matter, use Sonnet not Haiku. Don't fight model accuracy with prompt engineering — switch the model.

---

## Dashboard-wide fixes applied (June 2026)

### A. Cloud sync floating button removed (`cloud-sync.js`)
**Problem:** Every page showed a "☁ Cloud sync" pill button bottom-right.
**Fix:** `cloud-sync.js` replaced with a no-op IIFE — the file is still included by all pages so no script tags needed updating. Actual sync runs via `db.js` (untouched).

### B. Onboarding popup guard + settings gear (`index.html`)
**Problem:** Profile modal could reopen if saved object lacked `onboarded:true`.
**Fix:** Guard changed from `if (!profile)` to `if (!profile || !profile.onboarded)`. `saveProfile()` already sets `onboarded:true` on every save.
Added `.gearBtn` (⚙) button in `headerHtml` → `headerControls` — always visible, triggers `data-action="open-profile"`.

### C. Progress page wired to real gym data (`progress.html`)
**Problem:** `trainingHtml()` and `compHtml()` used hardcoded sample `LIFTS` / `COMPOSITION` constants.
**Fix:** Replaced with `loadGymLifts()` and `loadGymComposition()` that read from `po_coach_v1` localStorage.
- `loadGymLifts()`: finds per-exercise PRs/regressions over last 90 days, returns null if no gym data → section hidden.
- `loadGymComposition()`: computes weight slope from `progress_standalone_v1` entries + volume trend from gym logs. Returns null if insufficient data → section hidden.
- Removed "shown here as a sample" note from composition section.

### D. Rebrand Patron → Gavin
- `manifest.webmanifest`: `"name": "Patron — Rowan"` → `"name": "Gavin"`, `"short_name": "Patron"` → `"short_name": "Gavin"`
- All 11 HTML files: `<meta name="apple-mobile-web-app-title" content="Patron">` → `content="Gavin"`

---

## Architecture reminders

- `finance.html` import pipeline: `runImport` → `downscaleImage` → `callExtract` (Anthropic API) → `applyImport` → `save` / `render`
- `callExtract` picks `TXN_SYSTEM`/`TXN_TOOL` + hardcodes `claude-sonnet-4-6` when `kind === 'txn'`, else uses `EXTRACT_SYSTEM`/`EXTRACT_TOOL` + user-configured model
- `applyImport` `txn` branch runs first (before the `isFinite(it.a)` guard), all other kinds run after
- localStorage key: `finance_standalone_v1`
- State shape: `{ accounts, subscriptions, orders, wishlist, activity, netWorthHistory, transactions, currency, activeTab }`
