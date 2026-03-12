import React, { useEffect, useState, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { getCRM, saveCRM } from '../api'
import { useAuth } from '../context/AuthContext'

// ── helpers ──────────────────────────────────────────────────────────
const parseDate = (raw) => {
  if (!raw) return null
  // Excel serial number
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw)
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}`
  }
  const s = String(raw).trim()
  // dd/mm/yyyy  or  d/m/yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}`
  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${m2[1]}-${m2[2]}`
  return null
}

const colIndex = (headers, candidates) => {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h && String(h).toLowerCase().includes(c.toLowerCase()))
    if (idx >= 0) return idx
  }
  return -1
}

// Parse one sheet's raw data
function parseSheet(rows) {
  // Find header row (first row containing "Chi nhanh" or "Ma khach hang")
  let hdrIdx = 0
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const r = rows[i]
    if (r && r.some(c => c && String(c).toLowerCase().includes('chi nhanh'))) {
      hdrIdx = i; break
    }
  }
  const headers = rows[hdrIdx].map(c => c ? String(c).trim() : '')

  const iDate    = colIndex(headers, ['Ngay', 'Ngày'])
  const iSite    = colIndex(headers, ['Chi nhanh', 'Chi nhánh'])
  const iDoctor  = colIndex(headers, ['Ten bac si', 'Tên bác sĩ'])
  const iPlace   = colIndex(headers, ['Noi lam viec', 'Nơi làm việc'])
  const iPatient = colIndex(headers, ['Ma khach hang', 'Mã khách hàng'])
  const iSource  = colIndex(headers, ['Nguon KH', 'Nguồn KH'])

  const result = []
  for (let i = hdrIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.every(c => c === undefined || c === null || c === '')) continue

    const site    = r[iSite]    ? String(r[iSite]).trim()    : ''
    const doctor  = r[iDoctor]  ? String(r[iDoctor]).trim()  : ''
    const place   = r[iPlace]   ? String(r[iPlace]).trim()   : ''
    const patient = r[iPatient] ? String(r[iPatient]).trim() : ''
    const source  = r[iSource]  ? String(r[iSource]).trim()  : ''
    const month   = parseDate(r[iDate])

    if (!site || !month || !patient) continue

    // Xác định nhóm bệnh viện/cơ sở
    let hospital
    if (!source || source.toLowerCase().includes('tu den') || source.toLowerCase().includes('tự đến')) {
      hospital = 'Tự do'
    } else if (!place || place === '' || place === '-') {
      hospital = 'Tự do'
    } else {
      hospital = place
    }

    const doctorName = doctor || 'Không xác định'

    result.push({ site, hospital, doctor: doctorName, patient, month })
  }
  return result
}

// Aggregate raw rows → structured CRM data
function buildCRM(rows) {
  // site → hospital → doctor → month → Set of patients
  const tree = {}
  const allMonths = new Set()

  rows.forEach(({ site, hospital, doctor, patient, month }) => {
    allMonths.add(month)
    if (!tree[site]) tree[site] = {}
    if (!tree[site][hospital]) tree[site][hospital] = {}
    if (!tree[site][hospital][doctor]) tree[site][hospital][doctor] = {}
    if (!tree[site][hospital][doctor][month]) tree[site][hospital][doctor][month] = new Set()
    tree[site][hospital][doctor][month].add(patient)
  })

  // Convert Sets → counts
  const sites = {}
  Object.entries(tree).forEach(([site, hospitals]) => {
    sites[site] = {}
    Object.entries(hospitals).forEach(([hosp, doctors]) => {
      sites[site][hosp] = {}
      Object.entries(doctors).forEach(([doc, months]) => {
        sites[site][hosp][doc] = {}
        Object.entries(months).forEach(([mo, pset]) => {
          sites[site][hosp][doc][mo] = pset.size
        })
      })
    })
  })

  const months = Array.from(allMonths).sort()
  return { sites, months, updatedAt: new Date().toISOString() }
}

// ── component helpers ─────────────────────────────────────────────────
const sumMonths = (monthMap, months) =>
  months.reduce((s, m) => s + (monthMap[m] || 0), 0)

const NAVY = '#0f2c6b'
const NAVY2 = '#1e3a8a'

export default function CRM() {
  const { auth } = useAuth()
  const isAdmin = auth?.role === 'admin'

  const [crmData, setCrmData]       = useState(null)   // { sites, months }
  const [loading, setLoading]       = useState(true)
  const [uploading, setUploading]   = useState(false)
  const [parseMsg, setParseMsg]     = useState('')
  const [saving, setSaving]         = useState(false)
  const fileRef = useRef(null)

  // UI state
  const [activeSite, setActiveSite]         = useState(null)
  const [expandedHospitals, setExpandedH]   = useState({}) // key: hospital → bool
  const [selectedMonths, setSelectedMonths] = useState(null) // null = all

  useEffect(() => {
    getCRM().then(d => {
      if (d && d.months && d.sites) setCrmData(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Auto-select first site after data loads
  useEffect(() => {
    if (crmData && !activeSite) {
      const first = Object.keys(crmData.sites || {})[0]
      if (first) setActiveSite(first)
    }
  }, [crmData, activeSite])

  // ── Excel parse ──────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setParseMsg('Đang đọc file... (có thể mất 10-30 giây với file lớn)')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const wb   = XLSX.read(data, { type: 'array', cellDates: false })

        let allRows = []
        const sheetNames = wb.SheetNames.filter(n =>
          n.toUpperCase().includes('DOANHSO') || n.toUpperCase().includes('DOANH SO')
        )

        if (sheetNames.length === 0) {
          setParseMsg('Không tìm thấy sheet DOANHSO. Vui lòng kiểm tra file.')
          setUploading(false)
          return
        }

        sheetNames.forEach(name => {
          const ws   = wb.Sheets[name]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          const parsed = parseSheet(rows)
          allRows = allRows.concat(parsed)
        })

        if (allRows.length === 0) {
          setParseMsg('Không đọc được dữ liệu. Kiểm tra lại file.')
          setUploading(false)
          return
        }

        const built = buildCRM(allRows)
        setCrmData(built)
        setActiveSite(Object.keys(built.sites)[0] || null)
        setExpandedH({})
        setSelectedMonths(null)
        setParseMsg(`Đọc xong: ${allRows.length.toLocaleString('vi-VN')} dòng, ${Object.keys(built.sites).length} chi nhánh, ${built.months.length} tháng`)
        setUploading(false)

        // Auto-save to server
        if (isAdmin) {
          setSaving(true)
          saveCRM(built).then(() => setSaving(false)).catch(() => setSaving(false))
        }
      } catch (err) {
        setParseMsg(`Lỗi: ${err.message}`)
        setUploading(false)
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  // ── Display months (filter) ───────────────────────────────────────────
  const displayMonths = useMemo(() => {
    if (!crmData) return []
    if (!selectedMonths) return crmData.months
    return crmData.months.filter(m => selectedMonths.includes(m))
  }, [crmData, selectedMonths])

  const toggleMonth = (m) => {
    setSelectedMonths(prev => {
      if (!prev) {
        // deselect all except this one
        return [m]
      }
      if (prev.includes(m)) {
        const next = prev.filter(x => x !== m)
        return next.length === 0 ? null : next
      }
      const next = [...prev, m].sort()
      return next.length === (crmData?.months?.length || 0) ? null : next
    })
  }

  const toggleHospital = (key) =>
    setExpandedH(p => ({ ...p, [key]: !p[key] }))

  // ── Loading / empty states ────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Đang tải...</p>
      </div>
    </div>
  )

  const hasData = crmData && Object.keys(crmData.sites || {}).length > 0
  const siteList = hasData ? Object.keys(crmData.sites).sort() : []
  const siteData = activeSite && hasData ? crmData.sites[activeSite] : {}

  // Sort hospitals: "Tự do" last
  const hospitalList = Object.keys(siteData || {}).sort((a, b) => {
    if (a === 'Tự do') return 1
    if (b === 'Tự do') return -1
    return a.localeCompare(b, 'vi')
  })

  // Compute site-level totals for tabs
  const siteTotals = useMemo(() => {
    if (!hasData) return {}
    const out = {}
    siteList.forEach(site => {
      let total = 0
      Object.values(crmData.sites[site]).forEach(hosp =>
        Object.values(hosp).forEach(doc =>
          displayMonths.forEach(m => { total += doc[m] || 0 })
        )
      )
      out[site] = total
    })
    return out
  }, [hasData, siteList, crmData, displayMonths])

  return (
    <div className="space-y-0 -mx-4 -mt-4">

      {/* ── TOP BAR ── */}
      <div style={{ background: NAVY }} className="px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-white font-bold text-base">CRM — Phân Tích Khách Hàng</h2>
          <p className="text-xs mt-0.5" style={{ color: '#93c5fd' }}>
            Theo site → bệnh viện/phòng khám → bác sĩ → tháng
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-yellow-300">Đang lưu...</span>}
          {parseMsg && (
            <span className="text-xs px-3 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#e0f2fe' }}>
              {parseMsg}
            </span>
          )}
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-sm font-semibold transition-all"
            style={{ background: uploading ? 'rgba(255,255,255,0.1)' : '#2563eb', color: '#fff' }}>
            {uploading
              ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang xử lý...</>
              : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
                </svg>Upload Excel</>
            }
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {/* ── NO DATA STATE ── */}
      {!hasData && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: '#eff6ff' }}>
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-700 mb-2">Chưa có dữ liệu CRM</h3>
          <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
            Upload file <strong>FILE_TONGHOP_DULIEU.xlsx</strong> để bắt đầu phân tích khách hàng theo bác sĩ và chi nhánh.
          </p>
          <p className="text-xs text-gray-400">File cần có sheet tên <strong>DOANHSO_2025</strong> và/hoặc <strong>DOANHSO_2026</strong></p>
        </div>
      )}

      {hasData && (
        <div className="flex h-[calc(100vh-120px)] overflow-hidden">

          {/* ── LEFT: Site tabs ── */}
          <div className="w-48 flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Chi nhánh</p>
            </div>
            {siteList.map(site => (
              <button key={site} onClick={() => { setActiveSite(site); setExpandedH({}) }}
                className="w-full text-left px-3 py-3 border-b border-gray-50 transition-colors"
                style={{
                  background: activeSite === site ? '#eff6ff' : 'transparent',
                  borderRight: activeSite === site ? `3px solid ${NAVY2}` : '3px solid transparent',
                }}>
                <p className="text-sm font-semibold" style={{ color: activeSite === site ? NAVY2 : '#374151' }}>
                  {site}
                </p>
                <p className="text-xs mt-0.5" style={{ color: activeSite === site ? '#3b82f6' : '#9ca3af' }}>
                  {(siteTotals[site] || 0).toLocaleString('vi-VN')} KH
                </p>
              </button>
            ))}
          </div>

          {/* ── MAIN ── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Month filter bar */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap mr-1">Tháng:</span>
              <button onClick={() => setSelectedMonths(null)}
                className="px-2.5 py-1 rounded text-xs font-semibold transition-all whitespace-nowrap"
                style={{
                  background: !selectedMonths ? NAVY2 : '#f1f5f9',
                  color: !selectedMonths ? '#fff' : '#64748b',
                }}>
                Tất cả
              </button>
              {(crmData?.months || []).map(m => {
                const active = selectedMonths && selectedMonths.includes(m)
                const label = m.replace(/^(\d{4})-(\d{2})$/, (_, y, mo) => `T${parseInt(mo)}/${y.slice(2)}`)
                return (
                  <button key={m} onClick={() => toggleMonth(m)}
                    className="px-2 py-1 rounded text-xs font-medium transition-all whitespace-nowrap"
                    style={{
                      background: active ? '#dbeafe' : '#f8fafc',
                      color: active ? NAVY2 : '#94a3b8',
                      border: active ? `1px solid #93c5fd` : '1px solid #e2e8f0',
                    }}>
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Site summary header */}
              <div className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)` }}>
                <div>
                  <h3 className="text-white font-bold text-lg">{activeSite}</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#93c5fd' }}>
                    {hospitalList.length} bệnh viện/phòng khám •{' '}
                    {hospitalList.reduce((s, h) => s + Object.keys(siteData[h] || {}).length, 0)} bác sĩ
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">
                    {hospitalList.reduce((s, h) =>
                      s + Object.values(siteData[h] || {}).reduce((s2, doc) =>
                        s2 + sumMonths(doc, displayMonths), 0), 0
                    ).toLocaleString('vi-VN')}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#93c5fd' }}>
                    Tổng khách hàng {!selectedMonths ? '(cả năm)' : `(${displayMonths.length} tháng)`}
                  </p>
                </div>
              </div>

              {/* Hospital list */}
              {hospitalList.map(hospital => {
                const doctors = siteData[hospital] || {}
                const hospKey = `${activeSite}__${hospital}`
                const isOpen  = expandedHospitals[hospKey] !== false // default open
                const hospTotal = Object.values(doctors)
                  .reduce((s, doc) => s + sumMonths(doc, displayMonths), 0)
                const isTuDo = hospital === 'Tự do'

                // Sort doctors by total desc
                const sortedDoctors = Object.entries(doctors)
                  .map(([name, months]) => ({ name, total: sumMonths(months, displayMonths), months }))
                  .filter(d => d.total > 0 || !selectedMonths)
                  .sort((a, b) => b.total - a.total)

                return (
                  <div key={hospital} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Hospital header */}
                    <button
                      onClick={() => toggleHospital(hospKey)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      style={{ borderLeft: `4px solid ${isTuDo ? '#9ca3af' : NAVY2}` }}>
                      <div className="flex items-center gap-3">
                        <span className="text-base">{isTuDo ? '🏃' : '🏥'}</span>
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-800">{hospital}</p>
                          <p className="text-xs text-gray-400">
                            {sortedDoctors.length} bác sĩ • {hospTotal.toLocaleString('vi-VN')} lượt KH
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold" style={{ color: isTuDo ? '#6b7280' : NAVY2 }}>
                          {hospTotal.toLocaleString('vi-VN')}
                        </span>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Doctor table */}
                    {isOpen && sortedDoctors.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                              <th className="py-2 px-4 text-left font-semibold text-gray-500 sticky left-0 bg-gray-50 z-10" style={{ minWidth: 200 }}>
                                Bác sĩ
                              </th>
                              {displayMonths.map(m => (
                                <th key={m} className="py-2 px-2 text-center font-semibold text-gray-500 whitespace-nowrap" style={{ minWidth: 52 }}>
                                  {m.replace(/^(\d{4})-(\d{2})$/, (_, y, mo) => `T${parseInt(mo)}`)}
                                  <br />
                                  <span className="font-normal text-gray-400">{m.slice(2, 4)}</span>
                                </th>
                              ))}
                              <th className="py-2 px-3 text-center font-bold sticky right-0 bg-gray-50 z-10"
                                style={{ color: NAVY2, minWidth: 64 }}>
                                Tổng
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedDoctors.map((doc, i) => {
                              const maxInRow = Math.max(...displayMonths.map(m => doc.months[m] || 0), 1)
                              return (
                                <tr key={doc.name}
                                  className="border-t border-gray-50 hover:bg-blue-50 transition-colors"
                                  style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                  <td className="py-2 px-4 font-medium text-gray-700 sticky left-0 z-10"
                                    style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                    {doc.name}
                                  </td>
                                  {displayMonths.map(m => {
                                    const v = doc.months[m] || 0
                                    const pct = v > 0 ? Math.round(v / maxInRow * 100) : 0
                                    return (
                                      <td key={m} className="py-2 px-1 text-center">
                                        {v > 0 ? (
                                          <div className="flex flex-col items-center gap-0.5">
                                            <span className="font-semibold text-gray-700">{v}</span>
                                            <div className="w-8 h-1 rounded-full bg-gray-100">
                                              <div className="h-1 rounded-full"
                                                style={{ width: `${pct}%`, background: isTuDo ? '#94a3b8' : NAVY2 }} />
                                            </div>
                                          </div>
                                        ) : (
                                          <span className="text-gray-200">—</span>
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td className="py-2 px-3 text-center font-bold sticky right-0 z-10"
                                    style={{ color: NAVY2, background: i % 2 === 0 ? '#eff6ff' : '#dbeafe' }}>
                                    {doc.total.toLocaleString('vi-VN')}
                                  </td>
                                </tr>
                              )
                            })}
                            {/* Hospital subtotal */}
                            <tr className="border-t-2 border-gray-200" style={{ background: isTuDo ? '#f9fafb' : '#f0f9ff' }}>
                              <td className="py-2 px-4 font-bold sticky left-0 z-10 text-xs"
                                style={{ color: isTuDo ? '#6b7280' : NAVY, background: isTuDo ? '#f9fafb' : '#f0f9ff' }}>
                                Tổng — {hospital}
                              </td>
                              {displayMonths.map(m => {
                                const total = sortedDoctors.reduce((s, d) => s + (d.months[m] || 0), 0)
                                return (
                                  <td key={m} className="py-2 px-1 text-center font-bold text-xs"
                                    style={{ color: isTuDo ? '#6b7280' : NAVY }}>
                                    {total > 0 ? total : ''}
                                  </td>
                                )
                              })}
                              <td className="py-2 px-3 text-center font-bold text-sm sticky right-0 z-10"
                                style={{ color: isTuDo ? '#6b7280' : NAVY,
                                  background: isTuDo ? '#f3f4f6' : '#dbeafe' }}>
                                {hospTotal.toLocaleString('vi-VN')}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {isOpen && sortedDoctors.length === 0 && (
                      <p className="px-4 py-3 text-xs text-gray-400 italic">
                        Không có dữ liệu trong kỳ đã chọn
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
