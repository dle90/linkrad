import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

const fmtMoney = (v) => v == null ? '0' : Number(v).toLocaleString('vi-VN')

// ── Sidebar menu config ──────────────────────────────────
const MENU = [
  {
    group: 'Danh mục đối tác',
    items: [
      { key: 'referral-doctors', label: 'Bác sĩ giới thiệu', icon: '👨‍⚕️' },
      { key: 'partner-facilities', label: 'Cơ sở y tế đối tác', icon: '🏥' },
      { key: 'commission-groups', label: 'Nhóm hoa hồng', icon: '📋' },
      { key: 'commission-rules', label: 'Hoa hồng', icon: '💰' },
    ],
  },
  {
    group: 'Danh mục chung',
    items: [
      { key: 'users', label: 'Nhân sự', icon: '👤' },
      { key: 'patients', label: 'Bệnh nhân', icon: '🧑' },
      { key: 'specialties', label: 'Chuyên khoa', icon: '🩺' },
      { key: 'registration-reasons', label: 'Lý do phiếu đăng ký', icon: '📝' },
      { key: 'billing-cancel-reasons', label: 'Lý do huỷ phiếu thu', icon: '❌' },
      { key: 'medical-facilities', label: 'Cơ sở y tế', icon: '🏨' },
      { key: 'promotions', label: 'Chương trình khuyến mãi', icon: '🎁' },
      { key: 'promo-codes', label: 'Mã khuyến mãi', icon: '🏷️' },
      { key: 'services', label: 'Dịch vụ', icon: '📄' },
      { key: 'service-types', label: 'Loại dịch vụ', icon: '📂' },
      { key: 'tax-groups', label: 'Nhóm thuế dịch vụ', icon: '📊' },
      { key: 'admin-units', label: 'Địa chỉ hành chính', icon: '📍' },
    ],
  },
]

// ── Field definitions per catalog ────────────────────────
const CATALOG_FIELDS = {
  'referral-doctors': {
    columns: ['code', 'name', 'phone', 'specialty', 'hospital', 'status'],
    columnLabels: { code: 'Mã', name: 'Tên bác sĩ', phone: 'SĐT', specialty: 'Chuyên khoa', hospital: 'Bệnh viện', status: 'TT' },
    editFields: [
      { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên bác sĩ', required: true },
      { key: 'phone', label: 'SĐT' }, { key: 'email', label: 'Email' },
      { key: 'specialty', label: 'Chuyên khoa' }, { key: 'hospital', label: 'Bệnh viện' },
      { key: 'address', label: 'Địa chỉ', wide: true }, { key: 'notes', label: 'Ghi chú', wide: true },
    ],
  },
  'partner-facilities': {
    columns: ['code', 'name', 'type', 'phone', 'contactPerson', 'status'],
    columnLabels: { code: 'Mã', name: 'Tên cơ sở', type: 'Loại', phone: 'SĐT', contactPerson: 'Liên hệ', status: 'TT' },
    editFields: [
      { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên cơ sở', required: true },
      { key: 'type', label: 'Loại', type: 'select', options: [{ value: 'hospital', label: 'Bệnh viện' }, { value: 'clinic', label: 'Phòng khám' }, { value: 'lab', label: 'Xét nghiệm' }, { value: 'other', label: 'Khác' }] },
      { key: 'phone', label: 'SĐT' }, { key: 'contactPerson', label: 'Người liên hệ' }, { key: 'email', label: 'Email' },
      { key: 'address', label: 'Địa chỉ', wide: true },
    ],
    formatCell: { type: v => ({ hospital: 'Bệnh viện', clinic: 'Phòng khám', lab: 'Xét nghiệm', other: 'Khác' }[v] || v) },
  },
  'commission-groups': {
    columns: ['code', 'name', 'description', 'status'],
    columnLabels: { code: 'Mã', name: 'Tên nhóm', description: 'Mô tả', status: 'TT' },
    editFields: [
      { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên nhóm', required: true },
      { key: 'description', label: 'Mô tả', wide: true },
    ],
  },
  'commission-rules': {
    columns: ['commissionGroupName', 'serviceName', 'type', 'value', 'status'],
    columnLabels: { commissionGroupName: 'Nhóm HH', serviceName: 'Dịch vụ', type: 'Loại', value: 'Giá trị', status: 'TT' },
    editFields: [
      { key: 'commissionGroupId', label: 'Nhóm HH', required: true }, { key: 'commissionGroupName', label: 'Tên nhóm HH' },
      { key: 'serviceName', label: 'Dịch vụ' }, { key: 'serviceId', label: 'Mã DV' },
      { key: 'type', label: 'Loại', type: 'select', options: [{ value: 'percentage', label: 'Phần trăm (%)' }, { value: 'fixed', label: 'Số tiền cố định' }] },
      { key: 'value', label: 'Giá trị', type: 'number' },
    ],
    formatCell: { type: v => v === 'percentage' ? '%' : 'VND', value: (v, row) => row.type === 'percentage' ? `${v}%` : fmtMoney(v) },
  },
  'specialties': {
    columns: ['code', 'name', 'description', 'status'],
    columnLabels: { code: 'Mã', name: 'Tên chuyên khoa', description: 'Mô tả', status: 'TT' },
    editFields: [
      { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên chuyên khoa', required: true },
      { key: 'description', label: 'Mô tả', wide: true },
    ],
  },
  'registration-reasons': {
    columns: ['code', 'name', 'status'],
    columnLabels: { code: 'Mã', name: 'Lý do', status: 'TT' },
    editFields: [{ key: 'code', label: 'Mã' }, { key: 'name', label: 'Lý do', required: true }],
  },
  'billing-cancel-reasons': {
    columns: ['code', 'name', 'status'],
    columnLabels: { code: 'Mã', name: 'Lý do', status: 'TT' },
    editFields: [{ key: 'code', label: 'Mã' }, { key: 'name', label: 'Lý do', required: true }],
  },
  'medical-facilities': {
    columns: ['code', 'name', 'level', 'phone', 'address', 'status'],
    columnLabels: { code: 'Mã', name: 'Tên cơ sở', level: 'Tuyến', phone: 'SĐT', address: 'Địa chỉ', status: 'TT' },
    editFields: [
      { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên cơ sở', required: true },
      { key: 'level', label: 'Tuyến', type: 'select', options: [{ value: 'trung_uong', label: 'Trung ương' }, { value: 'tinh', label: 'Tỉnh' }, { value: 'huyen', label: 'Huyện' }, { value: 'xa', label: 'Xã' }, { value: 'phong_kham', label: 'Phòng khám' }, { value: 'other', label: 'Khác' }] },
      { key: 'phone', label: 'SĐT' }, { key: 'address', label: 'Địa chỉ', wide: true },
    ],
    formatCell: { level: v => ({ trung_uong: 'TW', tinh: 'Tỉnh', huyen: 'Huyện', xa: 'Xã', phong_kham: 'PK', other: 'Khác' }[v] || v) },
  },
  'services': {
    columns: ['code', 'name', 'serviceTypeCode', 'modality', 'basePrice', 'status'],
    columnLabels: { code: 'Mã', name: 'Tên dịch vụ', serviceTypeCode: 'Loại', modality: 'Modality', basePrice: 'Giá (VND)', status: 'TT' },
    editFields: [
      { key: 'code', label: 'Mã DV', required: true }, { key: 'name', label: 'Tên dịch vụ', required: true },
      { key: 'serviceTypeCode', label: 'Loại DV' },
      { key: 'modality', label: 'Modality', type: 'select', options: ['CT', 'MRI', 'XR', 'US', 'LAB', 'OTHER'].map(m => ({ value: m, label: m })) },
      { key: 'bodyPart', label: 'Bộ phận' }, { key: 'basePrice', label: 'Giá (VND)', type: 'number' }, { key: 'unit', label: 'Đơn vị' },
    ],
    formatCell: { basePrice: v => fmtMoney(v) },
    rightAlign: ['basePrice'],
  },
  'service-types': {
    columns: ['code', 'name', 'sortOrder', 'status'],
    columnLabels: { code: 'Mã', name: 'Tên loại DV', sortOrder: 'Thứ tự', status: 'TT' },
    editFields: [
      { key: 'code', label: 'Mã', required: true }, { key: 'name', label: 'Tên', required: true },
      { key: 'description', label: 'Mô tả', wide: true }, { key: 'sortOrder', label: 'Thứ tự', type: 'number' },
    ],
  },
  'tax-groups': {
    columns: ['code', 'name', 'rate', 'branchCode', 'status'],
    columnLabels: { code: 'Mã', name: 'Tên nhóm thuế', rate: 'Thuế suất', branchCode: 'Chi nhánh', status: 'TT' },
    editFields: [
      { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên nhóm thuế', required: true },
      { key: 'rate', label: 'Thuế suất (%)', type: 'number' }, { key: 'branchCode', label: 'Chi nhánh (all = tất cả)' },
    ],
    formatCell: { rate: v => `${v}%` },
  },
  'admin-units': {
    columns: ['code', 'name', 'level', 'parentCode'],
    columnLabels: { code: 'Mã', name: 'Tên', level: 'Cấp', parentCode: 'Thuộc' },
    editFields: [
      { key: 'code', label: 'Mã', required: true }, { key: 'name', label: 'Tên', required: true },
      { key: 'level', label: 'Cấp', type: 'select', options: [{ value: 'province', label: 'Tỉnh/TP' }, { value: 'district', label: 'Quận/Huyện' }, { value: 'ward', label: 'Phường/Xã' }] },
      { key: 'parentCode', label: 'Mã cấp trên' }, { key: 'fullName', label: 'Tên đầy đủ', wide: true },
    ],
    formatCell: { level: v => ({ province: 'Tỉnh/TP', district: 'Quận/Huyện', ward: 'Phường/Xã' }[v] || v) },
  },
}

// ── Edit Modal ───────────────────────────────────────────
function EditModal({ title, fields, record, onClose, onSave }) {
  const [form, setForm] = useState(record || {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const handleSave = async () => {
    for (const f of fields) { if (f.required && !form[f.key]?.toString().trim()) return setError(`${f.label} là bắt buộc`) }
    setSaving(true); setError('')
    try { await onSave(form) } catch (err) { setError(err.response?.data?.error || 'Lỗi'); setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between"><h3 className="font-semibold text-gray-800">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button></div>
        <div className="p-6 space-y-3">
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key} className={f.wide ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required ? ' *' : ''}</label>
                {f.type === 'select' ? (
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                    <option value="">-- Chọn --</option>{f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'number' ? (
                  <input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form[f.key] || 0} onChange={e => setForm(p => ({ ...p, [f.key]: +e.target.value }))} />
                ) : (
                  <input className="w-full border rounded px-2 py-1.5 text-sm" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Generic Catalog Table ────────────────────────────────
function CatalogTable({ catalogKey, isAdmin }) {
  const config = CATALOG_FIELDS[catalogKey]
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [searchQ, setSearchQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (searchQ) params.q = searchQ
      const r = await api.get(`/catalogs/${catalogKey}`, { params })
      setItems(r.data)
    } catch {}
    setLoading(false)
  }, [catalogKey, searchQ])

  useEffect(() => { load() }, [load])

  if (!config) return <div className="text-gray-400 text-sm p-4">Chưa cấu hình cho danh mục này</div>

  const handleSave = async (form) => {
    if (editing?._id) await api.put(`/catalogs/${catalogKey}/${editing._id}`, form)
    else await api.post(`/catalogs/${catalogKey}`, form)
    setEditing(null); load()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Tìm kiếm..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        {isAdmin && config.editFields && (
          <button onClick={() => setEditing({})} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Thêm mới</button>
        )}
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-gray-600 text-left">
            {config.columns.map(col => (
              <th key={col} className={`px-4 py-3 ${config.rightAlign?.includes(col) ? 'text-right' : ''}`}>{config.columnLabels[col] || col}</th>
            ))}
            {isAdmin && config.editFields && <th className="px-4 py-3 w-16"></th>}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={config.columns.length + 1} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            : items.length === 0 ? <tr><td colSpan={config.columns.length + 1} className="px-4 py-8 text-center text-gray-400">Chưa có dữ liệu</td></tr>
            : items.map((item, i) => (
              <tr key={item._id || i} className="border-t hover:bg-blue-50/50">
                {config.columns.map(col => {
                  let val = item[col]
                  if (config.formatCell?.[col]) val = config.formatCell[col](val, item)
                  if (col === 'status') {
                    return <td key={col} className="px-4 py-2.5"><span className={`px-1.5 py-0.5 rounded text-xs ${val === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{val === 'active' ? 'HĐ' : val === 'inactive' ? 'Ngưng' : val || '-'}</span></td>
                  }
                  if (col === 'code') return <td key={col} className="px-4 py-2.5 font-mono text-xs text-gray-500">{val || '-'}</td>
                  if (col === 'name' || col === 'serviceName' || col === 'commissionGroupName') return <td key={col} className="px-4 py-2.5 font-medium">{val || '-'}</td>
                  return <td key={col} className={`px-4 py-2.5 text-gray-600 ${config.rightAlign?.includes(col) ? 'text-right font-medium' : ''}`}>{val ?? '-'}</td>
                })}
                {isAdmin && config.editFields && (
                  <td className="px-4 py-2.5"><button onClick={() => setEditing(item)} className="text-gray-500 hover:text-gray-700 text-xs">Sửa</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing !== null && <EditModal title={editing._id ? 'Sửa' : 'Thêm mới'} fields={config.editFields} record={editing} onClose={() => setEditing(null)} onSave={handleSave} />}
    </>
  )
}

// ── Read-only tables for Users & Patients ────────────────
function UsersTable() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await api.get('/catalogs/users', { params: searchQ ? { q: searchQ } : {} }); setItems(r.data) } catch {}
    setLoading(false)
  }, [searchQ])
  useEffect(() => { load() }, [load])

  const ROLE_LABELS = { admin: 'Admin', giamdoc: 'Giám đốc', truongphong: 'Trưởng phòng', bacsi: 'Bác sĩ', nhanvien: 'Nhân viên', guest: 'Guest' }

  return (
    <>
      <div className="mb-3"><input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Tìm nhân sự..." value={searchQ} onChange={e => setSearchQ(e.target.value)} /></div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
          <th className="px-4 py-3">Username</th><th className="px-4 py-3">Tên hiển thị</th><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Phòng ban</th>
        </tr></thead><tbody>
          {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
          : items.map(u => (
            <tr key={u._id} className="border-t hover:bg-blue-50/50">
              <td className="px-4 py-2.5 font-mono text-xs">{u._id}</td>
              <td className="px-4 py-2.5 font-medium">{u.displayName || '-'}</td>
              <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{ROLE_LABELS[u.role] || u.role}</span></td>
              <td className="px-4 py-2.5 text-gray-500">{u.department || '-'}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </>
  )
}

function PatientsTable() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await api.get('/catalogs/patients', { params: searchQ ? { q: searchQ } : {} }); setItems(r.data) } catch {}
    setLoading(false)
  }, [searchQ])
  useEffect(() => { load() }, [load])
  return (
    <>
      <div className="mb-3"><input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Tìm bệnh nhân (tên, mã, SĐT)..." value={searchQ} onChange={e => setSearchQ(e.target.value)} /></div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
          <th className="px-4 py-3">Mã BN</th><th className="px-4 py-3">Họ tên</th><th className="px-4 py-3">Ngày sinh</th><th className="px-4 py-3">Giới tính</th><th className="px-4 py-3">SĐT</th><th className="px-4 py-3">Chi nhánh ĐK</th>
        </tr></thead><tbody>
          {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
          : items.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Chưa có bệnh nhân</td></tr>
          : items.map(p => (
            <tr key={p._id} className="border-t hover:bg-blue-50/50">
              <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{p.patientId}</td>
              <td className="px-4 py-2.5 font-medium">{p.name}</td>
              <td className="px-4 py-2.5 text-gray-500">{p.dob || '-'}</td>
              <td className="px-4 py-2.5">{p.gender === 'F' ? 'Nữ' : p.gender === 'M' ? 'Nam' : 'Khác'}</td>
              <td className="px-4 py-2.5">{p.phone || '-'}</td>
              <td className="px-4 py-2.5 text-gray-500">{p.registeredSite || '-'}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </>
  )
}

// ── Promotions & Promo Codes (inline) ────────────────────
function PromotionsTable({ isAdmin }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const r = await api.get('/promotions'); setItems(r.data) } catch {}; setLoading(false) }, [])
  useEffect(() => { load() }, [load])
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
        <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Tên chương trình</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3 text-right">Giá trị</th><th className="px-4 py-3">Thời gian</th><th className="px-4 py-3 text-center">Đã dùng</th><th className="px-4 py-3">TT</th>
      </tr></thead><tbody>
        {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
        : items.map(p => (
          <tr key={p._id} className="border-t hover:bg-blue-50/50">
            <td className="px-4 py-2.5 font-mono text-xs">{p.code}</td>
            <td className="px-4 py-2.5 font-medium">{p.name}</td>
            <td className="px-4 py-2.5">{p.type === 'percentage' ? '%' : 'VND'}</td>
            <td className="px-4 py-2.5 text-right font-medium text-blue-600">{p.type === 'percentage' ? `${p.discountValue}%` : fmtMoney(p.discountValue)}</td>
            <td className="px-4 py-2.5 text-xs text-gray-500">{p.startDate || ''} - {p.endDate || ''}</td>
            <td className="px-4 py-2.5 text-center">{p.currentUsage}{p.maxUsageTotal ? `/${p.maxUsageTotal}` : ''}</td>
            <td className="px-4 py-2.5"><span className={`px-1.5 py-0.5 rounded text-xs ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.status === 'active' ? 'HĐ' : p.status}</span></td>
          </tr>
        ))}
      </tbody></table>
    </div>
  )
}

function PromoCodesTable() {
  const [promos, setPromos] = useState([])
  const [codes, setCodes] = useState([])
  const [selectedPromo, setSelectedPromo] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/promotions').then(r => { setPromos(r.data); setLoading(false) }).catch(() => setLoading(false)) }, [])
  useEffect(() => { if (selectedPromo) api.get(`/promotions/${selectedPromo}/codes`).then(r => setCodes(r.data)).catch(() => setCodes([])); else setCodes([]) }, [selectedPromo])
  return (
    <>
      <div className="mb-3">
        <select className="border rounded px-3 py-1.5 text-sm w-72" value={selectedPromo} onChange={e => setSelectedPromo(e.target.value)}>
          <option value="">-- Chọn chương trình để xem mã --</option>
          {promos.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>
      {selectedPromo && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
            <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Chương trình</th><th className="px-4 py-3 text-center">Đã dùng</th><th className="px-4 py-3 text-center">Tối đa</th><th className="px-4 py-3">TT</th>
          </tr></thead><tbody>
            {codes.length === 0 ? <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400">Chưa có mã</td></tr>
            : codes.map(c => (
              <tr key={c._id} className="border-t"><td className="px-4 py-2 font-mono font-medium">{c.code}</td><td className="px-4 py-2 text-gray-500">{c.promotionName}</td>
              <td className="px-4 py-2 text-center">{c.usedCount}</td><td className="px-4 py-2 text-center">{c.maxUsage}</td>
              <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status === 'active' ? 'HĐ' : c.status}</span></td></tr>
            ))}
          </tbody></table>
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════
//  MAIN CATALOGS PAGE
// ══════════════════════════════════════════════════════════
export default function Catalogs() {
  const { auth } = useAuth()
  const isAdmin = auth?.role === 'admin'
  const [activeKey, setActiveKey] = useState('referral-doctors')

  const activeLabel = MENU.flatMap(g => g.items).find(i => i.key === activeKey)?.label || ''

  const renderContent = () => {
    if (activeKey === 'users') return <UsersTable />
    if (activeKey === 'patients') return <PatientsTable />
    if (activeKey === 'promotions') return <PromotionsTable isAdmin={isAdmin} />
    if (activeKey === 'promo-codes') return <PromoCodesTable />
    if (CATALOG_FIELDS[activeKey]) return <CatalogTable catalogKey={activeKey} isAdmin={isAdmin} />
    return <div className="text-gray-400 text-sm p-4">Chọn danh mục từ menu bên trái</div>
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-0 border rounded-lg overflow-hidden bg-white">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 border-r bg-gray-50 overflow-y-auto">
        {MENU.map(group => (
          <div key={group.group}>
            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b bg-gray-100">{group.group}</div>
            {group.items.map(item => (
              <button key={item.key} onClick={() => setActiveKey(item.key)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors border-b border-gray-100 ${
                  activeKey === item.key ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50'
                }`}>
                <span className="text-xs">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{activeLabel}</h3>
        {renderContent()}
      </div>
    </div>
  )
}
