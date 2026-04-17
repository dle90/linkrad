import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

// ── Sidebar menu ────────────────────────────────────────
const MENU = [
  { group: 'Nhân sự', items: [
    { key: 'employees', label: 'Danh sách nhân viên' },
    { key: 'departments', label: 'Phòng ban / Chi nhánh' },
  ]},
  { group: 'Phân quyền', items: [
    { key: 'permissions', label: 'Ma trận quyền' },
  ]},
]

const STATUS_BADGE = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  resigned: 'bg-red-100 text-red-700',
}
const STATUS_LABEL = { active: 'Đang làm', inactive: 'Ngừng', resigned: 'Nghỉ việc' }
const DEPT_TYPE_LABEL = { branch: 'Chi nhánh', hq: 'Phòng ban' }

// ═══════════════════════════════════════════════════════
// EMPLOYEE LIST & FORM
// ═══════════════════════════════════════════════════════
function EmployeeSection() {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | employee object
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.q = search
      if (deptFilter) params.departmentId = deptFilter
      if (statusFilter) params.status = statusFilter
      const [emps, depts, usrs] = await Promise.all([
        api.get('/hr/employees', { params }).then(r => r.data),
        api.get('/hr/departments').then(r => r.data),
        api.get('/hr/users').then(r => r.data),
      ])
      setEmployees(emps)
      setDepartments(depts)
      setUsers(usrs)
    } catch {}
    setLoading(false)
  }, [search, deptFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const startNew = () => {
    setEditing('new')
    setForm({ fullName: '', phone: '', email: '', position: '', departmentId: '', site: '', hireDate: '', birthDate: '', gender: 'M', address: '', idNumber: '', notes: '', userId: '' })
  }

  const startEdit = (emp) => {
    setEditing(emp)
    setForm({ ...emp })
  }

  const save = async () => {
    setSaving(true)
    try {
      // Set departmentName from selected department
      const dept = departments.find(d => d._id === form.departmentId)
      const payload = { ...form, departmentName: dept ? dept.name : '', site: dept ? dept.name : form.site }

      if (editing === 'new') {
        await api.post('/hr/employees', payload)
      } else {
        await api.put(`/hr/employees/${editing._id}`, payload)
      }
      setEditing(null)
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi lưu')
    }
    setSaving(false)
  }

  const remove = async (emp) => {
    if (!confirm(`Ngừng nhân viên ${emp.fullName}?`)) return
    await api.delete(`/hr/employees/${emp._id}`)
    load()
  }

  const F = (key, label, opts = {}) => (
    <div className={opts.wide ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label} {opts.required && <span className="text-red-500">*</span>}</label>
      {opts.type === 'select' ? (
        <select value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400">
          <option value="">—</option>
          {opts.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : opts.type === 'textarea' ? (
        <textarea value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400 resize-none" rows={2} />
      ) : (
        <input type={opts.type || 'text'} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400" required={opts.required} />
      )}
    </div>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm..."
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 outline-none focus:border-blue-400" />
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none">
          <option value="">Tất cả phòng ban</option>
          {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none">
          <option value="">Tất cả TT</option>
          <option value="active">Đang làm</option><option value="inactive">Ngừng</option><option value="resigned">Nghỉ việc</option>
        </select>
        <div className="flex-1" />
        <button onClick={startNew} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg">+ Thêm nhân viên</button>
      </div>

      {/* Table */}
      {loading ? <div className="text-gray-400 py-8 text-center">Đang tải...</div> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-3 py-2">Mã NV</th><th className="px-3 py-2">Họ tên</th><th className="px-3 py-2">Chức vụ</th>
              <th className="px-3 py-2">Phòng ban</th><th className="px-3 py-2">SĐT</th><th className="px-3 py-2">Ngày vào</th>
              <th className="px-3 py-2">TT</th><th className="px-3 py-2 w-20"></th>
            </tr></thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp._id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => startEdit(emp)}>
                  <td className="px-3 py-2 font-mono text-xs">{emp.employeeCode}</td>
                  <td className="px-3 py-2 font-medium">{emp.fullName}</td>
                  <td className="px-3 py-2">{emp.position}</td>
                  <td className="px-3 py-2">{emp.departmentName}</td>
                  <td className="px-3 py-2">{emp.phone}</td>
                  <td className="px-3 py-2">{emp.hireDate}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[emp.employmentStatus] || 'bg-gray-100'}`}>
                      {STATUS_LABEL[emp.employmentStatus] || emp.employmentStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => remove(emp)} className="text-xs text-red-500 hover:text-red-700">Ngừng</button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Không có nhân viên</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{editing === 'new' ? 'Thêm nhân viên' : `Sửa: ${editing.employeeCode}`}</h3>
            <div className="grid grid-cols-2 gap-3">
              {F('fullName', 'Họ tên', { required: true })}
              {F('position', 'Chức vụ')}
              {F('departmentId', 'Phòng ban', { type: 'select', options: departments.map(d => ({ value: d._id, label: `${d.name} (${DEPT_TYPE_LABEL[d.type] || d.type})` })) })}
              {F('userId', 'Tài khoản đăng nhập', { type: 'select', options: users.map(u => ({ value: u._id, label: `${u._id} — ${u.displayName} (${u.role})` })) })}
              {F('phone', 'SĐT')}
              {F('email', 'Email')}
              {F('gender', 'Giới tính', { type: 'select', options: [{ value: 'M', label: 'Nam' }, { value: 'F', label: 'Nữ' }, { value: 'other', label: 'Khác' }] })}
              {F('birthDate', 'Ngày sinh', { type: 'date' })}
              {F('hireDate', 'Ngày vào làm', { type: 'date' })}
              {F('idNumber', 'Số CCCD/CMND')}
              {F('address', 'Địa chỉ', { wide: true })}
              {F('notes', 'Ghi chú', { wide: true, type: 'textarea' })}
              {editing !== 'new' && F('employmentStatus', 'Trạng thái', { type: 'select', options: [{ value: 'active', label: 'Đang làm' }, { value: 'inactive', label: 'Ngừng' }, { value: 'resigned', label: 'Nghỉ việc' }] })}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button onClick={() => setEditing(null)} className="bg-gray-100 hover:bg-gray-200 text-sm px-5 py-2 rounded-lg">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// DEPARTMENT LIST & FORM
// ═══════════════════════════════════════════════════════
function DepartmentSection() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setDepartments((await api.get('/hr/departments')).data) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const startNew = () => {
    setEditing('new')
    setForm({ code: '', name: '', type: 'hq', headUserId: '', headName: '', phone: '', address: '', description: '' })
  }
  const startEdit = (d) => { setEditing(d); setForm({ ...d }) }

  const save = async () => {
    setSaving(true)
    try {
      if (editing === 'new') await api.post('/hr/departments', form)
      else await api.put(`/hr/departments/${editing._id}`, form)
      setEditing(null); load()
    } catch (err) { alert(err.response?.data?.error || 'Lỗi lưu') }
    setSaving(false)
  }

  const remove = async (d) => {
    if (!confirm(`Ngừng phòng ban ${d.name}?`)) return
    await api.delete(`/hr/departments/${d._id}`)
    load()
  }

  const F = (key, label, opts = {}) => (
    <div className={opts.wide ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {opts.type === 'select' ? (
        <select value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400">
          <option value="">—</option>
          {opts.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type="text" value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
      )}
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Phòng ban / Chi nhánh</h3>
        <div className="flex-1" />
        <button onClick={startNew} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg">+ Thêm</button>
      </div>

      {loading ? <div className="text-gray-400 py-8 text-center">Đang tải...</div> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-3 py-2">Mã</th><th className="px-3 py-2">Tên</th><th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Trưởng phòng</th><th className="px-3 py-2">SĐT</th><th className="px-3 py-2">TT</th><th className="px-3 py-2 w-20"></th>
            </tr></thead>
            <tbody>
              {departments.map(d => (
                <tr key={d._id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => startEdit(d)}>
                  <td className="px-3 py-2 font-mono text-xs">{d.code}</td>
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${d.type === 'branch' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {DEPT_TYPE_LABEL[d.type] || d.type}
                    </span>
                  </td>
                  <td className="px-3 py-2">{d.headName || '—'}</td>
                  <td className="px-3 py-2">{d.phone || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {d.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                    </span>
                  </td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => remove(d)} className="text-xs text-red-500 hover:text-red-700">Ngừng</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{editing === 'new' ? 'Thêm phòng ban' : `Sửa: ${editing.name}`}</h3>
            <div className="grid grid-cols-2 gap-3">
              {F('code', 'Mã')}
              {F('name', 'Tên')}
              {F('type', 'Loại', { type: 'select', options: [{ value: 'branch', label: 'Chi nhánh' }, { value: 'hq', label: 'Phòng ban' }] })}
              {F('headName', 'Trưởng phòng')}
              {F('phone', 'SĐT')}
              {F('address', 'Địa chỉ')}
              {F('description', 'Mô tả', { wide: true })}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button onClick={() => setEditing(null)} className="bg-gray-100 hover:bg-gray-200 text-sm px-5 py-2 rounded-lg">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// PERMISSION MATRIX
// ═══════════════════════════════════════════════════════
function PermissionMatrix() {
  const [roles, setRoles] = useState([])
  const [permDefs, setPermDefs] = useState({ permissions: {}, groups: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState({})

  useEffect(() => {
    Promise.all([
      api.get('/hr/roles').then(r => setRoles(r.data)),
      api.get('/hr/permissions').then(r => setPermDefs(r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  const toggle = (roleId, perm) => {
    if (roleId === 'admin') return // admin always has all
    setRoles(prev => prev.map(r => {
      if (r._id !== roleId) return r
      const perms = r.permissions || []
      const next = perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm]
      return { ...r, permissions: next }
    }))
    setDirty(prev => ({ ...prev, [roleId]: true }))
  }

  const saveRole = async (roleId) => {
    setSaving(true)
    try {
      const role = roles.find(r => r._id === roleId)
      await api.put(`/hr/roles/${roleId}`, { permissions: role.permissions })
      setDirty(prev => ({ ...prev, [roleId]: false }))
    } catch (err) { alert(err.response?.data?.error || 'Lỗi lưu') }
    setSaving(false)
  }

  if (loading) return <div className="text-gray-400 py-8 text-center">Đang tải...</div>

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Ma trận phân quyền</h3>
      <p className="text-sm text-gray-500 mb-4">Tick vào ô để cấp quyền cho vai trò. Admin luôn có tất cả quyền.</p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
        <table className="text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs text-gray-500 sticky left-0 bg-gray-50 min-w-[120px]">Vai trò</th>
              {(permDefs.groups || []).map(g => (
                <th key={g.key} colSpan={g.perms.length} className="px-2 py-2 text-center text-xs text-gray-600 border-l border-gray-200">
                  {g.label}
                </th>
              ))}
              <th className="px-3 py-2 w-20"></th>
            </tr>
            <tr className="bg-gray-50 border-t border-gray-100">
              <th className="sticky left-0 bg-gray-50"></th>
              {(permDefs.groups || []).flatMap(g => g.perms.map(p => (
                <th key={p} className="px-1 py-1 text-center text-[10px] text-gray-400 border-l border-gray-100 min-w-[60px] whitespace-nowrap" title={permDefs.permissions[p]}>
                  {(permDefs.permissions[p] || p).replace(/^(Xem|Quản lý|Nhập) /, '').slice(0, 12)}
                </th>
              )))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roles.map(role => (
              <tr key={role._id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium sticky left-0 bg-white">
                  {role.label || role._id}
                  <div className="text-[10px] text-gray-400">{role._id}</div>
                </td>
                {(permDefs.groups || []).flatMap(g => g.perms.map(p => (
                  <td key={p} className="text-center border-l border-gray-100">
                    <input
                      type="checkbox"
                      checked={role._id === 'admin' || (role.permissions || []).includes(p)}
                      disabled={role._id === 'admin'}
                      onChange={() => toggle(role._id, p)}
                      className="w-4 h-4 accent-blue-600"
                    />
                  </td>
                )))}
                <td className="px-2">
                  {dirty[role._id] && (
                    <button onClick={() => saveRole(role._id)} disabled={saving}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                      Lưu
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════
export default function HRManagement() {
  const { hrKey } = useParams()
  const section = hrKey || 'employees'

  return (
    <div>
      {section === 'employees' && <EmployeeSection />}
      {section === 'departments' && <DepartmentSection />}
      {section === 'permissions' && <PermissionMatrix />}
    </div>
  )
}
