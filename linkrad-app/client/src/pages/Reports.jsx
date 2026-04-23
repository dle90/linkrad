import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import DashboardClinical from './DashboardClinical'
import DashboardOps from './DashboardOps'
import DashboardFinance from './DashboardFinance'
import {
  CasesByMachineReport, CasesByMachineGroupReport, CasesByRadiologistReport,
  CasesByRadiologistModalityReport, CasesByTimeReport, ServicesDetailReport,
  PatientListReport, FilterBar as CaChupFilterBar,
} from './RadiologyReports'
import {
  REPORT_GROUPS, REPORT_TO_GROUP, TOP_LEVEL,
  CA_CHUP_DIMENSIONS, DOANH_THU_DIMENSIONS,
} from '../config/reportGroups'

const LAST_REPORT_KEY = 'linkrad_last_report'

const fmtMoney = (v) => v == null ? '0' : Number(v).toLocaleString('vi-VN')
const fmtDate = (d) => {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt)) return d
  return dt.toLocaleDateString('vi-VN')
}
const fmtTime = (d) => {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
const today = () => new Date().toISOString().slice(0, 10)

// R1 2026-04-24: 8-report REPORT_MENU replaced by reportGroups.js config.
// The 8 per-dimension renderers below are kept as exports and dispatched
// from the Doanh thu unified page via DOANH_THU_DIMENSIONS.

// ── Column groups (collapsible) ─────────────────────────
const COLUMN_GROUPS = [
  {
    key: 'basic', label: 'Cơ bản', defaultOpen: true,
    columns: [
      { key: 'stt', label: 'STT', render: (_, i) => i + 1, cls: 'text-gray-400' },
      { key: 'branch', label: 'Chi nhánh', cls: 'font-medium' },
      { key: 'date', label: 'Ngày', render: r => fmtDate(r.date) },
      { key: 'time', label: 'Giờ', render: r => fmtTime(r.date) },
      { key: 'billingCode', label: 'Mã TK', cls: 'font-mono' },
    ],
  },
  {
    key: 'doctor', label: 'Bác sĩ', defaultOpen: true,
    columns: [
      { key: 'doctorCode', label: 'Mã bác sĩ', cls: 'font-mono' },
      { key: 'doctorName', label: 'Tên bác sĩ' },
      { key: 'doctorWorkplace', label: 'Nơi làm việc BS' },
      { key: 'doctorPhone', label: 'SĐT BS' },
    ],
  },
  {
    key: 'staff', label: 'NV theo dõi', defaultOpen: true,
    columns: [
      { key: 'staffCode', label: 'Mã NV theo dõi', cls: 'font-mono' },
      { key: 'staffName', label: 'Tên NV theo dõi' },
    ],
  },
  {
    key: 'patient', label: 'Khách hàng', defaultOpen: true,
    columns: [
      { key: 'patientCode', label: 'Mã khách hàng', cls: 'font-mono' },
      { key: 'patientName', label: 'Tên khách hàng' },
      { key: 'patientPhone', label: 'SĐT' },
      { key: 'patientAddress', label: 'Địa chỉ' },
      { key: 'patientDob', label: 'Ngày sinh', render: r => fmtDate(r.patientDob) },
      { key: 'patientIdCard', label: 'CCCD' },
    ],
  },
  {
    key: 'service', label: 'Dịch vụ', defaultOpen: true,
    columns: [
      { key: 'customerSource', label: 'Nguồn KH' },
      { key: 'serviceCode', label: 'Mã dịch vụ', cls: 'font-mono' },
      { key: 'serviceTypeCode', label: 'Mã loại dịch vụ', cls: 'font-mono' },
      { key: 'serviceName', label: 'Tên dịch vụ' },
    ],
  },
  {
    key: 'finance', label: 'Tài chính', defaultOpen: true,
    columns: [
      { key: 'unitPrice', label: 'Đơn giá', align: 'right', render: r => `${fmtMoney(r.unitPrice)} d` },
      { key: 'quantity', label: 'Số lượng', align: 'right', render: r => r.quantity ?? 1 },
      { key: 'subtotal', label: 'Thành tiền', align: 'right', render: r => `${fmtMoney(r.subtotal)} d` },
      { key: 'consultFee', label: 'Phí tư vấn', align: 'right', render: r => `${fmtMoney(r.consultFee)} d` },
      { key: 'revenue', label: 'Doanh thu', align: 'right', cls: 'font-medium', render: r => `${fmtMoney(r.revenue)} d` },
      { key: 'discount', label: 'Giảm giá', align: 'right', render: r => `${fmtMoney(r.discount)} d` },
      { key: 'collected', label: 'Đã thu', align: 'right', cls: 'text-green-700', render: r => `${fmtMoney(r.collected)} d` },
      { key: 'remaining', label: 'Còn phải thu', align: 'right', cls: 'text-red-600', render: r => `${fmtMoney(r.remaining)} d` },
    ],
  },
  {
    key: 'extra', label: 'Khác', defaultOpen: true,
    columns: [
      { key: 'injectionLot', label: 'Số lô thuốc tiêm' },
      { key: 'injectionType', label: 'Loại thuốc tiêm' },
      { key: 'notes', label: 'Ghi chú' },
      { key: 'paymentInfo', label: 'Thông tin thanh toán' },
      { key: 'paymentMethod', label: 'Hình thức thanh toán' },
    ],
  },
]

// ── Detailed Revenue Report ─────────────────────────────
export function RevenueDetailReport() {
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [branchFilter, setBranchFilter] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(COLUMN_GROUPS.map(g => [g.key, g.defaultOpen]))
  )

  useEffect(() => {
    api.get('/hr/departments?type=branch').then(r => setBranches(r.data)).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { dateFrom, dateTo }
      if (branchFilter) params.branch = branchFilter
      const r = await api.get('/reports/revenue-detail', { params })
      setData(r.data)
    } catch { setData([]) }
    setLoading(false)
  }, [dateFrom, dateTo, branchFilter])

  useEffect(() => { load() }, [load])

  const toggleGroup = (key) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))

  // Flatten visible columns
  const visibleColumns = COLUMN_GROUPS.flatMap(g =>
    openGroups[g.key] ? g.columns : []
  )
  const totalCols = visibleColumns.length

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="text-sm text-gray-600">Ngày:</div>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-gray-400">-</span>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <select className="border rounded px-2 py-1.5 text-sm" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="">Chi nhánh (All)</option>
          {branches.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-2">Ngày: {fmtDate(dateFrom)} - {fmtDate(dateTo)}</span>
      </div>

      {/* Column group toggles */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="text-xs text-gray-500 mr-1">Nhóm cột:</span>
        {COLUMN_GROUPS.map(g => (
          <button
            key={g.key}
            onClick={() => toggleGroup(g.key)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              openGroups[g.key]
                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
            }`}
          >
            {openGroups[g.key] ? '−' : '+'} {g.label}
          </button>
        ))}
      </div>

      {/* Single wide table */}
      <div className="bg-white rounded-lg border overflow-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            {/* Group header row */}
            <tr className="bg-[#152f4d] text-blue-300 text-xs">
              {COLUMN_GROUPS.map(g => {
                if (!openGroups[g.key]) return null
                return (
                  <th
                    key={g.key}
                    colSpan={g.columns.length}
                    className="px-3 py-1 text-center border-x border-blue-800 cursor-pointer hover:text-white"
                    onClick={() => toggleGroup(g.key)}
                    title={`Ẩn nhóm "${g.label}"`}
                  >
                    {g.label} <span className="opacity-50">−</span>
                  </th>
                )
              })}
            </tr>
            {/* Column header row */}
            <tr className="bg-[#1e3a5f] text-white text-left">
              {visibleColumns.map(col => (
                <th key={col.key} className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={totalCols} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={totalCols} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            ) : data.map((row, i) => (
              <tr key={row._id || i} className="border-t hover:bg-blue-50/50">
                {visibleColumns.map(col => {
                  const val = col.render ? col.render(row, i) : (row[col.key] || '-')
                  return (
                    <td key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''} ${col.cls || 'text-gray-600'}`}>
                      {val}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Column Filter Dropdown ───────────────────────────────
const FILTER_OPS = [
  { value: 'eq', label: 'Equals', icon: '=' },
  { value: 'neq', label: 'Does not equal', icon: '!=' },
  { value: 'lt', label: 'Less than', icon: '<' },
  { value: 'gt', label: 'Greater than', icon: '>' },
  { value: 'lte', label: 'Less than or equal to', icon: '<=' },
  { value: 'gte', label: 'Greater than or equal to', icon: '>=' },
  { value: 'between', label: 'Between', icon: '...' },
  { value: 'reset', label: 'Reset', icon: '↺' },
]

function ColumnFilter({ colKey, filters, setFilters, isNumeric }) {
  const [open, setOpen] = useState(false)
  const [op, setOp] = useState(filters[colKey]?.op || '')
  const [val, setVal] = useState(filters[colKey]?.val || '')
  const [val2, setVal2] = useState(filters[colKey]?.val2 || '')
  const ref = React.useRef(null)

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const apply = (selectedOp) => {
    if (selectedOp === 'reset') {
      setOp(''); setVal(''); setVal2('')
      setFilters(prev => { const n = { ...prev }; delete n[colKey]; return n })
      setOpen(false)
      return
    }
    setOp(selectedOp)
  }

  const confirm = () => {
    if (op && val !== '') {
      setFilters(prev => ({ ...prev, [colKey]: { op, val, val2 } }))
    }
    setOpen(false)
  }

  const active = !!filters[colKey]

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`ml-1 text-xs ${active ? 'text-yellow-300' : 'text-blue-300 opacity-60 hover:opacity-100'}`}
        title="Lọc cột"
      >
        <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-xl z-50 w-48 text-gray-700 text-xs" onClick={e => e.stopPropagation()}>
          <div className="py-1">
            {FILTER_OPS.map(f => (
              <button
                key={f.value}
                onClick={() => apply(f.value)}
                className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center gap-2 ${op === f.value ? 'bg-blue-50 font-medium' : ''}`}
              >
                <span className="w-5 text-center text-gray-400">{f.icon}</span> {f.label}
              </button>
            ))}
          </div>
          {op && op !== 'reset' && (
            <div className="border-t px-3 py-2 space-y-1.5">
              <input
                type={isNumeric ? 'number' : 'text'}
                className="w-full border rounded px-2 py-1 text-xs"
                placeholder="Giá trị..."
                value={val}
                onChange={e => setVal(e.target.value)}
                autoFocus
              />
              {op === 'between' && (
                <input
                  type={isNumeric ? 'number' : 'text'}
                  className="w-full border rounded px-2 py-1 text-xs"
                  placeholder="Đến..."
                  value={val2}
                  onChange={e => setVal2(e.target.value)}
                />
              )}
              <button onClick={confirm} className="w-full bg-[#1e3a5f] text-white rounded py-1 text-xs hover:bg-[#2a4f7a]">Áp dụng</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function applyFilters(data, filters, cols) {
  if (Object.keys(filters).length === 0) return data
  return data.filter(row => {
    for (const [colKey, f] of Object.entries(filters)) {
      const col = cols.find(c => c.key === colKey)
      let rawVal = row[colKey]
      if (rawVal == null) rawVal = ''
      const isNum = col?.isNumeric
      const a = isNum ? Number(rawVal) : String(rawVal).toLowerCase()
      const b = isNum ? Number(f.val) : String(f.val).toLowerCase()
      const c = isNum ? Number(f.val2) : String(f.val2).toLowerCase()
      switch (f.op) {
        case 'eq': if (a !== b) return false; break
        case 'neq': if (a === b) return false; break
        case 'lt': if (a >= b) return false; break
        case 'gt': if (a <= b) return false; break
        case 'lte': if (a > b) return false; break
        case 'gte': if (a < b) return false; break
        case 'between': if (a < b || a > c) return false; break
      }
    }
    return true
  })
}

// ── Customer Detail Report ──────────────────────────────
const CUSTOMER_COLS = [
  { key: 'stt', label: 'STT', render: (_, i) => i + 1, cls: 'text-gray-400 w-10' },
  { key: 'date', label: 'Ngày', render: r => fmtDate(r.date), filterable: true },
  { key: 'patientName', label: 'Tên khách hàng', filterable: true },
  { key: 'patientAddress', label: 'Địa chỉ', filterable: true },
  { key: 'patientDob', label: 'Ngày sinh', render: r => fmtDate(r.patientDob), filterable: true },
  { key: 'amount', label: 'Số tiền', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.amount)} d` },
  { key: 'discount', label: 'Giảm giá', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.discount)} d` },
  { key: 'paid', label: 'Số tiền đã thanh toán', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.paid)} d` },
  { key: 'collected', label: 'Số tiền đã thu hộ', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.collected)} d` },
  { key: 'paymentMethod', label: 'Hình thức thanh toán', filterable: true },
]

export function CustomerDetailReport() {
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/reports/customer-detail', { params: { dateFrom, dateTo } })
      setData(r.data)
    } catch { setData([]) }
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filtered = applyFilters(data, filters, CUSTOMER_COLS)

  return (
    <>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="text-sm text-gray-600">Ngày:</div>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-gray-400">-</span>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <span className="text-xs text-gray-400 ml-2">Ngày: {fmtDate(dateFrom)} - {fmtDate(dateTo)}</span>
        {Object.keys(filters).length > 0 && (
          <button onClick={() => setFilters({})} className="text-xs text-red-500 hover:text-red-700 ml-2">Xóa tất cả bộ lọc</button>
        )}
      </div>

      <div className="bg-white rounded-lg border overflow-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e3a5f] text-white text-left">
              {CUSTOMER_COLS.map(col => (
                <th key={col.key} className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.label}
                  {col.filterable && (
                    <ColumnFilter colKey={col.key} filters={filters} setFilters={setFilters} isNumeric={col.isNumeric} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={CUSTOMER_COLS.length} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={CUSTOMER_COLS.length} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            ) : filtered.map((row, i) => (
              <tr key={row._id || i} className="border-t hover:bg-blue-50/50">
                {CUSTOMER_COLS.map(col => {
                  const val = col.render ? col.render(row, i) : (row[col.key] || '-')
                  return (
                    <td key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''} ${col.cls || 'text-gray-600'}`}>
                      {val}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Promotion Detail Report ─────────────────────────────
const PROMO_COLS = [
  { key: 'stt', label: 'STT', render: (_, i) => i + 1, cls: 'text-gray-400 w-10' },
  { key: 'promoCode', label: 'Mã chương trình', cls: 'font-mono', filterable: true },
  { key: 'promoName', label: 'Tên chương trình', filterable: true },
  { key: 'date', label: 'Ngày', render: r => fmtDate(r.date), filterable: true },
  { key: 'patientName', label: 'Tên khách hàng', filterable: true },
  { key: 'patientAddress', label: 'Địa chỉ khách hàng', filterable: true },
  { key: 'paymentMethod', label: 'Hình thức thanh toán', filterable: true },
  { key: 'totalAmount', label: 'Tổng tiền', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.totalAmount)} d` },
  { key: 'discountAmount', label: 'Số tiền giảm giá', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.discountAmount)} d` },
  { key: 'netAmount', label: 'Tổng tiền thực thu', align: 'right', isNumeric: true, filterable: true, cls: 'font-medium', render: r => `${fmtMoney(r.netAmount)} d` },
]

export function PromotionDetailReport() {
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/reports/promotion-detail', { params: { dateFrom, dateTo } })
      setData(r.data)
    } catch { setData([]) }
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filtered = applyFilters(data, filters, PROMO_COLS)

  return (
    <>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="text-sm text-gray-600">Ngày:</div>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-gray-400">-</span>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <span className="text-xs text-gray-400 ml-2">Ngày: {fmtDate(dateFrom)} - {fmtDate(dateTo)}</span>
        {Object.keys(filters).length > 0 && (
          <button onClick={() => setFilters({})} className="text-xs text-red-500 hover:text-red-700 ml-2">Xóa tất cả bộ lọc</button>
        )}
      </div>

      <div className="bg-white rounded-lg border overflow-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e3a5f] text-white text-left">
              {PROMO_COLS.map(col => (
                <th key={col.key} className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.label}
                  {col.filterable && <ColumnFilter colKey={col.key} filters={filters} setFilters={setFilters} isNumeric={col.isNumeric} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={PROMO_COLS.length} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={PROMO_COLS.length} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            ) : filtered.map((row, i) => (
              <tr key={row._id || i} className="border-t hover:bg-blue-50/50">
                {PROMO_COLS.map(col => {
                  const val = col.render ? col.render(row, i) : (row[col.key] || '-')
                  return <td key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''} ${col.cls || 'text-gray-600'}`}>{val}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Pagination component ────────────────────────────────
function Pagination({ total, page, pageSize, setPage, setPageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
      <div className="flex items-center gap-1">
        {[5, 10, 20].map(s => (
          <button key={s} onClick={() => { setPageSize(s); setPage(1) }}
            className={`px-2 py-1 rounded border ${pageSize === s ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'border-gray-300 hover:bg-gray-100'}`}
          >{s}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span>Page {page} of {totalPages} ({total} items)</span>
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
          className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40">&lt;</button>
        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
          className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40">&gt;</button>
      </div>
    </div>
  )
}

// ── Clinic Revenue Report ───────────────────────────────
const CLINIC_REV_COLS = [
  { key: 'stt', label: 'STT', render: (_, i, offset) => offset + i + 1, cls: 'text-gray-400 w-10' },
  { key: 'date', label: 'Ngày', render: r => fmtDate(r.date), filterable: true },
  { key: 'invoiceNumber', label: 'Mã hóa đơn', cls: 'font-mono', filterable: true },
  { key: 'doctorCode', label: 'Mã bác sĩ giới thiệu', cls: 'font-mono', filterable: true },
  { key: 'doctorName', label: 'Bác sĩ giới thiệu', filterable: true },
  { key: 'patientCode', label: 'Mã khách hàng', cls: 'font-mono', filterable: true },
  { key: 'patientName', label: 'Tên khách hàng', filterable: true },
  { key: 'patientAddress', label: 'Địa chỉ khách hàng', filterable: true },
  { key: 'patientDob', label: 'Ngày sinh', render: r => fmtDate(r.patientDob), filterable: true },
  { key: 'serviceTypeCode', label: 'Nhóm dịch vụ', filterable: true },
  { key: 'serviceName', label: 'Tên dịch vụ', filterable: true },
  { key: 'amount', label: 'Đơn tiền', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.amount)} d` },
  { key: 'discount', label: 'Giảm giá', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.discount)} d` },
  { key: 'netAmount', label: 'Tiền thực thu', align: 'right', isNumeric: true, filterable: true, cls: 'font-medium', render: r => `${fmtMoney(r.netAmount)} d` },
  { key: 'paymentMethod', label: 'Hình thức thanh toán', filterable: true },
]

export function ClinicRevenueReport() {
  const [tab, setTab] = useState('revenue') // revenue | collection
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/reports/clinic-revenue', { params: { dateFrom, dateTo, tab } })
      setData(r.data)
      setPage(1)
    } catch { setData([]) }
    setLoading(false)
  }, [dateFrom, dateTo, tab])

  useEffect(() => { load() }, [load])

  const filtered = applyFilters(data, filters, CLINIC_REV_COLS)
  const offset = (page - 1) * pageSize
  const paged = filtered.slice(offset, offset + pageSize)

  return (
    <>
      {/* Tabs */}
      <div className="flex mb-4 border-b">
        <button onClick={() => { setTab('revenue'); setFilters({}) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'revenue' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          DOANH THU
        </button>
        <button onClick={() => { setTab('collection'); setFilters({}) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'collection' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          THU HỘ
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="text-sm text-gray-600">Ngày:</div>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-gray-400">-</span>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <span className="text-xs text-gray-400 ml-2">Ngày: {fmtDate(dateFrom)} - {fmtDate(dateTo)}</span>
        {Object.keys(filters).length > 0 && (
          <button onClick={() => setFilters({})} className="text-xs text-red-500 hover:text-red-700 ml-2">Xóa tất cả bộ lọc</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-auto" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e3a5f] text-white text-left">
              {CLINIC_REV_COLS.map(col => (
                <th key={col.key} className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.label}
                  {col.filterable && <ColumnFilter colKey={col.key} filters={filters} setFilters={setFilters} isNumeric={col.isNumeric} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={CLINIC_REV_COLS.length} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={CLINIC_REV_COLS.length} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            ) : paged.map((row, i) => (
              <tr key={row._id || i} className="border-t hover:bg-blue-50/50">
                {CLINIC_REV_COLS.map(col => {
                  const val = col.render ? col.render(row, i, offset) : (row[col.key] || '-')
                  return <td key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''} ${col.cls || 'text-gray-600'}`}>{val}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={filtered.length} page={page} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} />
    </>
  )
}

// ── Refund / Exchange Report ─────────────────────────────
const REFUND_COLS = [
  { key: 'stt', label: 'STT', render: (_, i, offset) => offset + i + 1, cls: 'text-gray-400 w-10' },
  { key: 'date', label: 'Ngày', render: r => fmtDate(r.date), filterable: true },
  { key: 'invoiceNumber', label: 'Mã hóa đơn', cls: 'font-mono', filterable: true },
  { key: 'doctorCode', label: 'Mã bác sĩ giới thiệu', cls: 'font-mono', filterable: true },
  { key: 'doctorName', label: 'Bác sĩ giới thiệu', filterable: true },
  { key: 'patientCode', label: 'Mã khách hàng', cls: 'font-mono', filterable: true },
  { key: 'patientName', label: 'Tên khách hàng', filterable: true },
  { key: 'patientAddress', label: 'Địa chỉ khách hàng', filterable: true },
  { key: 'patientDob', label: 'Ngày sinh', render: r => fmtDate(r.patientDob), filterable: true },
  { key: 'serviceTypeCode', label: 'Nhóm dịch vụ', filterable: true },
  { key: 'serviceName', label: 'Tên dịch vụ', filterable: true },
  { key: 'amount', label: 'Đơn tiền', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.amount)} d` },
  { key: 'discount', label: 'Giảm giá', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.discount)} d` },
  { key: 'netAmount', label: 'Tiền thực thu', align: 'right', isNumeric: true, filterable: true, cls: 'font-medium', render: r => `${fmtMoney(r.netAmount)} d` },
  { key: 'reason', label: 'Lý do hoàn trả', filterable: true },
  { key: 'paymentMethod', label: 'Hình thức thanh toán', filterable: true },
]

export function RefundExchangeReport() {
  const [tab, setTab] = useState('refund') // refund | exchange
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/reports/refund-exchange', { params: { dateFrom, dateTo, tab } })
      setData(r.data)
      setPage(1)
    } catch { setData([]) }
    setLoading(false)
  }, [dateFrom, dateTo, tab])

  useEffect(() => { load() }, [load])

  const filtered = applyFilters(data, filters, REFUND_COLS)
  const offset = (page - 1) * pageSize
  const paged = filtered.slice(offset, offset + pageSize)

  return (
    <>
      {/* Tabs */}
      <div className="flex mb-4 border-b">
        <button onClick={() => { setTab('refund'); setFilters({}) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'refund' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          HOÀN TRẢ
        </button>
        <button onClick={() => { setTab('exchange'); setFilters({}) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'exchange' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          ĐỔI DỊCH VỤ
        </button>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="text-sm text-gray-600">Ngày:</div>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-gray-400">-</span>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <span className="text-xs text-gray-400 ml-2">Ngày: {fmtDate(dateFrom)} - {fmtDate(dateTo)}</span>
        {Object.keys(filters).length > 0 && (
          <button onClick={() => setFilters({})} className="text-xs text-red-500 hover:text-red-700 ml-2">Xóa tất cả bộ lọc</button>
        )}
      </div>

      <div className="bg-white rounded-lg border overflow-auto" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e3a5f] text-white text-left">
              {REFUND_COLS.map(col => (
                <th key={col.key} className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.label}
                  {col.filterable && <ColumnFilter colKey={col.key} filters={filters} setFilters={setFilters} isNumeric={col.isNumeric} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={REFUND_COLS.length} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={REFUND_COLS.length} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            ) : paged.map((row, i) => (
              <tr key={row._id || i} className="border-t hover:bg-blue-50/50">
                {REFUND_COLS.map(col => {
                  const val = col.render ? col.render(row, i, offset) : (row[col.key] || '-')
                  return <td key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''} ${col.cls || 'text-gray-600'}`}>{val}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={filtered.length} page={page} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} />
    </>
  )
}

// ── E-Invoice Report ────────────────────────────────────
const EINVOICE_COLS = [
  { key: 'stt', label: 'STT', render: (_, i, offset) => offset + i + 1, cls: 'text-gray-400 w-10' },
  { key: 'date', label: 'Ngày', render: r => fmtDate(r.date), filterable: true },
  { key: 'invoiceNumber', label: 'Mã hóa đơn', cls: 'font-mono', filterable: true },
  { key: 'patientName', label: 'Tên khách hàng', filterable: true },
  { key: 'patientPhone', label: 'SĐT', filterable: true },
  { key: 'email', label: 'Email', filterable: true },
  { key: 'patientAddress', label: 'Địa chỉ', filterable: true },
  { key: 'patientCode', label: 'Mã khách hàng', cls: 'font-mono', filterable: true },
  { key: 'amount', label: 'Tiền chưa xuất', align: 'right', isNumeric: true, filterable: true, render: r => `${fmtMoney(r.amount)} d` },
]

export function EInvoiceReport() {
  const [tab, setTab] = useState('not_issued') // not_issued | issued
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [data, setData] = useState([])
  const [stats, setStats] = useState({ notIssuedCount: 0, notIssuedTotal: 0, issuedCount: 0, issuedTotal: 0 })
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/reports/e-invoice', { params: { dateFrom, dateTo, tab } })
      setData(r.data.rows)
      setStats(r.data.stats)
      setPage(1)
    } catch { setData([]); setStats({ notIssuedCount: 0, notIssuedTotal: 0, issuedCount: 0, issuedTotal: 0 }) }
    setLoading(false)
  }, [dateFrom, dateTo, tab])

  useEffect(() => { load() }, [load])

  const filtered = applyFilters(data, filters, EINVOICE_COLS)
  const offset = (page - 1) * pageSize
  const paged = filtered.slice(offset, offset + pageSize)

  const StatCard = ({ icon, color, label, value }) => (
    <div className={`flex items-center gap-3 px-5 py-3 rounded-lg text-white ${color}`}>
      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">{icon}</div>
      <div><div className="text-xs opacity-80">{label}</div><div className="text-lg font-bold">{value}</div></div>
    </div>
  )

  // Columns adjust based on tab
  const cols = tab === 'issued'
    ? EINVOICE_COLS.map(c => c.key === 'amount' ? { ...c, label: 'Tổng tiền', key: 'amount' } : c)
    : EINVOICE_COLS

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard icon="📄" color="bg-[#1e3a5f]" label="Số hóa đơn chưa xuất" value={stats.notIssuedCount} />
        <StatCard icon="💰" color="bg-[#1e3a5f]" label="Tổng tiền chưa xuất" value={`${fmtMoney(stats.notIssuedTotal)} d`} />
        <StatCard icon="✅" color="bg-[#1e3a5f]" label="Số hóa đơn đã xuất" value={stats.issuedCount} />
        <StatCard icon="📈" color="bg-[#1e3a5f]" label="Tổng tiền đã xuất" value={`${fmtMoney(stats.issuedTotal)} d`} />
      </div>

      {/* Tabs */}
      <div className="flex mb-4 border-b">
        <button onClick={() => { setTab('not_issued'); setFilters({}) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'not_issued' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          HÓA ĐƠN CHƯA XUẤT
        </button>
        <button onClick={() => { setTab('issued'); setFilters({}) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'issued' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          HÓA ĐƠN ĐÃ XUẤT
        </button>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="text-sm text-gray-600">Ngày:</div>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-gray-400">-</span>
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <span className="text-xs text-gray-400 ml-2">Ngày: {fmtDate(dateFrom)} - {fmtDate(dateTo)}</span>
        {Object.keys(filters).length > 0 && (
          <button onClick={() => setFilters({})} className="text-xs text-red-500 hover:text-red-700 ml-2">Xóa tất cả bộ lọc</button>
        )}
      </div>

      <div className="bg-white rounded-lg border overflow-auto" style={{ maxHeight: 'calc(100vh - 24rem)' }}>
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e3a5f] text-white text-left">
              {cols.map(col => (
                <th key={col.key} className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.label}
                  {col.filterable && <ColumnFilter colKey={col.key} filters={filters} setFilters={setFilters} isNumeric={col.isNumeric} />}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right">Tổng tiền</th>
              <th className="px-3 py-2.5 text-center w-16">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length + 2} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={cols.length + 2} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            ) : paged.map((row, i) => (
              <tr key={row._id || i} className="border-t hover:bg-blue-50/50">
                {cols.map(col => {
                  const val = col.render ? col.render(row, i, offset) : (row[col.key] || '-')
                  return <td key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''} ${col.cls || 'text-gray-600'}`}>{val}</td>
                })}
                <td className="px-3 py-2 text-right font-medium">{fmtMoney(row.amount)} d</td>
                <td className="px-3 py-2 text-center">
                  <button className="text-[#1e3a5f] hover:text-blue-800" title={tab === 'not_issued' ? 'Xuất hóa đơn' : 'Tải hóa đơn'}>
                    <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={filtered.length} page={page} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} />
    </>
  )
}

// ── Referral Revenue Report ─────────────────────────────
export function ReferralRevenueReport() {
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [branch, setBranch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [branches, setBranches] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.get('/hr/departments?type=branch').then(r => setBranches(r.data)).catch(() => {}) }, [])
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { dateFrom, dateTo }
      if (branch) params.branch = branch
      if (typeFilter) params.referralType = typeFilter
      const r = await api.get('/reports/referral-revenue', { params })
      setRows(r.data.rows || [])
    } catch { setRows([]) }
    setLoading(false)
  }, [dateFrom, dateTo, branch, typeFilter])
  useEffect(() => { load() }, [load])

  const total = rows.reduce((s, r) => ({
    invoiceCount: s.invoiceCount + r.invoiceCount,
    grandTotal: s.grandTotal + r.grandTotal,
    paidAmount: s.paidAmount + r.paidAmount,
    outstanding: s.outstanding + r.outstanding,
  }), { invoiceCount: 0, grandTotal: 0, paidAmount: 0, outstanding: 0 })

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <input type="date" className="border rounded px-2 py-1 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-gray-400">→</span>
        <input type="date" className="border rounded px-2 py-1 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <select className="border rounded px-2 py-1 text-sm" value={branch} onChange={e => setBranch(e.target.value)}>
          <option value="">Tất cả cơ sở</option>
          {branches.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
        </select>
        <select className="border rounded px-2 py-1 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Tất cả loại</option>
          <option value="doctor">Bác sĩ giới thiệu</option>
          <option value="facility">Cơ sở giới thiệu</option>
          <option value="salesperson">Nhân viên kinh doanh</option>
        </select>
      </div>
      <div className="bg-white rounded-lg border overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead><tr className="bg-[#1e3a5f] text-white text-left text-xs">
            <th className="px-3 py-2.5 w-8">STT</th>
            <th className="px-3 py-2.5">Loại</th>
            <th className="px-3 py-2.5">Đối tác / Nguồn</th>
            <th className="px-3 py-2.5">NVKD theo dõi</th>
            <th className="px-3 py-2.5 text-right">Số HĐ</th>
            <th className="px-3 py-2.5 text-right">Số DV</th>
            <th className="px-3 py-2.5 text-right">Doanh thu</th>
            <th className="px-3 py-2.5 text-right">Đã thu</th>
            <th className="px-3 py-2.5 text-right">Còn phải thu</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            : rows.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            : rows.map((r, i) => (
              <tr key={`${r.referralType}-${r.referralId || r.sourceCode || i}`} className="border-t hover:bg-blue-50/50">
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2">{r.referralTypeLabel}</td>
                <td className="px-3 py-2 font-medium">{r.referralName || '-'}</td>
                <td className="px-3 py-2 text-gray-600">{r.effectiveSalespersonName || '-'}</td>
                <td className="px-3 py-2 text-right">{r.invoiceCount}</td>
                <td className="px-3 py-2 text-right">{r.serviceCount}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtMoney(r.grandTotal)} đ</td>
                <td className="px-3 py-2 text-right text-green-700">{fmtMoney(r.paidAmount)} đ</td>
                <td className="px-3 py-2 text-right text-red-600">{fmtMoney(r.outstanding)} đ</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr className="bg-gray-50 border-t font-semibold text-sm">
              <td className="px-3 py-2" colSpan={4}>Tổng</td>
              <td className="px-3 py-2 text-right">{total.invoiceCount}</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right">{fmtMoney(total.grandTotal)} đ</td>
              <td className="px-3 py-2 text-right text-green-700">{fmtMoney(total.paidAmount)} đ</td>
              <td className="px-3 py-2 text-right text-red-600">{fmtMoney(total.outstanding)} đ</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ── Salesperson (NVKD) KPI Report ───────────────────────
function SalespersonKpiReport() {
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [branch, setBranch] = useState('')
  const [branches, setBranches] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.get('/hr/departments?type=branch').then(r => setBranches(r.data)).catch(() => {}) }, [])
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { dateFrom, dateTo }
      if (branch) params.branch = branch
      const r = await api.get('/reports/salesperson-kpi', { params })
      setRows(r.data.rows || [])
    } catch { setRows([]) }
    setLoading(false)
  }, [dateFrom, dateTo, branch])
  useEffect(() => { load() }, [load])

  const total = rows.reduce((s, r) => ({
    invoiceCount: s.invoiceCount + r.invoiceCount,
    directCount: s.directCount + r.directCount,
    viaDoctorCount: s.viaDoctorCount + r.viaDoctorCount,
    viaFacilityCount: s.viaFacilityCount + r.viaFacilityCount,
    grandTotal: s.grandTotal + r.grandTotal,
    paidAmount: s.paidAmount + r.paidAmount,
    outstanding: s.outstanding + r.outstanding,
  }), { invoiceCount: 0, directCount: 0, viaDoctorCount: 0, viaFacilityCount: 0, grandTotal: 0, paidAmount: 0, outstanding: 0 })

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <input type="date" className="border rounded px-2 py-1 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-gray-400">→</span>
        <input type="date" className="border rounded px-2 py-1 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <select className="border rounded px-2 py-1 text-sm" value={branch} onChange={e => setBranch(e.target.value)}>
          <option value="">Tất cả cơ sở</option>
          {branches.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-lg border overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead><tr className="bg-[#1e3a5f] text-white text-left text-xs">
            <th className="px-3 py-2.5 w-8">STT</th>
            <th className="px-3 py-2.5">Mã NVKD</th>
            <th className="px-3 py-2.5">Tên NVKD</th>
            <th className="px-3 py-2.5">Cơ sở</th>
            <th className="px-3 py-2.5 text-right">Trực tiếp</th>
            <th className="px-3 py-2.5 text-right">Qua BS</th>
            <th className="px-3 py-2.5 text-right">Qua cơ sở</th>
            <th className="px-3 py-2.5 text-right">Tổng HĐ</th>
            <th className="px-3 py-2.5 text-right">Doanh thu</th>
            <th className="px-3 py-2.5 text-right">Đã thu</th>
            <th className="px-3 py-2.5 text-right">Còn phải thu</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            : rows.length === 0 ? <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            : rows.map((r, i) => (
              <tr key={r.salespersonId} className="border-t hover:bg-blue-50/50">
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.salespersonId}</td>
                <td className="px-3 py-2 font-medium">{r.salespersonName}</td>
                <td className="px-3 py-2 text-gray-600">{r.department || '-'}</td>
                <td className="px-3 py-2 text-right">{r.directCount}</td>
                <td className="px-3 py-2 text-right">{r.viaDoctorCount}</td>
                <td className="px-3 py-2 text-right">{r.viaFacilityCount}</td>
                <td className="px-3 py-2 text-right font-medium">{r.invoiceCount}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtMoney(r.grandTotal)} đ</td>
                <td className="px-3 py-2 text-right text-green-700">{fmtMoney(r.paidAmount)} đ</td>
                <td className="px-3 py-2 text-right text-red-600">{fmtMoney(r.outstanding)} đ</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr className="bg-gray-50 border-t font-semibold text-sm">
              <td className="px-3 py-2" colSpan={4}>Tổng</td>
              <td className="px-3 py-2 text-right">{total.directCount}</td>
              <td className="px-3 py-2 text-right">{total.viaDoctorCount}</td>
              <td className="px-3 py-2 text-right">{total.viaFacilityCount}</td>
              <td className="px-3 py-2 text-right">{total.invoiceCount}</td>
              <td className="px-3 py-2 text-right">{fmtMoney(total.grandTotal)} đ</td>
              <td className="px-3 py-2 text-right text-green-700">{fmtMoney(total.paidAmount)} đ</td>
              <td className="px-3 py-2 text-right text-red-600">{fmtMoney(total.outstanding)} đ</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  MAIN REPORTS PAGE (R1 unified 2026-04-24)
// ══════════════════════════════════════════════════════════

function ReportPageHeader({ breadcrumb, userName }) {
  const date = new Date()
  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
  return (
    <div className="flex items-center gap-6 px-4 py-2 border-b bg-white -mx-4 -mt-4 mb-4">
      <div className="flex items-baseline gap-2">
        <div className="text-lg font-semibold text-gray-800">Báo cáo</div>
        <div className="text-xs text-gray-400 font-mono">/báo cáo</div>
      </div>
      <div className="flex-1 text-xs text-gray-500">{breadcrumb}</div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {userName && <span className="px-2 py-1 bg-gray-100 rounded-md">👤 {userName}</span>}
        <span className="px-2 py-1 bg-gray-100 rounded-md">{dateStr}</span>
      </div>
    </div>
  )
}

// Group-by picker shared by the two unified detail reports. Horizontal pill
// row — active pill filled, idle is plain text (matches the Danh mục pattern
// user landed on after 2026-04-23 feedback).
function GroupByPicker({ dimensions, active, onChange }) {
  return (
    <div className="flex items-center gap-1 mb-3 flex-wrap">
      <span className="text-xs text-gray-500 mr-2">Nhóm theo:</span>
      {dimensions.map(d => {
        const isActive = d.key === active
        const cls = isActive
          ? 'px-3 py-1.5 rounded-full bg-blue-600 text-white shadow-sm'
          : 'px-3 py-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        return (
          <button key={d.key} onClick={() => onChange(d.key)} className={`text-xs font-semibold transition-colors ${cls}`}>
            {d.label}
          </button>
        )
      })}
    </div>
  )
}

// Unified Ca chụp / Ca đọc report — wraps the 7 per-dimension renderers from
// RadiologyReports.jsx behind one group-by picker. Each dimension owns its
// own internal filter state for R1; shared FilterBar is a later polish.
const CA_CHUP_RENDERERS = {
  'cases-by-machine':              CasesByMachineReport,
  'cases-by-machine-group':        CasesByMachineGroupReport,
  'cases-by-radiologist':          CasesByRadiologistReport,
  'cases-by-radiologist-modality': CasesByRadiologistModalityReport,
  'cases-by-time':                 CasesByTimeReport,
  'services-detail':               ServicesDetailReport,
  'patient-list':                  PatientListReport,
}
function monthAgo() { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) }
function todayStr() { return new Date().toISOString().slice(0, 10) }

function CaChupReport() {
  const [dim, setDim] = useState('cases-by-time')
  const [filters, setFilters] = useState({ dateFrom: monthAgo(), dateTo: todayStr(), modality: '', site: '', granularity: 'day' })
  const Renderer = CA_CHUP_RENDERERS[dim]
  return (
    <>
      <CaChupFilterBar filters={filters} setFilters={setFilters} granularityToggle={dim === 'cases-by-time'} />
      <GroupByPicker dimensions={CA_CHUP_DIMENSIONS} active={dim} onChange={setDim} />
      {Renderer ? <Renderer filters={filters} /> : <div className="text-sm text-gray-400 p-4">Không có bộ hiển thị phù hợp.</div>}
    </>
  )
}

// Unified Doanh thu report — each per-dim business report is self-contained
// with its own internal filter state, so the unified page is just a picker
// that swaps the active renderer. Shared top-level filter bar is a future
// consolidation.
const DOANH_THU_RENDERERS = {
  'revenue-detail':    RevenueDetailReport,
  'clinic-revenue':    ClinicRevenueReport,
  'customer-detail':   CustomerDetailReport,
  'referral-revenue':  ReferralRevenueReport,
  'promotion-detail':  PromotionDetailReport,
  'refund-exchange':   RefundExchangeReport,
  'e-invoice':         EInvoiceReport,
}
function DoanhThuReport() {
  const [dim, setDim] = useState('revenue-detail')
  const Renderer = DOANH_THU_RENDERERS[dim]
  return (
    <>
      <GroupByPicker dimensions={DOANH_THU_DIMENSIONS} active={dim} onChange={setDim} />
      {Renderer ? <Renderer /> : <div className="text-sm text-gray-400 p-4">Không có bộ hiển thị phù hợp.</div>}
    </>
  )
}

// Tổng Quan executive dashboard — R1 placeholder. R2 will replace with real
// KPI tiles (this-month revenue, MoM delta, cases today, TAT, unpaid).
function TongQuanPlaceholder() {
  const nav = useNavigate()
  const tiles = [
    { key: 'lam-sang-overview',  label: 'Lâm sàng',   desc: 'Ca chụp, BS đọc, TAT hôm nay', emoji: '🩺' },
    { key: 'van-hanh-overview',  label: 'Vận Hành',   desc: 'Doanh thu hôm nay, ca, chi nhánh', emoji: '⚙️' },
    { key: 'tai-chinh-overview', label: 'Tài Chính',  desc: 'Doanh thu tháng, EBITDA, LNST',    emoji: '💼' },
  ]
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <b>Đang phát triển</b> — trang Tổng Quan sẽ hiển thị các chỉ số then chốt (doanh thu tháng, MoM, ca hôm nay, TAT, công nợ chưa thu). Hiện tại, chọn một mảng để xem.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tiles.map(t => (
          <button
            key={t.key}
            onClick={() => nav(`/reports/${t.key}`)}
            className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="text-3xl mb-2">{t.emoji}</div>
            <div className="font-semibold text-gray-900 mb-1">{t.label}</div>
            <div className="text-xs text-gray-500">{t.desc}</div>
            <div className="mt-3 text-xs text-blue-600">Mở →</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Kho report — R1 links to the operational Inventory workspace; R2 will
// ship a proper Báo cáo Kho with group-by (vật tư / kho / thời gian / lý do).
function KhoReportPlaceholder() {
  const nav = useNavigate()
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <b>Đang phát triển</b> — báo cáo Kho (tiêu thụ vật tư, sổ kho, tồn theo chi nhánh) sẽ được xây dựng trong R2.
        Hiện tại, tab Giao dịch ở trang Quản lý kho cung cấp đầy đủ chức năng lọc/xuất.
      </div>
      <button onClick={() => nav('/inventory')}
        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        Mở Quản lý kho →
      </button>
    </div>
  )
}

export default function Reports() {
  const { auth } = useAuth()
  const { reportKey } = useParams()
  const activeKey = reportKey || ''

  useEffect(() => {
    if (activeKey) try { localStorage.setItem(LAST_REPORT_KEY, activeKey) } catch {}
  }, [activeKey])

  if (!activeKey) {
    let remembered = null
    try { remembered = localStorage.getItem(LAST_REPORT_KEY) } catch {}
    const valid = remembered && (remembered === TOP_LEVEL.key || REPORT_TO_GROUP[remembered])
    return <Navigate to={`/reports/${valid ? remembered : TOP_LEVEL.key}`} replace />
  }

  // Breadcrumb
  const top = activeKey === TOP_LEVEL.key ? TOP_LEVEL : null
  const groupInfo = REPORT_TO_GROUP[activeKey]
  const breadcrumb = top
    ? <b className="text-gray-700">Tổng Quan</b>
    : groupInfo
      ? <>{groupInfo.group.label} · <b className="text-gray-700">{groupInfo.item.label}</b></>
      : 'Không tìm thấy'

  const renderContent = () => {
    if (activeKey === TOP_LEVEL.key)        return <TongQuanPlaceholder />
    if (activeKey === 'lam-sang-overview')  return <DashboardClinical />
    if (activeKey === 'van-hanh-overview')  return <DashboardOps />
    if (activeKey === 'tai-chinh-overview') return <DashboardFinance />
    if (activeKey === 'ca-chup-doc')        return <CaChupReport />
    if (activeKey === 'doanh-thu')          return <DoanhThuReport />
    if (activeKey === 'kho')                return <KhoReportPlaceholder />
    return <div className="text-gray-400 text-sm p-4">Báo cáo không tồn tại.</div>
  }

  return (
    <div>
      <ReportPageHeader breadcrumb={breadcrumb} userName={auth?.displayName || auth?.username} />
      {renderContent()}
    </div>
  )
}
