import React, { useEffect, useState, useMemo } from 'react'
import api from '../api'
import CaseTabBar from '../components/CaseTabBar'
import PatientDetailView from '../components/PatientDetailView'

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
      if (res.data?.found === false) {
        alert('Ca này chưa có ảnh DICOM trong PACS.\n(StudyInstanceUID không khớp với dữ liệu trong Orthanc.)')
        return
      }
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

// ─── Study List (Right Panel) ─────────────────────────────────────────────────

function StudyList({ studies, onRefresh, onOpenCase }) {
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [modalityFilter, setModalityFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
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
      if (statusFilter && s.status !== statusFilter) return false
      const d = (s.appointmentTime || s.createdAt || '').slice(0, 10)
      if (dateFrom && d && d < dateFrom) return false
      if (dateTo && d && d > dateTo) return false
      return true
    })
  }, [studies, modalityFilter, siteFilter, statusFilter, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  useEffect(() => { setPage(0) }, [modalityFilter, siteFilter, statusFilter, dateFrom, dateTo])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex items-center gap-3 flex-shrink-0 flex-wrap">
        <span className="text-sm text-gray-600">Hiển thị {filtered.length} / {studies.length} ca</span>
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-600 flex-wrap">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400">
            <option value="">Trạng thái: tất cả</option>
            <option value="pending_read">Chờ đọc</option>
            <option value="reading">Đang đọc</option>
            <option value="reported">Hoàn thành</option>
            <option value="verified">Đã xác nhận</option>
            <option value="scheduled">Chờ thực hiện</option>
            <option value="in_progress">Đang thực hiện</option>
            <option value="cancelled">Đã hủy</option>
          </select>
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
              <tr key={s._id} onDoubleClick={() => onOpenCase?.(s)}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors cursor-pointer`}
                title="Double-click để mở ca">
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

const SYS_WORKLIST = '__worklist__'

export default function Teleradiology() {
  const [studies, setStudies] = useState([])
  const [loading, setLoading] = useState(true)
  const [openCases, setOpenCases] = useState([])
  const [activeCaseId, setActiveCaseId] = useState(SYS_WORKLIST)

  const load = async () => {
    try {
      const r = await api.get('/ris/studies')
      setStudies(r.data)
      // Keep any open case tabs in sync with latest server data (e.g. after Nhận ca updates status)
      setOpenCases(cs => cs.map(c => (r.data || []).find(s => s._id === c._id) || c))
    } catch (e) {
      console.error('Teleradiology load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCase = (study) => {
    setOpenCases(cs => cs.find(c => c._id === study._id) ? cs : [...cs, study])
    setActiveCaseId(study._id)
  }
  const closeCase = (id) => {
    setOpenCases(cs => cs.filter(c => c._id !== id))
    setActiveCaseId(prev => prev === id ? SYS_WORKLIST : prev)
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

  const activeCase = openCases.find(c => c._id === activeCaseId)
  const systemTabs = [{ id: SYS_WORKLIST, label: 'Danh sách ca đọc', icon: '📋' }]

  return (
    <div className="flex" style={{ height: 'calc(100vh - 6rem)' }}>
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        <CaseTabBar
          systemTabs={systemTabs}
          openCases={openCases}
          activeId={activeCaseId}
          onSelect={setActiveCaseId}
          onClose={closeCase}
        />
        {activeCase ? (
          <PatientDetailView study={activeCase} onRefresh={load} onOpenCase={openCase} />
        ) : (
          <div className="flex-1 overflow-hidden bg-white">
            <StudyList studies={studies} onRefresh={load} onOpenCase={openCase} />
          </div>
        )}
      </div>
    </div>
  )
}
