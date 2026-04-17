import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
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
    columns: ['code', 'name', 'phone', 'email', 'idCard', 'address', 'gender', 'dob', 'specialty', 'workplace', 'area', 'paymentMethod', 'bankAccount', 'bankName', 'assignedStaff', 'firstReferralDate', 'contractDate', 'notes'],
    columnLabels: { code: 'Mã', name: 'Tên', phone: 'Số điện thoại', email: 'Email', idCard: 'Số CCCD', address: 'Địa chỉ', gender: 'Giới tính', dob: 'Ngày sinh', specialty: 'Chuyên khoa', workplace: 'Nơi làm việc', area: 'Địa bàn', paymentMethod: 'Hình thức thanh toán', bankAccount: 'STK', bankName: 'Ngân hàng', assignedStaff: 'Nhân viên theo dõi', firstReferralDate: 'Ngày gửi đầu tiên', contractDate: 'Ngày hợp đồng', notes: 'Ghi chú' },
    editFields: [
      { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên', required: true },
      { key: 'phone', label: 'Số điện thoại' }, { key: 'email', label: 'Email' },
      { key: 'idCard', label: 'Số CCCD' }, { key: 'address', label: 'Địa chỉ', wide: true },
      { key: 'gender', label: 'Giới tính', type: 'select', options: [{ value: 'M', label: 'Nam' }, { value: 'F', label: 'Nữ' }] },
      { key: 'dob', label: 'Ngày sinh', type: 'date' },
      { key: 'specialty', label: 'Chuyên khoa' }, { key: 'workplace', label: 'Nơi làm việc' },
      { key: 'area', label: 'Địa bàn' },
      { key: 'paymentMethod', label: 'Hình thức thanh toán', type: 'select', options: [{ value: 'cash', label: 'Tiền mặt' }, { value: 'transfer', label: 'Chuyển khoản' }, { value: 'both', label: 'Cả hai' }] },
      { key: 'bankAccount', label: 'STK' }, { key: 'bankName', label: 'Ngân hàng' },
      { key: 'assignedStaff', label: 'Nhân viên theo dõi' },
      { key: 'firstReferralDate', label: 'Ngày gửi đầu tiên', type: 'date' },
      { key: 'contractDate', label: 'Ngày hợp đồng', type: 'date' },
      { key: 'notes', label: 'Ghi chú', wide: true },
    ],
    formatCell: { gender: v => v === 'M' ? 'Nam' : v === 'F' ? 'Nữ' : v || '', paymentMethod: v => ({ cash: 'Tiền mặt', transfer: 'Chuyển khoản', both: 'Cả hai' }[v] || v || '') },
  },
  'partner-facilities': {
    columns: ['code', 'name', 'phone', 'address', 'specialty', 'clinicHeadName', 'contactPerson', 'area', 'paymentMethod', 'bankAccount', 'bankName', 'firstReferralDate', 'contractDate', 'assignedStaff', 'notes'],
    columnLabels: { code: 'Mã', name: 'Tên', phone: 'Số điện thoại', address: 'Địa chỉ', specialty: 'Chuyên khoa', clinicHeadName: 'Tên trưởng phòng khám', contactPerson: 'Tên người liên hệ', area: 'Địa bàn', paymentMethod: 'Hình thức thanh toán', bankAccount: 'STK', bankName: 'Ngân hàng', firstReferralDate: 'Ngày gửi đầu tiên', contractDate: 'Ngày hợp đồng', assignedStaff: 'Người theo dõi', notes: 'Ghi chú' },
    editFields: [
      { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên', required: true },
      { key: 'phone', label: 'Số điện thoại' }, { key: 'email', label: 'Email' },
      { key: 'address', label: 'Địa chỉ', wide: true },
      { key: 'specialty', label: 'Chuyên khoa' }, { key: 'clinicHeadName', label: 'Tên trưởng phòng khám' },
      { key: 'contactPerson', label: 'Tên người liên hệ' }, { key: 'area', label: 'Địa bàn' },
      { key: 'paymentMethod', label: 'Hình thức thanh toán', type: 'select', options: [{ value: 'cash', label: 'Tiền mặt' }, { value: 'transfer', label: 'Chuyển khoản' }, { value: 'both', label: 'Cả hai' }] },
      { key: 'bankAccount', label: 'STK' }, { key: 'bankName', label: 'Ngân hàng' },
      { key: 'firstReferralDate', label: 'Ngày gửi đầu tiên', type: 'date' },
      { key: 'contractDate', label: 'Ngày hợp đồng', type: 'date' },
      { key: 'assignedStaff', label: 'Người theo dõi' },
      { key: 'type', label: 'Loại cơ sở', type: 'select', options: [{ value: 'hospital', label: 'Bệnh viện' }, { value: 'clinic', label: 'Phòng khám' }, { value: 'lab', label: 'Xét nghiệm' }, { value: 'other', label: 'Khác' }] },
      { key: 'notes', label: 'Ghi chú', wide: true },
    ],
    formatCell: { paymentMethod: v => ({ cash: 'Tiền mặt', transfer: 'Chuyển khoản', both: 'Cả hai' }[v] || v || '') },
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
    columns: ['code', 'name', 'level', 'phone', 'address', 'description'],
    columnLabels: { code: 'Mã', name: 'Tên', level: 'Loại hình', phone: 'Số điện thoại', address: 'Địa chỉ', description: 'Mô tả' },
    editFields: [
      { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên', required: true },
      { key: 'level', label: 'Loại hình', type: 'select', options: [{ value: 'trung_uong', label: 'Trung ương' }, { value: 'tinh', label: 'Tỉnh' }, { value: 'huyen', label: 'Huyện' }, { value: 'xa', label: 'Xã' }, { value: 'phong_kham', label: 'Phòng khám' }, { value: 'other', label: 'Khác' }] },
      { key: 'phone', label: 'Số điện thoại' }, { key: 'address', label: 'Địa chỉ', wide: true },
      { key: 'description', label: 'Mô tả', wide: true },
    ],
    formatCell: { level: v => ({ trung_uong: 'Trung ương', tinh: 'Tỉnh', huyen: 'Huyện', xa: 'Xã', phong_kham: 'Phòng khám', other: 'Khác' }[v] || v || '') },
  },
  'services': {
    columns: ['code', 'technicalInfo', 'name', 'serviceTypeCode', 'basePrice', 'points'],
    columnLabels: { code: 'Mã', technicalInfo: 'Thông tin kỹ thuật', name: 'Tên', serviceTypeCode: 'Nhóm dịch vụ', basePrice: 'Đơn giá', points: 'Lý điểm' },
    editFields: [
      { key: 'code', label: 'Mã', required: true }, { key: 'name', label: 'Tên', required: true },
      { key: 'technicalInfo', label: 'Thông tin kỹ thuật', wide: true },
      { key: 'serviceTypeCode', label: 'Nhóm dịch vụ' },
      { key: 'modality', label: 'Modality', type: 'select', options: ['CT', 'MRI', 'XR', 'US', 'LAB', 'OTHER'].map(m => ({ value: m, label: m })) },
      { key: 'bodyPart', label: 'Bộ phận' }, { key: 'basePrice', label: 'Đơn giá', type: 'number' },
      { key: 'points', label: 'Lý điểm', type: 'number' }, { key: 'unit', label: 'Đơn vị' },
    ],
    formatCell: { basePrice: v => fmtMoney(v) },
    rightAlign: ['basePrice', 'points'],
  },
  'service-types': {
    columns: ['code', 'name', 'abbreviation', 'taxGroupName'],
    columnLabels: { code: 'Mã', name: 'Tên', abbreviation: 'Tên viết tắt', taxGroupName: 'Nhóm thuế dịch vụ' },
    editFields: [
      { key: 'code', label: 'Mã', required: true }, { key: 'name', label: 'Tên', required: true },
      { key: 'abbreviation', label: 'Tên viết tắt' },
      { key: 'taxGroupId', label: 'Mã nhóm thuế' }, { key: 'taxGroupName', label: 'Nhóm thuế dịch vụ' },
      { key: 'description', label: 'Mô tả', wide: true }, { key: 'sortOrder', label: 'Thứ tự', type: 'number' },
    ],
    note: 'Lưu ý: Nếu không chọn "Nhóm thuế dịch vụ", khi xuất hóa đơn điện tử, các dịch vụ này sẽ là "không kê khai thuế".',
  },
  'tax-groups': {
    columns: ['code', 'name', 'description', 'vatType', 'rate'],
    columnLabels: { code: 'Mã', name: 'Tên', description: 'Mô tả', vatType: 'Loại thuế VAT', rate: '% VAT' },
    editFields: [
      { key: 'code', label: 'Mã' }, { key: 'name', label: 'Tên', required: true },
      { key: 'description', label: 'Mô tả', wide: true },
      { key: 'vatType', label: 'Loại thuế VAT', type: 'select', options: [{ value: 'percentage', label: 'Theo %' }, { value: 'exempt', label: 'Không chịu thuế' }] },
      { key: 'rate', label: '% VAT', type: 'number' },
    ],
    formatCell: { vatType: v => v === 'exempt' ? 'Không chịu thuế' : v === 'percentage' ? 'Theo %' : v || '' },
    rightAlign: ['rate'],
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
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
                ) : f.type === 'date' ? (
                  <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
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
      {config.note && <div className="mb-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">⚠ {config.note}</div>}
      <div className="flex items-center justify-between mb-3">
        <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Tìm kiếm..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        {isAdmin && config.editFields && (
          <button onClick={() => setEditing({})} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Thêm mới</button>
        )}
      </div>
      <div className="bg-white rounded-lg border overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
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

// ── Staff master-detail ─────────────────────────────────
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' }, { value: 'giamdoc', label: 'Giám đốc' },
  { value: 'truongphong', label: 'Trưởng phòng' }, { value: 'bacsi', label: 'Bác sĩ' },
  { value: 'nhanvien', label: 'Nhân viên' }, { value: 'sale', label: 'Sale' }, { value: 'guest', label: 'Guest' },
]
const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map(o => [o.value, o.label]))
const EMP_TYPE_OPTIONS = [
  { value: 'full_time', label: 'Toàn thời gian' }, { value: 'part_time', label: 'Bán thời gian' },
  { value: 'contract', label: 'Hợp đồng' }, { value: 'intern', label: 'Thực tập' },
]
const GENDER_OPTIONS = [{ value: 'M', label: 'Nam' }, { value: 'F', label: 'Nữ' }]

function UsersTable({ isAdmin }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await api.get('/catalogs/users', { params: searchQ ? { q: searchQ } : {} }); setItems(r.data) } catch {}
    setLoading(false)
  }, [searchQ])
  useEffect(() => { load() }, [load])

  const selectUser = (u) => { setSelected(u._id); setForm({ ...u }); setMsg('') }
  const startNew = () => { setSelected('__new__'); setForm({ _id: '', role: 'nhanvien', employeeType: 'full_time', gender: 'M' }); setMsg('') }
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.displayName?.trim()) return setMsg('Họ tên là bắt buộc')
    if (!form.role) return setMsg('Chức vụ là bắt buộc')
    setSaving(true); setMsg('')
    try {
      if (selected === '__new__') {
        if (!form._id?.trim()) { setSaving(false); return setMsg('Mã nhân viên là bắt buộc') }
        await api.post('/catalogs/users', form)
      } else {
        await api.put(`/catalogs/users/${selected}`, form)
      }
      await load()
      setMsg('Đã lưu thành công')
      if (selected === '__new__') setSelected(form._id)
    } catch (err) { setMsg(err.response?.data?.error || 'Lỗi lưu') }
    setSaving(false)
  }

  const filtered = items.filter(u => !roleFilter || u.role === roleFilter)

  const Field = ({ label, k, required, type, options, wide }) => (
    <div className={wide ? 'col-span-2 sm:col-span-1' : ''}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}{required ? ' *' : ''}</label>
      {type === 'select' ? (
        <select className="w-full border rounded px-2 py-1.5 text-sm" value={form[k] || ''} onChange={e => setF(k, e.target.value)} disabled={!isAdmin}>
          <option value="">-- Chọn --</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'date' ? (
        <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form[k] || ''} onChange={e => setF(k, e.target.value)} disabled={!isAdmin} />
      ) : (
        <input className="w-full border rounded px-2 py-1.5 text-sm" value={form[k] || ''} onChange={e => setF(k, e.target.value)} disabled={!isAdmin || (k === '_id' && selected !== '__new__')} />
      )}
    </div>
  )

  const ImagePlaceholder = ({ label }) => (
    <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-gray-400 min-h-[120px]">
      <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      <span className="text-xs">{label}</span>
    </div>
  )

  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)]">
      {/* Left: list */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border rounded-lg bg-white overflow-hidden">
        <div className="p-2 border-b flex items-center gap-2">
          {isAdmin && <button onClick={startNew} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex-shrink-0">+ Thêm</button>}
          <select className="border rounded px-2 py-1 text-xs" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">Tất cả chức vụ</option>{ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#1e3a5f] text-white text-left text-xs sticky top-0">
              <th className="px-2 py-2 w-8">STT</th><th className="px-2 py-2">Mã</th><th className="px-2 py-2">Họ tên</th><th className="px-2 py-2">Chức vụ</th><th className="px-2 py-2">Số điện thoại</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
              : filtered.map((u, i) => (
                <tr key={u._id} onClick={() => selectUser(u)} className={`border-t cursor-pointer text-xs ${selected === u._id ? 'bg-blue-100' : 'hover:bg-blue-50/50'}`}>
                  <td className="px-2 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-2 font-mono">{u._id}</td>
                  <td className="px-2 py-2 font-medium">{u.displayName || '-'}</td>
                  <td className="px-2 py-2">{ROLE_LABELS[u.role] || u.role}</td>
                  <td className="px-2 py-2">{u.phone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: detail form */}
      <div className="flex-1 border rounded-lg bg-white overflow-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chọn nhân viên từ danh sách bên trái</div>
        ) : (
          <div className="p-4">
            {isAdmin && (
              <div className="flex items-center gap-2 mb-4">
                <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-sm bg-[#1e3a5f] text-white rounded hover:bg-[#2a4f7a] disabled:opacity-50 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
                {msg && <span className={`text-xs ${msg.includes('thành công') ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>}
              </div>
            )}
            <div className="grid grid-cols-5 gap-3 mb-4">
              <Field label="Mã nhân viên" k="_id" required />
              <Field label="Chức vụ" k="role" required type="select" options={ROLE_OPTIONS} />
              <Field label="Loại hình HV" k="employeeType" required type="select" options={EMP_TYPE_OPTIONS} />
              <Field label="Họ tên" k="displayName" required />
              <Field label="Giới tính" k="gender" type="select" options={GENDER_OPTIONS} />
            </div>
            <div className="grid grid-cols-5 gap-3 mb-4">
              <Field label="CCCD" k="idCard" required />
              <Field label="Ngày sinh" k="dob" type="date" />
              <Field label="Số điện thoại" k="phone" />
              <Field label="Email" k="email" />
            </div>
            <div className="grid grid-cols-5 gap-3 mb-4">
              <Field label="Trình độ" k="education" />
              <Field label="Địa chỉ" k="address" />
              <Field label="Ngày vào làm" k="joinDate" type="date" />
            </div>
            <div className="grid grid-cols-5 gap-3 mb-6">
              <Field label="Số BHXH" k="socialInsuranceNo" />
              <Field label="Ngày tham gia BH" k="insuranceDate" type="date" />
              <Field label="Mã số thuế" k="taxCode" />
              <Field label="Nơi cấp mã số thuế" k="taxCodePlace" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <ImagePlaceholder label="Hình ảnh đại diện" />
              <ImagePlaceholder label="Ảnh chữ ký" />
              <ImagePlaceholder label="Vân tay" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PatientsTable() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await api.get('/catalogs/patients', { params: searchQ ? { q: searchQ } : {} }); setItems(r.data) } catch {}
    setLoading(false)
  }, [searchQ])
  useEffect(() => { load() }, [load])
  const filtered = items.filter(p => !genderFilter || p.gender === genderFilter)
  const cols = [
    { key: 'patientId', label: 'Mã', cls: 'font-mono text-xs text-blue-600' },
    { key: 'name', label: 'Tên', cls: 'font-medium' },
    { key: 'phone', label: 'SĐT' },
    { key: 'email', label: 'Email' },
    { key: 'dob', label: 'Ngày sinh' },
    { key: 'gender', label: 'Giới tính', fmt: v => v === 'M' ? 'Nam' : v === 'F' ? 'Nữ' : v || '-' },
    { key: 'idCard', label: 'CMND/CCCD' },
    { key: 'insuranceNumber', label: 'Mã BHYT' },
    { key: 'province', label: 'Tỉnh/Thành phố' },
    { key: 'district', label: 'Quận/huyện' },
    { key: 'ward', label: 'Phường/Xã' },
  ]
  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Tìm bệnh nhân (tên, mã, SĐT)..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        <select className="border rounded px-2 py-1.5 text-sm" value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
          <option value="">Giới tính (All)</option><option value="M">Nam</option><option value="F">Nữ</option>
        </select>
      </div>
      <div className="bg-white rounded-lg border overflow-auto">
        <table className="w-full text-sm whitespace-nowrap"><thead><tr className="bg-[#1e3a5f] text-white text-left">
          {cols.map(c => <th key={c.key} className="px-4 py-3">{c.label}</th>)}
        </tr></thead><tbody>
          {loading ? <tr><td colSpan={cols.length} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
          : filtered.length === 0 ? <tr><td colSpan={cols.length} className="px-4 py-8 text-center text-gray-400">Chưa có bệnh nhân</td></tr>
          : filtered.map(p => (
            <tr key={p._id} className="border-t hover:bg-blue-50/50">
              {cols.map(c => <td key={c.key} className={`px-4 py-2.5 text-gray-600 ${c.cls || ''}`}>{c.fmt ? c.fmt(p[c.key]) : (p[c.key] || '-')}</td>)}
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
  const { catalogKey } = useParams()
  const isAdmin = auth?.role === 'admin'
  const activeKey = catalogKey || 'referral-doctors'

  const activeLabel = MENU.flatMap(g => g.items).find(i => i.key === activeKey)?.label || ''

  const renderContent = () => {
    if (activeKey === 'users') return <UsersTable isAdmin={isAdmin} />
    if (activeKey === 'patients') return <PatientsTable />
    if (activeKey === 'promotions') return <PromotionsTable isAdmin={isAdmin} />
    if (activeKey === 'promo-codes') return <PromoCodesTable />
    if (CATALOG_FIELDS[activeKey]) return <CatalogTable catalogKey={activeKey} isAdmin={isAdmin} />
    return <div className="text-gray-400 text-sm p-4">Chọn danh mục từ menu bên trái</div>
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{activeLabel}</h3>
      {renderContent()}
    </div>
  )
}
