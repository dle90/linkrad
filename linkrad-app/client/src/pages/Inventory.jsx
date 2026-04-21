import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

const fmtMoney = (v) => v == null ? '0' : Number(v).toLocaleString('vi-VN')
const TX_TYPES = { import: 'Nhập kho', export: 'Xuất kho', adjustment: 'Điều chỉnh', auto_deduct: 'Trừ tự động' }
const TX_CLS = { import: 'bg-green-100 text-green-700', export: 'bg-orange-100 text-orange-700', adjustment: 'bg-blue-100 text-blue-700', auto_deduct: 'bg-purple-100 text-purple-700' }
const ST_CLS = { draft: 'bg-gray-100 text-gray-700', confirmed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' }
const ST_LBL = { draft: 'Nháp', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy' }

// ── Reusable CRUD Modal ──────────────────────────────────
function CrudModal({ title, fields, record, onClose, onSave }) {
  const [form, setForm] = useState(record || {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const handleSave = async () => {
    for (const f of fields) { if (f.required && !form[f.key]?.toString().trim()) return setError(`${f.label} là bắt buộc`) }
    setSaving(true); setError('')
    try { await onSave(form) } catch (err) { setError(err.response?.data?.error || 'Lỗi'); setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between"><h3 className="font-semibold text-gray-800">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button></div>
        <div className="p-6 space-y-3">
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key} className={f.wide ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required ? ' *' : ''}</label>
                {f.type === 'select' ? (
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                    <option value="">-- Chọn --</option>
                    {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'number' ? (
                  <input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form[f.key] || 0} onChange={e => setForm(p => ({ ...p, [f.key]: +e.target.value }))} />
                ) : (
                  <input className="w-full border rounded px-2 py-1.5 text-sm" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Transaction (Import/Export) Modal ────────────────────
function TransactionModal({ type, supplies, suppliers, warehouses, cancelReasons, userDept, onClose, onSaved }) {
  const [site, setSite] = useState(userDept || '')
  const [warehouseId, setWarehouseId] = useState('')
  const [accountingPeriod, setAccountingPeriod] = useState(() => {
    const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  })
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [reason, setReason] = useState('')
  const [txNotes, setTxNotes] = useState('')
  const emptyItem = { supplyId: '', supplyName: '', supplyCode: '', unit: '', packagingSpec: '', quantity: 1, conversionQuantity: 0, purchasePrice: 0, lotNumber: '', manufacturingDate: '', expiryDate: '', vatRate: 10, discountPercent: 0, discountAmount: 0, notes: '' }
  const [items, setItems] = useState([{ ...emptyItem }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const addItem = () => setItems(p => [...p, { ...emptyItem }])
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  const selectSupply = (i, id) => {
    const s = supplies.find(s => s._id === id)
    setItems(p => p.map((it, idx) => idx === i ? { ...it, supplyId: id, supplyName: s?.name || '', supplyCode: s?.code || '', unit: s?.unit || '', packagingSpec: s?.packagingSpec || '', conversionQuantity: (it.quantity || 1) * (s?.conversionRate || 1) } : it))
  }
  // Auto-calc conversion when quantity changes
  const updateQuantity = (i, qty) => {
    const s = supplies.find(s => s._id === items[i].supplyId)
    setItems(p => p.map((it, idx) => idx === i ? { ...it, quantity: qty, conversionQuantity: qty * (s?.conversionRate || 1) } : it))
  }

  // Computed totals per item
  const calcItem = (it) => {
    const amtBefore = (it.purchasePrice || 0) * (it.quantity || 0)
    const vatAmt = Math.round(amtBefore * (it.vatRate || 0) / 100)
    const amtAfter = amtBefore + vatAmt
    const discAmt = it.discountAmount || Math.round(amtAfter * (it.discountPercent || 0) / 100)
    return { amtBefore, vatAmt, amtAfter, discAmt, total: amtAfter - discAmt }
  }
  const totals = items.reduce((acc, it) => {
    const c = calcItem(it); return { before: acc.before + c.amtBefore, vat: acc.vat + c.vatAmt, disc: acc.disc + c.discAmt, total: acc.total + c.total }
  }, { before: 0, vat: 0, disc: 0, total: 0 })

  const handleSave = async () => {
    if (items.some(it => !it.supplyId || !it.quantity)) return setError('Vui lòng chọn vật tư và số lượng')
    setSaving(true)
    const wh = warehouses.find(w => w._id === warehouseId)
    try {
      await api.post('/inventory/transactions', {
        type, site, warehouseId, warehouseName: wh?.name || '', warehouseCode: wh?.code || '',
        accountingPeriod, items, supplierId, supplierName, reason, notes: txNotes,
      })
      onSaved()
    } catch (err) { setError(err.response?.data?.error || 'Lỗi'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between">
          <h3 className="font-semibold text-gray-800">{type === 'import' ? 'Tạo phiếu nhập kho' : 'Tạo phiếu xuất kho'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          {/* Header fields */}
          <div className="grid grid-cols-4 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Chi nhánh</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={site} onChange={e => setSite(e.target.value)} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Kho</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                <option value="">-- Tất cả --</option>{warehouses.map(w => <option key={w._id} value={w._id}>{w.code} - {w.name}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Kỳ kế toán</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={accountingPeriod} onChange={e => setAccountingPeriod(e.target.value)} placeholder="MM/YYYY" /></div>
            {type === 'import' && <div><label className="block text-xs font-medium text-gray-600 mb-1">Nhà cung cấp</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={supplierId} onChange={e => { setSupplierId(e.target.value); setSupplierName(suppliers.find(s => s._id === e.target.value)?.name || '') }}>
                <option value="">-- Chọn --</option>{suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select></div>}
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Lý do</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={reason} onChange={e => setReason(e.target.value)} /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú phiếu</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={txNotes} onChange={e => setTxNotes(e.target.value)} /></div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex justify-between items-center mb-2"><label className="text-sm font-medium text-gray-700">Danh sách vật tư</label><button onClick={addItem} className="text-sm text-blue-600 hover:text-blue-800">+ Thêm dòng</button></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1100px]">
                <thead><tr className="bg-gray-50 text-gray-600">
                  <th className="text-left px-1.5 py-1.5">Vật tư</th>
                  <th className="text-left px-1.5 py-1.5 w-16">ĐVT</th>
                  <th className="text-left px-1.5 py-1.5 w-20">Quy cách</th>
                  <th className="text-right px-1.5 py-1.5 w-14">SL</th>
                  <th className="text-right px-1.5 py-1.5 w-16">SL CĐ</th>
                  {type === 'import' && <>
                    <th className="text-left px-1.5 py-1.5 w-20">Mã lô</th>
                    <th className="text-left px-1.5 py-1.5 w-24">Ngày SX</th>
                    <th className="text-left px-1.5 py-1.5 w-24">Hạn SD</th>
                    <th className="text-right px-1.5 py-1.5 w-20">Giá mua</th>
                    <th className="text-right px-1.5 py-1.5 w-16">Giá/ĐV</th>
                    <th className="text-right px-1.5 py-1.5 w-20">Trước thuế</th>
                    <th className="text-right px-1.5 py-1.5 w-12">VAT%</th>
                    <th className="text-right px-1.5 py-1.5 w-12">CK%</th>
                    <th className="text-right px-1.5 py-1.5 w-20">Tổng tiền</th>
                  </>}
                  <th className="text-left px-1.5 py-1.5 w-20">Ghi chú</th>
                  <th className="px-1 py-1.5 w-6"></th>
                </tr></thead>
                <tbody>{items.map((it, i) => {
                  const c = calcItem(it)
                  return (
                    <tr key={i} className="border-b">
                      <td className="px-1.5 py-1"><select className="w-full border rounded px-1 py-1 text-xs" value={it.supplyId} onChange={e => selectSupply(i, e.target.value)}><option value="">-- Chọn --</option>{supplies.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}</select></td>
                      <td className="px-1.5 py-1 text-gray-500">{it.unit || '-'}</td>
                      <td className="px-1.5 py-1 text-gray-500">{it.packagingSpec || '-'}</td>
                      <td className="px-1.5 py-1"><input type="number" className="w-14 border rounded px-1 py-1 text-right text-xs" value={it.quantity} onChange={e => updateQuantity(i, +e.target.value)} min={1} /></td>
                      <td className="px-1.5 py-1 text-right text-gray-500">{it.conversionQuantity || '-'}</td>
                      {type === 'import' && <>
                        <td className="px-1.5 py-1"><input className="w-20 border rounded px-1 py-1 text-xs" value={it.lotNumber} onChange={e => updateItem(i, 'lotNumber', e.target.value)} /></td>
                        <td className="px-1.5 py-1"><input type="date" className="border rounded px-1 py-1 text-xs" value={it.manufacturingDate} onChange={e => updateItem(i, 'manufacturingDate', e.target.value)} /></td>
                        <td className="px-1.5 py-1"><input type="date" className="border rounded px-1 py-1 text-xs" value={it.expiryDate} onChange={e => updateItem(i, 'expiryDate', e.target.value)} /></td>
                        <td className="px-1.5 py-1"><input type="number" className="w-20 border rounded px-1 py-1 text-right text-xs" value={it.purchasePrice} onChange={e => updateItem(i, 'purchasePrice', +e.target.value)} /></td>
                        <td className="px-1.5 py-1 text-right text-gray-500">{it.conversionQuantity > 0 ? fmtMoney(Math.round((it.purchasePrice || 0) * (it.quantity || 0) / it.conversionQuantity)) : '-'}</td>
                        <td className="px-1.5 py-1 text-right">{fmtMoney(c.amtBefore)}</td>
                        <td className="px-1.5 py-1"><input type="number" className="w-12 border rounded px-1 py-1 text-right text-xs" value={it.vatRate} onChange={e => updateItem(i, 'vatRate', +e.target.value)} /></td>
                        <td className="px-1.5 py-1"><input type="number" className="w-12 border rounded px-1 py-1 text-right text-xs" value={it.discountPercent} onChange={e => updateItem(i, 'discountPercent', +e.target.value)} /></td>
                        <td className="px-1.5 py-1 text-right font-medium">{fmtMoney(c.total)}</td>
                      </>}
                      <td className="px-1.5 py-1"><input className="w-20 border rounded px-1 py-1 text-xs" value={it.notes || ''} onChange={e => updateItem(i, 'notes', e.target.value)} /></td>
                      <td className="px-1 py-1">{items.length > 1 && <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">&times;</button>}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
            {type === 'import' && (
              <div className="flex justify-end gap-6 mt-3 text-sm">
                <span className="text-gray-500">Trước thuế: <span className="font-medium text-gray-700">{fmtMoney(totals.before)}</span></span>
                <span className="text-gray-500">VAT: <span className="font-medium text-blue-600">{fmtMoney(totals.vat)}</span></span>
                <span className="text-gray-500">Chiết khấu: <span className="font-medium text-orange-600">{fmtMoney(totals.disc)}</span></span>
                <span className="text-gray-700 font-semibold">Tổng tiền: <span className="text-blue-700">{fmtMoney(totals.total)}</span></span>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Đang lưu...' : 'Tạo phiếu'}</button>
        </div>
      </div>
    </div>
  )
}

// ── HIS Mapping Modal ────────────────────────────────────
function HisMappingModal({ services, supplies, onClose, onSaved }) {
  const [serviceId, setServiceId] = useState('')
  const [supplyId, setSupplyId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const svc = services.find(s => s._id === serviceId)
  const spl = supplies.find(s => s._id === supplyId)
  const handleSave = async () => {
    if (!serviceId || !supplyId) return setError('Vui lòng chọn dịch vụ và vật tư')
    setSaving(true)
    try {
      await api.post('/inventory/his-mapping', { serviceId, serviceCode: svc?.code, serviceName: svc?.name, supplyId, supplyCode: spl?.code, supplyName: spl?.name, quantity, unit: spl?.unit })
      onSaved()
    } catch (err) { setError(err.response?.data?.error || 'Lỗi'); setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b"><h3 className="font-semibold text-gray-800">Thêm định mức vật tư - dịch vụ</h3></div>
        <div className="p-6 space-y-3">
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Dịch vụ *</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={serviceId} onChange={e => setServiceId(e.target.value)}><option value="">-- Chọn --</option>{services.map(s => <option key={s._id} value={s._id}>{s.code} - {s.name}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Vật tư *</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={supplyId} onChange={e => setSupplyId(e.target.value)}><option value="">-- Chọn --</option>{supplies.map(s => <option key={s._id} value={s._id}>{s.code} - {s.name}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Số lượng tiêu hao</label>
            <input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={quantity} onChange={e => setQuantity(+e.target.value)} min={1} /></div>
        </div>
        <div className="px-6 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Stock Card Modal ─────────────────────────────────────
function StockCardModal({ supply, onClose }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get(`/inventory/reports/card/${supply._id}`).then(r => { setEntries(r.data.entries || []); setLoading(false) }).catch(() => setLoading(false)) }, [supply._id])
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between"><div><h3 className="font-semibold text-gray-800">Thẻ kho - {supply.name}</h3><p className="text-xs text-gray-500">Mã: {supply.code} | Tồn: {supply.currentStock} {supply.unit}</p></div><button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button></div>
        <div className="p-4">{loading ? <p className="text-gray-400 text-sm p-4">Đang tải...</p> : entries.length === 0 ? <p className="text-gray-400 text-sm p-4 text-center">Chưa có giao dịch</p> : (
          <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600"><th className="text-left px-3 py-2">Ngày</th><th className="text-left px-3 py-2">Số phiếu</th><th className="text-left px-3 py-2">Loại</th><th className="text-right px-3 py-2">Nhập</th><th className="text-right px-3 py-2">Xuất</th><th className="text-right px-3 py-2">Tồn</th></tr></thead>
          <tbody>{entries.map((e, i) => (<tr key={i} className="border-t"><td className="px-3 py-1.5">{e.date}</td><td className="px-3 py-1.5 font-medium text-blue-600">{e.transactionNumber}</td><td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs ${TX_CLS[e.type]}`}>{TX_TYPES[e.type]}</span></td><td className="px-3 py-1.5 text-right text-green-600">{e.inQty > 0 ? `+${e.inQty}` : ''}</td><td className="px-3 py-1.5 text-right text-red-600">{e.outQty > 0 ? `-${e.outQty}` : ''}</td><td className="px-3 py-1.5 text-right font-medium">{e.balance}</td></tr>))}</tbody></table>
        )}</div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  MAIN INVENTORY PAGE
// ══════════════════════════════════════════════════════════
export default function Inventory() {
  const { auth, hasPerm } = useAuth()
  const canEdit = hasPerm('inventory.manage')
  const [tab, setTab] = useState('import')
  const [loading, setLoading] = useState(false)

  // Shared data
  const [supplies, setSupplies] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [cancelReasons, setCancelReasons] = useState([])
  const [hisMappings, setHisMappings] = useState([])
  const [services, setServices] = useState([])
  const [lots, setLots] = useState([])

  // Transaction lists
  const [importTxs, setImportTxs] = useState([])
  const [exportTxs, setExportTxs] = useState([])

  // Reports
  const [reportData, setReportData] = useState(null)

  // Modals
  const [showTxModal, setShowTxModal] = useState(null)
  const [editModal, setEditModal] = useState(null) // { type, record, fields, title, saveFn }
  const [showHisModal, setShowHisModal] = useState(false)
  const [showStockCard, setShowStockCard] = useState(null)

  // Filters
  const [filterQ, setFilterQ] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [reportSub, setReportSub] = useState('import') // sub-tab for reports
  const [hangHoaSub, setHangHoaSub] = useState('supplies') // sub-tab for hang hoa
  const [khoSub, setKhoSub] = useState('warehouses') // sub-tab for kho
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Load shared data
  const loadBase = useCallback(async () => {
    try {
      const [s, c, sup, wh, cr] = await Promise.all([
        api.get('/inventory/supplies'), api.get('/inventory/categories'),
        api.get('/inventory/suppliers'), api.get('/inventory/warehouses'),
        api.get('/inventory/cancel-reasons'),
      ])
      setSupplies(s.data); setCategories(c.data); setSuppliers(sup.data)
      setWarehouses(wh.data); setCancelReasons(cr.data)
    } catch {}
  }, [])

  const loadImportTxs = useCallback(async () => {
    setLoading(true)
    try { const r = await api.get('/inventory/transactions', { params: { type: 'import', limit: 200 } }); setImportTxs(r.data) } catch {}
    setLoading(false)
  }, [])

  const loadExportTxs = useCallback(async () => {
    setLoading(true)
    try { const r = await api.get('/inventory/transactions', { params: { type: 'export', limit: 200 } }); setExportTxs(r.data) } catch {}
    setLoading(false)
  }, [])

  const loadHisData = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([api.get('/inventory/his-mapping'), api.get('/catalogs/services')])
      setHisMappings(m.data); setServices(s.data)
    } catch {}
  }, [])

  const loadLots = useCallback(async () => {
    try { const r = await api.get('/inventory/lots'); setLots(r.data) } catch {}
  }, [])

  const loadReport = useCallback(async (type) => {
    setLoading(true)
    try {
      const params = {}
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      let r
      if (type === 'import') r = await api.get('/inventory/reports/import', { params })
      else if (type === 'export') r = await api.get('/inventory/reports/export', { params })
      else if (type === 'balance') r = await api.get('/inventory/reports/balance', { params })
      else if (type === 'stock') r = await api.get('/inventory/reports/stock', { params })
      else if (type === 'card') r = { data: null }
      setReportData(r.data)
    } catch {}
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { loadBase() }, [loadBase])
  useEffect(() => { if (tab === 'import') loadImportTxs(); if (tab === 'export') loadExportTxs() }, [tab])
  useEffect(() => { if (tab === 'hangHoa' && hangHoaSub === 'his') loadHisData() }, [tab, hangHoaSub])
  useEffect(() => { if (tab === 'kho' && khoSub === 'lots') loadLots() }, [tab, khoSub])
  useEffect(() => { if (tab === 'reports') loadReport(reportSub) }, [tab, reportSub, loadReport])

  const handleConfirmTx = async (id) => {
    if (!confirm('Xác nhận phiếu? Tồn kho sẽ được cập nhật.')) return
    try { await api.put(`/inventory/transactions/${id}/confirm`); tab === 'import' ? loadImportTxs() : loadExportTxs(); loadBase() }
    catch (err) { alert(err.response?.data?.error || 'Lỗi') }
  }
  const handleCancelTx = async (id) => {
    if (!confirm('Hủy phiếu này?')) return
    try { await api.put(`/inventory/transactions/${id}/cancel`); tab === 'import' ? loadImportTxs() : loadExportTxs() }
    catch (err) { alert(err.response?.data?.error || 'Lỗi') }
  }
  const handleDeleteMapping = async (id) => {
    if (!confirm('Xóa mapping này?')) return
    try { await api.delete(`/inventory/his-mapping/${id}`); loadHisData() } catch {}
  }

  const filteredSupplies = supplies.filter(s => {
    if (filterQ && !s.name.toLowerCase().includes(filterQ.toLowerCase()) && !s.code.toLowerCase().includes(filterQ.toLowerCase())) return false
    if (filterCat && s.categoryId !== filterCat) return false
    return true
  })

  const TABS = [
    { key: 'import', label: 'Phiếu nhập kho', icon: '📥' },
    { key: 'export', label: 'Phiếu xuất kho', icon: '📤' },
    { key: 'hangHoa', label: 'Hàng hóa', icon: '📦' },
    { key: 'suppliers', label: 'Nhà cung cấp', icon: '🏭' },
    { key: 'kho', label: 'Kho', icon: '🏬' },
    { key: 'reports', label: 'Báo cáo', icon: '📊' },
  ]

  // ── Render transaction table ───────────────────────────
  const renderTxTable = (txs, type) => (
    <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50 text-gray-600 text-left">
          <th className="px-3 py-3">Số phiếu</th><th className="px-3 py-3">Ngày lập</th>
          <th className="px-3 py-3">Mã kho</th><th className="px-3 py-3">Tên kho</th>
          <th className="px-3 py-3">Chi nhánh</th><th className="px-3 py-3">Kỳ KT</th>
          {type === 'import' && <th className="px-3 py-3">NCC</th>}
          <th className="px-3 py-3 text-right">Trước thuế</th><th className="px-3 py-3 text-right">VAT</th>
          <th className="px-3 py-3 text-right">CK</th><th className="px-3 py-3 text-right">Tổng tiền</th>
          <th className="px-3 py-3 text-center">SL dòng</th><th className="px-3 py-3">Trạng thái</th>
          <th className="px-3 py-3">Người tạo</th><th className="px-3 py-3"></th>
        </tr></thead>
        <tbody>{loading ? <tr><td colSpan={15} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
          : txs.length === 0 ? <tr><td colSpan={15} className="px-4 py-8 text-center text-gray-400">Chưa có phiếu</td></tr>
          : txs.map(tx => (
          <tr key={tx._id} className="border-t hover:bg-blue-50/50">
            <td className="px-3 py-2.5 font-medium text-blue-600 whitespace-nowrap">{tx.transactionNumber}</td>
            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{tx.createdAt?.slice(0, 10)}</td>
            <td className="px-3 py-2.5 font-mono text-xs">{tx.warehouseCode || '-'}</td>
            <td className="px-3 py-2.5">{tx.warehouseName || '-'}</td>
            <td className="px-3 py-2.5">{tx.site || '-'}</td>
            <td className="px-3 py-2.5 text-gray-500">{tx.accountingPeriod || '-'}</td>
            {type === 'import' && <td className="px-3 py-2.5">{tx.supplierName || '-'}</td>}
            <td className="px-3 py-2.5 text-right">{fmtMoney(tx.totalAmountBeforeTax || 0)}</td>
            <td className="px-3 py-2.5 text-right text-blue-600">{fmtMoney(tx.totalVat || 0)}</td>
            <td className="px-3 py-2.5 text-right text-orange-600">{fmtMoney(tx.totalDiscount || 0)}</td>
            <td className="px-3 py-2.5 text-right font-medium">{fmtMoney(tx.totalAmount)}</td>
            <td className="px-3 py-2.5 text-center">{tx.items?.length || 0}</td>
            <td className="px-3 py-2.5"><span className={`px-1.5 py-0.5 rounded text-xs ${ST_CLS[tx.status]}`}>{ST_LBL[tx.status]}</span></td>
            <td className="px-3 py-2.5 text-gray-500">{tx.createdBy}</td>
            <td className="px-3 py-2.5 flex gap-2">
              {tx.status === 'draft' && <>
                <button onClick={() => handleConfirmTx(tx._id)} className="text-green-600 hover:text-green-800 text-xs">Xác nhận</button>
                <button onClick={() => handleCancelTx(tx._id)} className="text-red-500 hover:text-red-700 text-xs">Hủy</button>
              </>}
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Quản lý Kho</h2>

      {/* Main tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${tab === t.key ? 'bg-white shadow font-medium text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ════════════ PHIEU NHAP KHO ════════════ */}
      {tab === 'import' && (
        <>
          <div className="flex justify-end"><button onClick={() => setShowTxModal('import')} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">+ Tạo phiếu nhập</button></div>
          {renderTxTable(importTxs, 'import')}
        </>
      )}

      {/* ════════════ PHIEU XUAT KHO ════════════ */}
      {tab === 'export' && (
        <>
          <div className="flex justify-end"><button onClick={() => setShowTxModal('export')} className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700">+ Tạo phiếu xuất</button></div>
          {renderTxTable(exportTxs, 'export')}
        </>
      )}

      {/* ════════════ HANG HOA (3 sub-tabs) ════════════ */}
      {tab === 'hangHoa' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-1 border-b">
              {[{ key: 'supplies', label: 'Hàng hóa' }, { key: 'categories', label: 'Nhóm hàng hóa' }, { key: 'his', label: 'Hàng hóa HIS' }].map(s => (
                <button key={s.key} onClick={() => setHangHoaSub(s.key)}
                  className={`px-4 py-2 text-sm border-b-2 transition-colors ${hangHoaSub === s.key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {hangHoaSub === 'supplies' && canEdit && <button onClick={() => setEditModal({ type: 'supply', record: null })} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Thêm hàng hóa</button>}
              {hangHoaSub === 'categories' && canEdit && <button onClick={() => setEditModal({ type: 'category', record: null })} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Thêm nhóm</button>}
              {hangHoaSub === 'his' && canEdit && <button onClick={() => setShowHisModal(true)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Thêm định mức</button>}
            </div>
          </div>

          {/* Supplies list */}
          {hangHoaSub === 'supplies' && (
            <>
              <div className="flex gap-3 items-center">
                <input className="border rounded px-3 py-1.5 text-sm w-56" placeholder="Tìm hàng hóa..." value={filterQ} onChange={e => setFilterQ(e.target.value)} />
                <select className="border rounded px-3 py-1.5 text-sm" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                  <option value="">Tất cả nhóm</option>{categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Tên</th><th className="px-4 py-3">Nhóm</th><th className="px-4 py-3">ĐVT</th>
                  <th className="px-4 py-3">Quy cách</th><th className="px-4 py-3 text-right">SL CĐ</th>
                  <th className="px-4 py-3 text-right">Tồn kho</th><th className="px-4 py-3 text-right">Tối thiểu</th><th className="px-4 py-3">Chi nhánh</th><th className="px-4 py-3"></th>
                </tr></thead><tbody>
                  {filteredSupplies.length === 0 ? <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Chưa có hàng hóa</td></tr>
                  : filteredSupplies.map(s => (
                    <tr key={s._id} className={`border-t hover:bg-blue-50/50 ${s.currentStock <= s.minimumStock ? 'bg-red-50/50' : ''}`}>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{s.code}</td>
                      <td className="px-4 py-2.5 font-medium">{s.name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{categories.find(c => c._id === s.categoryId)?.name || '-'}</td>
                      <td className="px-4 py-2.5">{s.unit}</td>
                      <td className="px-4 py-2.5 text-gray-500">{s.packagingSpec || '-'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{s.conversionRate || 1}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${s.currentStock <= s.minimumStock ? 'text-red-600' : 'text-green-600'}`}>{s.currentStock}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{s.minimumStock}</td>
                      <td className="px-4 py-2.5 text-gray-500">{s.site || '-'}</td>
                      <td className="px-4 py-2.5 flex gap-2">
                        <button onClick={() => setShowStockCard(s)} className="text-blue-500 hover:text-blue-700 text-xs">Thẻ kho</button>
                        {canEdit && <button onClick={() => setEditModal({ type: 'supply', record: s })} className="text-gray-500 hover:text-gray-700 text-xs">Sửa</button>}
                      </td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            </>
          )}

          {/* Categories */}
          {hangHoaSub === 'categories' && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
                <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Tên nhóm</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3"></th>
              </tr></thead><tbody>
                {categories.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Chưa có nhóm</td></tr>
                : categories.map(c => (
                  <tr key={c._id} className="border-t hover:bg-blue-50/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{c.code}</td>
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5"><span className={`px-1.5 py-0.5 rounded text-xs ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status === 'active' ? 'Hoạt động' : 'Ngưng'}</span></td>
                    <td className="px-4 py-2.5">{canEdit && <button onClick={() => setEditModal({ type: 'category', record: c })} className="text-gray-500 hover:text-gray-700 text-xs">Sửa</button>}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}

          {/* HIS Mapping */}
          {hangHoaSub === 'his' && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
                <th className="px-4 py-3">Mã DV</th><th className="px-4 py-3">Tên dịch vụ</th><th className="px-4 py-3">Mã VT</th><th className="px-4 py-3">Tên vật tư</th>
                <th className="px-4 py-3 text-right">SL tiêu hao</th><th className="px-4 py-3">ĐVT</th><th className="px-4 py-3"></th>
              </tr></thead><tbody>
                {hisMappings.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Chưa có định mức. Thêm để tự động trừ kho khi thực hiện dịch vụ.</td></tr>
                : hisMappings.map(m => (
                  <tr key={m._id} className="border-t hover:bg-blue-50/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{m.serviceCode}</td>
                    <td className="px-4 py-2.5">{m.serviceName}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{m.supplyCode}</td>
                    <td className="px-4 py-2.5">{m.supplyName}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{m.quantity}</td>
                    <td className="px-4 py-2.5 text-gray-500">{m.unit}</td>
                    <td className="px-4 py-2.5">{canEdit && <button onClick={() => handleDeleteMapping(m._id)} className="text-red-500 hover:text-red-700 text-xs">Xóa</button>}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </>
      )}

      {/* ════════════ NHA CUNG CAP ════════════ */}
      {tab === 'suppliers' && (
        <>
          {canEdit && <div className="flex justify-end"><button onClick={() => setEditModal({ type: 'supplier', record: null })} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Thêm NCC</button></div>}
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
              <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Tên NCC</th><th className="px-4 py-3">Liên hệ</th><th className="px-4 py-3">SĐT</th>
              <th className="px-4 py-3">Email</th><th className="px-4 py-3">MST</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3"></th>
            </tr></thead><tbody>
              {suppliers.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Chưa có NCC</td></tr>
              : suppliers.map(s => (
                <tr key={s._id} className="border-t hover:bg-blue-50/50">
                  <td className="px-4 py-2.5 font-mono text-xs">{s.code}</td>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5">{s.contactPerson || '-'}</td>
                  <td className="px-4 py-2.5">{s.phone || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{s.email || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{s.taxCode || '-'}</td>
                  <td className="px-4 py-2.5"><span className={`px-1.5 py-0.5 rounded text-xs ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.status === 'active' ? 'Hoạt động' : 'Ngưng'}</span></td>
                  <td className="px-4 py-2.5">{canEdit && <button onClick={() => setEditModal({ type: 'supplier', record: s })} className="text-gray-500 hover:text-gray-700 text-xs">Sửa</button>}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </>
      )}

      {/* ════════════ KHO (3 sub-tabs) ════════════ */}
      {tab === 'kho' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-1 border-b">
              {[{ key: 'warehouses', label: 'Kho hàng' }, { key: 'lots', label: 'Kho theo lô' }, { key: 'info', label: 'Thông tin kho' }, { key: 'cancelReasons', label: 'Lý do hủy' }].map(s => (
                <button key={s.key} onClick={() => setKhoSub(s.key)}
                  className={`px-4 py-2 text-sm border-b-2 transition-colors ${khoSub === s.key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            {khoSub === 'warehouses' && canEdit && <button onClick={() => setEditModal({ type: 'warehouse', record: null })} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Thêm kho</button>}
            {khoSub === 'cancelReasons' && canEdit && <button onClick={() => setEditModal({ type: 'cancelReason', record: null })} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Thêm lý do</button>}
          </div>

          {/* Warehouses */}
          {khoSub === 'warehouses' && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
                <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Tên kho</th><th className="px-4 py-3">Chi nhánh</th><th className="px-4 py-3">Quản lý</th><th className="px-4 py-3">SĐT</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3"></th>
              </tr></thead><tbody>
                {warehouses.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Chưa có kho</td></tr>
                : warehouses.map(w => (
                  <tr key={w._id} className="border-t hover:bg-blue-50/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{w.code}</td>
                    <td className="px-4 py-2.5 font-medium">{w.name}</td>
                    <td className="px-4 py-2.5">{w.site || '-'}</td>
                    <td className="px-4 py-2.5">{w.manager || '-'}</td>
                    <td className="px-4 py-2.5">{w.phone || '-'}</td>
                    <td className="px-4 py-2.5"><span className={`px-1.5 py-0.5 rounded text-xs ${w.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{w.status === 'active' ? 'Hoạt động' : 'Ngưng'}</span></td>
                    <td className="px-4 py-2.5">{canEdit && <button onClick={() => setEditModal({ type: 'warehouse', record: w })} className="text-gray-500 hover:text-gray-700 text-xs">Sửa</button>}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}

          {/* Lots */}
          {khoSub === 'lots' && (
            <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
                <th className="px-4 py-3">Mã lô</th><th className="px-4 py-3">Vật tư</th><th className="px-4 py-3">Kho</th><th className="px-4 py-3">Chi nhánh</th>
                <th className="px-4 py-3">Ngày SX</th><th className="px-4 py-3">Hạn SD</th>
                <th className="px-4 py-3 text-right">SL ban đầu</th><th className="px-4 py-3 text-right">SL hiện tại</th>
                <th className="px-4 py-3 text-right">Đơn giá</th><th className="px-4 py-3">Trạng thái</th>
              </tr></thead><tbody>
                {lots.length === 0 ? <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Chưa có lô hàng</td></tr>
                : lots.map(l => {
                  const spl = supplies.find(s => s._id === l.supplyId)
                  const wh = warehouses.find(w => w._id === l.warehouseId)
                  const isExpiring = l.expiryDate && l.expiryDate <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
                  return (
                    <tr key={l._id} className={`border-t hover:bg-blue-50/50 ${isExpiring ? 'bg-orange-50/50' : ''}`}>
                      <td className="px-4 py-2.5 font-mono text-xs">{l.lotNumber}</td>
                      <td className="px-4 py-2.5">{spl?.name || l.supplyId}</td>
                      <td className="px-4 py-2.5 text-gray-500">{wh?.name || '-'}</td>
                      <td className="px-4 py-2.5">{l.site || '-'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{l.manufacturingDate || '-'}</td>
                      <td className={`px-4 py-2.5 ${isExpiring ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>{l.expiryDate || '-'}</td>
                      <td className="px-4 py-2.5 text-right">{l.initialQuantity}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{l.currentQuantity}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoney(l.unitPrice)}</td>
                      <td className="px-4 py-2.5"><span className={`px-1.5 py-0.5 rounded text-xs ${l.status === 'available' ? 'bg-green-100 text-green-700' : l.status === 'expired' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{l.status === 'available' ? 'Còn hàng' : l.status === 'expired' ? 'Hết hạn' : 'Đã hết'}</span></td>
                    </tr>
                  )
                })}
              </tbody></table>
            </div>
          )}

          {/* Info - stock summary */}
          {khoSub === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4"><div className="text-xs text-blue-600 font-medium">Tổng mặt hàng</div><div className="text-2xl font-bold text-blue-700 mt-1">{supplies.length}</div></div>
                <div className="bg-red-50 rounded-lg p-4"><div className="text-xs text-red-600 font-medium">Dưới mức tối thiểu</div><div className="text-2xl font-bold text-red-700 mt-1">{supplies.filter(s => s.currentStock <= s.minimumStock).length}</div></div>
                <div className="bg-green-50 rounded-lg p-4"><div className="text-xs text-green-600 font-medium">Nhà cung cấp</div><div className="text-2xl font-bold text-green-700 mt-1">{suppliers.length}</div></div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Hàng hóa dưới mức tối thiểu</h3>
                {supplies.filter(s => s.currentStock <= s.minimumStock).length === 0 ? <p className="text-gray-400 text-sm">Tất cả hàng hóa đều đủ tồn kho</p> :
                <table className="w-full text-sm"><thead><tr className="bg-red-50 text-red-700"><th className="text-left px-3 py-2">Mã</th><th className="text-left px-3 py-2">Tên</th><th className="text-right px-3 py-2">Tồn</th><th className="text-right px-3 py-2">Tối thiểu</th><th className="text-right px-3 py-2">Thiếu</th></tr></thead>
                <tbody>{supplies.filter(s => s.currentStock <= s.minimumStock).map(s => (
                  <tr key={s._id} className="border-t"><td className="px-3 py-1.5 font-mono text-xs">{s.code}</td><td className="px-3 py-1.5">{s.name}</td>
                  <td className="px-3 py-1.5 text-right text-red-600 font-medium">{s.currentStock}</td><td className="px-3 py-1.5 text-right">{s.minimumStock}</td>
                  <td className="px-3 py-1.5 text-right text-red-600 font-semibold">{s.minimumStock - s.currentStock}</td></tr>
                ))}</tbody></table>}
              </div>
            </div>
          )}

          {/* Cancel reasons */}
          {khoSub === 'cancelReasons' && (
            <>
              <div className="flex gap-4">
                {['import', 'export'].map(t => (
                  <div key={t} className="flex-1 bg-white rounded-lg border overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b font-medium text-sm text-gray-700">{t === 'import' ? 'Lý do hủy - Phiếu nhập' : 'Lý do hủy - Phiếu xuất'}</div>
                    <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600"><th className="text-left px-4 py-2">Mã</th><th className="text-left px-4 py-2">Lý do</th><th className="px-4 py-2"></th></tr></thead>
                    <tbody>{cancelReasons.filter(r => r.type === t).length === 0 ? <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400 text-xs">Chưa có</td></tr>
                    : cancelReasons.filter(r => r.type === t).map(r => (
                      <tr key={r._id} className="border-t"><td className="px-4 py-1.5 font-mono text-xs">{r.code}</td><td className="px-4 py-1.5">{r.name}</td>
                      <td className="px-4 py-1.5">{canEdit && <button onClick={() => setEditModal({ type: 'cancelReason', record: r })} className="text-gray-500 hover:text-gray-700 text-xs">Sửa</button>}</td></tr>
                    ))}</tbody></table>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════ BAO CAO (5 sub-tabs) ════════════ */}
      {tab === 'reports' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-1 border-b">
              {[{ key: 'import', label: 'BC nhập' }, { key: 'export', label: 'BC xuất' }, { key: 'balance', label: 'BC xuất nhập tồn' }, { key: 'stock', label: 'BC tồn' }, { key: 'card', label: 'Thẻ kho' }].map(s => (
                <button key={s.key} onClick={() => setReportSub(s.key)}
                  className={`px-4 py-2 text-sm border-b-2 transition-colors ${reportSub === s.key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            {reportSub !== 'card' && <div className="flex gap-2 items-center text-sm">
              <input type="date" className="border rounded px-2 py-1 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span className="text-gray-400">-</span>
              <input type="date" className="border rounded px-2 py-1 text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              <button onClick={() => loadReport(reportSub)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Xem</button>
            </div>}
          </div>

          {/* Import report */}
          {reportSub === 'import' && reportData && (
            <div className="space-y-3">
              <div className="flex gap-4"><div className="bg-green-50 rounded-lg p-4"><div className="text-xs text-green-600">Tổng nhập</div><div className="text-xl font-bold text-green-700">{fmtMoney(reportData.total)}</div></div>
              <div className="bg-blue-50 rounded-lg p-4"><div className="text-xs text-blue-600">Số phiếu</div><div className="text-xl font-bold text-blue-700">{reportData.count}</div></div></div>
              {renderTxTable(reportData.transactions || [], 'import')}
            </div>
          )}

          {/* Export report */}
          {reportSub === 'export' && reportData && (
            <div className="space-y-3">
              <div className="flex gap-4"><div className="bg-orange-50 rounded-lg p-4"><div className="text-xs text-orange-600">Tổng xuất</div><div className="text-xl font-bold text-orange-700">{fmtMoney(reportData.total)}</div></div>
              <div className="bg-blue-50 rounded-lg p-4"><div className="text-xs text-blue-600">Số phiếu</div><div className="text-xl font-bold text-blue-700">{reportData.count}</div></div></div>
              {renderTxTable(reportData.transactions || [], 'export')}
            </div>
          )}

          {/* Balance report */}
          {reportSub === 'balance' && reportData && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
                <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Tên hàng hóa</th><th className="px-4 py-3">ĐVT</th>
                <th className="px-4 py-3 text-right">SL nhập</th><th className="px-4 py-3 text-right">Tiền nhập</th>
                <th className="px-4 py-3 text-right">SL xuất</th><th className="px-4 py-3 text-right">Tiền xuất</th>
                <th className="px-4 py-3 text-right">Tồn kho</th>
              </tr></thead><tbody>
                {(Array.isArray(reportData) ? reportData : []).length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
                : (Array.isArray(reportData) ? reportData : []).map(r => (
                  <tr key={r.supplyId} className="border-t hover:bg-blue-50/50">
                    <td className="px-4 py-2 font-mono text-xs">{r.code}</td><td className="px-4 py-2">{r.name}</td><td className="px-4 py-2">{r.unit}</td>
                    <td className="px-4 py-2 text-right text-green-600">{r.totalIn}</td><td className="px-4 py-2 text-right text-green-600">{fmtMoney(r.totalInAmount)}</td>
                    <td className="px-4 py-2 text-right text-orange-600">{r.totalOut}</td><td className="px-4 py-2 text-right text-orange-600">{fmtMoney(r.totalOutAmount)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{r.currentStock}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}

          {/* Stock report */}
          {reportSub === 'stock' && reportData && (
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="bg-blue-50 rounded-lg p-4"><div className="text-xs text-blue-600">Tổng mặt hàng</div><div className="text-xl font-bold text-blue-700">{reportData.supplies?.length || 0}</div></div>
                <div className="bg-red-50 rounded-lg p-4"><div className="text-xs text-red-600">Dưới tối thiểu</div><div className="text-xl font-bold text-red-700">{reportData.lowStockCount || 0}</div></div>
              </div>
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Tên</th><th className="px-4 py-3">ĐVT</th>
                  <th className="px-4 py-3 text-right">Tồn kho</th><th className="px-4 py-3 text-right">Tối thiểu</th><th className="px-4 py-3">Chi nhánh</th>
                </tr></thead><tbody>
                  {(reportData.supplies || []).map(s => (
                    <tr key={s._id} className={`border-t ${s.currentStock <= s.minimumStock ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-2 font-mono text-xs">{s.code}</td><td className="px-4 py-2">{s.name}</td><td className="px-4 py-2">{s.unit}</td>
                      <td className={`px-4 py-2 text-right font-medium ${s.currentStock <= s.minimumStock ? 'text-red-600' : ''}`}>{s.currentStock}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{s.minimumStock}</td>
                      <td className="px-4 py-2 text-gray-500">{s.site || '-'}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            </div>
          )}

          {/* Stock card */}
          {reportSub === 'card' && (
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600 mb-3">Chọn hàng hóa để xem thẻ kho:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {supplies.map(s => (
                  <button key={s._id} onClick={() => setShowStockCard(s)}
                    className="text-left px-3 py-2 border rounded hover:bg-blue-50 text-sm">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.code} | Tồn: {s.currentStock} {s.unit}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════ MODALS ════════════ */}
      {showTxModal && <TransactionModal type={showTxModal} supplies={supplies} suppliers={suppliers} warehouses={warehouses} cancelReasons={cancelReasons} userDept={auth.department} onClose={() => setShowTxModal(null)} onSaved={() => { setShowTxModal(null); tab === 'import' ? loadImportTxs() : loadExportTxs(); loadBase() }} />}
      {showStockCard && <StockCardModal supply={showStockCard} onClose={() => setShowStockCard(null)} />}
      {showHisModal && <HisMappingModal services={services} supplies={supplies} onClose={() => setShowHisModal(false)} onSaved={() => { setShowHisModal(false); loadHisData() }} />}

      {/* Generic edit modals */}
      {editModal?.type === 'supplier' && <CrudModal title={editModal.record?._id ? 'Sửa NCC' : 'Thêm NCC'}
        fields={[{ key: 'name', label: 'Tên NCC', required: true }, { key: 'code', label: 'Mã' }, { key: 'contactPerson', label: 'Người liên hệ' }, { key: 'phone', label: 'SĐT' }, { key: 'email', label: 'Email' }, { key: 'taxCode', label: 'MST' }, { key: 'address', label: 'Địa chỉ', wide: true }]}
        record={editModal.record} onClose={() => setEditModal(null)}
        onSave={async (form) => { if (editModal.record?._id) await api.put(`/inventory/suppliers/${editModal.record._id}`, form); else await api.post('/inventory/suppliers', form); setEditModal(null); loadBase() }} />}

      {editModal?.type === 'supply' && <CrudModal title={editModal.record?._id ? 'Sửa hàng hóa' : 'Thêm hàng hóa'}
        fields={[{ key: 'name', label: 'Tên', required: true }, { key: 'code', label: 'Mã' },
          { key: 'categoryId', label: 'Nhóm', type: 'select', options: categories.map(c => ({ value: c._id, label: c.name })) },
          { key: 'unit', label: 'ĐVT' }, { key: 'packagingSpec', label: 'Quy cách đóng gói' }, { key: 'conversionRate', label: 'SL chuyển đổi (1 gói = N đơn vị)', type: 'number' },
          { key: 'minimumStock', label: 'Tồn tối thiểu', type: 'number' }, { key: 'site', label: 'Chi nhánh' }]}
        record={editModal.record} onClose={() => setEditModal(null)}
        onSave={async (form) => { if (editModal.record?._id) await api.put(`/inventory/supplies/${editModal.record._id}`, form); else await api.post('/inventory/supplies', form); setEditModal(null); loadBase() }} />}

      {editModal?.type === 'category' && <CrudModal title={editModal.record?._id ? 'Sửa nhóm' : 'Thêm nhóm'}
        fields={[{ key: 'name', label: 'Tên nhóm', required: true }, { key: 'code', label: 'Mã' }]}
        record={editModal.record} onClose={() => setEditModal(null)}
        onSave={async (form) => { if (editModal.record?._id) await api.put(`/inventory/categories/${editModal.record._id}`, form); else await api.post('/inventory/categories', form); setEditModal(null); loadBase() }} />}

      {editModal?.type === 'warehouse' && <CrudModal title={editModal.record?._id ? 'Sửa kho' : 'Thêm kho'}
        fields={[{ key: 'name', label: 'Tên kho', required: true }, { key: 'code', label: 'Mã' }, { key: 'site', label: 'Chi nhánh' }, { key: 'manager', label: 'Quản lý' }, { key: 'phone', label: 'SĐT' }, { key: 'address', label: 'Địa chỉ', wide: true }, { key: 'description', label: 'Mô tả', wide: true }]}
        record={editModal.record} onClose={() => setEditModal(null)}
        onSave={async (form) => { if (editModal.record?._id) await api.put(`/inventory/warehouses/${editModal.record._id}`, form); else await api.post('/inventory/warehouses', form); setEditModal(null); loadBase() }} />}

      {editModal?.type === 'cancelReason' && <CrudModal title={editModal.record?._id ? 'Sửa lý do' : 'Thêm lý do hủy'}
        fields={[{ key: 'name', label: 'Lý do', required: true }, { key: 'code', label: 'Mã' }, { key: 'type', label: 'Loại', type: 'select', options: [{ value: 'import', label: 'Phiếu nhập' }, { value: 'export', label: 'Phiếu xuất' }] }]}
        record={editModal.record} onClose={() => setEditModal(null)}
        onSave={async (form) => { if (editModal.record?._id) await api.put(`/inventory/cancel-reasons/${editModal.record._id}`, form); else await api.post('/inventory/cancel-reasons', form); setEditModal(null); loadBase() }} />}
    </div>
  )
}
