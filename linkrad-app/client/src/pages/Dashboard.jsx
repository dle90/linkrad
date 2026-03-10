import React, { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, ReferenceLine
} from 'recharts'
import { getAnnualPL, getMonthlyPL, getActuals } from '../api'

const fmt = (v) => {
  if (v === null || v === undefined) return '-'
  return Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}

// Generate a performance comment + badge for each site based on financials
function getSiteComment(site, rev, ebitda, pat, margin) {
  const pct = (margin * 100).toFixed(1)
  const isNewSite = rev < 1500
  const isRampUp  = rev >= 1500 && rev < 4000

  // EBITDA positive but PAT negative → interest/depreciation drag
  const interestDrag = ebitda > 0 && pat < 0

  if (ebitda < 0) {
    if (isNewSite) {
      return {
        badge: 'Mới',
        color: 'bg-gray-100 text-gray-600',
        text: 'Site mới, doanh thu đang trong giai đoạn khởi động. Chưa đủ công suất để bù đắp định phí.'
      }
    }
    return {
      badge: 'Lỗ EBITDA',
      color: 'bg-red-100 text-red-700',
      text: `EBITDA âm ${fmt(ebitda)} tr. — cần tăng số ca hoặc kiểm soát chi phí biến đổi và định phí.`
    }
  }

  if (margin >= 0.35) {
    return {
      badge: 'Xuất sắc',
      color: 'bg-emerald-100 text-emerald-700',
      text: `Biên EBITDA ${pct}% — hiệu quả hoạt động rất cao.${interestDrag ? ' Lợi nhuận ròng bị ảnh hưởng bởi lãi vay & khấu hao.' : ' Đóng góp tốt vào dòng tiền toàn công ty.'}`
    }
  }

  if (margin >= 0.20) {
    return {
      badge: 'Tốt',
      color: 'bg-green-100 text-green-700',
      text: `Biên EBITDA ${pct}% — hoạt động ổn định.${interestDrag ? ' Chi phí lãi vay & khấu hao lớn đang ăn vào lợi nhuận ròng.' : ' Lợi nhuận ròng dương, khả quan.'}`
    }
  }

  if (margin >= 0.08) {
    if (isRampUp) {
      return {
        badge: 'Ramp-up',
        color: 'bg-yellow-100 text-yellow-700',
        text: `Biên EBITDA ${pct}%, doanh thu còn thấp — site đang trong giai đoạn tăng công suất. Cần theo dõi tốc độ tăng trưởng số ca.`
      }
    }
    return {
      badge: 'Trung bình',
      color: 'bg-yellow-100 text-yellow-700',
      text: `Biên EBITDA ${pct}% — còn dư địa cải thiện. ${interestDrag ? 'Chi phí tài chính đang ảnh hưởng lợi nhuận ròng.' : 'Tập trung tăng doanh thu và tối ưu định phí.'}`
    }
  }

  return {
    badge: 'Cần cải thiện',
    color: 'bg-orange-100 text-orange-700',
    text: `Biên EBITDA ${pct}% — gần điểm hòa vốn. ${isRampUp ? 'Site đang ramp-up, cần đẩy mạnh số ca dịch vụ.' : 'Nên xem xét lại cơ cấu chi phí định phí.'}`
  }
}

const MONTH_LABELS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']

const QUICK_PERIODS = [
  { key: 'year', label: 'Cả năm', months: [0,1,2,3,4,5,6,7,8,9,10,11] },
  { key: 'q1',   label: 'Q1',     months: [0,1,2] },
  { key: 'q2',   label: 'Q2',     months: [3,4,5] },
  { key: 'q3',   label: 'Q3',     months: [6,7,8] },
  { key: 'q4',   label: 'Q4',     months: [9,10,11] },
  ...MONTH_LABELS.map((m, i) => ({ key: `m${i+1}`, label: m, months: [i] }))
]

export default function Dashboard() {
  const [annualPL, setAnnualPL] = useState(null)
  const [monthlyPL, setMonthlyPL] = useState(null)
  const [actuals, setActuals] = useState({})
  const [loading, setLoading] = useState(true)

  // --- Time filter state ---
  const [timeMode, setTimeMode] = useState('preset') // 'preset' | 'range'
  const [period, setPeriod] = useState('year')
  const [rangeStart, setRangeStart] = useState(1)  // 1-12
  const [rangeEnd, setRangeEnd] = useState(12)      // 1-12

  // --- Site filter state ---
  const [selectedSites, setSelectedSites] = useState(null) // null = all (set after data loads)

  useEffect(() => {
    Promise.all([getAnnualPL(), getMonthlyPL(), getActuals()])
      .then(([apl, mpl, acts]) => {
        setAnnualPL(apl)
        setMonthlyPL(mpl)
        setActuals(acts)
        const main = (apl.sites || []).filter(s => s !== 'HO' && s !== 'Site LK')
        setSelectedSites(main)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Derived: which 0-based month indices are active
  // Must be before any conditional returns (Rules of Hooks)
  const selectedMonthIndices = useMemo(() => {
    if (timeMode === 'range') {
      const start = Math.min(rangeStart, rangeEnd) - 1
      const end   = Math.max(rangeStart, rangeEnd) - 1
      return Array.from({ length: end - start + 1 }, (_, i) => start + i)
    }
    return QUICK_PERIODS.find(p => p.key === period)?.months ?? [0,1,2,3,4,5,6,7,8,9,10,11]
  }, [timeMode, period, rangeStart, rangeEnd])

  const periodLabel = useMemo(() => {
    if (timeMode === 'range') {
      const s = Math.min(rangeStart, rangeEnd)
      const e = Math.max(rangeStart, rangeEnd)
      return s === e ? `T${s} 2025` : `T${s}–T${e} 2025`
    }
    const p = QUICK_PERIODS.find(p => p.key === period)
    return p?.label === 'Cả năm' ? '2025' : `${p?.label} 2025`
  }, [timeMode, period, rangeStart, rangeEnd])

  const isFullYear = timeMode === 'preset' && period === 'year'

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Đang tải...</div>
  if (!annualPL || !monthlyPL) return <div className="text-red-500 p-4">Lỗi tải dữ liệu</div>

  const allSites = annualPL.sites || []
  const rows = annualPL.rows || []
  const mainSites = allSites.filter(s => s !== 'HO' && s !== 'Site LK')
  const activeSel = selectedSites || mainSites

  const getRow = (id) => rows.find(r => r.id === id)
  const revTotalRow  = getRow('rev_total')
  const ebitdaRow    = getRow('ebitda_site')
  const patRow       = getRow('pat')

  const monthlyRevRow    = monthlyPL.rows?.find(r => r.id === 'rev_total')
  const monthlyEbitdaRow = monthlyPL.rows?.find(r => r.id === 'ebitda')

  // Sum annual values for selected sites
  const sumAnnual = (row) =>
    row ? activeSel.reduce((s, site) => s + (Number(row.values?.[site]) || 0), 0) : 0

  // Sum annual for ALL main sites (for ratio calculation)
  const sumAnnualAll = (row) =>
    row ? mainSites.reduce((s, site) => s + (Number(row.values?.[site]) || 0), 0) : 0

  // Sum monthly consolidated for selected months
  const sumMonthly = (row) =>
    row ? selectedMonthIndices.reduce((s, i) => s + (Number(row.values?.[i]) || 0), 0) : 0

  // Site ratio (used to prorate monthly totals when sites are filtered)
  const allSitesAnnualRev = sumAnnualAll(revTotalRow)
  const selSitesAnnualRev = sumAnnual(revTotalRow)
  const siteRatio = allSitesAnnualRev > 0 ? selSitesAnnualRev / allSitesAnnualRev : 1

  // KPI totals
  let totalRev, totalEbitda, totalPat
  if (isFullYear) {
    totalRev    = sumAnnual(revTotalRow)
    totalEbitda = sumAnnual(ebitdaRow)
    totalPat    = sumAnnual(patRow)
  } else {
    // Use monthly consolidated × site ratio
    totalRev    = sumMonthly(monthlyRevRow) * siteRatio
    totalEbitda = sumMonthly(monthlyEbitdaRow) * siteRatio
    totalPat    = totalEbitda // monthly PAT not tracked separately
  }

  const siteFilterActive = activeSel.length !== mainSites.length

  // Time ratio: scale annual per-site data to selected period
  const fullYearRev    = MONTH_LABELS.reduce((s, _, i) => s + (Number(monthlyRevRow?.values?.[i]) || 0), 0)
  const fullYearEbitda = MONTH_LABELS.reduce((s, _, i) => s + (Number(monthlyEbitdaRow?.values?.[i]) || 0), 0)
  const timeRatioRev    = !isFullYear && fullYearRev    !== 0 ? sumMonthly(monthlyRevRow)    / fullYearRev    : 1
  const timeRatioEbitda = !isFullYear && fullYearEbitda !== 0 ? sumMonthly(monthlyEbitdaRow) / fullYearEbitda : 1

  // ── Site bar chart data — respects both time filter and site filter
  const revBySite = mainSites
    .filter(site => activeSel.includes(site))
    .map(site => ({
      name: site.length > 7 ? site.slice(0, 7) + '..' : site,
      fullName: site,
      revenue: (Number(revTotalRow?.values?.[site]) || 0) * timeRatioRev,
      ebitda:  (Number(ebitdaRow?.values?.[site])   || 0) * timeRatioEbitda,
      pat:     (Number(patRow?.values?.[site])       || 0) * timeRatioEbitda,
    }))

  // ── Monthly trend data — 2025 scaled by site ratio; 2026 aggregated per month filtered by sites
  const actuals2026ByMonth = {}
  Object.entries(actuals).forEach(([key, d]) => {
    if (!key.startsWith('2026-')) return
    const parts = key.split('-')
    const mo = parseInt(parts[1])
    const site = parts.slice(2).join('-') || d.site
    if (siteFilterActive && !activeSel.includes(site)) return
    if (!actuals2026ByMonth[mo]) actuals2026ByMonth[mo] = { revenue: 0, ebitda: 0 }
    actuals2026ByMonth[mo].revenue += d.rev_total || 0
    actuals2026ByMonth[mo].ebitda  += d.ebitda    || 0
  })

  const monthlyData = [
    // 2025 months scaled by site ratio
    ...MONTH_LABELS.map((m, i) => ({
      month: `${m}'25`,
      revenue: (Number(monthlyRevRow?.values?.[i])    || 0) * siteRatio,
      ebitda:  (Number(monthlyEbitdaRow?.values?.[i]) || 0) * siteRatio,
      selected: selectedMonthIndices.includes(i),
      isActual: false,
    })),
    // 2026 actuals aggregated by month (filtered by selected sites)
    ...Object.entries(actuals2026ByMonth)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([mo, d]) => ({
        month: `T${mo}'26`,
        revenue: d.revenue,
        ebitda:  d.ebitda,
        selected: false,
        isActual: true,
      }))
  ]

  // ── Site summary table
  const siteSummary = mainSites
    .filter(site => activeSel.includes(site))
    .map(site => {
      const rev    = Number(revTotalRow?.values?.[site]) || 0
      const ebitda = Number(ebitdaRow?.values?.[site]) || 0
      const pat    = Number(patRow?.values?.[site]) || 0
      return { site, rev, ebitda, pat, margin: rev > 0 ? ebitda / rev : 0 }
    })

  // ── Handlers
  const toggleSite = (site) => {
    setSelectedSites(prev => {
      const cur = prev || mainSites
      if (cur.includes(site)) {
        const next = cur.filter(s => s !== site)
        return next.length === 0 ? cur : next // don't allow empty
      }
      return [...cur, site]
    })
  }
  const selectAllSites = () => setSelectedSites([...mainSites])

  const handlePresetClick = (key) => {
    setTimeMode('preset')
    setPeriod(key)
  }

  const handleRangeStart = (v) => {
    setTimeMode('range')
    const n = Number(v)
    setRangeStart(n)
    if (n > rangeEnd) setRangeEnd(n)
  }

  const handleRangeEnd = (v) => {
    setTimeMode('range')
    const n = Number(v)
    setRangeEnd(n)
    if (n < rangeStart) setRangeStart(n)
  }

  const kpiCards = [
    {
      label: `Tổng Doanh Thu (${periodLabel})`,
      value: fmt(totalRev) + ' tr.',
      sub: siteFilterActive ? `${activeSel.length} chi nhánh` : 'VND triệu',
      color: 'bg-blue-600', icon: '💵',
    },
    {
      label: `EBITDA (${periodLabel})`,
      value: fmt(totalEbitda) + ' tr.',
      sub: totalRev > 0 ? 'Margin: ' + (totalEbitda / totalRev * 100).toFixed(1) + '%' : '',
      color: totalEbitda >= 0 ? 'bg-green-600' : 'bg-red-600', icon: '📈',
    },
    {
      label: `Lợi nhuận sau thuế (${periodLabel})`,
      value: fmt(totalPat) + ' tr.',
      sub: isFullYear ? 'PAT' : 'Ước tính',
      color: totalPat >= 0 ? 'bg-emerald-600' : 'bg-red-600', icon: '✅',
    },
    {
      label: 'Sites được chọn',
      value: `${activeSel.length} / ${mainSites.length}`,
      sub: 'Chi nhánh',
      color: 'bg-purple-600', icon: '🏥',
    },
  ]

  return (
    <div className="space-y-4">

      {/* ── Filter Panel ── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 space-y-3">

        {/* Row 1: Time filter */}
        <div className="flex items-start gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1 min-w-[80px]">
            Kỳ báo cáo:
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {/* Preset buttons */}
            {QUICK_PERIODS.slice(0, 5).map(p => (
              <button key={p.key} onClick={() => handlePresetClick(p.key)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  timeMode === 'preset' && period === p.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {p.label}
              </button>
            ))}
            <span className="text-gray-300 mx-1">|</span>
            {QUICK_PERIODS.slice(5).map(p => (
              <button key={p.key} onClick={() => handlePresetClick(p.key)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  timeMode === 'preset' && period === p.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {p.label}
              </button>
            ))}

            {/* Range picker */}
            <span className="text-gray-300 mx-1">|</span>
            <span className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
              timeMode === 'range' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'
            }`}>
              Khoảng:
            </span>
            <select
              value={timeMode === 'range' ? rangeStart : ''}
              onChange={e => handleRangeStart(e.target.value)}
              className={`text-xs border rounded px-2 py-1 outline-none cursor-pointer ${
                timeMode === 'range' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
              }`}
            >
              <option value="">Từ tháng</option>
              {MONTH_LABELS.map((m, i) => (
                <option key={i} value={i+1}>{m}</option>
              ))}
            </select>
            <span className="text-gray-400 text-xs">→</span>
            <select
              value={timeMode === 'range' ? rangeEnd : ''}
              onChange={e => handleRangeEnd(e.target.value)}
              className={`text-xs border rounded px-2 py-1 outline-none cursor-pointer ${
                timeMode === 'range' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
              }`}
            >
              <option value="">Đến tháng</option>
              {MONTH_LABELS.map((m, i) => (
                <option key={i} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Row 2: Site filter */}
        <div className="flex items-start gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1 min-w-[80px]">
            Chi nhánh:
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={selectAllSites}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeSel.length === mainSites.length
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tất cả
            </button>
            <span className="text-gray-300 mx-1">|</span>
            {mainSites.map(site => (
              <button
                key={site}
                onClick={() => toggleSite(site)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  activeSel.includes(site)
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                {site}
              </button>
            ))}
          </div>
        </div>

        {/* Active filter summary */}
        {(timeMode === 'range' || siteFilterActive) && (
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs text-gray-400">Đang lọc:</span>
            {timeMode === 'range' && (
              <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-full px-2 py-0.5">
                📅 {periodLabel}
                <button onClick={() => { setTimeMode('preset'); setPeriod('year') }}
                  className="ml-1 hover:text-blue-900 font-bold">×</button>
              </span>
            )}
            {siteFilterActive && (
              <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs rounded-full px-2 py-0.5">
                🏥 {activeSel.length} sites
                <button onClick={selectAllSites} className="ml-1 hover:text-indigo-900 font-bold">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className={`${card.color} px-4 py-3 text-white`}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium opacity-90">{card.label}</div>
                <span className="text-lg">{card.icon}</span>
              </div>
              <div className="text-xl font-bold mt-1">{card.value}</div>
            </div>
            <div className="px-4 py-2 text-xs text-gray-500">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Revenue by site */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Doanh Thu theo Chi Nhánh
              {siteFilterActive && <span className="ml-1 text-xs font-normal text-indigo-500">({activeSel.length} sites)</span>}
            </h3>
            <span className="text-xs font-medium text-blue-600">{periodLabel}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revBySite} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v/1000).toFixed(0) + 'k'} />
              <Tooltip
                formatter={(v) => [fmt(v) + ' tr.', 'Doanh thu']}
                labelFormatter={label => revBySite.find(d => d.name === label)?.fullName || label}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly trend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Xu Hướng Doanh Thu Tháng</h3>
            <span className="text-xs font-medium text-indigo-600">
              {siteFilterActive ? `${activeSel.length} sites` : 'Tất cả'}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={({ x, y, payload, index }) => (
                <text x={x} y={y + 10} textAnchor="middle" fontSize={10}
                  fill={monthlyData[index]?.selected ? '#1d4ed8' : '#9ca3af'}
                  fontWeight={monthlyData[index]?.selected ? '700' : '400'}>
                  {payload.value}
                </text>
              )} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v/1000).toFixed(1) + 'k'} />
              <Tooltip formatter={(v, name) => [fmt(v) + ' tr.', name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x="T12'25" stroke="#d1d5db" strokeDasharray="4 4" label={{ value: '2025|2026', position: 'top', fontSize: 9, fill: '#9ca3af' }} />
              <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#3b82f6" strokeWidth={2}
                dot={({ cx, cy, index }) => {
                  const d = monthlyData[index]
                  if (!d) return null
                  if (d.isActual) return <rect key={index} x={cx-4} y={cy-4} width={8} height={8} fill="#1d4ed8" stroke="white" strokeWidth={1} />
                  return <circle key={index} cx={cx} cy={cy} r={d.selected ? 5 : 3} fill={d.selected ? '#1d4ed8' : '#3b82f6'} stroke="white" strokeWidth={1} />
                }}
              />
              <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="#10b981" strokeWidth={2}
                dot={({ cx, cy, index }) => {
                  const d = monthlyData[index]
                  if (!d) return null
                  if (d.isActual) return <rect key={index} x={cx-4} y={cy-4} width={8} height={8} fill="#065f46" stroke="white" strokeWidth={1} />
                  return <circle key={index} cx={cx} cy={cy} r={d.selected ? 5 : 3} fill={d.selected ? '#065f46' : '#10b981'} stroke="white" strokeWidth={1} />
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── EBITDA by site ── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            EBITDA theo Chi Nhánh
            {siteFilterActive && <span className="ml-1 text-xs font-normal text-indigo-500">({activeSel.length} sites)</span>}
          </h3>
          <span className="text-xs font-medium text-blue-600">{periodLabel}</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={revBySite} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v/1000).toFixed(1) + 'k'} />
            <ReferenceLine y={0} stroke="#d1d5db" />
            <Tooltip
              formatter={(v) => [fmt(v) + ' tr.', 'EBITDA']}
              labelFormatter={label => revBySite.find(d => d.name === label)?.fullName || label}
            />
            <Bar dataKey="ebitda" radius={[3,3,0,0]}>
              {revBySite.map((entry, i) => (
                <Cell key={i} fill={entry.ebitda >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Net Profit (PAT) by site ── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Net Profit (PAT) theo Chi Nhánh
            {siteFilterActive && <span className="ml-1 text-xs font-normal text-indigo-500">({activeSel.length} sites)</span>}
          </h3>
          <span className="text-xs font-medium text-blue-600">{periodLabel}</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={revBySite} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v/1000).toFixed(1) + 'k'} />
            <ReferenceLine y={0} stroke="#d1d5db" />
            <Tooltip
              formatter={(v) => [fmt(v) + ' tr.', 'Net Profit (PAT)']}
              labelFormatter={label => revBySite.find(d => d.name === label)?.fullName || label}
            />
            <Bar dataKey="pat" radius={[3,3,0,0]}>
              {revBySite.map((entry, i) => (
                <Cell key={i} fill={entry.pat >= 0 ? '#6366f1' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Site Summary Table ── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Tóm Tắt Kết Quả Kinh Doanh theo Chi Nhánh
          </h3>
          <span className="text-xs text-gray-400">Cả năm 2025 • {activeSel.length} chi nhánh</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b-2 border-gray-200">
                <th className="py-2 px-3 text-gray-600 font-semibold">Chi nhánh</th>
                <th className="py-2 px-3 text-right text-gray-600 font-semibold">Doanh thu (tr.)</th>
                <th className="py-2 px-3 text-right text-gray-600 font-semibold">EBITDA (tr.)</th>
                <th className="py-2 px-3 text-right text-gray-600 font-semibold">PAT (tr.)</th>
                <th className="py-2 px-3 text-right text-gray-600 font-semibold">EBITDA Margin</th>
                <th className="py-2 px-3 text-gray-600 font-semibold">Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              {siteSummary.map((row, i) => {
                const comment = getSiteComment(row.site, row.rev, row.ebitda, row.pat, row.margin)
                return (
                  <tr key={row.site} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="py-2 px-3 font-medium text-gray-700 whitespace-nowrap">{row.site}</td>
                    <td className="py-2 px-3 text-right text-blue-700 whitespace-nowrap">{fmt(row.rev)}</td>
                    <td className={`py-2 px-3 text-right font-medium whitespace-nowrap ${row.ebitda >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(row.ebitda)}
                    </td>
                    <td className={`py-2 px-3 text-right font-medium whitespace-nowrap ${row.pat >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(row.pat)}
                    </td>
                    <td className={`py-2 px-3 text-right whitespace-nowrap ${row.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(row.margin * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 min-w-[280px]">
                      <div className="flex items-start gap-2">
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${comment.color}`}>
                          {comment.badge}
                        </span>
                        <span className="text-xs text-gray-500 leading-relaxed">{comment.text}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {siteSummary.length > 1 && (
                <tr className="border-t-2 border-gray-300 bg-blue-50 font-bold">
                  <td className="py-2 px-3 text-blue-800 whitespace-nowrap">Tổng cộng ({activeSel.length} sites)</td>
                  <td className="py-2 px-3 text-right text-blue-800 whitespace-nowrap">{fmt(siteSummary.reduce((s,r) => s+r.rev,0))}</td>
                  <td className={`py-2 px-3 text-right whitespace-nowrap ${siteSummary.reduce((s,r)=>s+r.ebitda,0)>=0?'text-green-700':'text-red-600'}`}>
                    {fmt(siteSummary.reduce((s,r) => s+r.ebitda,0))}
                  </td>
                  <td className={`py-2 px-3 text-right whitespace-nowrap ${siteSummary.reduce((s,r)=>s+r.pat,0)>=0?'text-green-700':'text-red-600'}`}>
                    {fmt(siteSummary.reduce((s,r) => s+r.pat,0))}
                  </td>
                  <td className="py-2 px-3 text-right text-blue-800 whitespace-nowrap">
                    {(() => {
                      const r = siteSummary.reduce((s,r)=>s+r.rev,0)
                      const e = siteSummary.reduce((s,r)=>s+r.ebitda,0)
                      return r > 0 ? (e/r*100).toFixed(1)+'%' : '-'
                    })()}
                  </td>
                  <td className="py-2 px-3" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
