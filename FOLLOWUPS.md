# Follow-ups

Known limits and deferred work. Organise by area.

## Vật tư tiêu hao / Auto-deduct (commit a08b021)

- **No "add extra supply" row in ConsumablesPanel.** KTV can only edit quantity/notes on supplies that are in `SupplyServiceMapping`. If a scan actually uses a supply not in định mức, KTV has no way to record it — admin must create a manual export transaction in the Inventory page.
- **No reversal on status rollback.** If admin reverts a study `pending_read` → `in_progress` (or deletes), the confirmed `auto_deduct` InventoryTransaction stays and stock stays decremented. Need an "un-deduct" path before we support status-rollback flows.
- **No variance report.** We record `standardQty` and `actualQty` on each Study but don't aggregate across studies. Build a report at `/rad-reports/consumables-variance` keyed by service/KTV/period.

## Referral source / NVKD (Phase 1 shipped — Phase 2 pending)

**Phase 2 — revenue attribution & KPI (not yet built):**
- Snapshot `sourceCode`/`referralType`/`referralId` onto Invoice at issuance (so revenue stays attributable even if patient/appointment referral fields are later edited).
- When referral is `doctor` or `facility`, resolve effective NVKD via `assignedStaff` on that partner, and snapshot that too.
- Revenue-per-NVKD and revenue-per-referral-partner reports (add under `/reports/`).
- Commission calc hook — extend `CommissionRule` to support NVKD as an earning party, not just partner facilities.

**Design decisions that are easy to revisit:**
- NVKD is represented as `User.role === 'sale'` (this role value already existed as a stub). If we later want NVKD to be a non-login entity, switch to an `isSalesperson` flag on Employee or a dedicated `Salesperson` model.
- Old Appointment.`referringDoctor` free-text field is left in place; new data lives in `referralId`/`referralName`. Write a migration only if/when we decide to retire the old field.
- Existing patients/appointments pre-dating this change have empty source/referral fields. No backfill — they show as "Chưa rõ" in future reports.
