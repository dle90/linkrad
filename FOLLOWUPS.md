# Follow-ups

Known limits and deferred work. Organise by area.

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
