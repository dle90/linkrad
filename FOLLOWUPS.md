# Follow-ups

Known limits and deferred work. Organise by area.

## Phân quyền / multi-role RBAC (commit 54f34fe)

Phase 1 shipped: `User.assignments[]` + `RolePermission.scope`, token embeds `permissions/sites/sitePerms`, 12 roles seeded (admin / giamdoc / ketoan / hr / bacsi / gd_chinhanh / letan / ktv / nv_kho + legacy truongphong/nhanvien/guest). Ma trận quyền has create/delete/scope UI; HR employee edit has multi-role + site-picker assignment UI.

**Still to do:**

- **Per-route site scoping** — the token carries `sites[]` and `sitePerms[siteId][]`, but no route enforces "Lễ tân at site A can only register at site A" yet. Current routes still rely on `user.department` for site filtering (one primary site per user). Migrate when someone needs multi-site users.
- **Page-level role check migration** — partly resolved 2026-04-22 (Step 3c batches 1+2). Server: `inventory.js` 13 routes on `inventory.manage`, `billing.js` refund on `billing.refund`, `partner-admin.js` 3 routes on `partners.manage`, `promotions.js` 3 routes on `catalogs.manage`. Client: 6 financial pages (AnnualPL/CF, MonthlyPL/CF, BalanceSheet, Breakeven) on `financials.manage`, plus `Inventory.jsx`, `Promotions.jsx`, `Catalogs.jsx` (per-sub-table: hr.manage/catalogs.manage/partners.manage), `CRM.jsx` + `SiteList.jsx` on `system.admin`. `isAdmin` var renamed to `canEdit` everywhere. **Remaining ambiguous cases** (4 sites) not migrated — need your call:<br>&nbsp;&nbsp;• `KPISales.jsx:678` and `Marketing.jsx:486`: `isManager = admin || giamdoc || truongphong` doesn't map to any single perm (kpi-sales.view wrongly includes kinhdoanh; financials.manage excludes truongphong). Decide: drop truongphong (use `kpi-sales.view`/`marketing.view`), drop kinhdoanh (add a new `kpi-sales.manage` perm), or keep legacy check.<br>&nbsp;&nbsp;• `ReportTemplates.jsx:98`: "owner OR admin" — ownership check, not pure permission. Leave alone unless you want `system.admin` for the admin override.<br>&nbsp;&nbsp;• `Layout.jsx:166` `isAdmin` still used by the legacy `adminOnly` menu-item flag; keep until those items move to `perm:`. **Data-scoping checks** in `ris.js` / `tasks.js` / `registration.js` / `enhancements.js` (filtering query results by role — e.g. truongphong sees only their dept) are intentionally NOT migrated: they're query shape, not permission. Revisit only when Phase 2 per-site scoping ships. **Still pending**: `App.jsx` top-level route guards (`auth.role === 'admin'` on 3 routes — small count, high blast radius); `Workflow.jsx` role-visible action buttons.
- **~~"sale" role is orphaned~~** — resolved 2026-04-21: `kinhdoanh` added as the proper NVKD role (group-scope, perms `registration.view + referral.view + kpi-sales.view + partners.manage + catalogs.view + crm.view`) and `sale` kept as a legacy alias with identical perms. Migrate `User.role === 'sale'` accounts onto `assignments: [{ roleId: 'kinhdoanh' }]` when touching a sale account next.
- **Existing sessions**: users logged in before deploy still carry old tokens (no `permissions[]`). They need to log out + back in to pick up the new gating. Not an issue for Railway auto-deploy because the server restart invalidates sessions? Actually no — tokens are stateless HMAC, so old tokens keep working. Worst case: stale tokens trigger the DB-fallback path in `requirePermission`. Acceptable.
- **Sidebar migration partial** — `Quản lý`, `Tài chính`, and now `Báo cáo` (both subgroups) + `/audit-log` use `perm:` keys. Clinical items (Đăng ký, Phiếu thu, Ca chụp, Ca đọc, Công việc, Quản lý kho) + all `Danh mục` items still use `workflowOnly`. Migrating those is a behavior change (current `workflowOnly` = any non-guest role; perm-based would drop visibility for hr/ketoan/kinhdoanh). Decide per-item rather than bulk.
- **Danh mục → Nhân sự is now profile-only** (2026-04-21) — the editable `Chức vụ` dropdown was removed from the Catalogs employee form because it only wrote the legacy single `User.role` field and had no assignments/site UI. A "Phân quyền tại HR" link now points to `/hr/employees`. The list still shows the `Chức vụ` column + role filter as read-only reflections of the legacy field. New employees created via Catalogs still default `role: 'nhanvien'` (hardcoded in `startNew`) so the legacy field stays populated for back-compat with the ~30 client + 29 server sites that still gate on `user.role ===`. Remove the default and the column once those legacy checks are migrated.
- **`Employee` collection dropped, HR now reads `User`** (2026-04-21) — the separate `Employee` model/collection was redundant (duplicated HR fields on User, linked back via `userId`). The model file is deleted; `/hr/employees` routes now read/write `User` directly (password is required on create, defaulted to the mã NV if omitted). `User` gained three new fields: `position`, `employmentStatus`, `notes`. Catalogs → Nhân sự and HR → DS nhân viên now show the same list. **Orphan data:** if the prod `employees` collection had any docs they are no longer reachable from the app — drop the collection manually on Atlas once confirmed empty (don't auto-drop; honor the "no destructive ops without confirming" rule). The `seed-hr.js` now just backfills `departmentId`/`position`/`employmentStatus` on existing Users. The `sanity-check-hr.js` `Has 6 roles` assertion is stale (now 14 after Step 2) — unrelated pre-existing bug, noted here so nobody re-reports it.
- **Phân quyền vocabulary expanded** (2026-04-21) — permissions.js now defines 29 perms across 10 groups: added `consumables.record`, `reports.view`, `rad-reports.view`, `kpi-sales.view`, `referral.view`, `partners.manage`, `audit.view`. ROLE_CATALOG now has 10 named + 4 legacy roles (added `kinhdoanh`, kept `sale` as alias). Seed-hr.js was run against prod Atlas — RolePermission collection carries the new defaults. Matrix display bug fixed: view/manage columns now show "XEM"/"QL" verb prefix.
- **Step 3 route enforcement (a+b done)** (2026-04-22) — Sidebar (3a): all 15 report items + 2 phase-2 + `/audit-log` now gate on `perm:` keys. Server (3b): `/reports/*` require `reports.view`; `/reports/rad/*` require `rad-reports.view`; `/reports/referral-revenue` requires `referral.view`; `/reports/salesperson-kpi` requires `kpi-sales.view`; `/audit-log` GET requires `audit.view` (dropped the hardcoded admin/giamdoc check); `PUT /studies/:id/consumables` requires `consumables.record`; catalogCRUD extended with `writePerm` parameter — referral-doctors/partner-facilities/commission-groups/commission-rules writes now require `partners.manage` (non-admin `kinhdoanh` users can manage partners). **Still open (3c)**: ~30 client + 29 server `role === 'admin'` gates; `workflowOnly` on clinical + danh-mục sidebar items; other catalog POST/PUT/DELETE still require admin rather than `catalogs.manage`.



## Mock catalog data — cleanup before real-data import

Seed script `linkrad-app/server/scripts/seed-catalogs-mock.js` populates the Danh mục pages for demo. Every inserted doc has an `_id` containing `MOCK-`. Collections affected:

- Specialty, TaxGroup, ServiceType, Service (12 mock services)
- MedicalFacility, RegistrationReason, BillingCancelReason
- ReferralDoctor, PartnerFacility, CommissionGroup, CommissionRule

**Before importing real data**, run the paired cleanup script to wipe all mock rows:

```bash
node linkrad-app/server/scripts/seed-catalogs-mock-remove.js
```

It does `deleteMany({ _id: /MOCK-/ })` on each affected collection. Real data (without `MOCK-` in its `_id`) is untouched.

### Studies seeding split (2026-04-21)

Fake studies (STD-MOCK-*) were dropped because their fabricated `studyUID`s meant "Xem ảnh" landed on an empty OHIF homepage. **For Ca đọc demo**, run `linkrad-app/server/test-flow1/wire-dicom-studies.js` — it wires 3 real DICOM studies already in Orthanc (1 CT chest 651 instances, 2 MRI brain — Hà Nội + Thanh Hóa sites, all status `pending_read`). That script is idempotent (upserts by studyUID). The `Study` entry stays in the mock-remove TARGETS as a defensive cleanup for any leftover `MOCK-` study docs.


## Vật tư tiêu hao / Auto-deduct (commit a08b021)

- **No "add extra supply" row in ConsumablesPanel.** KTV can only edit quantity/notes on supplies that are in `SupplyServiceMapping`. If a scan actually uses a supply not in định mức, KTV has no way to record it — admin must create a manual export transaction in the Inventory page.
- **No reversal on status rollback.** If admin reverts a study `pending_read` → `in_progress` (or deletes), the confirmed `auto_deduct` InventoryTransaction stays and stock stays decremented. Need an "un-deduct" path before we support status-rollback flows.
- **No variance report.** We record `standardQty` and `actualQty` on each Study but don't aggregate across studies. Build a report at `/rad-reports/consumables-variance` keyed by service/KTV/period.

## Referral source / NVKD (Phase 1 + 2 shipped)

**Phase 1 (commit fa03e6a):** CustomerSource catalog + Registration form Nguồn + referral picker, assignedStaff dropdowns on partner forms.

**Phase 2 (this PR):** Invoice snapshots `sourceCode/referralType/referralId/referralName/effectiveSalespersonId/effectiveSalespersonName` on create. Two new reports: `/reports/referral-revenue` and `/reports/salesperson-kpi`.

### Still pending — commission (Phase 3)

Needs its own design pass before implementation. Key decisions to resolve:

1. **Commission rule schema**: extend `CommissionRule` with an `earnerType` (`'facility' | 'salesperson'`) and make `commissionGroupId` optional when earner is NVKD, or add a dedicated `SalespersonCommissionRule` collection. Leaning toward extending since the calc logic is 90% shared.
2. **NVKD rate definition**: flat % of attributed revenue, or per-service rules like facilities? Users will want flexibility (e.g. higher % on imaging than on consult), so per-service is probably worth the cost.
3. **Payout cycle**: monthly cut-off, what events finalize a period, can an invoice's attribution still be edited after close? Currently attribution is immutable from invoice creation — good foundation.
4. **Statement generation**: PDF per NVKD per period, with line-item breakdown; who signs off.
5. **Reversal on cancel/refund**: when an invoice is cancelled or refunded, what happens to already-paid-out commission. Claw back vs. adjust next period.

The infrastructure from Phase 2 (snapshotted `effectiveSalespersonId` per invoice) already makes the compute side trivial — it's the policy and payout UX that need product input.

### Design decisions worth knowing

- NVKD is represented as `User.role === 'sale'` (role value existed as a stub pre-feature). Switch to `Employee.isSalesperson` or a dedicated `Salesperson` model only if NVKDs should not log in.
- Old `Appointment.referringDoctor` free-text field is left in place; new data lives in `referralId`/`referralName`. Retire only when there's a migration need.
- Existing patients/appointments/invoices pre-dating Phase 1 have empty source/referral fields — they appear under "Trực tiếp / Không xác định" in the new reports. No backfill.
- Invoice attribution is snapshotted at `POST /invoices` (draft creation), not at payment. This means if admin fixes a wrong referral on the Appointment *after* the invoice was created, the old invoice keeps the stale attribution. Acceptable trade-off: snapshot immutability > retroactive correctness.

## Đăng ký (Registration) search-first redesign (2026-04-22)

**Phase 1 shipped:** `Registration.jsx` rewritten with a 3-step stepper header (1. Tìm/Tạo BN → 2. Dịch vụ → 3. In phiếu), 320px left rail showing today's patients only (toggle "Tất cả"), search-first main area with debounced live dropdown over `/api/registration/patients?q=`, dual "Tạo hồ sơ mới với SĐT/tên" buttons that prefill the form, essential 6-field form with collapsible "Thông tin bổ sung" accordion, and a cart-based service picker wired to `/catalogs/services/public`.

**Phase 1b shipped (same day):** "In phiếu chỉ định" now hits a new `POST /registration/check-in` endpoint that atomically creates **1 Invoice (draft, → Phiếu thu "Chờ thu")** + **N Appointments (scheduled)** + **N Studies (scheduled, → Ca chụp "Chờ thực hiện")** — one pair per imaging service. Invoice gets the full cart as line items and a referral snapshot via `resolveEffectiveSalesperson`. Non-imaging services (modality not in CT/MRI/XR/US) only appear on the Invoice, no Ca chụp row — that's a different workflow. Invoice helpers (`nextInvoiceNumber`, `resolveEffectiveSalesperson`) moved from `routes/billing.js` into `lib/invoicing.js` so both routes can share them.

**Deferred (Phase 2 / 3):**

- **BHYT payment method**: Cart's "BHYT" chip maps to Invoice.paymentMethod `'mixed'` since the enum doesn't have a BHYT value. Proper BHYT flow needs insurance card capture + split-payment logic (partial BHYT coverage + patient copay).
- **Invoice ↔ multiple appointments**: Invoice.appointmentId is a single string, so the invoice only links to the *first* appointment. Referral snapshot path still works because all appointments in a check-in share the same referral source (copied from the patient). If you need to navigate Invoice → all its work items, either add `Invoice.appointmentIds: [String]` or query `Appointment.find({ invoiceId })` after adding that reverse field.
- **Rollback is best-effort**: `/check-in` uses try/catch with manual deletion on failure, not Mongo transactions. Matches existing patterns (LinkRad doesn't use transactions anywhere). Acceptable for this flow because failures are rare and any orphan rows are visible on Ca chụp/Phiếu thu for manual cleanup.
- **Past orders for returning patients**: Screen C shows a fresh cart only. Previously-ordered services (from the patient's appointment history) are not displayed. Consider a "Lịch sử chỉ định" panel or link.
- **Rescheduling / "Số ngày hẹn"**: The old ScheduleTab (days-ahead → scheduled date + note) was removed from Đăng ký. `POST /registration/appointments` still exists for legacy callers. If re-chụp scheduling is needed from this page, extend `/check-in` to accept `scheduledAt` instead of hardcoding `now()`.
- **"Hôm nay" status chips**: The wireframe showed per-row status (Đã khám / Đang chờ / Mới đăng ký). Current implementation just shows name/phone/time/code. Needs a join with today's Appointment rows to derive status.
- **Tablet/mobile breakpoint**: Left rail hides below ~900px currently (flex layout collapses poorly). Wireframes had a tablet variant (rail → drawer) that's not implemented yet.
- **Print flow**: `window.print()` prints the whole page. A proper printable "Phiếu chỉ định" template (patient + services + total + barcode) would be cleaner. Today's output is placeholder.
- **`/catalogs/services/public` graceful fallback**: If the catalog is empty or the endpoint errors, Screen C shows a yellow banner but no way to proceed with services. Not blocking for empty-catalog clinics (they can still register patients), but worth a graceful "Skip services, just save patient" escape.
- **Scripts folder**: `scripts/decode-wireframes.mjs` + `scripts/wireframes-out/` are local artifacts from decoding the Claude Design bundle. Not committed, but kept locally under `scripts/` — delete if cluttering. The source wireframe HTML is at repo root (`LinkRad Registration Wireframes _standalone_.html`).

## Ca chụp → Kết thúc chụp modal + signatures (2026-04-22, same-day)

**Shipped:**

- **Button semantics split on Ca chụp worklist** — removed the ambiguous single "▶ Hoàn tất" button that used to appear on both CHỜ THỰC HIỆN and ĐANG THỰC HIỆN tabs. Now: CHỜ THỰC HIỆN has `▶ Bắt đầu chụp` (simple status flip `scheduled → in_progress`, no modal); ĐANG THỰC HIỆN has `▶ Kết thúc chụp` (opens `CompleteStudyModal` → `in_progress → pending_read`). The 📡 button remains on both tabs as MWL-only sync (no status change).
- **`CompleteStudyModal` component** at [components/CompleteStudyModal.jsx](linkrad-app/client/src/components/CompleteStudyModal.jsx) — KTV flow for logging vật tư tiêu hao + confirming end of imaging. Opens with consumables pre-filled from `GET /ris/studies/:id/consumables-standard` (derived from `SupplyServiceMapping` + `getStudyServices` chain); KTV can edit quantities (amber diff badge), remove rows (rose ghost-row with Hoàn tác undo), add rows via debounced supply picker hitting `/inventory/supplies?q=`. "Xác nhận & chuyển sang Chờ đọc" does `PUT /consumables` then `PUT status:'pending_read'` sequentially — the existing backend `autoDeductConsumables` fires on the status transition (FIFO lot deduction, creates `InventoryTransaction` with type `auto_deduct`). Success phase shows the deducted items + short transaction id. Empty-định-mức case shows the empty state C with inline supply picker so KTV can add items manually or confirm zero-vật-tư.
- **`seed-consumables-mock.js`** at [linkrad-app/server/scripts/seed-consumables-mock.js](linkrad-app/server/scripts/seed-consumables-mock.js) — idempotent (all upserts). Writes 15 Supply docs + 30 InventoryLot docs (2 lots per supply, older + newer for FIFO coverage) + 51 SupplyServiceMapping rows covering all 12 seeded services (SA020/026/028, XQ001/002, CT001/002/003/004, MR001/002, XN001). All `_id`s prefixed `SEED-MOCK-*` so they're identifiable. Run with `--dry` to preview. Pattern: load dotenv before `require('../db')` (db.js doesn't load dotenv itself; match the same pattern in existing `seed-*.js` scripts).
- **Typed signature** on reports — the existing `POST /reports/:reportId/sign` endpoint already worked without an image (stamps `displayName + finalizedAt` regardless), but the UI and print template scolded "(không có ảnh chữ ký)". Now: signed-without-image renders the name in large italic serif (Times) in both the live view and the A4 print output — looks like a real typed signature block. Image upload still available via the hover "📤 Ảnh" button on each sign block for doctors who want a scanned image.
- **Focus-loss bug** in the report editor (Ca đọc) — the `TextField` sub-component was defined *inside* `PatientDetailView`'s render function, so every `form` state change created a new function reference → React unmounted/remounted the textarea → focus lost after each keystroke. Fixed by hoisting `ReportField` out of the component scope and using a stable `onField(name)` curry for onChange handlers.

**Deferred:**

- **BHYT / partial-payment on auto-deduct invoicing** still noted in the earlier Registration section — unchanged.
- **Dedicated "Danh sách kết quả đã đọc" list page** — right now finished reports are only surfaced via status filters on RIS/Teleradiology worklists or the per-patient `HistoryRail`. `/rad-reports` is analytics, not a report browser. Add if users ask for it.
- **Per-KTV signature on Kết thúc chụp modal** — the modal currently just records vật tư; it doesn't stamp a KTV signature on the Study. If needed for audit, add `study.technicianName`/`technicianSignedAt` fields and wire from the modal's confirm action.
- **"In phiếu xuất kho"** button in success phase — the wireframe showed a print affordance for the deduction slip; not implemented (no print template for that slip exists yet).
- **Wireframe HTML artifacts** at repo root: `LinkRad Hoan Tat Ca Chup Modal _standalone_.html` joined the earlier `LinkRad Registration Wireframes _standalone_.html`. Neither committed. `scripts/decode-hoan-tat-modal.mjs` + `scripts/hoan-tat-modal-out/` also local-only.
- **Ca chụp full restyle (Pass B)** — still unfinished; Đăng ký/Billing/Ca đọc are on the new design system, Ca chụp's WorklistView + top bar still aren't. Next session pickup point if asked.

## Ca đọc reading-workspace improvements — Pass 1 (2026-04-22)

**Shipped (viewer-independent reading-side UX):**

- **Section tabs** at the top of the report editor (Kỹ thuật / Lâm sàng / Findings / Impression / Đề nghị) with live completion indicators: ✓ when filled, ● rose for required-but-empty (Findings, Impression), ○ for optional-empty. Click a tab → smooth scroll + focus that section's textarea. Completion counter in the header ("3 / 5 mục đã nhập").
- **Templates panel** (collapsible, just above the fields): pulls from existing `/templates` endpoint filtered by modality+bodyPart. Shows each template's text for the *currently-focused section* only (snippet-in-context), with a search input and a "Chèn vào: [active section]" label. Click inserts at the cursor position of the focused textarea (no overwrite), then restores cursor after paint. Templates with no content for the active section are dimmed/disabled.
- **Critical-finding treatment** lifted from buried checkbox to explicit three-step UX: (1) rose banner at the top of the page when the flag is set, (2) rose ring on all report fields while flagged, (3) primary CTA changes color + copy to "⚠ Lưu, gửi cảnh báo & ca tiếp →", (4) clicking it opens a confirmation modal previewing recipients and the auto-generated SMS/push message before firing the save. The existing backend auto-Notification path fires unchanged (POST /reports with `criticalFinding: true` → creates Notification for admin/giamdoc/truongphong of that site).
- **Save & Next flow** at [Teleradiology.jsx:handleSaveAndNext](linkrad-app/client/src/pages/Teleradiology.jsx): on finalise, reloads studies, picks next unclaimed `pending_read`, `POST /ris/studies/:id/pick` to claim, opens it as a new tab, closes the finished one. Empty queue → falls back to the worklist. Keyboard shortcut `Ctrl/Cmd+Enter` fires when any report textarea is focused.
- **Pinned footer** with always-reachable actions: `Lưu tạm`, completion hint ("Thiếu Findings · Thiếu Impression"), Ctrl+Enter kbd affordance, then the primary save button. No more scrolling to find buttons.
- **Queue rail** (288→320px on the left when a case is tabbed open) shows all `pending_read`+`reading` studies FIFO-sorted. Current case highlighted; "Ca kế tiếp" button at the top of the rail opens + claims the next unclaimed case without closing the current tab.
- **Layout proportion fix** on the worklist: study list fixed at 520px, detail preview gets the rest (was reversed — list was stretching with empty whitespace, preview was cramped at 384px).
- **Visual consistency**: QueueRail now uses the same card vocabulary as the worklist list (and Đăng ký's `TodayRail`): white `rounded-lg border` cards with avatar + modality chip + status pill. No more mixed "flat rows" vs "cards" look.
- **Focus bug fix** (earlier this session): the inline `TextField` was redefined on every render → React remounted each textarea → focus lost per keystroke. Hoisted `ReportField` out of component scope + added `forwardRef` for cursor-position template insertion.

**Deferred — Pass 2 (next session):**

- **~~Inline DICOM viewer~~** — shipped in Pass 2, see below.
- **"Danh sách kết quả đã đọc" list page** — still only reachable via status filters on RIS/Teleradiology or `HistoryRail` per patient. `/rad-reports` is analytics, not a report browser. Add if requested.
- **Template categories / tags** — `ReportTemplate` model has no `tag` field. The wireframes showed category chips ("Bình thường", "Thoái hóa", "Thoát vị", etc.). Would need a schema addition to group templates. Not implemented; templates are shown as a flat search-filtered grid.
- **Lot-number display per consumable row** on the Kết thúc chụp modal — the wireframe hinted at `OMN-2611 · HSD 03/2027` per row, but FIFO lot is only determined at deduction time. A pre-display would require either (a) a "peek FIFO" endpoint or (b) separate UI showing which lots *will* be used. Not shipped.
- **Wireframe HTML files** at repo root now include `LinkRad Ca Doc Reading Workspace.standalone.html` alongside the earlier two. None committed. `scripts/decode-ca-doc.mjs` + `scripts/ca-doc-out/` local-only.

## Ca đọc soft-lock / claim enforcement (2026-04-22, same-day)

**Shipped:**

- **Action toolbar trimmed** from 8 buttons to 2: `👁 Xem ảnh` (primary) + `🖨️ In kết quả`. Removed `Xem ảnh V1` (dead — backend ignored the v1 flag), `Tải Video` + `Tải tệp đính kèm` (not implemented), `In nhanh` (folded into In kết quả — user hits browser print themselves), `In Tra cứu Portal` (niche for bacsi workflow). `Nhận ca` moved out of the toolbar entirely.
- **ClaimBanner** — new three-state banner that sits between the patient summary card and the report editor. One of: blue "Ca này chưa có BS đọc" with a prominent 🛎️ Nhận ca button (unclaimed), green "Bạn đang đọc ca này" with Trả lại ca link (claimed by me), amber "Ca đang được đọc bởi BS X" with an admin-only "Lấy quyền" button (claimed by other). Directly reflects `study.radiologist` vs `auth.username`.
- **Editing lock** — when the study isn't claimed-by-me (and user isn't admin/giamdoc), all five ReportField textareas become `readOnly` + visually dimmed, the critical-finding checkbox is disabled, the templates panel is hidden entirely, and both `Lưu tạm` and the primary save button are disabled. The footer label tells you why ("Đang khoá bởi BS …" / "Bấm Nhận ca để có thể lưu").
- **Trả lại ca** — new `DELETE /ris/studies/:id/pick` endpoint. Only the current claimer or admin can release. Refuses if a final report already exists (`report.status === 'final'`). Clears `radiologist/radiologistName/assignedAt` and flips `status: reading → pending_read`. Frontend has a confirm dialog + busy state via the existing `claiming` flag.
- **Admin override** (`Lấy quyền (admin)` button) uses the existing `POST /ris/studies/:id/assign` (admin-only) rather than `/pick` (which would race-reject on `status != pending_read`). Stamps the admin as the new radiologist.
- **Backend write-guard** on `POST /ris/reports`: non-admin/non-truongphong must own the claim (`study.radiologist === req.user.username`), else 409 with the blocking reason. Prevents the "doctor B clobbers doctor A's report" scenario even if doctor B bypasses the UI lock (e.g. opens a tab while their session state is stale). Admin + truongphong keep the ability to save for supervisor corrections.
- **Race-safety on `/pick`** was already in place (atomic `findOneAndUpdate({ status: 'pending_read', radiologist: {$in: [null, '']} })`) — verified and not changed.

**Deferred / known gaps:**

- **No auto-release on idle/tab-close** — if a bacsi claims a case then walks away or closes their laptop, the case stays locked until they come back or an admin reassigns. Acceptable for a small team; for scale, add a heartbeat + server-side TTL (e.g. release after 20 min idle) or a `beforeunload` release beacon.
- **Queue rail doesn't live-refresh** when another bacsi claims in a different session — the rail shows a polled snapshot. Manual ⟳ fixes it, but a 15-30s polling interval or websocket push would be cleaner.
- **Truongphong can bypass the lock server-side** (deliberate for supervisor corrections) but there's no UI for them to do it explicitly — they'd need to use the Lấy quyền flow (admin) or `POST /assign` directly. Fine for now.
- **No "claim expired" notification** — if an admin uses Lấy quyền on your case while you were writing, you'll next see the 409 when you try to save. Not ideal UX; a soft "your claim was overridden" toast would help but requires polling the study state.

## Ca đọc reading-workspace — Pass 2: inline DICOM viewer (2026-04-22)

**Shipped:**

- **InlineViewer** at [components/InlineViewer.jsx](linkrad-app/client/src/components/InlineViewer.jsx) — persistent OHIF iframe side-by-side with the report editor. src swaps on case change without unmounting so OHIF's JS context (and HTTP-cached bundle) stays warm — one OHIF cold-start per reading session, not per case switch.
- **Dock / undock** (`⇗ Cửa sổ riêng`) pops the viewer into a named popup (`linkrad-viewer`). Popup-reuse: if popup is still alive AND showing the same study, we just `focus()` it — no reload. Inline iframe stays mounted while undocked (CSS `display:none`) and keeps tracking the active study, so re-dock is instant and already on the right case. Pref in `localStorage.linkrad.reader.viewerDocked`.
- **Undock banner** above the report with `⇦ Kéo viewer về` button.
- **Draggable divider** between viewer and report. Width 360–900px (default 576), persisted in `localStorage.linkrad.reader.reportWidth`. ±6px hit area via `before:` pseudo. Transparent full-viewport overlay during drag to keep cursor + stop iframe from stealing pointer events.
- **Expand preset** (`⇔ Mở rộng ảnh`) — report shrinks to 380px, the whole reading trio becomes `position: fixed inset-0 z-50`, covering the Layout sidebar + top header + Ca đọc tab bar. `↔ Thu gọn` restores last non-narrow width. Wrapper div is always present so className flip preserves iframe mount — no cold-start on expand toggle.
- **QueueRail + HistoryRail hidden during reading** (per Claude Design States 1–3). `PatientDetailView` has new `showHistoryRail` prop (default true for backward compat); Teleradiology passes `false`. `QueueRail` function body left in place, unused, in case we re-enable it as a collapsible.
- **Save & Next removed.** Primary button changed `Lưu & Hoàn tất & ca tiếp →` → `Lưu & Hoàn tất` (critical: `⚠ Lưu & gửi cảnh báo`). Current tab stays open after finalize; no auto-pick-next, no auto-close. `handleSaveAndNext` in Teleradiology deleted; `onSaveAndNext` prop on PatientDetailView removed. Internal rename `saveAndNext` → `saveAndFinalize`. Ctrl+Enter still finalizes.

**Deferred — Pass 3:**

- **Popup case-switch without cold-start** — switching cases while undocked still forces a popup reload on the next undock. Needs OHIF to accept a `postMessage({ studyUID })` and route internally — that's a patch to the OHIF Docker image, not a LinkRad-side change.
- **Prior-comparison dual-viewer (Claude Design State 5)** — side-by-side current vs older exam using existing `/ris/compare-url`. HistoryRail needs to come back, probably as a collapsible strip inside the report column.
- **Tablet layout (State 7)** — viewer top 55% / report bottom 45%, compact top bar. Current layout assumes desktop; below ~900px the draggable divider gets cramped.
- **postMessage W/L / slice sync** across docked + popup (Claude Design State 6 "Đồng bộ W/L / slice / annotation").
- **z-index audit** — expand overlay uses `z-50`; haven't verified it doesn't collide with NotificationBell dropdown, Cmd+K palette, or any toast layer.
- **`.env` still points Orthanc + OHIF at prod Railway.** Local docker-compose at [linkrad-app/pacs/](linkrad-app/pacs/) runs fine but is unused by the app. Wire `ORTHANC_URL=http://localhost:8042` + `OHIF_URL=http://localhost:3000` if local-only dev is ever needed.

## Kho / Inventory — warehouse-scoped rewrite (2026-04-23)

**Shipped (Pass 1):**

- **Data model reshaped around Warehouse.** `InventoryLot.warehouseId` and `InventoryTransaction.warehouseId` are now the authoritative location fields; `site` remains as a legacy echo. `Supply.site` was dropped; `Supply.currentStock` kept as a deprecated cache (writes still happen for back-compat; reads should prefer live aggregation). Schema at [Warehouse.js](linkrad-app/server/models/Warehouse.js), [InventoryLot.js](linkrad-app/server/models/InventoryLot.js), [InventoryTransaction.js](linkrad-app/server/models/InventoryTransaction.js), [StocktakeSession.js](linkrad-app/server/models/StocktakeSession.js).
- **Kho tổng = regular warehouse with `site: null`** (no type flag) — multiple allowed for regional grouping later; optional `region` field on Warehouse is future-facing but already in schema.
- **Scope resolver** at [lib/warehouseScope.js](linkrad-app/server/lib/warehouseScope.js). Every `GET` in inventory routes now goes through `withWarehouseScope()`: admin/giamdoc/truongphong with no `?warehouseId=` get `mode:'all'` across their accessible set; nv_kho / non-supervisor resolves to their single warehouse; any other case returns 400 asking to pick one. `?warehouseId=X` is validated against entitlement; foreign warehouse → 403.
- **Migration script** at [scripts/migrate-warehouse-model.js](linkrad-app/server/scripts/migrate-warehouse-model.js). Dry-run confirms: creates 12 branch warehouses (one per active branch Department) + 1 Kho Tổng, backfills warehouseId from legacy `site` on existing lots/txs. Idempotent; safe to re-run. **Not yet run against prod** — needs go-ahead.
- **Auto-deduct** now resolves warehouse via `Warehouse.findOne({ site: study.site })` and is **soft-fail**: on insufficient stock it deducts what's available, tags the tx with `reasonCode:'variance'` + per-item notes describing the shortfall, and does NOT block the study's `pending_read` transition. The "Sai khác định mức" landing tile surfaces these. See [ris.js:82](linkrad-app/server/routes/ris.js:82).
- **New endpoints** in [routes/inventory.js](linkrad-app/server/routes/inventory.js): `GET /warehouses/accessible` (list + supervisor flag), `GET /stock` (live aggregation, supply rows), `GET /stock/matrix` (supervisor cross-warehouse), `GET /alerts` + `GET /activity-today` (landing dashboard), `POST /transfers` (creates linked transfer_out + transfer_in pair with shared `transferId`), `POST/GET/PUT /stocktakes*` (session lifecycle: open → submitted → approved → applied; approval auto-spawns & confirms adjustment tx per variance line).
- **FIFO deduction** centralised in `fifoDeduct({warehouseId, supplyId, quantity})` — sorted by `expiryDate asc, createdAt asc`. Used by `confirm` on export/auto_deduct/transfer_out/adjustment-negative.
- **Transaction types expanded** to `import / export / adjustment / auto_deduct / transfer_out / transfer_in`. Transfer pair carries `transferId` + `counterpartyWarehouseId` on each leg; both start `status:'draft'`, confirm independently (Pass 1 has no in-transit state).
- **Frontend IA** at [Inventory.jsx](linkrad-app/client/src/pages/Inventory.jsx). 4 tabs for nv_kho (**Tổng quan · Tồn kho · Giao dịch · Kiểm kê**) + **Tổng hợp chuỗi** for supervisor/admin. Previously had a fifth "Danh mục" tab — moved to top-level /catalogs on 2026-04-23 (see bullet below). Header uses the shared PageHeader pattern (title + breadcrumb + date/user pills + supervisor's warehouse switcher on the right), matching Đăng ký/Billing/Ca đọc.
- **Pattern reuse**: reason-code picker (`REASON_PRESETS`) used in manual xuất, adjustment, and stocktake variance; FEFO lot drawer opens from Tồn kho rows; confirmation drawer for txs with per-line variance notes visible.
- **Seed script** ([seed-consumables-mock.js](linkrad-app/server/scripts/seed-consumables-mock.js)) now writes `warehouseId: 'WH-HN'` + `site: 'DEPT-HN'` on seeded lots and drops the obsolete `site: ''` on Supply. Re-run after migration to attach the 30 existing SEED-MOCK lots.

**Addendum 2026-04-23 (polish pass):**

- **Inventory catalogs relocated** to top-level Danh mục. Vật tư / Nhóm vật tư / Nhà cung cấp / Định mức dịch vụ are now edited at `/catalogs/supplies`, `/catalogs/supply-categories`, `/catalogs/suppliers`, `/catalogs/supply-service-mapping` under a new "Kho" subgroup in [Layout.jsx](linkrad-app/client/src/components/Layout.jsx). Server routes registered in [routes/catalogs.js](linkrad-app/server/routes/catalogs.js) gated by `inventory.manage`. The legacy `/api/inventory/{supplies,categories,suppliers,his-mapping}` endpoints still exist for the Kho workspace's internal reads (e.g. Stock filter's category dropdown) — both read paths hit the same collections.
- **Định mức dịch vụ serviceName hydration** — `GET /catalogs/supply-service-mapping` joins Service by `serviceId` or `serviceCode` and backfills empty `serviceName` on the response. Fixes the blank "Dịch vụ" column that came from seed docs written with `serviceName: ''`. No migration needed.
- **PageHeader rollout** — Inventory header now matches the Billing/Đăng ký/Ca đọc strip. The supervisor warehouse switcher moved into the header's right cluster alongside the user/date pills.

**Deferred — Pass 2:**

- **Transfer lifecycle (in-transit / receive with variance)** — currently both legs go to `draft` and are confirmed independently. Needs: `status: 'in_transit'` on the dest leg after source confirms, a "Nhận hàng" flow where destination acknowledges actual qty (may differ from sent qty) with an auto-spawned adjustment for the delta, and the "Cần nhận đến" landing tile wired to click-through. Sketch in section 6 of warehouse-design-sketches.html mentions this state diagram.
- **Auto-deduct variance confirmation screen** — the tile shows a count; there's no dedicated "review this variance" drawer yet. Claude Design called this out as the next screen worth drawing (clinical/operational/catalog mental models colliding). Currently nv_kho has to open the transaction in Giao dịch.
- **Supervisor "Đề xuất điều chuyển" inline CTA** in the matrix — when a row has surplus@A vs deficit@B, the sketch proposes an inline blue CTA to pre-fill a transfer. Not wired; needs a heuristic (`surplus ≥ min * 2` AND `deficit < min`) + a deep-link into the transfer modal.
- **Line-item inline validation in create forms** — nhập form in the sketch shows per-row HSD warning ("HSD chỉ còn 44 ngày — xác nhận nhập?") and xuất shows FEFO-override warning + insufficient-stock hard error. Current modal is a simpler grid without row-level validation slots.
- **Confirmation screen with before/after stock** — promised in section 7 "Shared patterns." Not built; confirm is a single click with a `window.confirm` blocker.
- **Tablet layout + offline queue for kiểm kê** — Claude Design section 5 calls these out. Current implementation is desktop-only and online-only; `dirty` state is in-memory and lost on refresh.
- **Print slip** per phiếu (Nhập/Xuất/Điều chuyển) — no print template yet.
- **Lot-number uniqueness index** — schema has `(supplyId, warehouseId)` + expiry index, but not a unique constraint on `(supplyId, warehouseId, lotNumber)`. Add once we're confident no legacy dupes exist.
- **`Supply.currentStock` deprecation removal** — field + all its writes are still in the code. Remove in a second-pass cleanup after a week of operation to ensure no consumer regressed to reading the cached value.
- **Expired-lot auto-flip** — lot.status is still manually set; nothing flips `available → expired` when `expiryDate < today`. Add a daily cron or on-read lazy flip.
- **Cài đặt (admin)** tab — not built. Warehouse CRUD lives at existing `/inventory/warehouses` endpoints; needs a UI to manage them without direct DB.
- **Permission-denied UX on foreign warehouse URL** — Claude Design spec says "literal message with button back to their kho, not silent redirect." Not implemented; current behavior is a generic error page.
- **Matrix partial-data column header** — sketch shows "cập nhật 2 giờ trước" when a warehouse is stale. We don't track per-warehouse freshness yet.
- **Deferred migration step**: drop the `Employee` collection once confirmed empty on prod Atlas. Separate follow-up from earlier; not warehouse-related but noted during this session's model review.

**Open decisions worth flagging before Pass 2 starts:**

- **Reorder-point per warehouse**: `Supply.minimumStock` is a global default applied at every warehouse in the matrix. If a clinic wants different thresholds per site (e.g. HN handles more CT, needs more contrast), we'd add a `SupplyWarehouseConfig { supplyId, warehouseId, minimumStock }` collection. Defer until someone asks.
- **Auto-release on transfer timeout**: if a transfer_out is issued but the dest never confirms receipt, stock is stuck. Decide a policy (auto-confirm after N days? auto-cancel? dashboard alert?).

## Next session queue (set 2026-04-22, updated 2026-04-23)

- **UIUX pass on Danh mục Pass A done 2026-04-23** — PageHeader strip, killed dark-navy `#1e3a5f` headers in UsersTable+PatientsTable, unified toolbar (search + status filter + count + ＋ Thêm), client-side pagination 50/page with Tải thêm, column sort, empty-state CTA, house-style buttons throughout.
- **Danh mục dead-catalog cleanup done 2026-04-23** — 3 catalogs confirmed zero workflow consumers and deleted: `RegistrationReason` (never picked in Registration), `BillingCancelReason` (Invoice.cancelReason is free-text; no picker — there's a separate `CancelReason` model used by Inventory which stayed), `AdminUnit` (Registration.jsx hardcodes `ADDR_SHORTCUTS`). Removed: 3 models, 3 `catalogCRUD` registrations in [routes/catalogs.js](linkrad-app/server/routes/catalogs.js), the `/admin-units/bulk` custom route, sidebar entries in [Layout.jsx](linkrad-app/client/src/components/Layout.jsx), MENU + CATALOG_FIELDS in [Catalogs.jsx](linkrad-app/client/src/pages/Catalogs.jsx), seed entries in `seed-catalogs-mock.js` + `seed-catalogs-extra.js` + `seed-catalogs-mock-remove.js`, and sanity-check CRUD probe. Prod collections untouched — if a future need surfaces, docs still exist in Atlas.
- **Danh mục Pass B — Claude Design sketches received 2026-04-23** at [linkrad-catalogs-design-sketches.html](linkrad-catalogs-design-sketches.html). 6 mockups + pattern notes: landing / catalog detail / CSV import 3-step / Điểm sử dụng drawer tab with verdict banner / bulk action bar / Nhân sự master-detail. Shared patterns: group pills + sub-catalog tabs + 3-tab drawer + verdict banner. Keyboard wiring planned: n/e/j/k/Esc/`/`.
- **Danh mục Pass B1 done 2026-04-23 (IA & chrome)** — client-side landing view at `/catalogs` with 4 group tiles (counts derived client-side from `/api/catalogs/summary`) + recent-edits feed (from audit log where resource in {catalogs, promotions}). Detail view now uses GroupPills + SubcatalogTabs in-page instead of flat sidebar. New `RowDrawer` component replaces `EditModal` — right-docked, 3 tabs: Thông tin (edit form), Lịch sử (audit log filtered by resourceId; requires `audit.view` perm — admin-only for now), Điểm sử dụng (B2 stub). Sidebar [Layout.jsx](linkrad-app/client/src/components/Layout.jsx) Danh mục group collapsed from 25 items across 5 subgroups to 2 entries (Danh mục landing + Mẫu kết quả). Server added `/api/catalogs/summary` (counts + recent edits) and extended `/api/audit-log` filter with `resourceId` + `path`.
- **Danh mục IA refinement + collision cleanup 2026-04-23 (post-B1)** — (1) idle group pills flattened (no border/bg), only the active pill is shaped, so the sub-catalog tabs below clearly "belong to" it; (2) sub-catalog tabs underline now uses the active group's color for further visual connection; (3) Marketing split into its own group (rose); (4) `medical-facilities` catalog **deleted** — only consumer was Reports.jsx which was mis-wired (filtering by external facilities instead of LinkRad branches). [Reports.jsx](linkrad-app/client/src/pages/Reports.jsx) now reads `/api/hr/departments?type=branch`. Model `MedicalFacility.js` + catalog CRUD + summary + 3 seed scripts cleaned up. (5) HR consolidated into Danh mục → Hồ sơ & Tham chiếu: `/hr/employees` → `hr-employees` sub-tab (renders `EmployeeSection`), `/hr/departments` → `hr-departments` (`DepartmentSection`), `/hr/permissions` → `hr-permissions` (`PermissionMatrix`). Sub-components exported from [HRManagement.jsx](linkrad-app/client/src/pages/HRManagement.jsx). Old `/hr/*` routes still work as a fallback. Sidebar "Quản lý" group trimmed to just `/audit-log`. (6) `UsersTable` (old master-detail in Catalogs) removed since EmployeeSection is canonical.
- **Danh mục sidebar tree 2026-04-23 (replaces in-page 2-row nav)** — Two-row nav (GroupPills + SubcatalogTabs) felt clunky for 18 rarely-touched catalogs. Replaced with Notion/Linear-style collapsible tree in the main sidebar: 5 group nodes that expand to show their catalogs; group expansion state persists in localStorage; group containing active catalog auto-expands on arrival. Counts fetched once via `/api/catalogs/summary` (cached briefly in localStorage to avoid flicker on page switches). `Mẫu kết quả` (ReportTemplates) folded into Dịch vụ & Chuyên khoa as a sub-catalog. Standalone `/report-templates` sidebar entry removed. `/catalogs` with no param redirects to `localStorage.linkrad_last_catalog` or the default (Nguồn khách hàng). `CatalogsLanding` + `GroupPills` + `SubcatalogTabs` + `RecentEditRow` components deleted. Shared config at [src/config/catalogGroups.js](linkrad-app/client/src/config/catalogGroups.js) — single source of truth for both the sidebar tree and `Catalogs.jsx` render switch.
- **Danh mục Pass B2–B5 still queued** — B2 Điểm sử dụng / verdict banner (needs per-catalog `/references` endpoints returning `{active, historical}` for services / referral-doctors / partner-facilities / commission-groups first, others later); B3 CSV import 3-step with dry-run; B4 bulk-action sticky bar; B5 Nhân sự master-detail polish + keyboard shortcuts (n/e/j/k/Esc/`/`).
- **Soft collisions noted** — Registration.jsx hardcodes `SERVICE_GROUPS` instead of reading `/catalogs/service-types`, and `ADDR_SHORTCUTS` instead of reading admin-units (now deleted anyway, but the deeper pattern of UI-hardcoded lists shadowing catalogs remains). If we ever want admins to edit these via Danh mục, wire Registration to the live catalog source.
- **UIUX pass on HR & phân quyền, Reports, Dashboard** — still to do. Match the bg-gray-50 page + white rounded-xl cards + pill tabs + blue-600 primary house style. Dashboard especially will likely need a Claude Design export.
- **UIUX pass on Patient Portal + Partner (Doctor Referral) Portal** — [PatientPortal.jsx](linkrad-app/client/src/pages/PatientPortal.jsx) (303 lines), [PartnerPortal.jsx](linkrad-app/client/src/pages/PartnerPortal.jsx) (323 lines), plus matching login screens. Currently pre-restyle. External-user-facing so the visual polish bar is higher than internal tools — probably wants a Claude Design pass. User flagged 2026-04-23, will touch later.
- **Danh mục ↔ workflow wiring audit** — walk every Danh mục list page and verify there's a live back-link to where those items are consumed (Services → registration picker, Referral doctors → referral picker, etc.). Flag any orphan catalogs for cleanup.
- **`/` route still points at the old Dashboard** — `App.jsx` root redirect predates phase-1. Check what it should route to per role (`/dashboard/clinical` vs `/dashboard/ops` vs `/dashboard/finance`) and fix.
