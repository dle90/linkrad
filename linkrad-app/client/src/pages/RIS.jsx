import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

// ─── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <div className="font-bold mb-2">Lỗi RIS:</div>
          <pre className="text-xs whitespace-pre-wrap">{String(this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

const fmtTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const todayStr = () => {
  const d = new Date()
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

const isToday = (iso) => {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
}

const isThisWeek = (iso) => {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  return d >= startOfWeek && d <= endOfWeek
}

// ─── Shared Badge Components ───────────────────────────────────────────────────

function StatusBadge({ status }) {
  const CONFIG = {
    scheduled:    { label: 'Đã lên lịch', cls: 'bg-gray-100 text-gray-600' },
    in_progress:  { label: 'Đang chụp',   cls: 'bg-blue-100 text-blue-700' },
    pending_read: { label: 'Chờ đọc',     cls: 'bg-yellow-100 text-yellow-700' },
    reading:      { label: 'Đang đọc',    cls: 'bg-orange-100 text-orange-700' },
    reported:     { label: 'Có kết quả',  cls: 'bg-green-100 text-green-700' },
    verified:     { label: 'Đã xác nhận', cls: 'bg-emerald-100 text-emerald-800' },
  }
  const c = CONFIG[status] || { label: status, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${c.cls}`}>
      {c.label}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const CONFIG = {
    routine: { label: 'Thường',   cls: 'bg-gray-100 text-gray-600' },
    urgent:  { label: 'Khẩn',    cls: 'bg-orange-100 text-orange-700' },
    stat:    { label: 'Cấp cứu', cls: 'bg-red-100 text-red-700' },
  }
  const c = CONFIG[priority] || { label: priority, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${c.cls}`}>
      {c.label}
    </span>
  )
}

function ModalityBadge({ modality }) {
  const CONFIG = {
    CT:  'bg-blue-100 text-blue-700',
    MRI: 'bg-purple-100 text-purple-700',
    XR:  'bg-gray-100 text-gray-600',
    US:  'bg-teal-100 text-teal-700',
  }
  const cls = CONFIG[modality] || 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-semibold ${cls}`}>
      {modality}
    </span>
  )
}

function ImageStatusBadge({ imageStatus, imageCount, studyUID }) {
  const CONFIG = {
    no_images:  { label: 'Chưa có ảnh', cls: 'bg-gray-100 text-gray-400' },
    receiving:  { label: 'Đang nhận…',  cls: 'bg-blue-100 text-blue-600 animate-pulse' },
    available:  { label: 'Có ảnh DICOM', cls: 'bg-emerald-100 text-emerald-700' },
  }
  const c = CONFIG[imageStatus] || CONFIG.no_images
  const [opening, setOpening] = React.useState(false)

  const openViewer = async (e) => {
    e.preventDefault()
    setOpening(true)
    try {
      const res = await api.get(`/ris/orthanc/viewer-url/${encodeURIComponent(studyUID)}`)
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${c.cls}`}>
        {c.label}{imageCount > 0 ? ` (${imageCount})` : ''}
      </span>
      {imageStatus === 'available' && (
        <button
          onClick={openViewer}
          disabled={opening}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
        >
          {opening ? '...' : 'Xem ảnh'}
        </button>
      )}
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, colorBar, sub }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className={`h-1 ${colorBar}`} />
      <div className="px-4 py-3">
        <div className="text-xs text-gray-500 font-medium">{label}</div>
        <div className="text-2xl font-bold text-gray-800 mt-1">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ─── ReportEditor Modal ────────────────────────────────────────────────────────

function ReportEditor({ study, onClose, onSaved }) {
  const [form, setForm] = useState({ technique: '', clinicalInfo: '', findings: '', impression: '', recommendation: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get(`/ris/reports/${study._id}`)
      .then(r => setForm({
        technique: r.data.technique || '',
        clinicalInfo: r.data.clinicalInfo || study.clinicalInfo || '',
        findings: r.data.findings || '',
        impression: r.data.impression || '',
        recommendation: r.data.recommendation || '',
      }))
      .catch(() => setForm(f => ({ ...f, clinicalInfo: study.clinicalInfo || '' })))
      .finally(() => setLoading(false))
  }, [study._id])

  const save = async (status) => {
    setSaving(true)
    try {
      await api.post('/ris/reports', { studyId: study._id, studyUID: study.studyUID, ...form, status })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const Field = ({ label, name, rows = 3 }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <textarea
        rows={rows}
        value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-y"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800">Kết quả đọc phim</h2>
            <p className="text-xs text-gray-400 mt-0.5">{study.patientName} · {study.modality} · {study.bodyPart || '—'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Đang tải...</div>
          ) : (
            <>
              <Field label="Kỹ thuật chụp" name="technique" rows={2} />
              <Field label="Thông tin lâm sàng" name="clinicalInfo" rows={2} />
              <Field label="Mô tả hình ảnh (Findings)" name="findings" rows={5} />
              <Field label="Kết luận (Impression)" name="impression" rows={3} />
              <Field label="Đề nghị (Recommendation)" name="recommendation" rows={2} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => save('final')}
            disabled={saving || !form.findings.trim() || !form.impression.trim()}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
          >
            {saving ? 'Đang lưu...' : 'Hoàn thành & Ký'}
          </button>
          <button
            onClick={() => save('preliminary')}
            disabled={saving}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm rounded-lg font-medium transition-colors"
          >
            Lưu tạm
          </button>
          <button onClick={onClose} className="ml-auto px-4 py-2 text-gray-400 hover:text-gray-600 text-sm">Hủy</button>
        </div>
      </div>
    </div>
  )
}

// ─── AssignModal ───────────────────────────────────────────────────────────────

function AssignModal({ study, onClose, onAssigned }) {
  const [radiologists, setRadiologists] = useState([])
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/ris/radiologists').then(r => {
      setRadiologists(r.data)
      if (study.radiologist) setSelected(study.radiologist)
    }).catch(() => {})
  }, [])

  const assign = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const rad = radiologists.find(r => r.username === selected)
      await api.post(`/ris/studies/${study._id}/assign`, {
        radiologistId: selected,
        radiologistName: rad?.displayName || selected,
      })
      onAssigned()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">Phân công bác sĩ</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="text-sm text-gray-600">
            Ca chụp: <span className="font-medium">{study.patientName}</span> · {study.modality}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Chọn bác sĩ đọc phim</label>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">— Chọn bác sĩ —</option>
              {radiologists.map(r => (
                <option key={r.username} value={r.username}>
                  {r.displayName} {r.department ? `(${r.department})` : ''}
                </option>
              ))}
            </select>
            {radiologists.length === 0 && (
              <p className="text-xs text-red-400 mt-1">Chưa có tài khoản bác sĩ nào. Vui lòng tạo tài khoản với role "bacsi".</p>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={assign}
            disabled={saving || !selected}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
          >
            {saving ? 'Đang lưu...' : 'Phân công'}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg font-medium transition-colors">Hủy</button>
        </div>
      </div>
    </div>
  )
}

// ─── BacsiView ─────────────────────────────────────────────────────────────────

function BacsiView({ studies, auth, onRefresh }) {
  const [tab, setTab] = useState('pending')
  const [reportStudy, setReportStudy] = useState(null)

  const pending   = studies.filter(s => s.status === 'pending_read' || s.status === 'reading')
  const completed = studies.filter(s => s.status === 'reported' || s.status === 'verified')
  const list      = tab === 'pending' ? pending : completed

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Danh sách ca đọc phim</h2>
          <p className="text-xs text-gray-400 mt-0.5">BS. {auth.displayName || auth.username}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">{pending.length} ca chờ đọc</span>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">{completed.length} hoàn thành</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ key: 'pending', label: 'Chờ đọc' }, { key: 'done', label: 'Đã hoàn thành' }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-teal-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Bệnh nhân', 'Loại chụp', 'Bộ phận', 'Ưu tiên', 'Trạng thái', 'Ảnh PACS', 'Ngày phân công', 'Thao tác'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">Không có ca nào</td></tr>
              ) : list.map((s, i) => (
                <tr key={s._id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{s.patientName || '—'}</div>
                    <div className="text-xs text-gray-400">{s.patientId}</div>
                  </td>
                  <td className="px-4 py-3"><ModalityBadge modality={s.modality} /></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.bodyPart || '—'}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={s.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    <ImageStatusBadge imageStatus={s.imageStatus} imageCount={s.imageCount} studyUID={s.studyUID} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(s.assignedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setReportStudy(s)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                        tab === 'pending'
                          ? 'bg-teal-600 hover:bg-teal-700 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }`}
                    >
                      {tab === 'pending' ? 'Đọc phim' : 'Xem kết quả'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {reportStudy && (
        <ReportEditor
          study={reportStudy}
          onClose={() => setReportStudy(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  )
}

// ─── NhanVienView ──────────────────────────────────────────────────────────────

function NhanVienView({ studies, updateStudy, auth }) {
  const [period, setPeriod] = useState('today')
  const [updating, setUpdating] = useState(null)

  const site = auth.department || 'Chi nhánh'

  const filtered = studies.filter(s => {
    const appt = s.appointmentTime || s.createdAt
    if (period === 'today') return isToday(appt)
    if (period === 'week') return isThisWeek(appt)
    return true
  })

  const handleAction = async (study) => {
    const nextStatus = study.status === 'scheduled' ? 'in_progress' : 'pending_read'
    setUpdating(study._id)
    try {
      await updateStudy(study._id, { status: nextStatus })
    } finally {
      setUpdating(null)
    }
  }

  const TABS = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'week',  label: 'Tuần này' },
    { key: 'all',   label: 'Tất cả' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Danh sách ca chụp — {site}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Ngày {todayStr()}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          {filtered.length} ca
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-5 py-3">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setPeriod(t.key)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                period === t.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['STT', 'Bệnh nhân', 'Loại chụp', 'Bộ phận', 'Ưu tiên', 'Trạng thái', 'Ảnh PACS', 'Giờ hẹn', 'Thao tác'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Không có ca chụp nào
                  </td>
                </tr>
              ) : filtered.map((s, i) => (
                <tr key={s._id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                  <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{s.patientName || '—'}</div>
                    <div className="text-xs text-gray-400">{s.patientId || ''}</div>
                  </td>
                  <td className="px-4 py-3"><ModalityBadge modality={s.modality} /></td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.bodyPart || '—'}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={s.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    <ImageStatusBadge imageStatus={s.imageStatus} imageCount={s.imageCount} studyUID={s.studyUID} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{fmtTime(s.appointmentTime)}</td>
                  <td className="px-4 py-3">
                    {(s.status === 'scheduled' || s.status === 'in_progress') ? (
                      <button
                        onClick={() => handleAction(s)}
                        disabled={updating === s._id}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                          s.status === 'scheduled'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        } disabled:opacity-50`}
                      >
                        {updating === s._id ? '...' : s.status === 'scheduled' ? 'Bắt đầu' : 'Hoàn thành'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── TruongPhongView ───────────────────────────────────────────────────────────

function TruongPhongView({ studies, stats, updateStudy, onRefresh }) {
  const [modalityFilter, setModalityFilter] = useState('all')
  const [reportPanel, setReportPanel] = useState(null) // study._id
  const [reportText, setReportText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [assignStudy, setAssignStudy] = useState(null)

  const MODALITIES = ['Tất cả', 'CT', 'MRI', 'XR', 'US']

  const todayStudies  = studies.filter(s => isToday(s.appointmentTime || s.createdAt))
  const pendingRead   = studies.filter(s => s.status === 'pending_read')
  const reported      = studies.filter(s => s.status === 'reported' || s.status === 'verified')

  const filtered = studies.filter(s =>
    modalityFilter === 'all' || s.modality === modalityFilter
  )

  const openReport = (study) => {
    setReportPanel(study._id)
    setReportText(study.reportText || '')
  }

  const submitReport = async (study) => {
    if (!reportText.trim()) return
    setSubmitting(true)
    try {
      await updateStudy(study._id, { status: 'reported', reportText: reportText.trim() })
      setReportPanel(null)
      setReportText('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Hôm nay"      value={todayStudies.length} colorBar="bg-blue-500"   sub="ca chụp" />
        <StatCard label="Chờ đọc"      value={pendingRead.length}  colorBar="bg-yellow-400" sub="cần đọc kết quả" />
        <StatCard label="Có kết quả"   value={reported.length}     colorBar="bg-green-500"  sub="đã báo cáo" />
        <StatCard label="Tổng tháng"   value={studies.length}      colorBar="bg-purple-500" sub="tất cả ca" />
      </div>

      {/* Modality filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-semibold mr-1">Loại chụp:</span>
          {MODALITIES.map(m => {
            const key = m === 'Tất cả' ? 'all' : m
            return (
              <button
                key={key}
                onClick={() => setModalityFilter(key)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  modalityFilter === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m}
              </button>
            )
          })}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} ca</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Danh sách ca chụp</h3>
          <span className="text-xs text-gray-400">{fmtDate(new Date().toISOString())}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Bệnh nhân', 'Loại chụp', 'Ưu tiên', 'Trạng thái', 'Ảnh PACS', 'Bác sĩ', 'Thao tác'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Không có ca nào
                  </td>
                </tr>
              ) : filtered.map((s, i) => (
                <tr key={s._id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{s.patientName || '—'}</div>
                    <div className="text-xs text-gray-400">{s.patientId || ''}</div>
                  </td>
                  <td className="px-4 py-3"><ModalityBadge modality={s.modality} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={s.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    <ImageStatusBadge imageStatus={s.imageStatus} imageCount={s.imageCount} studyUID={s.studyUID} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {s.radiologistName || <span className="text-gray-300">Chưa phân công</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {s.status === 'pending_read' || !s.radiologist ? (
                        <button
                          onClick={() => setAssignStudy(s)}
                          className="px-2 py-1 rounded text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors whitespace-nowrap"
                        >
                          Phân công
                        </button>
                      ) : null}
                      {(s.status === 'reported' || s.status === 'reading') && (
                        <button
                          onClick={() => { setReportPanel(s._id); setReportText(s.reportText || '') }}
                          className="px-2 py-1 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors whitespace-nowrap"
                        >
                          Xem KQ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {assignStudy && (
        <AssignModal
          study={assignStudy}
          onClose={() => setAssignStudy(null)}
          onAssigned={() => { onRefresh(); setAssignStudy(null) }}
        />
      )}
    </div>
  )
}

// ─── GiamDocView ───────────────────────────────────────────────────────────────

function GiamDocView({ studies, stats }) {
  const todayStudies  = studies.filter(s => isToday(s.appointmentTime || s.createdAt))
  const pendingRead   = studies.filter(s => s.status === 'pending_read')
  const verified      = studies.filter(s => s.status === 'verified')

  // Modality breakdown
  const modCounts = ['CT', 'MRI', 'XR', 'US'].map(m => ({
    modality: m,
    count: studies.filter(s => s.modality === m).length,
  }))

  const MODALITY_STYLE = {
    CT:  { bar: 'bg-blue-500',   icon: '🔵', label: 'CT Scan' },
    MRI: { bar: 'bg-purple-500', icon: '🟣', label: 'MRI' },
    XR:  { bar: 'bg-gray-400',   icon: '⚪', label: 'X-Ray' },
    US:  { bar: 'bg-teal-500',   icon: '🟦', label: 'Siêu âm' },
  }

  // Site performance
  const siteMap = {}
  studies.forEach(s => {
    const site = s.site || 'Chưa phân'
    if (!siteMap[site]) siteMap[site] = { total: 0, today: 0, pendingRead: 0, done: 0 }
    siteMap[site].total++
    if (isToday(s.appointmentTime || s.createdAt)) siteMap[site].today++
    if (s.status === 'pending_read') siteMap[site].pendingRead++
    if (s.status === 'reported' || s.status === 'verified') siteMap[site].done++
  })
  const sitePerf = Object.entries(siteMap).map(([site, d]) => ({
    site,
    ...d,
    rate: d.total > 0 ? Math.round((d.done / d.total) * 100) : 0,
  })).sort((a, b) => b.total - a.total)

  // Recent urgent/stat
  const urgentStudies = studies
    .filter(s => s.priority === 'urgent' || s.priority === 'stat')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 20)

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Tổng ca (toàn hệ thống)" value={studies.length}      colorBar="bg-blue-600"   sub="tất cả thời gian" />
        <StatCard label="Hôm nay"                  value={todayStudies.length} colorBar="bg-indigo-500" sub="ca chụp hôm nay" />
        <StatCard label="Chờ đọc kết quả"          value={pendingRead.length}  colorBar="bg-yellow-400" sub="cần xử lý" />
        <StatCard label="Đã xác nhận"              value={verified.length}     colorBar="bg-green-500"  sub="kết quả verified" />
      </div>

      {/* Modality breakdown */}
      <div className="grid grid-cols-4 gap-4">
        {modCounts.map(({ modality, count }) => {
          const style = MODALITY_STYLE[modality] || { bar: 'bg-gray-400', icon: '⬜', label: modality }
          const pct = studies.length > 0 ? Math.round((count / studies.length) * 100) : 0
          return (
            <div key={modality} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className={`h-1.5 ${style.bar}`} />
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{style.icon}</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase">{style.label}</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{count}</div>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${style.bar} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-gray-400 mt-1">{pct}% tổng ca</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Site performance table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Hiệu suất theo Chi nhánh</h3>
          <span className="text-xs text-gray-400">{sitePerf.length} chi nhánh</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Chi nhánh', 'Tổng ca', 'Hôm nay', 'Chờ đọc', 'Tỷ lệ hoàn thành (%)'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sitePerf.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Không có dữ liệu</td>
                </tr>
              ) : sitePerf.map((row, i) => (
                <tr key={row.site} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{row.site}</td>
                  <td className="px-4 py-3 text-blue-700 font-semibold">{row.total}</td>
                  <td className="px-4 py-3 text-gray-600">{row.today}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${row.pendingRead > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                      {row.pendingRead}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                        <div
                          className={`h-full rounded-full ${row.rate >= 70 ? 'bg-green-500' : row.rate >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${row.rate}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${row.rate >= 70 ? 'text-green-600' : row.rate >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {row.rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {sitePerf.length > 1 && (
                <tr className="border-t-2 border-gray-300 bg-blue-50 font-bold">
                  <td className="px-4 py-3 text-blue-800">Tổng cộng</td>
                  <td className="px-4 py-3 text-blue-800">{studies.length}</td>
                  <td className="px-4 py-3 text-blue-800">{todayStudies.length}</td>
                  <td className="px-4 py-3 text-yellow-600">{pendingRead.length}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const done = studies.filter(s => s.status === 'reported' || s.status === 'verified').length
                      const rate = studies.length > 0 ? Math.round((done / studies.length) * 100) : 0
                      return (
                        <span className={`text-sm font-bold ${rate >= 70 ? 'text-green-600' : rate >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {rate}%
                        </span>
                      )
                    })()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent urgent/stat studies */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-700">Ca Khẩn / Cấp cứu gần đây</h3>
          <span className="ml-auto text-xs text-gray-400">{urgentStudies.length} ca</span>
        </div>
        {urgentStudies.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Không có ca khẩn nào</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {urgentStudies.map((s, i) => (
              <div key={s._id} className="px-5 py-3 flex items-center gap-4 hover:bg-red-50 transition-colors">
                <span className="text-xs text-gray-400 w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm truncate">{s.patientName || '—'}</div>
                  <div className="text-xs text-gray-400">{s.site || '—'}</div>
                </div>
                <ModalityBadge modality={s.modality} />
                <StatusBadge status={s.status} />
                <ImageStatusBadge imageStatus={s.imageStatus} imageCount={s.imageCount} studyUID={s.studyUID} />
                <PriorityBadge priority={s.priority} />
                <div className="text-xs text-gray-400 whitespace-nowrap w-20 text-right">
                  {fmtDate(s.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main RIS Component ────────────────────────────────────────────────────────

export default function RIS() {
  const { auth } = useAuth()
  const [studies, setStudies] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const [studiesRes, statsRes] = await Promise.all([
        api.get('/ris/studies'),
        api.get('/ris/stats'),
      ])
      setStudies(studiesRes.data)
      setStats(statsRes.data)
    } catch (e) {
      console.error('RIS load error:', e)
      if (e?.response?.status !== 401) {
        setLoadError(String(e?.response?.data?.error || e?.message || e))
      }
    } finally {
      setLoading(false)
    }
  }

  const updateStudy = async (id, data) => {
    const res = await api.put(`/ris/studies/${id}`, data)
    setStudies(prev => prev.map(s => s._id === id ? res.data : s))
    load() // refresh stats
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm">Đang tải...</div>
        </div>
      </div>
    )
  }

  if (auth.role === 'guest') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="text-4xl">🔒</div>
          <div className="text-red-500 font-medium">Không có quyền truy cập</div>
          <div className="text-xs text-gray-400">Vui lòng liên hệ quản trị viên</div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-800">
        <div className="font-bold mb-2">Lỗi tải dữ liệu RIS:</div>
        <pre className="text-xs whitespace-pre-wrap">{loadError}</pre>
      </div>
    )
  }

  const sharedProps = { studies, stats, updateStudy, auth, onRefresh: load }

  return (
    <div className="space-y-4">
      {/* Page title bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Hệ thống RIS</h1>
          <p className="text-xs text-gray-400 mt-0.5">Radiology Information System</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          {auth.displayName || auth.username}
          {auth.department && <span className="text-gray-400">— {auth.department}</span>}
        </div>
      </div>

      {/* Role-based view */}
      <ErrorBoundary>
        {auth.role === 'bacsi' && <BacsiView studies={studies} auth={auth} onRefresh={load} />}
        {auth.role === 'nhanvien' && <NhanVienView {...sharedProps} />}
        {auth.role === 'truongphong' && <TruongPhongView {...sharedProps} />}
        {(auth.role === 'giamdoc' || auth.role === 'admin') && <GiamDocView {...sharedProps} />}
      </ErrorBoundary>
    </div>
  )
}
