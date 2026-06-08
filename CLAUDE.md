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
**Cause:** Vision model dropped the decimal point, treating `760.00` as `76000`.
**Fix:** Added a prominent `=== NUMBER FORMAT ===` block to `TXN_SYSTEM` with explicit rules and before/after examples:
- `"100.00" → 100`, `"760.00" → 760`, `"17,000.00" → 17000`
- Commas are thousands separators; period is decimal.
**Rule:** When prompting for numeric extraction from financial screenshots, always include explicit decimal/comma format rules with examples. Don't assume the model infers this from context.

---

## Architecture reminders

- `finance.html` import pipeline: `runImport` → `downscaleImage` → `callExtract` (Anthropic API) → `applyImport` → `save` / `render`
- `callExtract` picks `TXN_SYSTEM`/`TXN_TOOL` when `kind === 'txn'`, else `EXTRACT_SYSTEM`/`EXTRACT_TOOL`
- `applyImport` `txn` branch runs first (before the `isFinite(it.a)` guard), all other kinds run after
- localStorage key: `finance_standalone_v1`
- State shape: `{ accounts, subscriptions, orders, wishlist, activity, netWorthHistory, transactions, currency, activeTab }`
