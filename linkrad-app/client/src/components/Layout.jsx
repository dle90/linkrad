import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logoutUser } from '../api'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'

const NAV = [
  {
    group: 'Dashboard',
    items: [
      { path: '/dashboard/clinical', label: 'Lâm Sàng',  icon: '🩺', workflowOnly: true },
      { path: '/dashboard/ops',      label: 'Vận Hành',  icon: '⚙️', workflowOnly: true },
      { path: '/dashboard/finance',  label: 'Tài Chính', icon: '💼', financialsOnly: true },
    ]
  },
  {
    group: 'Tiếp đón',
    items: [
      { path: '/registration', label: 'Đăng ký',   icon: '🏥', workflowOnly: true },
      { path: '/billing',      label: 'Phiếu thu', icon: '💳', workflowOnly: true },
    ]
  },
  {
    group: 'Chẩn đoán hình ảnh',
    items: [
      { path: '/ris',             label: 'Ca chụp', icon: '🩻', workflowOnly: true },
      { path: '/teleradiology',   label: 'Ca đọc',  icon: '🖥️', workflowOnly: true },
    ]
  },
  {
    group: 'Vận hành',
    items: [
      { path: '/inventory', label: 'Quản lý kho', icon: '📦', workflowOnly: true },
    ]
  },
  {
    group: 'Danh mục',
    items: [
      { path: '/catalogs',         label: 'Danh mục',    icon: '📚', workflowOnly: true },
      { path: '/report-templates', label: 'Mẫu kết quả', icon: '📋', workflowOnly: true },
    ]
  },
  {
    group: 'Báo cáo',
    subgroups: [
      {
        title: 'Chẩn đoán hình ảnh',
        items: [
          { path: '/rad-reports/cases-by-machine',              label: 'BC số ca theo máy',          icon: '🖥️', perm: 'rad-reports.view' },
          { path: '/rad-reports/cases-by-machine-group',        label: 'BC số ca theo nhóm máy',     icon: '📦', perm: 'rad-reports.view' },
          { path: '/rad-reports/cases-by-radiologist',          label: 'BC số ca theo BS đọc',       icon: '👨‍⚕️', perm: 'rad-reports.view' },
          { path: '/rad-reports/cases-by-radiologist-modality', label: 'BC BS đọc × loại máy',       icon: '📋', perm: 'rad-reports.view' },
          { path: '/rad-reports/cases-by-time',                 label: 'BC theo thời gian',          icon: '🕒', perm: 'rad-reports.view' },
          { path: '/rad-reports/services-detail',               label: 'BC chi tiết DV ca theo máy', icon: '📄', perm: 'rad-reports.view' },
          { path: '/rad-reports/patient-list',                  label: 'BC DS BN đã đọc KQ',         icon: '🧑', perm: 'rad-reports.view' },
        ]
      },
      {
        title: 'Kinh doanh',
        items: [
          { path: '/reports/revenue-detail',    label: 'BC doanh thu chi tiết',   icon: '📊', perm: 'reports.view' },
          { path: '/reports/customer-detail',   label: 'BC chi tiết khách hàng',  icon: '👥', perm: 'reports.view' },
          { path: '/reports/promotion-detail',  label: 'BC chương trình KM',      icon: '🎁', perm: 'reports.view' },
          { path: '/reports/clinic-revenue',    label: 'BC doanh thu phòng khám', icon: '🏥', perm: 'reports.view' },
          { path: '/reports/refund-exchange',   label: 'BC hoàn trả/đổi DV',      icon: '🔄', perm: 'reports.view' },
          { path: '/reports/e-invoice',         label: 'BC hóa đơn điện tử',      icon: '🧾', perm: 'reports.view' },
          { path: '/reports/referral-revenue',  label: 'BC doanh thu đối tác GT', icon: '🤝', perm: 'referral.view' },
          { path: '/reports/salesperson-kpi',   label: 'BC KPI NVKD',             icon: '🎯', perm: 'kpi-sales.view' },
        ]
      }
    ]
  },
  {
    group: 'Quản lý',
    items: [
      { path: '/audit-log', label: 'Nhật ký hệ thống', icon: '📜', perm: 'audit.view' },
    ]
  },
  {
    group: 'Tài chính',
    perm: 'financials.view',
    items: [
      { path: '/actuals',   label: 'Nhập số liệu',          icon: '✏️', perm: 'financials.manage' },
      { path: '/pl',        label: 'Kết quả kinh doanh',    icon: '📋', perm: 'financials.view' },
      { path: '/cf',        label: 'Dòng tiền',             icon: '💰', perm: 'financials.view' },
      { path: '/bs',        label: 'Bảng cân đối kế toán',  icon: '⚖️', perm: 'financials.view' },
      { path: '/breakeven', label: 'Điểm hòa vốn',          icon: '📈', perm: 'financials.view' },
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
  {
    group: 'Inactive',
    items: [
      { path: '/workflow',        label: 'Công việc',          icon: '✅', workflowOnly: true },
      { path: '/telerad-reading', label: 'Ca đọc — Của tôi',   icon: '🔬', workflowOnly: true },
      { path: '/telerad-admin',   label: 'Ca đọc — Phân công', icon: '📋', adminOnly: true },
    ]
  },
  {
    group: 'Tổng Quan (Cũ)',
    items: [
      { path: '/today', label: 'Hôm nay (live)', icon: '📡', workflowOnly: true },
      { path: '/',      label: 'Dashboard',      icon: '📊' },
      { path: '/sites', label: 'Danh sách Site', icon: '📍' },
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
  const { auth, logout, hasPerm } = useAuth()
  const isAdmin = auth?.role === 'admin'
  // Legacy flags kept as fallback for items that haven't migrated to `perm` yet.
  const isFinancialsUser = hasPerm('financials.view') || auth?.role === 'giamdoc'
  const isWorkflowUser = auth?.role && auth.role !== 'guest'
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [collapsed, setCollapsed] = React.useState({})
  const toggleSub = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }))
  const filterItems = (items) => items.filter(item => {
    if (item.perm && !hasPerm(item.perm)) return false
    if (item.adminOnly && !isAdmin) return false
    if (item.financialsOnly && !isFinancialsUser) return false
    if (item.workflowOnly && !isWorkflowUser) return false
    return true
  })
  const renderLink = (item, nested = false) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `flex items-center ${nested ? 'pl-9 pr-4' : 'px-4'} py-2 text-sm transition-colors duration-150 ${
          isActive
            ? 'bg-blue-700 text-white font-medium border-r-2 border-blue-300'
            : 'text-blue-200 hover:bg-blue-800 hover:text-white'
        }`
      }
    >
      <span className="mr-2 text-xs">{item.icon}</span>
      {item.label}
    </NavLink>
  )

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
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {NAV.map((section) => {
            if (section.financialsOnly && !isFinancialsUser) return null
            if (section.perm && !hasPerm(section.perm)) return null

            if (section.subgroups) {
              const visibleSubs = section.subgroups
                .map(sg => ({ ...sg, items: filterItems(sg.items) }))
                .filter(sg => sg.items.length > 0)
              if (visibleSubs.length === 0) return null
              return (
                <div key={section.group} className="mb-2">
                  <div className="px-4 py-1 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                    {section.group}
                  </div>
                  {visibleSubs.map(sg => {
                    const key = `${section.group}:${sg.title}`
                    const isOpen = !collapsed[key]
                    return (
                      <div key={sg.title}>
                        <button
                          type="button"
                          onClick={() => toggleSub(key)}
                          className="w-full flex items-center px-4 py-1.5 text-xs text-blue-300 hover:text-white hover:bg-blue-800 transition-colors"
                        >
                          <span className="mr-1.5 text-[10px] w-3 inline-block">{isOpen ? '▾' : '▸'}</span>
                          <span className="font-medium">{sg.title}</span>
                        </button>
                        {isOpen && sg.items.map(item => renderLink(item, true))}
                      </div>
                    )
                  })}
                </div>
              )
            }

            const visibleItems = filterItems(section.items)
            if (visibleItems.length === 0) return null
            return (
              <div key={section.group} className="mb-2">
                <div className="px-4 py-1 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                  {section.group}
                </div>
                {visibleItems.map(item => renderLink(item))}
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
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="text-xs flex items-center gap-2 px-2.5 py-1 rounded border border-gray-200 hover:border-gray-300 text-gray-500 hover:bg-gray-50"
              title="Tìm kiếm (Ctrl+K)"
            >
              🔍 <span>Tìm kiếm</span> <kbd className="bg-gray-100 px-1 rounded text-[10px]">Ctrl+K</kbd>
            </button>
            <NotificationBell />
            {!isAdmin && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Chế độ xem</span>
            )}
            <span className="text-sm text-gray-500">Đơn vị: VND triệu</span>
            <div className="w-2 h-2 rounded-full bg-green-500" title="Server online"></div>
          </div>
        </header>

        {/* Cmd+K palette (rendered globally; portals out via fixed positioning) */}
        <GlobalSearch />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
