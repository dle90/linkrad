import React, { useEffect, useState, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { getCRM, saveCRM } from '../api'
import { useAuth } from '../context/AuthContext'

// ── helpers ───────────────────────────────────────────────────────────
function toYYYYMM(raw) {
  if (!raw) return null
  if (typeof raw === 'number' && raw > 1000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  const a = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (a) return `${a[3]}-${a[2].padStart(2, '0')}`
  const b = s.match(/^(\d{4})-(\d{2})/)
  if (b) return `${b[1]}-${b[2]}`
  return null
}

function findCol(headers, ...keys) {
  for (const k of keys) {
    const i = headers.findIndex(h => h && String(h).toLowerCase().includes(k.toLowerCase()))
    if (i >= 0) return i
  }
  return -1
}

function parseSheet(rows) {
  let hi = 0
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if ((rows[i] || []).some(c => String(c || '').toLowerCase().includes('chi nhanh'))) { hi = i; break }
  }
  const H    = (rows[hi] || []).map(c => String(c || '').trim())
  const iDate = findCol(H, 'ngay', 'ngày')
  const iSite = findCol(H, 'chi nhanh', 'chi nhánh')
  const iDoc  = findCol(H, 'ten bac si', 'tên bác sĩ')
  const iPl   = findCol(H, 'noi lam viec', 'nơi làm việc')
  const iPt   = findCol(H, 'ma khach hang', 'mã khách hàng')
  const iSrc  = findCol(H, 'nguon kh', 'nguồn kh')
  const out   = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r    = rows[i] || []
    const site = String(r[iSite] || '').trim()
    const pt   = String(r[iPt]   || '').trim()
    const mo   = toYYYYMM(r[iDate])
    if (!site || !pt || !mo) continue
    const src  = String(r[iSrc] || '').trim().toLowerCase()
    const pl   = String(r[iPl]  || '').trim()
    const doc  = String(r[iDoc] || '').trim()
    const hosp = (src.includes('tu den') || src.includes('tự đến') || !pl || pl === '-') ? 'Tự do' : pl
    out.push({ site, hosp, doc: doc || 'Không xác định', pt, mo })
  }
  return out
}

function buildCRM(rows) {
  const tree = {}, allMo = new Set()
  for (const { site, hosp, doc, pt, mo } of rows) {
    allMo.add(mo)
    if (!tree[site])            tree[site] = {}
    if (!tree[site][hosp])      tree[site][hosp] = {}
    if (!tree[site][hosp][doc]) tree[site][hosp][doc] = {}
    if (!tree[site][hosp][doc][mo]) tree[site][hosp][doc][mo] = new Set()
    tree[site][hosp][doc][mo].add(pt)
  }
  const sites = {}
  for (const [s, hs] of Object.entries(tree)) {
    sites[s] = {}
    for (const [h, ds] of Object.entries(hs)) {
      sites[s][h] = {}
      for (const [d, ms] of Object.entries(ds)) {
        sites[s][h][d] = {}
        for (const [m, set] of Object.entries(ms)) sites[s][h][d][m] = set.size
      }
    }
  }
  return { sites, months: [...allMo].sort(), updatedAt: new Date().toISOString() }
}

const sumMo  = (map, mos) => mos.reduce((s, m) => s + (map[m] || 0), 0)
const fmtMo  = m => m.replace(/^(\d{4})-(\d{2})$/, (_, y, mo) => `T${+mo}/${y.slice(2)}`)
const fmtNum = n => Number(n).toLocaleString('vi-VN')
const NAVY   = '#0f2c6b'
const BLUE   = '#1e3a8a'
const TEAL   = '#0e7490'

// ── summary table ────────────────────────────────────────────────────
function SummaryTable({ data, months, siteList, BLUE, NAVY }) {
  const [open, setOpen] = useState(true)
  const [expandedSites, setExpandedSites] = useState({})

  const rows = useMemo(() => {
    if (!data) return []
    return siteList.map(s => {
      const hosps = data.sites[s] || {}
      const hospRows = Object.keys(hosps)
        .filter(h => h !== 'Tự do')
        .sort((a, b) => a.localeCompare(b, 'vi'))
        .map(h => {
          const docs  = Object.keys(hosps[h] || {}).length
          const total = Object.values(hosps[h] || {}).reduce((s, d) => s + months.reduce((s2, m) => s2 + (d[m] || 0), 0), 0)
          return { hosp: h, docs, total }
        })
      const freeDocs  = Object.keys(hosps['Tự do'] || {}).length
      const freeTotal = Object.values(hosps['Tự do'] || {}).reduce((s, d) => s + months.reduce((s2, m) => s2 + (d[m] || 0), 0), 0)
      const totalDocs  = hospRows.reduce((s, r) => s + r.docs, freeDocs)
      const totalVisit = hospRows.reduce((s, r) => s + r.total, freeTotal)
      return { site: s, hospRows, freeDocs, freeTotal, totalDocs, totalVisit }
    })
  }, [data, siteList, months])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* header */}
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-sm font-extrabold text-gray-700 uppercase tracking-wide">Tổng quan — Tất cả chi nhánh</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: NAVY + '0d' }}>
                <th className="py-2.5 px-4 text-left font-extrabold text-gray-500 uppercase tracking-wider text-xs sticky left-0" style={{ background: NAVY + '0d', minWidth: 180 }}>Chi nhánh</th>
                <th className="py-2.5 px-4 text-left font-extrabold text-gray-500 uppercase tracking-wider text-xs" style={{ minWidth: 240 }}>Bệnh viện / PK</th>
                <th className="py-2.5 px-4 text-center font-extrabold text-gray-500 uppercase tracking-wider text-xs" style={{ minWidth: 100 }}>Bác sĩ</th>
                <th className="py-2.5 px-4 text-center font-extrabold text-gray-500 uppercase tracking-wider text-xs" style={{ minWidth: 120 }}>Tổng lượt KH</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const isExpanded = expandedSites[r.site] !== false
                const bgSite = ri % 2 === 0 ? '#f8fafc' : '#fff'
                return (
                  <React.Fragment key={r.site}>
                    {/* site row */}
                    <tr className="border-t border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                      style={{ background: bgSite }}
                      onClick={() => setExpandedSites(p => ({ ...p, [r.site]: !isExpanded }))}>
                      <td className="py-2.5 px-4 sticky left-0 font-extrabold" style={{ background: bgSite, color: BLUE }}>
                        <div className="flex items-center gap-2">
                          <svg className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                          {r.site}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-400 italic">
                        {r.hospRows.length} bệnh viện/PK{r.freeDocs > 0 ? ' + nhóm tự do' : ''}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold" style={{ color: BLUE }}>{r.totalDocs.toLocaleString('vi-VN')}</td>
                      <td className="py-2.5 px-4 text-center font-extrabold text-base" style={{ color: BLUE }}>{r.totalVisit.toLocaleString('vi-VN')}</td>
                    </tr>
                    {/* hospital rows */}
                    {isExpanded && r.hospRows.map((h, hi) => (
                      <tr key={h.hosp} className="border-t border-gray-50 hover:bg-blue-50 transition-colors"
                        style={{ background: hi % 2 === 0 ? '#f0f9ff' : '#e0f2fe' }}>
                        <td className="py-2 px-4 sticky left-0 text-xs text-gray-400"
                          style={{ background: hi % 2 === 0 ? '#f0f9ff' : '#e0f2fe' }}></td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🏥</span>
                            <span className="text-xs font-semibold text-gray-700">{h.hosp}</span>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center text-xs font-semibold text-gray-600">{h.docs.toLocaleString('vi-VN')}</td>
                        <td className="py-2 px-4 text-center text-xs font-bold" style={{ color: BLUE }}>{h.total.toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                    {/* "Tự do" row */}
                    {isExpanded && r.freeDocs > 0 && (
                      <tr className="border-t border-gray-50" style={{ background: '#f9fafb' }}>
                        <td className="py-2 px-4 sticky left-0 text-xs text-gray-400" style={{ background: '#f9fafb' }}></td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🏃</span>
                            <span className="text-xs font-semibold text-gray-500">Tự do (không thuộc BV/PK)</span>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center text-xs font-semibold text-gray-500">{r.freeDocs.toLocaleString('vi-VN')}</td>
                        <td className="py-2 px-4 text-center text-xs font-bold text-gray-500">{r.freeTotal.toLocaleString('vi-VN')}</td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
            {/* grand total */}
            <tfoot>
              <tr style={{ background: NAVY, borderTop: `2px solid ${NAVY}` }}>
                <td className="py-3 px-4 font-extrabold text-white text-xs uppercase tracking-wider sticky left-0" style={{ background: NAVY }}>TỔNG CỘNG</td>
                <td className="py-3 px-4 text-white text-xs">{rows.reduce((s, r) => s + r.hospRows.length, 0)} BV/PK trên {siteList.length} chi nhánh</td>
                <td className="py-3 px-4 text-center font-extrabold text-white">{rows.reduce((s, r) => s + r.totalDocs, 0).toLocaleString('vi-VN')}</td>
                <td className="py-3 px-4 text-center font-extrabold text-white text-base">{rows.reduce((s, r) => s + r.totalVisit, 0).toLocaleString('vi-VN')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── small stat card ───────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = BLUE }) => (
  <div className="rounded-xl px-5 py-4 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#93c5fd' }}>{label}</p>
    <p className="text-2xl font-bold text-white">{value}</p>
    {sub && <p className="text-xs" style={{ color: '#bfdbfe' }}>{sub}</p>}
  </div>
)

// ── badge ─────────────────────────────────────────────────────────────
const Badge = ({ n, color }) => (
  <span className="inline-flex items-center justify-center rounded-full text-xs font-bold px-2 py-0.5 min-w-[26px]"
    style={{ background: color + '22', color }}>
    {fmtNum(n)}
  </span>
)

// ═════════════════════════════════════════════════════════════════════
export default function CRM() {
  const { auth }  = useAuth()
  const isAdmin   = auth?.role === 'admin'
  const fileRef   = useRef(null)

  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [msg,       setMsg]       = useState('')
  const [saving,    setSaving]    = useState(false)
  const [site,      setSite]      = useState(null)
  const [openH,     setOpenH]     = useState({})
  const [selMo,     setSelMo]     = useState(null)

  useEffect(() => {
    getCRM().then(d => { if (d?.sites && d?.months) setData(d) }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (data && !site) setSite(Object.keys(data.sites || {})[0] || null)
  }, [data, site])

  const months   = useMemo(() => !data ? [] : selMo ? data.months.filter(m => selMo.includes(m)) : data.months, [data, selMo])
  const siteList = useMemo(() => Object.keys(data?.sites || {}).sort(), [data])
  const siteData = useMemo(() => (data && site) ? (data.sites[site] || {}) : {}, [data, site])
  const hospList = useMemo(() =>
    Object.keys(siteData).sort((a, b) => a === 'Tự do' ? 1 : b === 'Tự do' ? -1 : a.localeCompare(b, 'vi'))
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

  // global KPIs
  const kpis = useMemo(() => {
    if (!data) return { totalKH: 0, totalDocs: 0, totalHosps: 0 }
    let totalKH = 0, docSet = new Set(), hospSet = new Set()
    for (const [s, hs] of Object.entries(data.sites)) {
      for (const [h, ds] of Object.entries(hs)) {
        if (h !== 'Tự do') hospSet.add(h)
        for (const [d, ms] of Object.entries(ds)) {
          docSet.add(`${s}||${d}`)
          for (const m of months) totalKH += ms[m] || 0
        }
      }
    }
    return { totalKH, totalDocs: docSet.size, totalHosps: hospSet.size }
  }, [data, months])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── event handlers ────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setMsg('Đang đọc file...')
    const reader = new FileReader()
    reader.onload = ({ target }) => {
      try {
        const wb = XLSX.read(new Uint8Array(target.result), { type: 'array', cellDates: false })
        const sheets = wb.SheetNames.filter(n => n.toUpperCase().includes('DOANHSO'))
        if (!sheets.length) { setMsg('Không thấy sheet DOANHSO'); setUploading(false); return }
        let all = []
        for (const name of sheets)
          all = all.concat(parseSheet(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })))
        if (!all.length) { setMsg('Không đọc được dữ liệu'); setUploading(false); return }
        const built = buildCRM(all)
        setData(built); setSite(Object.keys(built.sites)[0] || null)
        setOpenH({}); setSelMo(null)
        setMsg(`✓ ${fmtNum(all.length)} dòng • ${Object.keys(built.sites).length} chi nhánh • ${built.months.length} tháng`)
        setUploading(false)
        if (isAdmin) { setSaving(true); saveCRM(built).finally(() => setSaving(false)) }
      } catch (err) { setMsg(`Lỗi: ${err.message}`); setUploading(false) }
    }
    reader.readAsArrayBuffer(file); e.target.value = ''
  }

  const toggleMo = (m) => setSelMo(p => {
    if (!p) return [m]
    const n = p.includes(m) ? p.filter(x => x !== m) : [...p, m].sort()
    return !n.length || n.length === data?.months?.length ? null : n
  })

  const hasData  = siteList.length > 0
  const maxSite  = Math.max(...siteList.map(s => siteTotals[s] || 0), 1)

  return (
    <div className="space-y-4">

      {/* ── HERO BANNER ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1e3a8a 50%, ${TEAL} 100%)` }}>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">👥</span>
              <h2 className="text-white font-extrabold text-xl tracking-tight">CRM — Phân Tích Khách Hàng</h2>
            </div>
            <p className="text-blue-200 text-sm">Site → Bệnh viện / Phòng khám → Bác sĩ → Lượt khách theo tháng</p>
          </div>
          <div className="flex items-center gap-3">
            {saving && <span className="text-yellow-300 text-xs animate-pulse">Đang lưu...</span>}
            {msg    && <span className="text-blue-100 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.15)' }}>{msg}</span>}
            <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer shadow-lg transition-all hover:scale-105 active:scale-95"
              style={{ background: uploading ? 'rgba(255,255,255,0.15)' : '#f59e0b', color: uploading ? '#fff' : '#1c1917' }}>
              {uploading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Đang xử lý...</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/></svg>Upload Excel</>
              }
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
          </div>
        </div>
        {/* KPI cards */}
        {hasData && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Tổng lượt KH" value={fmtNum(kpis.totalKH)} sub={!selMo ? 'Cả năm' : `${months.length} tháng`} />
            <StatCard label="Tổng bác sĩ" value={fmtNum(kpis.totalDocs)} sub="Tất cả chi nhánh" />
            <StatCard label="Bệnh viện / PK" value={fmtNum(kpis.totalHosps)} sub="Không kể nhóm tự do" />
          </div>
        )}
      </div>

      {/* ── NO DATA ─────────────────────────────────────────────────── */}
      {!hasData && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">Chưa có dữ liệu CRM</h3>
          <p className="text-sm text-gray-500 mb-1">Click <strong>Upload Excel</strong> để tải file <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">FILE_TONGHOP_DULIEU.xlsx</code></p>
          <p className="text-xs text-gray-400 mt-3">File cần có sheet <strong>DOANHSO_2025</strong> hoặc <strong>DOANHSO_2026</strong></p>
        </div>
      )}

      {/* ── MAIN LAYOUT ─────────────────────────────────────────────── */}
      {hasData && (
        <div className="flex gap-4">

          {/* ── LEFT SIDEBAR: sites ───────────────────────────────── */}
          <div className="w-52 flex-shrink-0 space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50"
                style={{ background: `linear-gradient(90deg, ${NAVY}11, transparent)` }}>
                <p className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Chi nhánh</p>
              </div>
              {siteList.map(s => {
                const total  = siteTotals[s] || 0
                const pct    = Math.round(total / maxSite * 100)
                const active = s === site
                return (
                  <button key={s} onClick={() => { setSite(s); setOpenH({}) }}
                    className="w-full text-left px-4 py-3 border-b border-gray-50 transition-all hover:bg-blue-50 group"
                    style={{ background: active ? '#eff6ff' : '' }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold truncate" style={{ color: active ? BLUE : '#374151' }}>{s}</p>
                      <Badge n={total} color={active ? BLUE : '#6b7280'} />
                    </div>
                    {/* mini progress bar */}
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-1 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: active ? BLUE : '#d1d5db' }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT: detail ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Month pills */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-2.5 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest whitespace-nowrap">Lọc tháng:</span>
              <button onClick={() => setSelMo(null)}
                className="px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                style={{ background: !selMo ? BLUE : '#f1f5f9', color: !selMo ? '#fff' : '#64748b' }}>
                Tất cả
              </button>
              {data.months.map(m => {
                const on = selMo?.includes(m)
                return (
                  <button key={m} onClick={() => toggleMo(m)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
                    style={{
                      background: on ? '#dbeafe' : '#f8fafc',
                      color: on ? BLUE : '#94a3b8',
                      border: `1.5px solid ${on ? BLUE : '#e2e8f0'}`,
                    }}>
                    {fmtMo(m)}
                  </button>
                )
              })}
            </div>

            {/* ── SUMMARY TABLE ─────────────────────────────────── */}
            <SummaryTable data={data} months={months} siteList={siteList} BLUE={BLUE} NAVY={NAVY} />

            {/* Site summary row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: site, sub: 'Chi nhánh đang xem', icon: '📍' },
                { label: fmtNum(hospList.reduce((s, h) => s + Object.values(siteData[h] || {}).reduce((s2, d) => s2 + sumMo(d, months), 0), 0)), sub: 'Tổng lượt KH', icon: '🧑‍🤝‍🧑' },
                { label: fmtNum(hospList.filter(h => h !== 'Tự do').length), sub: 'Bệnh viện / PK', icon: '🏥' },
                { label: fmtNum(hospList.reduce((s, h) => s + Object.keys(siteData[h] || {}).length, 0)), sub: 'Bác sĩ', icon: '👨‍⚕️' },
              ].map(({ label, sub, icon }) => (
                <div key={sub} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="text-xl font-extrabold" style={{ color: BLUE }}>{label}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Hospital accordion blocks */}
            {hospList.map(hosp => {
              const hospKey   = `${site}__${hosp}`
              const isOpen    = openH[hospKey] !== false
              const isFree    = hosp === 'Tự do'
              const hColor    = isFree ? '#6b7280' : BLUE
              const docs      = siteData[hosp] || {}
              const hospTotal = Object.values(docs).reduce((s, d) => s + sumMo(d, months), 0)
              const sorted    = Object.entries(docs)
                .map(([name, mo]) => ({ name, total: sumMo(mo, months), mo }))
                .sort((a, b) => b.total - a.total)
              const maxDoc = Math.max(...sorted.map(d => d.total), 1)

              return (
                <div key={hosp} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                  {/* header */}
                  <button onClick={() => setOpenH(p => ({ ...p, [hospKey]: !isOpen }))}
                    className="w-full flex items-center justify-between px-5 py-4 transition-all hover:bg-gray-50 text-left"
                    style={{ borderLeft: `5px solid ${hColor}` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: hColor + '18' }}>
                        {isFree ? '🏃' : '🏥'}
                      </div>
                      <div>
                        <p className="font-extrabold text-gray-800 text-sm leading-tight">{hosp}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{sorted.length} bác sĩ</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* mini bars for top 3 months */}
                      <div className="hidden sm:flex items-end gap-1 h-8">
                        {months.slice(-6).map(m => {
                          const v = sorted.reduce((s, d) => s + (d.mo[m] || 0), 0)
                          const maxV = months.slice(-6).reduce((mx, mm) => Math.max(mx, sorted.reduce((s, d) => s + (d.mo[mm] || 0), 0)), 1)
                          return (
                            <div key={m} className="w-3 rounded-t"
                              title={`${fmtMo(m)}: ${v}`}
                              style={{ height: `${Math.max(Math.round(v / maxV * 100), 4)}%`, background: v > 0 ? hColor : '#e5e7eb' }} />
                          )
                        })}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-extrabold" style={{ color: hColor }}>{fmtNum(hospTotal)}</p>
                        <p className="text-xs text-gray-400">lượt KH</p>
                      </div>
                      <svg className={`w-5 h-5 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* table */}
                  {isOpen && sorted.length > 0 && (
                    <div className="overflow-x-auto border-t border-gray-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: hColor + '0d' }}>
                            <th className="py-2.5 px-5 text-left font-extrabold sticky left-0 z-10 text-gray-500 uppercase tracking-wider"
                              style={{ background: hColor + '0d', minWidth: 200 }}>Bác sĩ</th>
                            {months.map(m => (
                              <th key={m} className="py-2.5 px-2 text-center font-bold text-gray-400 whitespace-nowrap" style={{ minWidth: 48 }}>
                                {fmtMo(m)}
                              </th>
                            ))}
                            <th className="py-2.5 px-4 text-center font-extrabold sticky right-0 z-10 whitespace-nowrap"
                              style={{ color: hColor, background: hColor + '18', minWidth: 64 }}>
                              Tổng
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((doc, i) => {
                            const rankPct = Math.round(doc.total / maxDoc * 100)
                            return (
                              <tr key={doc.name} className="border-t border-gray-50 hover:bg-blue-50 transition-colors"
                                style={{ background: i % 2 ? '#fafbfc' : '#fff' }}>
                                <td className="py-2.5 px-5 sticky left-0 z-10"
                                  style={{ background: i % 2 ? '#fafbfc' : '#fff' }}>
                                  <div className="flex items-center gap-2">
                                    {i < 3 && (
                                      <span className="w-5 h-5 rounded-full text-xs font-extrabold flex items-center justify-center flex-shrink-0"
                                        style={{ background: [BLUE, '#0284c7', TEAL][i] + '22', color: [BLUE, '#0284c7', TEAL][i] }}>
                                        {i + 1}
                                      </span>
                                    )}
                                    <div>
                                      <p className="font-semibold text-gray-700">{doc.name}</p>
                                      {/* rank bar */}
                                      <div className="w-20 h-1 bg-gray-100 rounded-full mt-0.5">
                                        <div className="h-1 rounded-full" style={{ width: `${rankPct}%`, background: hColor }} />
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                {months.map(m => {
                                  const v = doc.mo[m] || 0
                                  const maxV = Math.max(...months.map(x => doc.mo[x] || 0), 1)
                                  return (
                                    <td key={m} className="py-2 px-2 text-center">
                                      {v > 0 ? (
                                        <div className="flex flex-col items-center gap-0.5">
                                          <span className="font-bold text-gray-700">{v}</span>
                                          <div className="w-6 h-1 bg-gray-100 rounded-full">
                                            <div className="h-1 rounded-full" style={{ width: `${Math.round(v / maxV * 100)}%`, background: hColor }} />
                                          </div>
                                        </div>
                                      ) : <span className="text-gray-200">—</span>}
                                    </td>
                                  )
                                })}
                                <td className="py-2.5 px-4 text-center font-extrabold sticky right-0 z-10 text-base"
                                  style={{ color: hColor, background: i % 2 ? hColor + '15' : hColor + '0d' }}>
                                  {fmtNum(doc.total)}
                                </td>
                              </tr>
                            )
                          })}
                          {/* subtotal */}
                          <tr style={{ background: hColor + '18', borderTop: `2px solid ${hColor}30` }}>
                            <td className="py-3 px-5 font-extrabold sticky left-0 z-10 text-xs uppercase tracking-wider"
                              style={{ color: hColor, background: hColor + '18' }}>
                              Tổng — {hosp}
                            </td>
                            {months.map(m => {
                              const t = sorted.reduce((s, d) => s + (d.mo[m] || 0), 0)
                              return (
                                <td key={m} className="py-3 px-2 text-center font-bold" style={{ color: hColor }}>
                                  {t > 0 ? t : ''}
                                </td>
                              )
                            })}
                            <td className="py-3 px-4 text-center font-extrabold text-base sticky right-0 z-10"
                              style={{ color: hColor, background: hColor + '28' }}>
                              {fmtNum(hospTotal)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isOpen && sorted.length === 0 && (
                    <p className="px-5 py-4 text-xs text-gray-400 italic border-t border-gray-100">
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
