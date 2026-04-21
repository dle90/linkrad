/**
 * Canonical permission definitions for RBAC
 * Keys are used in RolePermission.permissions[] arrays
 * Values are Vietnamese labels for the UI
 */
const PERMISSIONS = {
  // RIS / Workflow
  'ris.view': 'Xem ca chụp (RIS)',
  'ris.manage': 'Quản lý ca chụp',
  'registration.view': 'Xem đăng ký',
  'registration.manage': 'Quản lý đăng ký',
  'teleradiology.view': 'Xem đọc phim',
  'teleradiology.manage': 'Quản lý đọc phim',
  'tasks.view': 'Xem công việc',
  'tasks.manage': 'Quản lý công việc',
  // Billing
  'billing.view': 'Xem viện phí',
  'billing.manage': 'Quản lý viện phí',
  'billing.refund': 'Hoàn tiền',
  // Inventory
  'inventory.view': 'Xem kho',
  'inventory.manage': 'Quản lý kho',
  // Financials
  'financials.view': 'Xem tài chính',
  'financials.manage': 'Nhập số liệu tài chính',
  // CRM / Marketing
  'crm.view': 'Xem CRM',
  'marketing.view': 'Xem marketing',
  // Catalogs
  'catalogs.view': 'Xem danh mục',
  'catalogs.manage': 'Quản lý danh mục',
  // HR
  'hr.view': 'Xem nhân sự',
  'hr.manage': 'Quản lý nhân sự',
  // System
  'system.admin': 'Quản trị hệ thống',
}

/**
 * Group permissions for the UI matrix display
 */
const PERMISSION_GROUPS = [
  { key: 'workflow', label: 'Hoạt động', perms: ['ris.view', 'ris.manage', 'registration.view', 'registration.manage', 'teleradiology.view', 'teleradiology.manage', 'tasks.view', 'tasks.manage'] },
  { key: 'billing', label: 'Viện phí', perms: ['billing.view', 'billing.manage', 'billing.refund'] },
  { key: 'inventory', label: 'Kho', perms: ['inventory.view', 'inventory.manage'] },
  { key: 'financials', label: 'Tài chính', perms: ['financials.view', 'financials.manage'] },
  { key: 'crm', label: 'CRM & Marketing', perms: ['crm.view', 'marketing.view'] },
  { key: 'catalogs', label: 'Danh mục', perms: ['catalogs.view', 'catalogs.manage'] },
  { key: 'hr', label: 'Nhân sự', perms: ['hr.view', 'hr.manage'] },
  { key: 'system', label: 'Hệ thống', perms: ['system.admin'] },
]

/**
 * Role catalog — 9 named roles + 2 legacy ones kept for backwards compat.
 * Each role has: label (Vietnamese), scope (group|site), default permissions, isSystem (seeded).
 */
const ROLE_CATALOG = {
  // ── Group-scope roles (org-wide) ────────────────────────────────────────
  admin: {
    label: 'Admin',
    scope: 'group',
    description: 'Toàn quyền hệ thống',
    permissions: Object.keys(PERMISSIONS),
  },
  giamdoc: {
    label: 'Giám đốc',
    scope: 'group',
    description: 'Giám đốc cấp tập đoàn — xem mọi chi nhánh',
    permissions: [
      'ris.view', 'ris.manage', 'registration.view', 'registration.manage',
      'teleradiology.view', 'teleradiology.manage', 'tasks.view', 'tasks.manage',
      'billing.view', 'billing.manage', 'billing.refund',
      'inventory.view', 'inventory.manage',
      'financials.view', 'financials.manage',
      'crm.view', 'marketing.view',
      'catalogs.view', 'catalogs.manage',
      'hr.view',
    ],
  },
  ketoan: {
    label: 'Kế toán',
    scope: 'group',
    description: 'Kế toán — chỉ xem/nhập tài chính',
    permissions: ['financials.view', 'financials.manage', 'billing.view', 'catalogs.view'],
  },
  hr: {
    label: 'HR',
    scope: 'group',
    description: 'Quản lý nhân sự cấp tập đoàn',
    permissions: ['hr.view', 'hr.manage', 'catalogs.view'],
  },
  bacsi: {
    label: 'Bác sĩ',
    scope: 'group',
    description: 'Bác sĩ chẩn đoán hình ảnh — đọc phim ở mọi chi nhánh',
    permissions: ['ris.view', 'teleradiology.view', 'teleradiology.manage', 'tasks.view'],
  },

  // ── Site-scope roles (per-branch) ───────────────────────────────────────
  gd_chinhanh: {
    label: 'Giám đốc chi nhánh',
    scope: 'site',
    description: 'Phụ trách toàn bộ hoạt động một chi nhánh',
    permissions: [
      'ris.view', 'ris.manage', 'registration.view', 'registration.manage',
      'teleradiology.view', 'tasks.view', 'tasks.manage',
      'billing.view', 'billing.manage',
      'inventory.view', 'inventory.manage',
      'catalogs.view', 'hr.view',
    ],
  },
  letan: {
    label: 'Lễ tân',
    scope: 'site',
    description: 'Tiếp đón, đăng ký bệnh nhân, lập phiếu thu',
    permissions: ['registration.view', 'registration.manage', 'billing.view', 'billing.manage', 'catalogs.view'],
  },
  ktv: {
    label: 'Kỹ thuật viên',
    scope: 'site',
    description: 'Vận hành máy chụp, ghi nhận vật tư tiêu hao',
    permissions: ['ris.view', 'ris.manage', 'registration.view', 'tasks.view', 'inventory.view'],
  },
  nv_kho: {
    label: 'Nhân viên kho',
    scope: 'site',
    description: 'Quản lý kho vật tư, hóa chất, thiết bị',
    permissions: ['inventory.view', 'inventory.manage', 'catalogs.view'],
  },

  // ── Legacy roles (kept so existing User.role values keep working) ──────
  truongphong: {
    label: 'Trưởng phòng (legacy)',
    scope: 'site',
    description: 'Vai trò cũ — ánh xạ tương đương giám đốc chi nhánh',
    permissions: [
      'ris.view', 'ris.manage', 'registration.view', 'registration.manage',
      'teleradiology.view', 'tasks.view', 'tasks.manage',
      'billing.view', 'billing.manage',
      'inventory.view', 'inventory.manage',
      'catalogs.view', 'hr.view',
    ],
  },
  nhanvien: {
    label: 'Nhân viên (legacy)',
    scope: 'site',
    description: 'Vai trò cũ — dùng cho tài khoản chưa được gán vai trò chức năng',
    permissions: ['ris.view', 'registration.view', 'registration.manage', 'tasks.view', 'billing.view', 'inventory.view', 'catalogs.view'],
  },
  guest: {
    label: 'Guest',
    scope: 'group',
    description: 'Chỉ xem',
    permissions: [],
  },
}

// Backwards-compat alias used by older code paths
const DEFAULT_ROLE_PERMISSIONS = Object.fromEntries(
  Object.entries(ROLE_CATALOG).map(([k, v]) => [k, v.permissions])
)

module.exports = { PERMISSIONS, PERMISSION_GROUPS, ROLE_CATALOG, DEFAULT_ROLE_PERMISSIONS }
