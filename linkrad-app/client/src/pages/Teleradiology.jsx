import React, { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const todayISO = () => new Date().toISOString().slice(0, 10)

// ─── Image Viewer Button ──────────────────────────────────────────────────────

function ViewImagesButton({ studyUID, imageStatus, imageCount }) {
  const [opening, setOpening] = useState(false)
  if (imageStatus !== 'available' || !studyUID) {
    return <span className="text-xs text-gray-400">—</span>
  }
  const open = async (e) => {
    e.stopPropagation()
    setOpening(true)
    try {
      const res = await api.get(`/ris/orthanc/viewer-url/${encodeURIComponent(studyUID)}`)
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    } catch {
      alert('Không mở được trình xem ảnh')
    } finally { setOpening(false) }
  }
  return (
    <button onClick={open} disabled={opening}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors whitespace-nowrap">
      {opening ? '...' : `Xem ảnh${imageCount ? ` (${imageCount})` : ''}`}
    </button>
  )
}

// ─── Study Detail View ────────────────────────────────────────────────────────

function StudyDetail({ study, onBack, onRefresh }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/ris/reports/${study._id}`).catch(() => ({ data: null })),
      study.patientId ? api.get(`/ris/studies?patientId=${study.patientId}`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]).then(([reportRes, historyRes]) => {
      setReport(reportRes.data)
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : [])
    }).finally(() => setLoading(false))
  }, [study._id])

  const openViewer = async () => {
    if (!study.studyUID) return
    try {
      const res = await api.get(`/ris/orthanc/viewer-url/${encodeURIComponent(study.studyUID)}`)
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    } catch {}
  }

  const fmtDob = (dob) => {
    if (!dob) return '—'
    return new Date(dob).getFullYear().toString()
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar - Patient & case info */}
      <div className="w-[220px] flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
        {/* Back button */}
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-700 transition-colors text-sm">‹</button>
          <span className="text-xs font-medium text-gray-700">Thông tin ca</span>
        </div>

        {/* Patient info */}
        <div className="px-3 py-3 border-b border-gray-200">
          <div className="text-xs font-semibold text-blue-600 uppercase mb-2">Thông tin bệnh nhân</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">PID:</span><span className="font-medium text-gray-800">{study.patientId || '—'}</span></div>
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">Họ và tên:</span><span className="font-medium text-gray-800">{study.patientName || '—'}</span></div>
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">Năm sinh:</span><span className="text-gray-700">{fmtDob(study.dob)}, Giới tính: {study.gender === 'M' ? 'Nam' : study.gender === 'F' ? 'Nữ' : '—'}</span></div>
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">CĐ lâm sàng:</span><span className="text-gray-700">{study.clinicalInfo || '—'}</span></div>
          </div>
        </div>

        {/* History */}
        <div className="px-3 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-600 uppercase">Lịch sử khám</span>
            <label className="text-xs text-gray-400 flex items-center gap-1"><input type="checkbox" className="rounded" /> Tất cả</label>
          </div>
          <div className="space-y-1">
            {history.length === 0 && <div className="text-xs text-gray-400">Không có</div>}
            {history.slice(0, 10).map(h => (
              <div key={h._id} className={`text-xs px-2 py-1.5 rounded cursor-pointer transition-colors ${h._id === study._id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'}`}>
                <div className="font-medium">{h.modality} - {fmtDateTime(h.appointmentTime || h.createdAt)}</div>
                {h.clinicalInfo && <div className="text-gray-400 truncate mt-0.5">{h.clinicalInfo}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Diagnosis request */}
        <div className="px-3 py-3 border-b border-gray-200">
          <div className="text-xs font-semibold text-blue-600 uppercase mb-2">Yêu cầu chẩn đoán</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">Ưu tiên:</span><span className="font-medium text-gray-700">{study.priority === 'urgent' ? 'KHẨN' : study.priority === 'stat' ? 'CẤP CỨU' : 'KHÔNG'}</span></div>
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">Bác sĩ chỉ định:</span><span className="text-gray-700">{study.referringDoctor || '—'}</span></div>
            <div className="flex flex-col"><span className="text-gray-400">Chỉ định:</span><span className="text-gray-700 mt-0.5">{study.clinicalInfo || study.bodyPart || '—'}</span></div>
          </div>
        </div>

        {/* Case info */}
        <div className="px-3 py-3">
          <div className="text-xs font-semibold text-blue-600 uppercase mb-2">Thông tin ca</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">Ngày chụp:</span><span className="text-gray-700">{fmtDateTime(study.appointmentTime || study.createdAt)}</span></div>
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">Bộ phận:</span><span className="text-gray-700">{study.bodyPart || '—'}</span></div>
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">Ghi chú:</span><span className="text-gray-700">{study.clinicalInfo || '—'}</span></div>
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">Máy chụp:</span><span className="text-gray-700">{study.modality} {study.site || ''}</span></div>
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">Điện thoại:</span><span className="text-gray-700">{study.phone || '—'}</span></div>
            <div className="flex"><span className="text-gray-400 w-16 flex-shrink-0">Địa chỉ:</span><span className="text-gray-700">{study.address || '—'}</span></div>
          </div>
        </div>
      </div>

      {/* Right - Report content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2 flex-shrink-0">
          <button onClick={() => {}} className="flex flex-col items-center px-3 py-1 hover:bg-gray-200 rounded transition-colors" title="Nhận ca">
            <span className="text-base">🔒</span><span className="text-[10px] text-gray-500">Nhận ca</span>
          </button>
          <button onClick={openViewer} className="flex flex-col items-center px-3 py-1 hover:bg-gray-200 rounded transition-colors" title="Xem ảnh">
            <span className="text-base">👁</span><span className="text-[10px] text-gray-500">Xem ảnh</span>
          </button>
          <button onClick={openViewer} className="flex flex-col items-center px-3 py-1 hover:bg-gray-200 rounded transition-colors" title="Xem ảnh V1">
            <span className="text-base">👁</span><span className="text-[10px] text-gray-500">Xem ảnh V1</span>
          </button>
          <button className="flex flex-col items-center px-3 py-1 hover:bg-gray-200 rounded transition-colors" title="Xem - Tải Video">
            <span className="text-base">☁</span><span className="text-[10px] text-gray-500">Xem - Tải Video</span>
          </button>
          <button className="flex flex-col items-center px-3 py-1 hover:bg-gray-200 rounded transition-colors" title="Tải tệp đính kèm">
            <span className="text-base">📎</span><span className="text-[10px] text-gray-500">Tải tệp đính kèm</span>
          </button>
          <div className="w-px h-8 bg-gray-300 mx-1" />
          <button className="flex flex-col items-center px-3 py-1 hover:bg-gray-200 rounded transition-colors" title="In kết quả">
            <span className="text-base">🖨</span><span className="text-[10px] text-gray-500">In kết quả</span>
          </button>
          <button className="flex flex-col items-center px-3 py-1 hover:bg-gray-200 rounded transition-colors" title="In nhanh">
            <span className="text-base">🖨</span><span className="text-[10px] text-gray-500">In nhanh</span>
          </button>
          <button className="flex flex-col items-center px-3 py-1 hover:bg-gray-200 rounded transition-colors" title="In Tra cứu Portal">
            <span className="text-base">🖨</span><span className="text-[10px] text-gray-500">In Tra cứu Portal</span>
          </button>
        </div>

        {/* Report body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Đang tải...</div>
          ) : (
            <div className="max-w-4xl">
              <div className="text-sm text-gray-500 uppercase mb-1">
                YÊU CẦU: {study.modality} {study.bodyPart ? study.bodyPart.toUpperCase() : ''}
              </div>
              <div className="text-center text-sm font-semibold text-gray-800 mb-6">KẾT QUẢ</div>

              {report && report.technique && (
                <div className="mb-4">
                  <div className="text-sm font-semibold text-gray-800 mb-1">Kỹ thuật: {report.technique}</div>
                </div>
              )}

              {report && report.findings ? (
                <div className="space-y-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {report.findings}
                </div>
              ) : (
                <div className="text-gray-400 text-sm italic py-4">Chưa có kết quả đọc phim</div>
              )}

              {report && report.impression && (
                <div className="mt-6">
                  <span className="font-semibold text-gray-800">Kết Luận: </span>
                  <span className="text-gray-800">{report.impression}</span>
                </div>
              )}

              {report && report.recommendation && (
                <div className="mt-4 text-sm text-gray-600">
                  <span className="font-medium">Đề nghị: </span>{report.recommendation}
                </div>
              )}

              {/* Signatures */}
              <div className="flex justify-between mt-10 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Người ký (Alt + 1):</span> 📁
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Kỹ thuật viên (Alt + 2):</span> 📁
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - tags */}
        <div className="border-t border-gray-200 flex-shrink-0 text-xs">
          <div className="flex items-center px-4 py-1.5 border-b border-gray-100">
            <span className="text-blue-600 font-medium w-20">Chỉ định</span>
            <span className="text-gray-700">{study.clinicalInfo || study.bodyPart || '—'}</span>
          </div>
          <div className="flex items-center px-4 py-1.5">
            <span className="text-blue-600 font-medium w-20">Thẻ(Tag)</span>
            <span className="text-gray-400">Không có</span>
            <span className="ml-auto text-blue-600 font-medium mr-2">Mã ICD10</span>
            <span className="text-gray-400">Không có</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Study List (Right Panel) ─────────────────────────────────────────────────

function StudyList({ studies, onRefresh }) {
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [modalityFilter, setModalityFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const siteOptions = useMemo(
    () => Array.from(new Set(studies.map(s => s.site).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [studies]
  )

  const filtered = useMemo(() => {
    return studies.filter(s => {
      if (modalityFilter && s.modality !== modalityFilter) return false
      if (siteFilter && s.site !== siteFilter) return false
      const d = (s.appointmentTime || s.createdAt || '').slice(0, 10)
      if (dateFrom && d && d < dateFrom) return false
      if (dateTo && d && d > dateTo) return false
      return true
    })
  }, [studies, modalityFilter, siteFilter, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  useEffect(() => { setPage(0) }, [modalityFilter, siteFilter, dateFrom, dateTo])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex items-center gap-3 flex-shrink-0 flex-wrap">
        <span className="text-sm text-gray-600">Hiển thị {filtered.length} / {studies.length} ca</span>
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-600 flex-wrap">
          <select value={modalityFilter} onChange={e => setModalityFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400">
            <option value="">Loại máy: tất cả</option>
            <option value="CT">CT</option>
            <option value="MRI">MRI</option>
            <option value="XR">X-Ray</option>
            <option value="US">Siêu âm</option>
          </select>
          <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400">
            <option value="">Cơ sở: tất cả</option>
            {siteOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span>Ngày chụp:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400" />
          <span>→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400" />
          <button onClick={onRefresh}
            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors" title="Làm mới">⟳</button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              {['Mã BN', 'Tên bệnh nhân', 'Loại máy', 'Cơ sở', 'BS chỉ định', 'Trạng thái', 'Ngày chụp', 'Ngày đọc', 'BS đọc', 'Chỉ định', 'Giới tính', 'Ảnh'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400 text-sm">Không có dữ liệu</td></tr>
            ) : paged.map((s, i) => (
              <tr key={s._id} onDoubleClick={() => window.open(`/teleradiology/study/${s._id}`, '_blank')}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors cursor-pointer`}>
                <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{s.patientId || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className="font-medium text-gray-800">{s.patientName || '—'}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">{s.modality}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{s.site || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{s.referringDoctor || '—'}</td>
                <td className="px-3 py-2.5">
                  <StatusLabel status={s.status} />
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{fmtDateTime(s.appointmentTime || s.createdAt)}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                  {s.reportedAt ? fmtDateTime(s.reportedAt) : '—'}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600">
                  {s.radiologistName || '—'}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[250px]">
                  <div className="truncate">{s.clinicalInfo || s.bodyPart || '—'}</div>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500">
                  {s.gender === 'M' ? 'Nam' : s.gender === 'F' ? 'Nữ' : '—'}
                </td>
                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                  <ViewImagesButton studyUID={s.studyUID} imageStatus={s.imageStatus} imageCount={s.imageCount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-2.5 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
        <div className="flex items-center gap-1">
          {[5, 10, 20].map(s => (
            <button key={s} onClick={() => { setPageSize(s); setPage(0) }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${pageSize === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span>Page {page + 1} of {totalPages} ({filtered.length} items)</span>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`w-7 h-7 rounded-lg font-medium transition-all ${page === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Status Label ─────────────────────────────────────────────────────────────

function StatusLabel({ status }) {
  const CONFIG = {
    scheduled:    { label: 'Chờ thực hiện', cls: 'text-gray-600' },
    in_progress:  { label: 'Đang thực hiện', cls: 'text-blue-600' },
    pending_read: { label: 'Chờ đọc', cls: 'text-orange-600' },
    reading:      { label: 'Đang đọc', cls: 'text-orange-500' },
    reported:     { label: 'Hoàn thành', cls: 'text-green-600' },
    verified:     { label: 'Đã xác nhận', cls: 'text-emerald-700' },
    cancelled:    { label: 'Đã hủy', cls: 'text-red-500' },
  }
  const c = CONFIG[status] || { label: status, cls: 'text-gray-400' }
  return <span className={`text-xs font-medium ${c.cls}`}>{c.label}</span>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Teleradiology() {
  const { auth } = useAuth()
  const [studies, setStudies] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const r = await api.get('/ris/studies')
      setStudies(r.data)
    } catch (e) {
      console.error('Teleradiology load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <StudyList studies={studies} onRefresh={load} />
    </div>
  )
}

// ─── Study Detail Page (standalone, opens in new tab) ─────────────────────────

export function StudyDetailPage() {
  const { studyId } = useParams()
  const [study, setStudy] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/ris/studies').then(r => {
      const found = (r.data || []).find(s => s._id === studyId)
      setStudy(found || null)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [studyId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm">Đang tải...</div>
        </div>
      </div>
    )
  }

  if (!study) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center space-y-2">
          <div className="text-4xl">📋</div>
          <div className="text-gray-500">Không tìm thấy ca chụp</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <span className="text-sm font-semibold text-gray-800">Thông tin ca</span>
        <span className="text-xs text-gray-400">—</span>
        <span className="text-sm font-medium text-gray-700">{study.patientName}</span>
        <span className="text-xs text-gray-400">{study.modality} · {study.site || ''}</span>
      </div>
      {/* Detail */}
      <div className="flex-1 overflow-hidden">
        <StudyDetail study={study} onBack={() => window.close()} onRefresh={() => {}} />
      </div>
    </div>
  )
}
