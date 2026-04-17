import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logoutUser } from '../api'

const NAV = [
  {
    group: 'Tổng quan',
    items: [
      { path: '/',      label: 'Dashboard',      icon: '📊' },
      { path: '/sites', label: 'Danh sách Site', icon: '📍' },
    ]
  },
  {
    group: 'Hoạt động',
    items: [
      { path: '/workflow', label: 'Công việc', icon: '✅', workflowOnly: true },
      { path: '/registration', label: 'Đăng ký', icon: '🏥', workflowOnly: true },
      { path: '/ris',      label: 'RIS',        icon: '🩻', workflowOnly: true },
      { path: '/teleradiology', label: 'Đọc phim', icon: '🖥️', workflowOnly: true },
      { path: '/telerad-admin', label: 'Quản lý đọc hộ', icon: '📋', adminOnly: true },
      { path: '/telerad-reading', label: 'Đọc phim --', icon: '🔬', workflowOnly: true },
    ]
  },
  {
    group: 'Viện phí',
    items: [
      { path: '/billing', label: 'Phiếu thu', icon: '💳', workflowOnly: true },
    ]
  },
  {
    group: 'Kho',
    items: [
      { path: '/inventory', label: 'Quản lý kho', icon: '📦', workflowOnly: true },
    ]
  },
  {
    group: 'DM Đối tác',
    items: [
      { path: '/catalogs/referral-doctors', label: 'Bác sĩ giới thiệu', icon: '👨‍⚕️', workflowOnly: true },
      { path: '/catalogs/partner-facilities', label: 'CSYT đối tác', icon: '🏥', workflowOnly: true },
      { path: '/catalogs/commission-groups', label: 'Nhóm hoa hồng', icon: '📋', workflowOnly: true },
      { path: '/catalogs/commission-rules', label: 'Hoa hồng', icon: '💰', workflowOnly: true },
    ]
  },
  {
    group: 'DM Chung',
    items: [
      { path: '/catalogs/users', label: 'Nhân sự', icon: '👤', workflowOnly: true },
      { path: '/catalogs/patients', label: 'Bệnh nhân', icon: '🧑', workflowOnly: true },
      { path: '/catalogs/specialties', label: 'Chuyên khoa', icon: '🩺', workflowOnly: true },
      { path: '/catalogs/services', label: 'Dịch vụ', icon: '📄', workflowOnly: true },
      { path: '/catalogs/service-types', label: 'Loại dịch vụ', icon: '📂', workflowOnly: true },
      { path: '/catalogs/medical-facilities', label: 'Cơ sở y tế', icon: '🏨', workflowOnly: true },
      { path: '/catalogs/tax-groups', label: 'Nhóm thuế DV', icon: '📊', workflowOnly: true },
      { path: '/catalogs/promotions', label: 'CT khuyến mãi', icon: '🎁', workflowOnly: true },
      { path: '/catalogs/promo-codes', label: 'Mã khuyến mãi', icon: '🏷️', workflowOnly: true },
      { path: '/catalogs/registration-reasons', label: 'Lý do ĐK', icon: '📝', workflowOnly: true },
      { path: '/catalogs/billing-cancel-reasons', label: 'Lý do huỷ PT', icon: '❌', workflowOnly: true },
      { path: '/catalogs/admin-units', label: 'Địa chỉ hành chính', icon: '📍', workflowOnly: true },
    ]
  },
  {
    group: 'Báo cáo',
    items: [
      { path: '/reports/revenue-detail', label: 'BC doanh thu chi tiết', icon: '📊', workflowOnly: true },
      { path: '/reports/customer-detail', label: 'BC chi tiết khách hàng', icon: '👥', workflowOnly: true },
      { path: '/reports/promotion-detail', label: 'BC chương trình KM', icon: '🎁', workflowOnly: true },
      { path: '/reports/clinic-revenue', label: 'BC doanh thu phòng khám', icon: '🏥', workflowOnly: true },
      { path: '/reports/refund-exchange', label: 'BC hoàn trả/đổi DV', icon: '🔄', workflowOnly: true },
      { path: '/reports/e-invoice', label: 'BC hóa đơn điện tử', icon: '🧾', workflowOnly: true },
    ]
  },
  {
    group: 'Quản lý',
    items: [
      { path: '/hr/employees', label: 'DS nhân viên', icon: '👤', adminOnly: true },
      { path: '/hr/departments', label: 'Phòng ban / CN', icon: '🏢', adminOnly: true },
      { path: '/hr/permissions', label: 'Ma trận quyền', icon: '🔐', adminOnly: true },
    ]
  },
  {
    group: 'Tài chính',
    financialsOnly: true,
    items: [
      { path: '/actuals',   label: 'Nhập số liệu',          icon: '✏️', adminOnly: true },
      { path: '/pl',        label: 'Kết quả kinh doanh',    icon: '📋' },
      { path: '/cf',        label: 'Dòng tiền',             icon: '💰' },
      { path: '/bs',        label: 'Bảng cân đối kế toán',  icon: '⚖️' },
      { path: '/breakeven', label: 'Điểm hòa vốn',          icon: '📈' }
    ]
  },
  {
    group: 'CRM',
    items: [
      { path: '/crm',        label: 'Phân tích KH',  icon: '👥' },
      { path: '/kpi-sales',  label: 'KPI Sales',     icon: '🎯' },
      { path: '/marketing',  label: 'Marketing',     icon: '📣' }
    ]
  },
]

const ROLE_LABELS = {
  admin:       { label: 'Admin',        cls: 'bg-yellow-800 text-yellow-200' },
  guest:       { label: 'Guest',        cls: 'bg-blue-800 text-blue-300' },
  nhanvien:    { label: 'Nhân viên',    cls: 'bg-blue-800 text-blue-200' },
  truongphong: { label: 'Trưởng phòng', cls: 'bg-indigo-800 text-indigo-200' },
  giamdoc:     { label: 'Giám đốc',     cls: 'bg-purple-800 text-purple-200' },
  bacsi:       { label: 'Bác sĩ',       cls: 'bg-teal-800 text-teal-200' },
}

export default function Layout({ children }) {
  const { auth, logout } = useAuth()
  const isAdmin = auth?.role === 'admin'
  const isFinancialsUser = auth?.role === 'admin' || auth?.role === 'giamdoc'
  const isWorkflowUser = auth?.role && auth.role !== 'guest'
  const [sidebarOpen, setSidebarOpen] = React.useState(true)

  const handleLogout = async () => {
    try { await logoutUser() } catch {}
    logout()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-0'} flex-shrink-0 flex flex-col overflow-y-auto overflow-x-hidden transition-all duration-200`} style={{ backgroundColor: '#1e3a5f' }}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-blue-800">
          <div className="text-white font-bold text-lg tracking-wide">LinkRad</div>
          <div className="text-blue-300 text-xs mt-1">Financial Model</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {NAV.map((section) => {
            if (section.financialsOnly && !isFinancialsUser) return null
            const visibleItems = section.items.filter(item => {
              if (item.adminOnly && !isAdmin) return false
              if (item.workflowOnly && !isWorkflowUser) return false
              return true
            })
            if (visibleItems.length === 0) return null
            return (
              <div key={section.group} className="mb-2">
                <div className="px-4 py-1 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                  {section.group}
                </div>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-2 text-sm transition-colors duration-150 ${
                        isActive
                          ? 'bg-blue-700 text-white font-medium border-r-2 border-blue-300'
                          : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                      }`
                    }
                  >
                    <span className="mr-2 text-xs">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        {/* User info + logout */}
        <div className="px-4 py-3 border-t border-blue-800 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-blue-200 text-xs font-medium truncate">{auth?.displayName || auth?.username}</span>
            {(() => {
              const rc = ROLE_LABELS[auth?.role] || ROLE_LABELS.guest
              return <span className={`ml-auto text-xs px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${rc.cls}`}>{rc.label}</span>
            })()}
          </div>
          {auth?.department && (
            <div className="text-blue-400 text-xs px-0.5">{auth.department}</div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-xs text-blue-300 hover:text-white hover:bg-blue-800 px-2 py-1.5 rounded text-left transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(prev => !prev)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title={sidebarOpen ? 'Ẩn menu' : 'Hiện menu'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-800">LinkRad ERP</h1>
          </div>
          <div className="flex items-center gap-3">
            {!isAdmin && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Chế độ xem</span>
            )}
            <span className="text-sm text-gray-500">Đơn vị: VND triệu</span>
            <div className="w-2 h-2 rounded-full bg-green-500" title="Server online"></div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
