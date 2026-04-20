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
 * Default permission sets for each role (used in seed)
 */
const DEFAULT_ROLE_PERMISSIONS = {
  admin: Object.keys(PERMISSIONS),
  giamdoc: [
    'ris.view', 'ris.manage', 'registration.view', 'registration.manage',
    'teleradiology.view', 'teleradiology.manage', 'tasks.view', 'tasks.manage',
    'billing.view', 'billing.manage', 'billing.refund',
    'inventory.view', 'inventory.manage',
    'financials.view', 'financials.manage',
    'crm.view', 'marketing.view',
    'catalogs.view', 'catalogs.manage',
    'hr.view',
  ],
  truongphong: [
    'ris.view', 'ris.manage', 'registration.view', 'registration.manage',
    'teleradiology.view', 'tasks.view', 'tasks.manage',
    'billing.view', 'billing.manage',
    'inventory.view', 'inventory.manage',
    'catalogs.view',
    'hr.view',
  ],
  nhanvien: [
    'ris.view', 'registration.view', 'registration.manage',
    'tasks.view',
    'billing.view',
    'inventory.view',
    'catalogs.view',
  ],
  bacsi: [
    'ris.view', 'ris.manage',
    'teleradiology.view',
    'tasks.view',
  ],
  guest: [],
}

module.exports = { PERMISSIONS, PERMISSION_GROUPS, DEFAULT_ROLE_PERMISSIONS }
