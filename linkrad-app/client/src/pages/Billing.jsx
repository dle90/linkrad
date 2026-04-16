import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

const fmtMoney = (v) => v == null ? '0' : Number(v).toLocaleString('vi-VN')
const fmtDate = (s) => s ? s.slice(0, 10) : ''
const fmtDateTime = (s) => s ? s.slice(0, 16).replace('T', ' ') : ''

const STATUS_TABS = [
  { key: 'cho_thu', label: 'Chờ thu' },
  { key: 'da_thu', label: 'Đã thu' },
  { key: 'hoan_tra', label: 'Hoàn trả' },
  { key: 'all', label: 'Tất cả' },
]

const PAY_METHODS = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'transfer', label: 'Chuyển khoản' },
  { value: 'card', label: 'Thẻ' },
  { value: 'mixed', label: 'Kết hợp' },
]

const PAY_STATUS_MAP = {
  cho_thu: ['draft', 'issued', 'partially_paid'],
  da_thu: ['paid'],
  hoan_tra: ['cancelled', 'refunded'],
}

// ══════════════════════════════════════════════════════════
//  LEFT PANEL — Invoice list
// ══════════════════════════════════════════════════════════
function InvoiceListPanel({ invoices, loading, selectedId, onSelect, statusTab, onStatusTab, dateFrom, dateTo, onDateFrom, onDateTo, searchQ, onSearchQ, onRefresh }) {
  return (
    <div className="flex flex-col h-full">
      {/* Status tabs */}
      <div className="flex border-b">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => onStatusTab(t.key)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors border-b-2 ${
              statusTab === t.key ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filter */}
      <div className="px-3 py-2 border-b bg-gray-50 space-y-1">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>Ngày:</span>
          <input type="date" className="border rounded px-1.5 py-1 text-xs flex-1" value={dateFrom} onChange={e => onDateFrom(e.target.value)} />
          <span>-</span>
          <input type="date" className="border rounded px-1.5 py-1 text-xs flex-1" value={dateTo} onChange={e => onDateTo(e.target.value)} />
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-12 gap-0 bg-[#1e3a5f] text-white text-xs font-medium">
        <div className="col-span-1 px-2 py-1.5">STT</div>
        <div className="col-span-2 px-1 py-1.5">Mã đơn</div>
        <div className="col-span-3 px-1 py-1.5">Họ tên</div>
        <div className="col-span-2 px-1 py-1.5">Ngày thu</div>
        <div className="col-span-1 px-1 py-1.5">GT</div>
        <div className="col-span-3 px-1 py-1.5">SĐT</div>
      </div>

      {/* Search row */}
      <div className="grid grid-cols-12 gap-0 border-b bg-white">
        <div className="col-span-1"></div>
        <div className="col-span-2 px-1 py-1">
          <input className="w-full border rounded px-1 py-0.5 text-xs" placeholder="🔍" value={searchQ} onChange={e => onSearchQ(e.target.value)} />
        </div>
        <div className="col-span-3 px-1 py-1">
          <input className="w-full border rounded px-1 py-0.5 text-xs" placeholder="🔍" />
        </div>
        <div className="col-span-2 px-1 py-1"></div>
        <div className="col-span-1"></div>
        <div className="col-span-3 px-1 py-1">
          <input className="w-full border rounded px-1 py-0.5 text-xs" placeholder="🔍" />
        </div>
      </div>

      {/* Invoice rows */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-gray-400 text-xs py-8">Đang tải...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center text-gray-400 text-xs py-8">No data</div>
        ) : invoices.map((inv, i) => (
          <div key={inv._id} onClick={() => onSelect(inv._id)}
            className={`grid grid-cols-12 gap-0 border-b text-xs cursor-pointer transition-colors ${
              selectedId === inv._id ? 'bg-blue-100' : i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'
            }`}>
            <div className="col-span-1 px-2 py-1.5 text-gray-400">{i + 1}</div>
            <div className="col-span-2 px-1 py-1.5 font-medium text-blue-700 truncate">{inv.invoiceNumber}</div>
            <div className="col-span-3 px-1 py-1.5 truncate">{inv.patientName}</div>
            <div className="col-span-2 px-1 py-1.5 text-gray-500">{fmtDate(inv.paidAt || inv.createdAt)}</div>
            <div className="col-span-1 px-1 py-1.5 text-gray-500">{inv.gender === 'F' ? 'Nữ' : 'Nam'}</div>
            <div className="col-span-3 px-1 py-1.5 text-gray-500">{inv.phone || ''}</div>
          </div>
        ))}
      </div>

      {/* Refresh button */}
      <div className="px-3 py-2 border-t bg-gray-50 flex justify-end">
        <button onClick={onRefresh} className="text-xs text-blue-600 hover:text-blue-800">🔄 Làm mới</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  CENTER PANEL — Payment form + Service table
// ══════════════════════════════════════════════════════════
function PaymentFormPanel({ invoice, setInvoice, promotions, onCollect, onPrint, onRefund, saving }) {
  const { auth } = useAuth()
  const [payMethod, setPayMethod] = useState('transfer')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountPct, setDiscountPct] = useState(0)
  const [promoId, setPromoId] = useState('')
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [promoResult, setPromoResult] = useState(null)
  const [promoError, setPromoError] = useState('')
  const [note, setNote] = useState('')
  const [partner, setPartner] = useState('')
  const [thuHo, setThuHo] = useState(false)
  const [quickDiscountPct, setQuickDiscountPct] = useState(0)
  const [serviceStatusFilter, setServiceStatusFilter] = useState('all')
  const [selectedRows, setSelectedRows] = useState(new Set())

  // When invoice changes, reset form
  useEffect(() => {
    if (invoice) {
      setDiscountAmount(invoice.totalDiscount || 0)
      setNote(invoice.notes || '')
      setPromoId('')
      setPromoCodeInput('')
      setPromoResult(null)
      setPromoError('')
      setSelectedRows(new Set())
      setQuickDiscountPct(0)
    }
  }, [invoice?._id])

  // When selecting a promotion program, apply discount
  useEffect(() => {
    if (!promoId || !invoice) return
    const promo = promotions.find(p => p._id === promoId)
    if (!promo) return
    if (promo.type === 'percentage') {
      setDiscountPct(promo.discountValue)
      let amt = Math.round(invoice.subtotal * promo.discountValue / 100)
      if (promo.maxDiscountAmount && amt > promo.maxDiscountAmount) amt = promo.maxDiscountAmount
      setDiscountAmount(amt)
    } else {
      setDiscountPct(0)
      setDiscountAmount(promo.discountValue)
    }
  }, [promoId])

  // Validate promo code
  const handleValidateCode = async () => {
    if (!promoCodeInput.trim()) return
    setPromoError('')
    try {
      const res = await api.post('/promotions/validate', {
        code: promoCodeInput.trim(),
        totalAmount: invoice?.subtotal || 0,
        site: invoice?.site || '',
      })
      setPromoResult(res.data)
      setDiscountAmount(res.data.discountAmount)
      if (res.data.promotion?.type === 'percentage') {
        setDiscountPct(res.data.promotion.discountValue)
      }
    } catch (err) {
      setPromoError(err.response?.data?.error || 'Mã không hợp lệ')
      setPromoResult(null)
    }
  }

  // When discount % changes manually
  const handleDiscountPctChange = (val) => {
    setDiscountPct(val)
    if (invoice) setDiscountAmount(Math.round(invoice.subtotal * val / 100))
  }

  const handleDiscountAmountChange = (val) => {
    setDiscountAmount(val)
    if (invoice && invoice.subtotal > 0) setDiscountPct(Math.round(val / invoice.subtotal * 100 * 100) / 100)
  }

  const subtotal = invoice?.subtotal || 0
  const actualCollect = subtotal - discountAmount

  const handleCollect = () => {
    onCollect({
      paymentMethod: payMethod,
      totalDiscount: discountAmount,
      notes: note,
      promoCodeId: promoResult?.promoCode?._id,
      promotionId: promoResult?.promotion?._id || promoId,
      partner,
    })
  }

  // Apply quick discount to selected rows
  const applyQuickDiscount = () => {
    if (!invoice || selectedRows.size === 0) return
    const updated = invoice.items.map((it, i) => {
      if (!selectedRows.has(i)) return it
      const lineDiscount = Math.round(it.amount * quickDiscountPct / 100)
      return { ...it, discountAmount: lineDiscount, discountPct: quickDiscountPct }
    })
    const totalLineDiscount = updated.reduce((s, it) => s + (it.discountAmount || 0), 0)
    setInvoice({ ...invoice, items: updated })
    setDiscountAmount(totalLineDiscount)
    setDiscountPct(0)
  }

  const toggleRow = (i) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }
  const toggleAll = () => {
    if (!invoice) return
    if (selectedRows.size === invoice.items.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(invoice.items.map((_, i) => i)))
    }
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Chọn phiếu thu từ danh sách bên trái hoặc tạo mới
      </div>
    )
  }

  const isPaid = invoice.status === 'paid'
  const isCancelled = invoice.status === 'cancelled' || invoice.status === 'refunded'

  return (
    <div className="flex flex-col h-full">
      {/* Action buttons */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50">
        <button onClick={handleCollect} disabled={saving || isPaid || isCancelled}
          className="px-4 py-1.5 text-xs font-medium bg-[#1e3a5f] text-white rounded hover:bg-[#0f2c6b] disabled:opacity-40 flex items-center gap-1">
          💰 Thu tiền (F1)
        </button>
        <button onClick={onPrint} disabled={!isPaid}
          className="px-4 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 flex items-center gap-1">
          🖨️ In phiếu thu (Ctrl+P)
        </button>
        <button disabled={isCancelled}
          className="px-4 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 flex items-center gap-1">
          🔄 Đổi dịch vụ (F3)
        </button>
      </div>

      {/* Payment info form */}
      <div className="px-4 py-3 border-b space-y-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-28 flex-shrink-0">Người thu</label>
            <input className="flex-1 border-b border-gray-300 px-1 py-0.5 text-xs bg-transparent outline-none"
              value={auth?.displayName || auth?.username || ''} readOnly />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-20 flex-shrink-0">Ngày thu</label>
            <input className="flex-1 border-b border-gray-300 px-1 py-0.5 text-xs bg-transparent outline-none"
              value={fmtDate(invoice.paidAt || new Date().toISOString())} readOnly />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-28 flex-shrink-0">Hình thức TT *</label>
            <select className="flex-1 border rounded px-2 py-1 text-xs" value={payMethod} onChange={e => setPayMethod(e.target.value)} disabled={isPaid}>
              {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-20 flex-shrink-0">Giảm tiền</label>
            <input type="number" className="w-24 border rounded px-2 py-1 text-xs text-right" value={discountAmount}
              onChange={e => handleDiscountAmountChange(+e.target.value)} disabled={isPaid} />
            <label className="text-xs text-gray-500 ml-2">Giảm %</label>
            <input type="number" className="w-16 border rounded px-2 py-1 text-xs text-right" value={discountPct}
              onChange={e => handleDiscountPctChange(+e.target.value)} disabled={isPaid} min={0} max={100} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-28 flex-shrink-0">CT giảm giá</label>
            <select className="flex-1 border rounded px-2 py-1 text-xs" value={promoId} onChange={e => setPromoId(e.target.value)} disabled={isPaid}>
              <option value="">-- Chọn --</option>
              {promotions.map(p => <option key={p._id} value={p._id}>{p.name} ({p.type === 'percentage' ? `${p.discountValue}%` : fmtMoney(p.discountValue)})</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-20 flex-shrink-0">Mã giảm giá</label>
            <input className="flex-1 border rounded px-2 py-1 text-xs" value={promoCodeInput}
              onChange={e => setPromoCodeInput(e.target.value)} disabled={isPaid} placeholder="Nhập mã..."
              onKeyDown={e => e.key === 'Enter' && handleValidateCode()} />
            <button onClick={handleValidateCode} disabled={isPaid} className="text-xs text-blue-600 hover:text-blue-800 px-1">✓</button>
          </div>
          <div className="flex items-center gap-2 col-span-1">
            <label className="text-xs text-gray-500 w-28 flex-shrink-0">Ghi chú phiếu thu</label>
            <input className="flex-1 border-b border-gray-300 px-1 py-0.5 text-xs bg-transparent outline-none"
              value={note} onChange={e => setNote(e.target.value)} disabled={isPaid} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-20 flex-shrink-0">Đối tác GT</label>
            <input className="flex-1 border-b border-gray-300 px-1 py-0.5 text-xs bg-transparent outline-none"
              value={partner} onChange={e => setPartner(e.target.value)} disabled={isPaid} />
          </div>
        </div>
        {promoError && <div className="text-red-500 text-xs">{promoError}</div>}
        {promoResult && <div className="text-green-600 text-xs">Áp dụng: {promoResult.promotion.name} - Giảm {fmtMoney(promoResult.discountAmount)} VND</div>}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-700">Thu hộ</label>
          <input type="checkbox" checked={thuHo} onChange={e => setThuHo(e.target.checked)} disabled={isPaid} />
        </div>
      </div>

      {/* Service table section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">DỊCH VỤ</span>
            <span className="text-xs font-semibold text-gray-800">Giảm nhanh</span>
            <input type="number" className="w-14 border rounded px-1.5 py-0.5 text-xs text-right" value={quickDiscountPct}
              onChange={e => setQuickDiscountPct(+e.target.value)} min={0} max={100} placeholder="%" disabled={isPaid} />
            <button onClick={applyQuickDiscount} disabled={isPaid || selectedRows.size === 0}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40">Áp dụng</button>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40" disabled>
              📄 Xuất hóa đơn điện tử (F7)
            </button>
            <button onClick={onRefund} disabled={!isPaid}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40">
              ↩️ Hoàn trả (F4)
            </button>
          </div>
        </div>

        {/* Service table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="bg-[#1e3a5f] text-white">
                <th className="px-2 py-1.5 w-8">
                  <input type="checkbox" checked={invoice.items?.length > 0 && selectedRows.size === invoice.items.length}
                    onChange={toggleAll} className="w-3 h-3" />
                </th>
                <th className="px-2 py-1.5 w-8">STT</th>
                <th className="px-2 py-1.5 text-left">Mã dịch vụ</th>
                <th className="px-2 py-1.5 text-left">Tên dịch vụ</th>
                <th className="px-2 py-1.5 text-right">Đơn giá</th>
                <th className="px-2 py-1.5 text-right w-10">SL</th>
                <th className="px-2 py-1.5 text-right">Tổng tiền</th>
                <th className="px-2 py-1.5 text-right">Giảm tiền</th>
                <th className="px-2 py-1.5 text-right w-14">Giảm %</th>
                <th className="px-2 py-1.5 text-right">Thành tiền</th>
                <th className="px-2 py-1.5 text-center">Trạng thái TT</th>
                <th className="px-2 py-1.5 text-left">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {(!invoice.items || invoice.items.length === 0) ? (
                <tr><td colSpan={12} className="text-center text-gray-400 py-8">No data</td></tr>
              ) : invoice.items.map((it, i) => {
                const lineTotal = (it.unitPrice || 0) * (it.quantity || 1)
                const lineDiscount = it.discountAmount || 0
                const lineFinal = lineTotal - lineDiscount
                return (
                  <tr key={i} className={`border-b ${selectedRows.has(i) ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleRow(i)} className="w-3 h-3" />
                    </td>
                    <td className="px-2 py-1.5 text-center text-gray-400">{i + 1}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-500">{it.serviceCode || ''}</td>
                    <td className="px-2 py-1.5">{it.serviceName}</td>
                    <td className="px-2 py-1.5 text-right">{fmtMoney(it.unitPrice)}</td>
                    <td className="px-2 py-1.5 text-right">{it.quantity || 1}</td>
                    <td className="px-2 py-1.5 text-right">{fmtMoney(lineTotal)}</td>
                    <td className="px-2 py-1.5 text-right text-red-500">{lineDiscount > 0 ? fmtMoney(lineDiscount) : ''}</td>
                    <td className="px-2 py-1.5 text-right text-red-500">{it.discountPct > 0 ? `${it.discountPct}%` : ''}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{fmtMoney(lineFinal)}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {isPaid ? 'Đã thu' : 'Chưa thu'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-gray-400">{it.note || ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Service filter + totals */}
        <div className="px-4 py-2 border-t bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-xs" value={serviceStatusFilter} onChange={e => setServiceStatusFilter(e.target.value)}>
              <option value="all">(All)</option>
              <option value="paid">Đã thu</option>
              <option value="unpaid">Chưa thu</option>
            </select>
          </div>
          <div className="text-xs font-medium text-gray-700">
            Tổng cộng: <span className="text-blue-700 font-semibold">{fmtMoney(actualCollect > 0 ? actualCollect : subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  RIGHT PANEL — Totals summary
// ══════════════════════════════════════════════════════════
function TotalsSummaryPanel({ invoice, discountAmount }) {
  const subtotal = invoice?.subtotal || 0
  const discount = discountAmount || invoice?.totalDiscount || 0
  const actual = subtotal - discount

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Tổng tiền</div>
        <div className="text-lg font-bold text-gray-800">{fmtMoney(subtotal)}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">Tổng giảm</div>
        <div className="text-lg font-bold text-red-600">{fmtMoney(discount)}</div>
      </div>
      <div className="pt-2 border-t">
        <div className="text-xs text-gray-500 mb-1">Thực thu</div>
        <div className="text-xl font-bold text-blue-700">{fmtMoney(actual)}</div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  CREATE INVOICE MODAL
// ══════════════════════════════════════════════════════════
function CreateInvoiceModal({ onClose, onCreated, userDept }) {
  const [form, setForm] = useState({ patientName: '', phone: '', site: userDept || '', notes: '' })
  const [items, setItems] = useState([{ serviceName: '', serviceCode: '', unitPrice: 0, quantity: 1 }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addItem = () => setItems(prev => [...prev, { serviceName: '', serviceCode: '', unitPrice: 0, quantity: 1 }])
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  const subtotal = items.reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 1), 0)

  const handleSave = async () => {
    if (!form.patientName.trim()) return setError('Vui lòng nhập tên bệnh nhân')
    if (items.length === 0 || !items[0].serviceName) return setError('Vui lòng thêm ít nhất 1 dịch vụ')
    setSaving(true)
    setError('')
    try {
      const res = await api.post('/billing/invoices', {
        ...form,
        items: items.map(it => ({ serviceName: it.serviceName, serviceCode: it.serviceCode || '', unitPrice: +it.unitPrice, quantity: +it.quantity || 1 })),
      })
      onCreated(res.data)
    } catch (err) { setError(err.response?.data?.error || 'Lỗi tạo phiếu') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Tạo phiếu thu mới</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tên bệnh nhân *</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.patientName}
                onChange={e => setForm(p => ({ ...p, patientName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Số điện thoại</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Chi nhánh</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.site}
                onChange={e => setForm(p => ({ ...p, site: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ghi chú</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Dịch vụ</label>
              <button onClick={addItem} className="text-sm text-blue-600 hover:text-blue-800">+ Thêm dòng</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="text-left px-2 py-1">#</th>
                  <th className="text-left px-2 py-1">Mã DV</th>
                  <th className="text-left px-2 py-1">Tên dịch vụ</th>
                  <th className="text-right px-2 py-1">Đơn giá</th>
                  <th className="text-right px-2 py-1">SL</th>
                  <th className="text-right px-2 py-1">Thành tiền</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                    <td className="px-2 py-1">
                      <input className="w-20 border rounded px-2 py-1" value={it.serviceCode}
                        onChange={e => updateItem(i, 'serviceCode', e.target.value)} placeholder="Mã" />
                    </td>
                    <td className="px-2 py-1">
                      <input className="w-full border rounded px-2 py-1" value={it.serviceName}
                        onChange={e => updateItem(i, 'serviceName', e.target.value)} placeholder="Tên dịch vụ" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" className="w-24 border rounded px-2 py-1 text-right" value={it.unitPrice}
                        onChange={e => updateItem(i, 'unitPrice', +e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" className="w-14 border rounded px-2 py-1 text-right" value={it.quantity}
                        onChange={e => updateItem(i, 'quantity', +e.target.value)} min={1} />
                    </td>
                    <td className="px-2 py-1 text-right font-medium">{fmtMoney((it.unitPrice || 0) * (it.quantity || 1))}</td>
                    <td className="px-2 py-1">
                      {items.length > 1 && <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">&times;</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right mt-2 text-sm font-semibold text-gray-700">
              Tổng: <span className="text-blue-700">{fmtMoney(subtotal)} VND</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Tạo phiếu thu'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  MAIN BILLING PAGE
// ══════════════════════════════════════════════════════════
export default function Billing() {
  const { auth } = useAuth()

  // Invoice list state
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [statusTab, setStatusTab] = useState('cho_thu')
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10))
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [searchQ, setSearchQ] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [discountAmount, setDiscountAmount] = useState(0)

  // Promotions
  const [promotions, setPromotions] = useState([])

  // Load invoices
  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 200 }
      if (statusTab !== 'all') {
        const statuses = PAY_STATUS_MAP[statusTab]
        if (statuses) params.status = statuses.join(',')
      }
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (searchQ) params.q = searchQ

      const res = await api.get('/billing/invoices', { params })
      let list = res.data.invoices || []

      // Client-side filter by status group (since API takes single status)
      if (statusTab !== 'all' && PAY_STATUS_MAP[statusTab]) {
        const allowed = PAY_STATUS_MAP[statusTab]
        list = list.filter(inv => allowed.includes(inv.status))
      }

      setInvoices(list)
    } catch { setInvoices([]) }
    setLoading(false)
  }, [statusTab, dateFrom, dateTo, searchQ])

  // Load promotions
  const loadPromotions = useCallback(async () => {
    try {
      const res = await api.get('/promotions/active')
      setPromotions(res.data)
    } catch { setPromotions([]) }
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])
  useEffect(() => { loadPromotions() }, [loadPromotions])

  // Load selected invoice detail
  useEffect(() => {
    if (!selectedId) { setSelectedInvoice(null); return }
    api.get(`/billing/invoices/${selectedId}`).then(r => {
      setSelectedInvoice(r.data)
      setDiscountAmount(r.data.totalDiscount || 0)
    }).catch(() => setSelectedInvoice(null))
  }, [selectedId])

  // Collect payment
  const handleCollect = async (payData) => {
    if (!selectedInvoice) return
    setSaving(true)
    try {
      // Update discount first if changed
      if (payData.totalDiscount !== selectedInvoice.totalDiscount) {
        await api.put(`/billing/invoices/${selectedInvoice._id}`, {
          totalDiscount: payData.totalDiscount,
          notes: payData.notes,
        })
      }

      // Recalculate amount
      const grandTotal = selectedInvoice.subtotal - (payData.totalDiscount || 0)
      const payAmount = grandTotal - selectedInvoice.paidAmount

      if (payAmount > 0) {
        await api.post(`/billing/invoices/${selectedInvoice._id}/pay`, {
          amount: payAmount,
          paymentMethod: payData.paymentMethod,
        })
      }

      // Apply promo code usage
      if (payData.promoCodeId || payData.promotionId) {
        try {
          await api.post('/promotions/apply', {
            promoCodeId: payData.promoCodeId,
            promotionId: payData.promotionId,
          })
        } catch {}
      }

      // Reload
      setSelectedId(selectedInvoice._id) // trigger reload
      const res = await api.get(`/billing/invoices/${selectedInvoice._id}`)
      setSelectedInvoice(res.data)
      loadInvoices()
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi thu tiền')
    }
    setSaving(false)
  }

  const handleRefund = async () => {
    if (!selectedInvoice) return
    if (!confirm('Bạn có chắc muốn hoàn trả phiếu thu này?')) return
    try {
      await api.post(`/billing/invoices/${selectedInvoice._id}/refund`, { reason: 'Hoàn trả theo yêu cầu' })
      const res = await api.get(`/billing/invoices/${selectedInvoice._id}`)
      setSelectedInvoice(res.data)
      loadInvoices()
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi hoàn trả')
    }
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-800">Quản lý Viện phí - Phiếu thu</h2>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm">
          + Tạo phiếu thu
        </button>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 flex gap-0 border rounded-lg overflow-hidden bg-white min-h-0">
        {/* Left: Invoice list */}
        <div className="w-[340px] flex-shrink-0 border-r flex flex-col min-h-0">
          <InvoiceListPanel
            invoices={invoices} loading={loading}
            selectedId={selectedId} onSelect={setSelectedId}
            statusTab={statusTab} onStatusTab={setStatusTab}
            dateFrom={dateFrom} dateTo={dateTo}
            onDateFrom={setDateFrom} onDateTo={setDateTo}
            searchQ={searchQ} onSearchQ={setSearchQ}
            onRefresh={loadInvoices}
          />
        </div>

        {/* Center: Payment form + services */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <PaymentFormPanel
            invoice={selectedInvoice}
            setInvoice={setSelectedInvoice}
            promotions={promotions}
            onCollect={handleCollect}
            onPrint={() => window.print()}
            onRefund={handleRefund}
            saving={saving}
          />
        </div>

        {/* Right: Totals */}
        <div className="w-[140px] flex-shrink-0 border-l bg-gray-50">
          <TotalsSummaryPanel invoice={selectedInvoice} discountAmount={discountAmount} />
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateInvoiceModal
          userDept={auth.department}
          onClose={() => setShowCreate(false)}
          onCreated={(inv) => { setShowCreate(false); loadInvoices(); setSelectedId(inv._id) }}
        />
      )}
    </div>
  )
}
