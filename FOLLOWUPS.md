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
