import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logoutUser } from '../api'

const NAV = [
  {
    group: 'Tổng quan',
    items: [
      { path: '/', label: 'Dashboard', icon: '📊' },
      { path: '/actuals', label: 'Nhập số liệu', icon: '✏️', adminOnly: true },
      { path: '/workflow', label: 'Công việc', icon: '✅', workflowOnly: true }
    ]
  },
  {
    group: 'Kết quả kinh doanh',
    items: [
      { path: '/pl/annual', label: 'P&L Năm 2025', icon: '📋' },
      { path: '/pl/monthly', label: 'P&L Tháng 2025', icon: '📅' },
      { path: '/pl/site/1', label: 'P&L Chi nhánh', icon: '🏥' }
    ]
  },
  {
    group: 'Dòng tiền',
    items: [
      { path: '/cf/annual', label: 'CF Năm 2026', icon: '💰' },
      { path: '/cf/monthly', label: 'CF Tháng 2026', icon: '📆' }
    ]
  },
  {
    group: 'Bảng cân đối',
    items: [
      { path: '/bs', label: 'Bảng cân đối kế toán', icon: '⚖️' }
    ]
  },
  {
    group: 'Phân tích',
    items: [
      { path: '/breakeven', label: 'Điểm hòa vốn', icon: '📈' }
    ]
  },
  {
    group: 'CRM',
    items: [
      { path: '/crm', label: 'Phân tích KH', icon: '👥' }
    ]
  },
  {
    group: 'Danh sách',
    items: [
      { path: '/sites', label: 'Danh sách Site', icon: '📍' }
    ]
  }
]

const ROLE_LABELS = {
  admin:       { label: 'Admin',        cls: 'bg-yellow-800 text-yellow-200' },
  guest:       { label: 'Guest',        cls: 'bg-blue-800 text-blue-300' },
  nhanvien:    { label: 'Nhân viên',    cls: 'bg-blue-800 text-blue-200' },
  truongphong: { label: 'Trưởng phòng', cls: 'bg-indigo-800 text-indigo-200' },
  giamdoc:     { label: 'Giám đốc',     cls: 'bg-purple-800 text-purple-200' },
}

export default function Layout({ children }) {
  const { auth, logout } = useAuth()
  const isAdmin = auth?.role === 'admin'
  const isWorkflowUser = auth?.role && auth.role !== 'guest'

  const handleLogout = async () => {
    try { await logoutUser() } catch {}
    logout()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col overflow-y-auto" style={{ backgroundColor: '#1e3a5f' }}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-blue-800">
          <div className="text-white font-bold text-lg tracking-wide">LinkRad</div>
          <div className="text-blue-300 text-xs mt-1">Financial Model</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {NAV.map((section) => {
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
          <h1 className="text-lg font-semibold text-gray-800">LinkRad Financial Model 2025-2026</h1>
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
