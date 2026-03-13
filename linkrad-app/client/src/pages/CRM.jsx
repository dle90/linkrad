import React, { useEffect, useState, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { getCRM, saveCRM } from '../api'
import { useAuth } from '../context/AuthContext'

// ── date helper ───────────────────────────────────────────────────────
function toYYYYMM(raw) {
  if (!raw) return null
  // Excel date serial number
  if (typeof raw === 'number' && raw > 1000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000))
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }
  const s = String(raw).trim()
  // dd/mm/yyyy
  const a = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (a) return `${a[3]}-${a[2].padStart(2, '0')}`
  // yyyy-mm-dd
  const b = s.match(/^(\d{4})-(\d{2})/)
  if (b) return `${b[1]}-${b[2]}`
  return null
}

// ── find column by keyword ────────────────────────────────────────────
function col(headers, ...keys) {
  for (const k of keys) {
    const i = headers.findIndex(h => h && String(h).toLowerCase().includes(k.toLowerCase()))
    if (i >= 0) return i
  }
  return -1
}

// ── parse one DOANHSO sheet ───────────────────────────────────────────
function parseSheet(rows) {
  // find header row
  let hi = 0
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if ((rows[i] || []).some(c => String(c || '').toLowerCase().includes('chi nhanh'))) { hi = i; break }
  }
  const H = (rows[hi] || []).map(c => String(c || '').trim())
  const iDate = col(H, 'ngay', 'ngày')
  const iSite = col(H, 'chi nhanh', 'chi nhánh')
  const iDoc  = col(H, 'ten bac si', 'tên bác sĩ')
  const iPl   = col(H, 'noi lam viec', 'nơi làm việc')
  const iPt   = col(H, 'ma khach hang', 'mã khách hàng')
  const iSrc  = col(H, 'nguon kh', 'nguồn kh')

  const out = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const site = String(r[iSite] || '').trim()
    const pt   = String(r[iPt]   || '').trim()
    const mo   = toYYYYMM(r[iDate])
    if (!site || !pt || !mo) continue

    const src = String(r[iSrc] || '').trim().toLowerCase()
    const pl  = String(r[iPl]  || '').trim()
    const doc = String(r[iDoc] || '').trim()

    const hosp = (src.includes('tu den') || src.includes('tự đến') || !pl || pl === '-')
      ? 'Tự do' : pl

    out.push({ site, hosp, doc: doc || 'Không xác định', pt, mo })
  }
  return out
}

// ── aggregate into CRM tree ───────────────────────────────────────────
function buildCRM(rows) {
  const tree = {}
  const months = new Set()
  for (const { site, hosp, doc, pt, mo } of rows) {
    months.add(mo)
    if (!tree[site])              tree[site] = {}
    if (!tree[site][hosp])        tree[site][hosp] = {}
    if (!tree[site][hosp][doc])   tree[site][hosp][doc] = {}
    const key = `${mo}__${pt}`
    tree[site][hosp][doc][mo] = (tree[site][hosp][doc][mo] || new Set())
    tree[site][hosp][doc][mo].add(pt)
  }
  // convert Sets → counts
  const sites = {}
  for (const [site, hosps] of Object.entries(tree)) {
    sites[site] = {}
    for (const [hosp, docs] of Object.entries(hosps)) {
      sites[site][hosp] = {}
      for (const [doc, mos] of Object.entries(docs)) {
        sites[site][hosp][doc] = {}
        for (const [mo, set] of Object.entries(mos)) {
          sites[site][hosp][doc][mo] = set.size
        }
      }
    }
  }
  return { sites, months: [...months].sort(), updatedAt: new Date().toISOString() }
}

const sum = (docMap, months) => months.reduce((s, m) => s + (docMap[m] || 0), 0)
const NAVY = '#0f2c6b'
const BLUE = '#1e3a8a'
const fmtMo = m => m.replace(/^(\d{4})-(\d{2})$/, (_, y, mo) => `T${+mo}/${y.slice(2)}`)

// ═════════════════════════════════════════════════════════════════════
export default function CRM() {
  const { auth } = useAuth()
  const isAdmin = auth?.role === 'admin'
  const fileRef = useRef(null)

  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [msg,       setMsg]       = useState('')
  const [saving,    setSaving]    = useState(false)
  const [site,      setSite]      = useState(null)
  const [openH,     setOpenH]     = useState({})
  const [selMo,     setSelMo]     = useState(null)

  // ── fetch saved data on mount ──────────────────────────────────────
  useEffect(() => {
    getCRM()
      .then(d => { if (d?.sites && d?.months) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (data && !site) setSite(Object.keys(data.sites || {})[0] || null)
  }, [data, site])

  // ── ALL hooks before any conditional return ────────────────────────
  const months = useMemo(() => {
    if (!data) return []
    return selMo ? data.months.filter(m => selMo.includes(m)) : data.months
  }, [data, selMo])

  const siteList = useMemo(() => Object.keys(data?.sites || {}).sort(), [data])

  const siteData = useMemo(() =>
    (data && site && data.sites[site]) ? data.sites[site] : {}
  , [data, site])

  const hospList = useMemo(() =>
    Object.keys(siteData).sort((a, b) =>
      a === 'Tự do' ? 1 : b === 'Tự do' ? -1 : a.localeCompare(b, 'vi')
    )
  , [siteData])

  const siteTotals = useMemo(() => {
    const out = {}
    for (const s of siteList) {
      let t = 0
      for (const h of Object.values(data?.sites?.[s] || {}))
        for (const d of Object.values(h))
          for (const m of months) t += d[m] || 0
      out[s] = t
    }
    return out
  }, [data, siteList, months])

  // ── render ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── file handler ───────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMsg('Đang đọc file...')
    const reader = new FileReader()
    reader.onload = ({ target }) => {
      try {
        const wb = XLSX.read(new Uint8Array(target.result), { type: 'array', cellDates: false })
        const sheets = wb.SheetNames.filter(n => n.toUpperCase().includes('DOANHSO'))
        if (!sheets.length) { setMsg('Không thấy sheet DOANHSO'); setUploading(false); return }

        let all = []
        for (const name of sheets) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
          all = all.concat(parseSheet(rows))
        }
        if (!all.length) { setMsg('Không đọc được dữ liệu'); setUploading(false); return }

        const built = buildCRM(all)
        setData(built)
        setSite(Object.keys(built.sites)[0] || null)
        setOpenH({})
        setSelMo(null)
        setMsg(`✓ ${all.length.toLocaleString('vi-VN')} dòng • ${Object.keys(built.sites).length} chi nhánh`)
        setUploading(false)
        if (isAdmin) {
          setSaving(true)
          saveCRM(built).finally(() => setSaving(false))
        }
      } catch (err) {
        setMsg(`Lỗi: ${err.message}`)
        setUploading(false)
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const toggleMo = (m) => setSelMo(p => {
    if (!p) return [m]
    const n = p.includes(m) ? p.filter(x => x !== m) : [...p, m].sort()
    return n.length === 0 || n.length === data?.months?.length ? null : n
  })

  const hasData = siteList.length > 0

  return (
    <div className="space-y-4">

      {/* Header card */}
      <div className="rounded-xl p-4 flex items-center justify-between flex-wrap gap-3"
        style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}>
        <div>
          <h2 className="text-white font-bold text-lg">CRM — Phân Tích Khách Hàng</h2>
          <p className="text-blue-200 text-xs mt-0.5">Site → Bệnh viện / PK → Bác sĩ → Tháng</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {saving && <span className="text-yellow-300 text-xs">Đang lưu...</span>}
          {msg && <span className="text-blue-100 text-xs px-3 py-1 rounded-full bg-white/10">{msg}</span>}
          <label className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer text-white"
            style={{ background: uploading ? 'rgba(255,255,255,0.15)' : '#2563eb' }}>
            {uploading ? 'Đang xử lý...' : '⬆ Upload Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={handleFile} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* No data */}
      {!hasData && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <h3 className="text-lg font-bold text-gray-700 mb-2">Chưa có dữ liệu CRM</h3>
          <p className="text-sm text-gray-500 mb-1">Upload file <strong>FILE_TONGHOP_DULIEU.xlsx</strong></p>
          <p className="text-xs text-gray-400">Cần có sheet <strong>DOANHSO_2025</strong> hoặc <strong>DOANHSO_2026</strong></p>
        </div>
      )}

      {/* Main layout */}
      {hasData && (
        <div className="flex gap-4" style={{ minHeight: 600 }}>

          {/* Left: site selector */}
          <div className="w-44 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Chi nhánh</p>
            </div>
            {siteList.map(s => (
              <button key={s} onClick={() => { setSite(s); setOpenH({}) }}
                className="w-full text-left px-3 py-3 border-b border-gray-50 transition-colors"
                style={{ background: site === s ? '#eff6ff' : '' }}>
                <p className="text-sm font-semibold" style={{ color: site === s ? BLUE : '#374151' }}>{s}</p>
                <p className="text-xs mt-0.5" style={{ color: site === s ? '#3b82f6' : '#9ca3af' }}>
                  {(siteTotals[s] || 0).toLocaleString('vi-VN')} KH
                </p>
              </button>
            ))}
          </div>

          {/* Right: detail */}
          <div className="flex-1 space-y-3 min-w-0">

            {/* Month filter */}
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-gray-400 uppercase whitespace-nowrap">Tháng:</span>
              <button onClick={() => setSelMo(null)}
                className="px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap"
                style={{ background: !selMo ? BLUE : '#f1f5f9', color: !selMo ? '#fff' : '#64748b' }}>
                Tất cả
              </button>
              {data.months.map(m => {
                const on = selMo?.includes(m)
                return (
                  <button key={m} onClick={() => toggleMo(m)}
                    className="px-2 py-1 rounded text-xs whitespace-nowrap"
                    style={{
                      background: on ? '#dbeafe' : '#f8fafc',
                      color: on ? BLUE : '#94a3b8',
                      border: `1px solid ${on ? '#93c5fd' : '#e2e8f0'}`,
                    }}>
                    {fmtMo(m)}
                  </button>
                )
              })}
            </div>

            {/* Site summary */}
            <div className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}>
              <div>
                <h3 className="text-white font-bold text-base">{site}</h3>
                <p className="text-blue-200 text-xs mt-0.5">
                  {hospList.length} BV/PK •{' '}
                  {hospList.reduce((s, h) => s + Object.keys(siteData[h] || {}).length, 0)} bác sĩ
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {hospList.reduce((s, h) =>
                    s + Object.values(siteData[h] || {}).reduce((s2, d) => s2 + sum(d, months), 0), 0
                  ).toLocaleString('vi-VN')}
                </p>
                <p className="text-blue-200 text-xs">Tổng KH{selMo ? ` (${months.length} tháng)` : ''}</p>
              </div>
            </div>

            {/* Hospital blocks */}
            {hospList.map(hosp => {
              const hospKey  = `${site}__${hosp}`
              const isOpen   = openH[hospKey] !== false
              const isFree   = hosp === 'Tự do'
              const color    = isFree ? '#9ca3af' : BLUE
              const docs     = siteData[hosp] || {}
              const hospTotal = Object.values(docs).reduce((s, d) => s + sum(d, months), 0)
              const sorted   = Object.entries(docs)
                .map(([name, mo]) => ({ name, total: sum(mo, months), mo }))
                .sort((a, b) => b.total - a.total)

              return (
                <div key={hosp} className="bg-white rounded-xl border border-gray-200 overflow-hidden">

                  {/* hospital header */}
                  <button onClick={() => setOpenH(p => ({ ...p, [hospKey]: !isOpen }))}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                    style={{ borderLeft: `4px solid ${color}` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{isFree ? '🏃' : '🏥'}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{hosp}</p>
                        <p className="text-xs text-gray-400">{sorted.length} bác sĩ • {hospTotal.toLocaleString('vi-VN')} KH</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold" style={{ color }}>{hospTotal.toLocaleString('vi-VN')}</span>
                      <svg className={`w-4 h-4 text-gray-400 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* doctor table */}
                  {isOpen && sorted.length > 0 && (
                    <div className="overflow-x-auto border-t border-gray-100">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-4 text-left font-semibold text-gray-500 sticky left-0 bg-gray-50" style={{ minWidth: 180 }}>Bác sĩ</th>
                            {months.map(m => (
                              <th key={m} className="py-2 px-2 text-center font-semibold text-gray-500 whitespace-nowrap" style={{ minWidth: 48 }}>
                                {fmtMo(m)}
                              </th>
                            ))}
                            <th className="py-2 px-3 text-center font-bold sticky right-0 bg-gray-50" style={{ color: BLUE, minWidth: 56 }}>Tổng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((doc, i) => {
                            const maxV = Math.max(...months.map(m => doc.mo[m] || 0), 1)
                            return (
                              <tr key={doc.name} className="border-t border-gray-50 hover:bg-blue-50"
                                style={{ background: i % 2 ? '#fafbfc' : '#fff' }}>
                                <td className="py-2 px-4 font-medium text-gray-700 sticky left-0"
                                  style={{ background: i % 2 ? '#fafbfc' : '#fff' }}>{doc.name}</td>
                                {months.map(m => {
                                  const v = doc.mo[m] || 0
                                  return (
                                    <td key={m} className="py-1 px-1 text-center">
                                      {v > 0 ? (
                                        <div className="flex flex-col items-center gap-0.5">
                                          <span className="font-semibold text-gray-700">{v}</span>
                                          <div className="w-7 h-1 bg-gray-100 rounded-full">
                                            <div className="h-1 rounded-full" style={{ width: `${Math.round(v/maxV*100)}%`, background: color }} />
                                          </div>
                                        </div>
                                      ) : <span className="text-gray-200">—</span>}
                                    </td>
                                  )
                                })}
                                <td className="py-2 px-3 text-center font-bold sticky right-0"
                                  style={{ color: BLUE, background: i % 2 ? '#dbeafe' : '#eff6ff' }}>
                                  {doc.total.toLocaleString('vi-VN')}
                                </td>
                              </tr>
                            )
                          })}
                          {/* subtotal row */}
                          <tr className="border-t-2 border-gray-200" style={{ background: isFree ? '#f9fafb' : '#f0f9ff' }}>
                            <td className="py-2 px-4 font-bold text-xs sticky left-0"
                              style={{ color, background: isFree ? '#f9fafb' : '#f0f9ff' }}>
                              Tổng — {hosp}
                            </td>
                            {months.map(m => {
                              const t = sorted.reduce((s, d) => s + (d.mo[m] || 0), 0)
                              return <td key={m} className="py-2 px-1 text-center font-bold text-xs" style={{ color }}>{t || ''}</td>
                            })}
                            <td className="py-2 px-3 text-center font-bold sticky right-0"
                              style={{ color, background: isFree ? '#f3f4f6' : '#dbeafe' }}>
                              {hospTotal.toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isOpen && sorted.length === 0 && (
                    <p className="px-4 py-3 text-xs text-gray-400 italic border-t border-gray-100">
                      Không có dữ liệu trong kỳ đã chọn
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
