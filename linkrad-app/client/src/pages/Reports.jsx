import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

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

// ── Sidebar menu ────────────────────────────────────────
const REPORT_MENU = [
  { key: 'revenue-detail', label: 'Báo cáo doanh thu chi tiết', icon: '📊' },
  { key: 'customer-detail', label: 'Báo cáo chi tiết khách hàng', icon: '👥' },
  { key: 'promotion-detail', label: 'Báo cáo chương trình khuyến mãi', icon: '🎁' },
  { key: 'clinic-revenue', label: 'Báo cáo doanh thu phòng khám', icon: '🏥' },
  { key: 'refund-exchange', label: 'Báo cáo hoàn trả/đổi dịch vụ', icon: '🔄' },
  { key: 'e-invoice', label: 'Báo cáo hóa đơn điện tử', icon: '🧾' },
]

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
function RevenueDetailReport() {
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
    api.get('/catalogs/medical-facilities').then(r => setBranches(r.data)).catch(() => {})
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

function CustomerDetailReport() {
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

function PromotionDetailReport() {
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

function ClinicRevenueReport() {
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

function RefundExchangeReport() {
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

function EInvoiceReport() {
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

// ══════════════════════════════════════════════════════════
//  MAIN REPORTS PAGE
// ══════════════════════════════════════════════════════════
export default function Reports() {
  const { reportKey } = useParams()
  const activeKey = reportKey || 'revenue-detail'
  const activeLabel = REPORT_MENU.find(i => i.key === activeKey)?.label || ''

  const renderContent = () => {
    if (activeKey === 'revenue-detail') return <RevenueDetailReport />
    if (activeKey === 'customer-detail') return <CustomerDetailReport />
    if (activeKey === 'promotion-detail') return <PromotionDetailReport />
    if (activeKey === 'clinic-revenue') return <ClinicRevenueReport />
    if (activeKey === 'refund-exchange') return <RefundExchangeReport />
    if (activeKey === 'e-invoice') return <EInvoiceReport />
    return <div className="text-gray-400 text-sm p-4">Chọn báo cáo từ menu bên trái</div>
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{activeLabel}</h3>
      {renderContent()}
    </div>
  )
}
