import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

// ─── Constants ───────────────────────────────────────────────────────────────

const MODALITIES = ['CT', 'MRI', 'XR', 'US']
const GENDERS = { M: 'Nam', F: 'Nữ', other: 'Khác' }

const STATUS_CONFIG = {
  scheduled:   { label: 'Đã đặt',      cls: 'bg-blue-100 text-blue-700' },
  confirmed:   { label: 'Xác nhận',    cls: 'bg-indigo-100 text-indigo-700' },
  arrived:     { label: 'Đến nơi',     cls: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'Đang chụp',   cls: 'bg-orange-100 text-orange-700' },
  completed:   { label: 'Hoàn thành',  cls: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Hủy',         cls: 'bg-red-100 text-red-700' },
  no_show:     { label: 'Không đến',   cls: 'bg-gray-100 text-gray-500' },
}

const STATUS_FLOW = {
  scheduled:   ['confirmed', 'cancelled', 'no_show'],
  confirmed:   ['arrived', 'cancelled', 'no_show'],
  arrived:     ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed:   [],
  cancelled:   [],
  no_show:     [],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function fmtTime(iso) {
  if (!iso) return '—'
  return iso.slice(11, 16)
}

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'bg-gray-100 text-gray-500' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

// ─── PatientForm modal ───────────────────────────────────────────────────────

function PatientForm({ patient, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', dob: '', gender: 'M', phone: '', address: '',
    idCard: '', insuranceNumber: '', notes: '',
    ...(patient || {}),
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Họ tên là bắt buộc'); return }
    setSaving(true)
    try {
      let saved
      if (patient?._id) {
        saved = await api.put(`/his/patients/${patient._id}`, form).then(r => r.data)
      } else {
        saved = await api.post('/his/patients', form).then(r => r.data)
      }
      onSave(saved)
    } catch (e) {
      setErr(e.response?.data?.error || 'Lỗi lưu')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{patient ? 'Cập nhật bệnh nhân' : 'Đăng ký bệnh nhân mới'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {err && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{err}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Họ và tên *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ngày sinh</label>
              <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Giới tính</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="M">Nam</option>
                <option value="F">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Số điện thoại</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="09x..." />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">CMND/CCCD</label>
              <input value={form.idCard} onChange={e => set('idCard', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Địa chỉ</label>
              <input value={form.address} onChange={e => set('address', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Số BHYT</label>
              <input value={form.insuranceNumber} onChange={e => set('insuranceNumber', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
              <input value={form.notes} onChange={e => set('notes', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── AppointmentForm modal ────────────────────────────────────────────────────

function AppointmentForm({ appt, sites, onSave, onClose }) {
  const { auth } = useAuth()
  const defaultSite = auth.role === 'nhanvien' || auth.role === 'truongphong' ? auth.department : ''

  const [patientQuery, setPatientQuery] = useState(appt?.patientName || '')
  const [patientResults, setPatientResults] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)

  const [form, setForm] = useState({
    patientId: appt?.patientId || '',
    patientName: appt?.patientName || '',
    dob: appt?.dob || '',
    gender: appt?.gender || 'M',
    phone: appt?.phone || '',
    site: appt?.site || defaultSite || (sites[0] || ''),
    modality: appt?.modality || 'CT',
    room: appt?.room || '',
    scheduledAt: appt?.scheduledAt ? appt.scheduledAt.slice(0, 16) : `${todayISO()}T08:00`,
    duration: appt?.duration || 30,
    referringDoctor: appt?.referringDoctor || '',
    clinicalInfo: appt?.clinicalInfo || '',
    notes: appt?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Patient search
  useEffect(() => {
    if (patientQuery.length < 2) { setPatientResults([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/his/patients?q=${encodeURIComponent(patientQuery)}&limit=8`)
        setPatientResults(res.data)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [patientQuery])

  const selectPatient = (p) => {
    setSelectedPatient(p)
    setPatientQuery(p.name)
    setPatientResults([])
    setForm(f => ({ ...f, patientId: p._id, patientName: p.name, dob: p.dob || '', gender: p.gender || 'M', phone: p.phone || '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patientName.trim()) { setErr('Cần chọn hoặc nhập tên bệnh nhân'); return }
    if (!form.site) { setErr('Vui lòng chọn site'); return }
    setSaving(true)
    try {
      let saved
      if (appt?._id) {
        saved = await api.put(`/his/appointments/${appt._id}`, form).then(r => r.data)
      } else {
        saved = await api.post('/his/appointments', { ...form, scheduledAt: new Date(form.scheduledAt).toISOString() }).then(r => r.data)
      }
      onSave(saved)
    } catch (e) {
      setErr(e.response?.data?.error || 'Lỗi lưu')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{appt ? 'Chỉnh sửa lịch hẹn' : 'Đặt lịch hẹn mới'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{err}</div>}

          {/* Patient search */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Bệnh nhân *</label>
            <div className="relative">
              <input
                value={patientQuery}
                onChange={e => { setPatientQuery(e.target.value); set('patientName', e.target.value); setSelectedPatient(null) }}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Tìm theo tên, SĐT hoặc nhập tên mới..."
              />
              {patientResults.length > 0 && (
                <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {patientResults.map(p => (
                    <button key={p._id} type="button" onClick={() => selectPatient(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between">
                      <span>{p.name}</span>
                      <span className="text-gray-400">{p.phone} · {p._id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedPatient && (
              <div className="mt-1 text-xs text-green-600">✓ Bệnh nhân: {selectedPatient._id} · {fmtDate(selectedPatient.dob)} · {GENDERS[selectedPatient.gender]}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!selectedPatient && (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ngày sinh</label>
                  <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Giới tính</label>
                  <select value={form.gender} onChange={e => set('gender', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="M">Nam</option>
                    <option value="F">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">SĐT</label>
                  <input value={form.phone} onChange={e => set('phone', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="09x..." />
                </div>
              </>
            )}

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Site *</label>
              <select value={form.site} onChange={e => set('site', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                disabled={auth.role === 'nhanvien' || auth.role === 'truongphong'}>
                {sites.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Modality *</label>
              <select value={form.modality} onChange={e => set('modality', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phòng / Máy</label>
              <input value={form.room} onChange={e => set('room', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Phòng CT 1" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Thời lượng (phút)</label>
              <input type="number" value={form.duration} onChange={e => set('duration', Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm" min={10} max={120} step={5} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Ngày giờ hẹn *</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Bác sĩ chỉ định</label>
              <input value={form.referringDoctor} onChange={e => set('referringDoctor', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="BS. Nguyễn Văn A" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Chỉ định lâm sàng</label>
              <textarea value={form.clinicalInfo} onChange={e => set('clinicalInfo', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : appt ? 'Cập nhật' : 'Đặt lịch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Patient Profile modal ────────────────────────────────────────────────────

function PatientProfile({ patientId, onEdit, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/his/patients/${patientId}`).then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [patientId])

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 text-gray-500">Đang tải...</div>
    </div>
  )
  if (!data) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{data.name}</h2>
          <div className="flex gap-2">
            <button onClick={() => onEdit(data)} className="text-xs text-blue-600 hover:underline">Chỉnh sửa</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2">✕</button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-400">Mã BN:</span> <span className="font-medium">{data.patientId}</span></div>
            <div><span className="text-gray-400">Giới:</span> {GENDERS[data.gender]}</div>
            <div><span className="text-gray-400">Ngày sinh:</span> {fmtDate(data.dob)}</div>
            <div><span className="text-gray-400">SĐT:</span> {data.phone || '—'}</div>
            <div className="col-span-2"><span className="text-gray-400">Địa chỉ:</span> {data.address || '—'}</div>
            <div><span className="text-gray-400">CCCD:</span> {data.idCard || '—'}</div>
            <div><span className="text-gray-400">BHYT:</span> {data.insuranceNumber || '—'}</div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Lịch sử khám ({data.appointments?.length || 0})</div>
            {data.appointments?.length === 0 && <div className="text-sm text-gray-400">Chưa có lịch hẹn</div>}
            <div className="space-y-2">
              {data.appointments?.map(a => (
                <div key={a._id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium">{a.modality}</span>
                    <span className="text-gray-400 ml-2">{fmtDateTime(a.scheduledAt)}</span>
                    <span className="text-gray-400 ml-2">· {a.site}</span>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Appointments Tab ─────────────────────────────────────────────────────────

function AppointmentsTab({ sites }) {
  const { auth } = useAuth()
  const [date, setDate] = useState(todayISO())
  const [siteFilter, setSiteFilter] = useState('')
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editAppt, setEditAppt] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ date })
      if (siteFilter) params.set('site', siteFilter)
      const res = await api.get(`/his/appointments?${params}`)
      setAppointments(res.data)
    } catch {}
    setLoading(false)
  }, [date, siteFilter])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id, status) => {
    try {
      const updated = await api.put(`/his/appointments/${id}`, { status }).then(r => r.data)
      setAppointments(prev => prev.map(a => a._id === id ? updated : a))
    } catch {}
  }

  const canEdit = auth.role !== 'giamdoc'

  // Group by modality
  const byModality = MODALITIES.reduce((acc, m) => {
    acc[m] = appointments.filter(a => a.modality === m)
    return acc
  }, {})

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(date); d.setDate(d.getDate()-1); setDate(d.toISOString().slice(0,10)) }}
            className="px-2 py-1 border rounded hover:bg-gray-50 text-sm">‹</button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" />
          <button onClick={() => { const d = new Date(date); d.setDate(d.getDate()+1); setDate(d.toISOString().slice(0,10)) }}
            className="px-2 py-1 border rounded hover:bg-gray-50 text-sm">›</button>
          <button onClick={() => setDate(todayISO())}
            className="px-2 py-1 text-xs border rounded hover:bg-gray-50 text-blue-600">Hôm nay</button>
        </div>

        {(auth.role === 'admin' || auth.role === 'giamdoc') && (
          <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm">
            <option value="">Tất cả site</option>
            {sites.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        <div className="ml-auto">
          {canEdit && (
            <button onClick={() => { setEditAppt(null); setShowForm(true) }}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              + Đặt lịch
            </button>
          )}
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-400">Đang tải...</div>}

      {!loading && appointments.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-3xl mb-2">📅</div>
          <div>Không có lịch hẹn nào ngày {fmtDate(date)}</div>
        </div>
      )}

      {!loading && appointments.length > 0 && (
        <div className="space-y-4">
          {MODALITIES.map(m => {
            const appts = byModality[m]
            if (appts.length === 0) return null
            return (
              <div key={m}>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
                  <span className="bg-gray-100 px-2 py-0.5 rounded">{m}</span>
                  <span className="text-gray-300">{appts.length} ca</span>
                </div>
                <div className="bg-white rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2 w-16">Giờ</th>
                        <th className="text-left px-3 py-2">Bệnh nhân</th>
                        <th className="text-left px-3 py-2 hidden md:table-cell">Site</th>
                        <th className="text-left px-3 py-2 hidden md:table-cell">Phòng</th>
                        <th className="text-left px-3 py-2 hidden lg:table-cell">BS chỉ định</th>
                        <th className="text-left px-3 py-2">Trạng thái</th>
                        {canEdit && <th className="text-left px-3 py-2">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {appts.map(a => (
                        <tr key={a._id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-blue-700 font-medium">{fmtTime(a.scheduledAt)}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{a.patientName}</div>
                            {a.phone && <div className="text-xs text-gray-400">{a.phone}</div>}
                          </td>
                          <td className="px-3 py-2 hidden md:table-cell text-gray-500">{a.site}</td>
                          <td className="px-3 py-2 hidden md:table-cell text-gray-500">{a.room || '—'}</td>
                          <td className="px-3 py-2 hidden lg:table-cell text-gray-500">{a.referringDoctor || '—'}</td>
                          <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                          {canEdit && (
                            <td className="px-3 py-2">
                              <div className="flex gap-1 flex-wrap">
                                {STATUS_FLOW[a.status]?.map(next => (
                                  <button key={next} onClick={() => updateStatus(a._id, next)}
                                    className="text-xs px-2 py-0.5 border rounded hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 whitespace-nowrap">
                                    {STATUS_CONFIG[next]?.label}
                                  </button>
                                ))}
                                <button onClick={() => { setEditAppt(a); setShowForm(true) }}
                                  className="text-xs px-2 py-0.5 border rounded hover:bg-gray-100">✎</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <AppointmentForm
          appt={editAppt}
          sites={sites}
          onSave={(saved) => { setShowForm(false); setEditAppt(null); load() }}
          onClose={() => { setShowForm(false); setEditAppt(null) }}
        />
      )}
    </div>
  )
}

// ─── Patients Tab ─────────────────────────────────────────────────────────────

function PatientsTab() {
  const [q, setQ] = useState('')
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editPatient, setEditPatient] = useState(null)
  const [profileId, setProfileId] = useState(null)

  const search = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/his/patients?q=${encodeURIComponent(q)}&limit=30`)
      setPatients(res.data)
    } catch {}
    setLoading(false)
  }, [q])

  // Load on mount and debounced on q change
  useEffect(() => {
    if (q.length === 0 || q.length >= 2) {
      const t = setTimeout(search, q.length === 0 ? 0 : 300)
      return () => clearTimeout(t)
    }
  }, [q, search])

  const handleSavePatient = (saved) => {
    setShowForm(false)
    setEditPatient(null)
    search()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Tìm theo tên, SĐT, mã BN, CCCD..."
          className="border rounded-lg px-3 py-2 text-sm flex-1 max-w-sm"
        />
        <button onClick={search} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">🔍</button>
        <button onClick={() => { setEditPatient(null); setShowForm(true) }}
          className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + Đăng ký mới
        </button>
      </div>

      {loading && <div className="text-center py-8 text-gray-400">Đang tìm kiếm...</div>}

      {!loading && patients.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-3xl mb-2">🔍</div>
          <div>Nhập tên, SĐT hoặc mã bệnh nhân để tìm kiếm</div>
        </div>
      )}

      {!loading && patients.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Mã BN</th>
                <th className="text-left px-4 py-2">Họ tên</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Ngày sinh</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Giới</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">SĐT</th>
                <th className="text-left px-4 py-2 hidden lg:table-cell">Site đăng ký</th>
                <th className="text-left px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {patients.map(p => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.patientId}</td>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 hidden md:table-cell text-gray-500">{fmtDate(p.dob)}</td>
                  <td className="px-4 py-2 hidden md:table-cell text-gray-500">{GENDERS[p.gender] || '—'}</td>
                  <td className="px-4 py-2 hidden md:table-cell text-gray-500">{p.phone || '—'}</td>
                  <td className="px-4 py-2 hidden lg:table-cell text-gray-500">{p.registeredSite || '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => setProfileId(p._id)}
                        className="text-xs text-blue-600 hover:underline">Xem</button>
                      <button onClick={() => { setEditPatient(p); setShowForm(true) }}
                        className="text-xs text-gray-500 hover:underline">Sửa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <PatientForm
          patient={editPatient}
          onSave={handleSavePatient}
          onClose={() => { setShowForm(false); setEditPatient(null) }}
        />
      )}

      {profileId && (
        <PatientProfile
          patientId={profileId}
          onEdit={(p) => { setProfileId(null); setEditPatient(p); setShowForm(true) }}
          onClose={() => setProfileId(null)}
        />
      )}
    </div>
  )
}

// ─── Main HIS Page ────────────────────────────────────────────────────────────

export default function HIS() {
  const [tab, setTab] = useState('appointments')
  const [sites, setSites] = useState([])

  useEffect(() => {
    // Load site list from RIS sites or HIS appointments
    api.get('/sites').then(r => {
      const siteNames = (r.data || []).map(s => s.name || s).filter(Boolean)
      setSites(siteNames)
    }).catch(() => {})
  }, [])

  const tabs = [
    { key: 'appointments', label: '📅 Lịch hẹn' },
    { key: 'patients',     label: '👤 Bệnh nhân' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">HIS — Hệ thống thông tin bệnh viện</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'appointments' && <AppointmentsTab sites={sites} />}
        {tab === 'patients' && <PatientsTab />}
      </div>
    </div>
  )
}
