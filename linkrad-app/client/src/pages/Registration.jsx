import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

// ─── Constants ───────────────────────────────────────────────────────────────

const GENDERS = { M: 'Nam', F: 'Nữ', other: 'Khác' }
const SUBJECT_TYPES = ['Tự đến', 'Giới thiệu']

const SERVICE_GROUPS = [
  { code: 'CDHA', name: 'Chẩn đoán hình ảnh' },
  { code: 'XN', name: 'Xét nghiệm' },
  { code: 'TDCN', name: 'Thăm dò chức năng' },
  { code: 'KH', name: 'Khác' },
]

const SAMPLE_SERVICES = [
  { code: 'SA020', name: 'Siêu âm ổ bụng', group: 'CDHA', price: 150000 },
  { code: 'SA026', name: 'Siêu âm tuyến giáp', group: 'CDHA', price: 150000 },
  { code: 'SA028', name: 'Siêu âm tuyến vú hai bên', group: 'CDHA', price: 150000 },
  { code: 'CT001', name: 'Chụp CT sọ não', group: 'CDHA', price: 800000 },
  { code: 'CT002', name: 'Chụp CT ngực', group: 'CDHA', price: 900000 },
  { code: 'MRI01', name: 'MRI sọ não', group: 'CDHA', price: 1500000 },
  { code: 'MRI02', name: 'MRI cột sống', group: 'CDHA', price: 1500000 },
  { code: 'XQ001', name: 'X-Quang ngực thẳng', group: 'CDHA', price: 100000 },
]

// Quick address lookup - gõ tắt để fill nhanh đơn vị hành chính
const ADDR_SHORTCUTS = [
  { key: 'xda', ward: 'Xã Đường An', city: 'Thành Phố Hải Phòng' },
  { key: 'ba', ward: 'Phường Ba Đình', city: 'Thành Phố Hà Nội' },
  { key: 'hk', ward: 'Phường Hoàn Kiếm', city: 'Thành Phố Hà Nội' },
  { key: 'cg', ward: 'Phường Cầu Giấy', city: 'Thành Phố Hà Nội' },
  { key: 'tx', ward: 'Phường Thanh Xuân', city: 'Thành Phố Hà Nội' },
  { key: 'bt', ward: 'Quận Bình Thạnh', city: 'Thành Phố Hồ Chí Minh' },
  { key: 'td', ward: 'Quận Thủ Đức', city: 'Thành Phố Hồ Chí Minh' },
  { key: 'q1', ward: 'Quận 1', city: 'Thành Phố Hồ Chí Minh' },
  { key: 'hp', ward: 'Quận Hồng Bàng', city: 'Thành Phố Hải Phòng' },
  { key: 'hd', ward: 'Thành Phố Hải Dương', city: 'Tỉnh Hải Dương' },
]

const STATUS_PAY = {
  paid: { label: 'Đã thu', cls: 'text-green-700' },
  unpaid: { label: 'Chưa thu', cls: 'text-orange-600' },
}

const STATUS_EXEC = {
  pending: 'Chờ',
  done: 'Hoàn thành',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10) }
function nowTime() { return new Date().toISOString().slice(11, 16) }
function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function calcAge(dob) {
  if (!dob) return ''
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}
function fmtMoney(n) {
  if (!n) return '0'
  return n.toLocaleString('vi-VN')
}

// ─── Input Component ─────────────────────────────────────────────────────────

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50'
const selectCls = inputCls

// ─── Patient List Panel (Left) ───────────────────────────────────────────────

function PatientListPanel({ patients, loading, selectedId, onSelect, page, pageSize, onPageChange, onPageSizeChange, total, dateFilter, onDateChange }) {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Trạng thái: Tất cả</span>
          <div className="flex gap-1">
            <button className="p-1 hover:bg-gray-200 rounded text-gray-500" title="Lọc">⏷</button>
            <button className="p-1 hover:bg-gray-200 rounded text-gray-500" title="Refresh">⟳</button>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Ngày: <input type="date" value={dateFilter} onChange={e => onDateChange(e.target.value)}
            className="border rounded px-1.5 py-0.5 text-xs ml-1" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {['STT', 'Mã BN', 'Họ tên', 'Ngày ĐK', 'Giới tính', 'Ngày sinh', 'SĐT'].map(h => (
                <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={7} className="text-center py-4 text-gray-400">Đang tải...</td></tr>
            )}
            {!loading && patients.length === 0 && (
              <tr><td colSpan={7} className="text-center py-4 text-gray-400">Không có dữ liệu</td></tr>
            )}
            {patients.map((p, i) => (
              <tr key={p._id}
                onClick={() => onSelect(p)}
                className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedId === p._id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                <td className="px-2 py-1.5">{page * pageSize + i + 1}</td>
                <td className="px-2 py-1.5 font-mono">
                  <div>{p.patientId}</div>
                  <div className="text-gray-400">{p._id?.slice(-6)}</div>
                </td>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{p.name}</td>
                <td className="px-2 py-1.5">{fmtDate(p.createdAt)}</td>
                <td className="px-2 py-1.5">{p.gender === 'M' ? '♂' : p.gender === 'F' ? '♀' : '—'}</td>
                <td className="px-2 py-1.5">{fmtDate(p.dob)}</td>
                <td className="px-2 py-1.5">{p.phone || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          {[5, 10, 20].map(s => (
            <button key={s} onClick={() => onPageSizeChange(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${pageSize === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>
        <div>
          Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))} ({total} items)
          <button onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0}
            className="ml-2 px-1.5 border rounded disabled:opacity-30">‹</button>
          <button onClick={() => onPageChange(page + 1)} disabled={(page + 1) * pageSize >= total}
            className="ml-1 px-1.5 border rounded disabled:opacity-30">›</button>
        </div>
      </div>
    </div>
  )
}

// ─── Registration Form Panel (Right Top) ─────────────────────────────────────

function RegistrationForm({ patient, onSave, onClear }) {
  const emptyForm = {
    name: '', dob: '', gender: 'M', phone: '', address: '', idCard: '',
    insuranceNumber: '', notes: '', email: '', contact: '',
    subjectType: 'Tự đến', partner: '', clinicalInfo: '',
    city: '', ward: '', street: '', _addrShortcut: '',
  }

  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [regDate] = useState(todayISO())
  const [regTime] = useState(nowTime())

  useEffect(() => {
    if (patient) {
      setForm({
        ...emptyForm,
        ...patient,
        city: patient.city || '',
        ward: patient.ward || '',
        street: patient.street || '',
        contact: patient.contact || '',
        email: patient.email || '',
        subjectType: patient.subjectType || 'Tự đến',
        partner: patient.partner || '',
        clinicalInfo: patient.clinicalInfo || '',
      })
    }
  }, [patient])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErr('') }

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Họ tên là bắt buộc'); return }
    setSaving(true)
    try {
      let saved
      if (patient?._id) {
        saved = await api.put(`/registration/patients/${patient._id}`, form).then(r => r.data)
      } else {
        saved = await api.post('/registration/patients', form).then(r => r.data)
      }
      onSave(saved)
      setErr('')
    } catch (e) {
      setErr(e.response?.data?.error || 'Lỗi lưu')
    }
    setSaving(false)
  }

  const handleClear = () => {
    setForm(emptyForm)
    setErr('')
    onClear()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F1') { e.preventDefault(); handleSave() }
      if (e.key === 'F2') { e.preventDefault(); handleClear() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [form])

  return (
    <div className="bg-white border-b">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b">
        <button onClick={handleClear}
          className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium transition-colors">
          + Bệnh nhân mới
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors">
          {saving ? 'Đang lưu...' : 'Lưu (F1)'}
        </button>
        <button onClick={handleClear}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 font-medium transition-colors">
          Làm mới (F2)
        </button>
        <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 font-medium transition-colors">
          In phiếu hẹn tái chụp
        </button>
      </div>

      {err && <div className="px-4 py-1.5 text-red-600 text-xs bg-red-50">{err}</div>}

      {/* Form */}
      <div className="px-4 py-3 flex gap-4">
        {/* Left column - Patient info */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            {/* Row 1 */}
            <Field label="Đối tượng *">
              <select value={form.subjectType} onChange={e => set('subjectType', e.target.value)} className={selectCls}>
                {SUBJECT_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Đối tác giới thiệu">
              <input value={form.partner} onChange={e => set('partner', e.target.value)} className={inputCls} />
            </Field>
            <div></div>

            {/* Row 2 */}
            <Field label="Ngày đăng ký">
              <input type="date" value={regDate} readOnly className={`${inputCls} bg-gray-50`} />
            </Field>
            <Field label="Giờ thực hiện">
              <input type="time" value={regTime} readOnly className={`${inputCls} bg-gray-50`} />
            </Field>
            <Field label="Mã khách hàng">
              <input value={patient?.patientId || ''} readOnly className={`${inputCls} bg-gray-50 font-mono`} />
            </Field>

            {/* Row 3 */}
            <Field label="Họ và tên *">
              <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Nguyễn Văn A" />
            </Field>
            <Field label="Số điện thoại">
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="09x..." />
            </Field>
            <Field label="Giới tính">
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className={selectCls}>
                <option value="M">Nam</option>
                <option value="F">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </Field>

            {/* Row 4 */}
            <Field label="Ngày sinh *">
              <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Tuổi">
              <input value={calcAge(form.dob)} readOnly className={`${inputCls} bg-gray-50`} />
            </Field>
            <Field label="Căn cước">
              <input value={form.idCard} onChange={e => set('idCard', e.target.value)} className={inputCls} />
            </Field>

            {/* Row 5 */}
            <Field label="Người liên hệ">
              <input value={form.contact} onChange={e => set('contact', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} type="email" />
            </Field>
            <div></div>

            {/* Row 6 - Clinical Info */}
            <Field label="Triệu Chứng/Chẩn Đoán" className="col-span-3">
              <textarea value={form.clinicalInfo} onChange={e => set('clinicalInfo', e.target.value)}
                className={`${inputCls} resize-none`} rows={2} placeholder="KTSK" />
            </Field>
          </div>
        </div>

        {/* Right column - Address box */}
        <div className="w-64 flex-shrink-0 border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-2">
          <Field label="Gõ tắt">
            <input value={form._addrShortcut || ''} onChange={e => {
              const v = e.target.value
              set('_addrShortcut', v)
              // Quick search: match ward/city by keyword
              if (v.length >= 2) {
                const lower = v.toLowerCase()
                // Simple lookup - fill city/ward if keyword matches
                const matched = ADDR_SHORTCUTS.find(a => a.key.includes(lower))
                if (matched) {
                  set('ward', matched.ward)
                  set('city', matched.city)
                }
              }
            }} className={inputCls} placeholder="Nhập để tìm nhanh..." />
          </Field>
          <Field label="Tỉnh thành *">
            <input value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} placeholder="Thành Phố Hải Phòng" />
          </Field>
          <Field label="Xã/Phường">
            <input value={form.ward} onChange={e => set('ward', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Tên đường">
            <input value={form.street} onChange={e => set('street', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Địa chỉ">
            <input value={form.address} onChange={e => set('address', e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>
    </div>
  )
}

// ─── Schedule Tab (Lịch hẹn) ─────────────────────────────────────────────────

function ScheduleTab({ patient }) {
  const [appointmentNo, setAppointmentNo] = useState('')
  const [daysAhead, setDaysAhead] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Auto-calc appointment date from days ahead
  useEffect(() => {
    if (daysAhead && !isNaN(daysAhead) && Number(daysAhead) > 0) {
      const d = new Date()
      d.setDate(d.getDate() + Number(daysAhead))
      const iso = d.toISOString().slice(0, 16)
      setAppointmentDate(iso)
    }
  }, [daysAhead])

  const handleSave = async () => {
    if (!patient?._id) return
    setSaving(true)
    try {
      const res = await api.post('/registration/appointments', {
        patientId: patient._id,
        patientName: patient.name,
        dob: patient.dob,
        gender: patient.gender,
        phone: patient.phone,
        site: patient.registeredSite || '',
        modality: 'US',
        scheduledAt: appointmentDate ? new Date(appointmentDate).toISOString() : new Date().toISOString(),
        notes: note,
      })
      setAppointmentNo(res.data._id?.slice(-8)?.toUpperCase() || 'LH-' + Date.now())
      setSaved(true)
    } catch {}
    setSaving(false)
  }

  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-4">
        <Field label="Số hẹn">
          <input value={appointmentNo} readOnly className={`${inputCls} bg-gray-100`} placeholder="Tự sinh sau khi lưu" />
        </Field>
        <Field label="Số ngày hẹn">
          <input type="number" value={daysAhead} onChange={e => { setDaysAhead(e.target.value); setSaved(false) }}
            className={inputCls} placeholder="Nhập số ngày" min={1} />
        </Field>
        <Field label={<span className="text-blue-600">Ngày hẹn khám</span>}>
          <input type="datetime-local" value={appointmentDate}
            onChange={e => setAppointmentDate(e.target.value)}
            className={inputCls} />
        </Field>
      </div>
      <Field label="Ghi chú">
        <input value={note} onChange={e => setNote(e.target.value)} className={inputCls} />
      </Field>
      <div className="flex items-center gap-3 pt-1">
        <button onClick={handleSave} disabled={saving || !patient}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors">
          {saving ? 'Đang lưu...' : 'Lưu lịch hẹn'}
        </button>
        {saved && <span className="text-green-600 text-sm">✓ Đã lưu</span>}
        {!patient && <span className="text-gray-400 text-xs">Chọn bệnh nhân trước</span>}
      </div>
    </div>
  )
}

// ─── Service Orders Panel (Right Bottom) ─────────────────────────────────────

function ServiceOrdersPanel({ patient }) {
  const [tab, setTab] = useState('orders')
  const [groupFilter, setGroupFilter] = useState('')
  const [orders, setOrders] = useState([])
  const [showAdd, setShowAdd] = useState(false)

  // Load orders for patient (using appointments as proxy)
  useEffect(() => {
    if (!patient?._id) { setOrders([]); return }
    api.get(`/registration/patients/${patient._id}`).then(r => {
      const appts = r.data?.appointments || []
      setOrders(appts.map((a, i) => ({
        _id: a._id,
        stt: i + 1,
        code: `SA0${20 + i}`,
        name: `${a.modality} - ${a.clinicalInfo || a.room || 'Khám'}`,
        price: 150000,
        qty: 1,
        note: a.notes || '',
        payStatus: a.status === 'completed' ? 'paid' : 'unpaid',
        execStatus: a.status === 'completed' ? 'done' : 'pending',
      })))
    }).catch(() => {})
  }, [patient])

  const total = orders.reduce((s, o) => s + o.price * o.qty, 0)

  const addService = (svc) => {
    setOrders(prev => [...prev, {
      _id: `tmp-${Date.now()}`,
      stt: prev.length + 1,
      code: svc.code,
      name: svc.name,
      price: svc.price,
      qty: 1,
      note: '',
      payStatus: 'unpaid',
      execStatus: 'pending',
    }])
    setShowAdd(false)
  }

  const filteredServices = groupFilter
    ? SAMPLE_SERVICES.filter(s => s.group === groupFilter)
    : SAMPLE_SERVICES

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Tabs */}
      <div className="flex items-center border-b px-4">
        <button onClick={() => setTab('orders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'orders' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          CHỈ ĐỊNH
        </button>
        <button onClick={() => setTab('schedule')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          LỊCH HẸN
        </button>
      </div>

      {tab === 'orders' && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b bg-gray-50">
            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
              <option value="">Nhóm dịch vụ</option>
              {SERVICE_GROUPS.map(g => <option key={g.code} value={g.code}>{g.name}</option>)}
            </select>
            <div className="ml-auto flex gap-2">
              <button className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 font-medium transition-colors">In chỉ định (Ctrl+P)</button>
              <button onClick={() => setShowAdd(true)}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium transition-colors">
                + Thêm
              </button>
            </div>
          </div>

          {/* Orders table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {['STT', 'Mã dịch vụ', 'Tên dịch vụ', 'Đơn giá', 'SL', 'Thành tiền', 'Ghi chú', 'Trạng thái TT', 'Thực hiện', 'Kết quả'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-4 text-gray-300 text-xs">—</td></tr>
                )}
                {orders.map((o, i) => (
                  <tr key={o._id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono">{o.code}</td>
                    <td className="px-3 py-1.5">{o.name}</td>
                    <td className="px-3 py-1.5 text-right">{fmtMoney(o.price)}</td>
                    <td className="px-3 py-1.5 text-center">{o.qty}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{fmtMoney(o.price * o.qty)}</td>
                    <td className="px-3 py-1.5 text-gray-500">{o.note}</td>
                    <td className={`px-3 py-1.5 ${STATUS_PAY[o.payStatus]?.cls || ''}`}>
                      {STATUS_PAY[o.payStatus]?.label || o.payStatus}
                    </td>
                    <td className="px-3 py-1.5">{STATUS_EXEC[o.execStatus] || o.execStatus}</td>
                    <td className="px-3 py-1.5">
                      {o.execStatus === 'done' && <span className="text-blue-600 cursor-pointer">👁</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-gray-600">Tổng cộng:</td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-800">{fmtMoney(total)} đ</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {tab === 'schedule' && (
        <ScheduleTab patient={patient} />
      )}

      {/* Add Service Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Thêm dịch vụ</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
            </div>
            <div className="p-4">
              <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="border rounded px-3 py-1.5 text-sm mb-3 w-full">
                <option value="">Tất cả nhóm</option>
                {SERVICE_GROUPS.map(g => <option key={g.code} value={g.code}>{g.name}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-auto px-4 pb-4">
              <div className="space-y-1">
                {filteredServices.map(svc => (
                  <button key={svc.code} onClick={() => addService(svc)}
                    className="w-full text-left flex items-center justify-between px-3 py-2 rounded hover:bg-blue-50 border text-sm">
                    <div>
                      <span className="font-mono text-xs text-gray-400 mr-2">{svc.code}</span>
                      <span>{svc.name}</span>
                    </div>
                    <span className="text-gray-600">{fmtMoney(svc.price)} đ</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Registration() {
  const { auth } = useAuth()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [dateFilter, setDateFilter] = useState(todayISO())

  const loadPatients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/registration/patients?q=&limit=${pageSize}&skip=${page * pageSize}`)
      const data = res.data || []
      setPatients(data)
      setTotal(data.length < pageSize ? page * pageSize + data.length : (page + 1) * pageSize + 1)
    } catch {}
    setLoading(false)
  }, [page, pageSize])

  useEffect(() => { loadPatients() }, [loadPatients])

  const handleSave = (saved) => {
    setSelectedPatient(saved)
    loadPatients()
  }

  const handleClear = () => {
    setSelectedPatient(null)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mt-4">
      {/* Left Panel - Patient List */}
      <div className="w-[520px] min-w-[480px] flex-shrink-0 p-2">
        <PatientListPanel
          patients={patients}
          loading={loading}
          selectedId={selectedPatient?._id}
          onSelect={setSelectedPatient}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0) }}
          total={total}
          dateFilter={dateFilter}
          onDateChange={setDateFilter}
        />
      </div>

      {/* Right Panel - Form + Orders */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top - Registration Form */}
        <RegistrationForm
          patient={selectedPatient}
          onSave={handleSave}
          onClear={handleClear}
        />

        {/* Bottom - Service Orders */}
        <ServiceOrdersPanel patient={selectedPatient} />
      </div>
    </div>
  )
}
