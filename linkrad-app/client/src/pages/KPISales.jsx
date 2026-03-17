import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getKPI, saveKPI, getSites } from '../api'

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtB  = n => { if (!n) return '0'; const b = n / 1e9; return b >= 1 ? b.toFixed(2) + ' tỷ' : (n / 1e6).toFixed(0) + 'M' }
const fmtM  = n => n ? (n / 1e6).toFixed(0) + 'M' : '0'
const num   = v => Number(v) || 0
const pct   = (a, b) => (b > 0 ? Math.round(a / b * 100) : 0)
const clamp = v => Math.min(100, Math.max(0, v))

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = String(i + 1).padStart(2, '0')
  return { value: `2026-${m}`, label: `T${i + 1}/2026` }
}).concat(Array.from({ length: 12 }, (_, i) => {
  const m = String(i + 1).padStart(2, '0')
  return { value: `2025-${m}`, label: `T${i + 1}/2025` }
}))

const DEFAULT_TARGETS = {
  revenue: 2500000000,
  costs: 2000000000,
  avgPrice: 2000000,
  channelSplit: { doctor: 70, hospital: 20, direct: 10 },
  doctorActive: 70,
  doctorNew: 20,
  salesVisits: 160,
  salesConversion: 20,
}

const DEFAULT_MONTH = {
  cases: { doctor: 0, hospital: 0, direct: 0, internal: 0 },
  revenue: { doctor: 0, hospital: 0, direct: 0, internal: 0 },
  doctors: { active: 0, new: 0, churn: 0 },
  hospitalDeals: 0,
  sales: [],
}

// ── small components ─────────────────────────────────────────────────────────
function KpiCard({ title, actual, target, unit = '', color = 'blue', icon, note }) {
  const p = pct(actual, target)
  const colors = {
    blue:   { ring: 'border-blue-200',   bg: 'bg-blue-50',   txt: 'text-blue-700',   bar: 'bg-blue-500' },
    green:  { ring: 'border-green-200',  bg: 'bg-green-50',  txt: 'text-green-700',  bar: 'bg-green-500' },
    purple: { ring: 'border-purple-200', bg: 'bg-purple-50', txt: 'text-purple-700', bar: 'bg-purple-500' },
    orange: { ring: 'border-orange-200', bg: 'bg-orange-50', txt: 'text-orange-700', bar: 'bg-orange-500' },
    red:    { ring: 'border-red-200',    bg: 'bg-red-50',    txt: 'text-red-700',    bar: 'bg-red-500' },
  }
  const c = colors[color] || colors.blue
  return (
    <div className={`bg-white rounded-xl border ${c.ring} p-4 space-y-2`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{icon} {title}</p>
        {target > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.txt}`}>{p}%</span>
        )}
      </div>
      <p className={`text-2xl font-extrabold ${c.txt}`}>{actual}{unit}</p>
      {target > 0 && (
        <>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${clamp(p)}%` }} />
          </div>
          <p className="text-xs text-gray-400">Mục tiêu: {target}{unit} {note && `· ${note}`}</p>
        </>
      )}
      {!target && note && <p className="text-xs text-gray-400">{note}</p>}
    </div>
  )
}

function ChannelBar({ label, actual, target, pctSplit, color }) {
  const p = pct(actual, target)
  const barColors = { doctor: 'bg-blue-500', hospital: 'bg-emerald-500', direct: 'bg-orange-400', internal: 'bg-purple-400' }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-400">mục tiêu {pctSplit}%</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Số ca</p>
          <p className="text-xl font-bold text-gray-800">{actual.cases.toLocaleString('vi-VN')}</p>
          <p className="text-xs text-gray-400">/ {target.cases.toLocaleString('vi-VN')} ca</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Doanh thu</p>
          <p className="text-xl font-bold text-gray-800">{fmtB(actual.revenue)}</p>
          <p className="text-xs text-gray-400">/ {fmtB(target.revenue)}</p>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColors[color] || 'bg-blue-500'} rounded-full`} style={{ width: `${clamp(p)}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1 text-right">{p}% hoàn thành</p>
    </div>
  )
}

function SalesRow({ rep, targets, onEdit, isManager }) {
  const visitPct  = pct(rep.visits,    targets.salesVisits)
  const newDocPct = pct(rep.newDocs,   targets.doctorNew)
  const convRate  = rep.visits > 0 ? Math.round(rep.newDocs / rep.visits * 100) : 0
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
            {rep.name.charAt(0)}
          </span>
          <span className="text-sm font-semibold text-gray-800">{rep.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${clamp(visitPct)}%` }} />
          </div>
          <span className="text-sm font-medium text-gray-700">{rep.visits}</span>
          <span className="text-xs text-gray-400">/{targets.salesVisits}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{rep.calls}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${clamp(newDocPct)}%` }} />
          </div>
          <span className="text-sm font-medium text-gray-700">{rep.newDocs}</span>
          <span className="text-xs text-gray-400">/{targets.doctorNew}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-sm font-semibold ${convRate >= 20 ? 'text-green-600' : convRate >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>
          {convRate}%
        </span>
        <span className="text-xs text-gray-400 ml-1">(chuẩn ≥20%)</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-semibold text-indigo-700">{rep.activeDocs}</span>
        <span className="text-xs text-gray-400 ml-1">/{targets.doctorActive}</span>
      </td>
      <td className="px-4 py-3 text-sm font-bold text-emerald-700">{fmtB(rep.revenue)}</td>
      {isManager && (
        <td className="px-4 py-3">
          <button onClick={() => onEdit(rep)}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded">
            Sửa
          </button>
        </td>
      )}
    </tr>
  )
}

// ── Edit sales rep modal ──────────────────────────────────────────────────────
function EditSalesModal({ rep, onClose, onSave }) {
  const [form, setForm] = useState({ ...rep })
  const setF = (k, v) => setForm(p => ({ ...p, [k]: Number(v) || v }))
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Cập nhật KPI — {rep.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { key: 'visits',     label: 'Số lượt visit' },
            { key: 'calls',      label: 'Số cuộc gọi' },
            { key: 'followups',  label: 'Follow-up' },
            { key: 'newDocs',    label: 'Bác sĩ mới' },
            { key: 'activeDocs', label: 'Bác sĩ active duy trì' },
            { key: 'revenue',    label: 'Doanh thu generate (VND)' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input type="number" value={form[f.key] || 0} onChange={e => setF(f.key, e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
            <button onClick={() => { onSave(form); onClose() }}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Lưu</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Target setup modal ────────────────────────────────────────────────────────
function TargetModal({ targets, onClose, onSave }) {
  const [form, setForm] = useState({
    revenue: targets.revenue || 2500000000,
    costs: targets.costs || 2000000000,
    avgPrice: targets.avgPrice || 2000000,
    doctorActive: targets.doctorActive || 70,
    doctorNew: targets.doctorNew || 20,
    salesVisits: targets.salesVisits || 160,
    salesConversion: targets.salesConversion || 20,
    splitDoctor: (targets.channelSplit?.doctor) || 70,
    splitHospital: (targets.channelSplit?.hospital) || 20,
    splitDirect: (targets.channelSplit?.direct) || 10,
  })
  const setF = (k, v) => setForm(p => ({ ...p, [k]: Number(v) || 0 }))
  const breakeven = form.avgPrice > 0 ? Math.round(form.costs / form.avgPrice) : 0
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-800">⚙ Cài đặt mục tiêu tháng</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-5">
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Tài chính</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'revenue',  label: 'Doanh thu mục tiêu (VND)' },
                { key: 'costs',    label: 'Chi phí / tháng (VND)' },
                { key: 'avgPrice', label: 'Giá trung bình / ca (VND)' },
              ].map(f => (
                <div key={f.key} className={f.key === 'avgPrice' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input type="number" value={form[f.key]} onChange={e => setF(f.key, e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400" />
                </div>
              ))}
            </div>
            {breakeven > 0 && (
              <p className="mt-2 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded">
                Break-even: <strong>{breakeven.toLocaleString('vi-VN')} ca/tháng</strong>
                {' '}(~{Math.ceil(breakeven / 26)} ca/ngày)
              </p>
            )}
          </section>

          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Phân bổ kênh (%)</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'splitDoctor',   label: 'Doctor Referral' },
                { key: 'splitHospital', label: 'Hospital Partner' },
                { key: 'splitDirect',   label: 'Direct / Walk-in' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label} %</label>
                  <input type="number" min="0" max="100" value={form[f.key]} onChange={e => setF(f.key, e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400" />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Tổng: {form.splitDoctor + form.splitHospital + form.splitDirect}% (cần = 100%)</p>
          </section>

          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Doctor funnel</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'doctorActive', label: 'Bác sĩ active mục tiêu' },
                { key: 'doctorNew',    label: 'Bác sĩ mới / tháng' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input type="number" value={form[f.key]} onChange={e => setF(f.key, e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400" />
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">KPI nhân viên Sale</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'salesVisits',     label: 'Visit / sale / tháng' },
                { key: 'salesConversion', label: 'Tỷ lệ chuyển đổi mục tiêu (%)' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input type="number" value={form[f.key]} onChange={e => setF(f.key, e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400" />
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
            <button onClick={() => {
              onSave({
                revenue: form.revenue, costs: form.costs, avgPrice: form.avgPrice,
                doctorActive: form.doctorActive, doctorNew: form.doctorNew,
                salesVisits: form.salesVisits, salesConversion: form.salesConversion,
                channelSplit: { doctor: form.splitDoctor, hospital: form.splitHospital, direct: form.splitDirect },
              })
              onClose()
            }} className="px-5 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Lưu mục tiêu</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit actuals modal ────────────────────────────────────────────────────────
function ActualsModal({ month, onClose, onSave }) {
  const [form, setForm] = useState({
    casesDoctor:   month.cases?.doctor   || 0,
    casesHospital: month.cases?.hospital || 0,
    casesDirect:   month.cases?.direct   || 0,
    casesInternal: month.cases?.internal || 0,
    revDoctor:     month.revenue?.doctor   || 0,
    revHospital:   month.revenue?.hospital || 0,
    revDirect:     month.revenue?.direct   || 0,
    revInternal:   month.revenue?.internal || 0,
    docActive:     month.doctors?.active  || 0,
    docNew:        month.doctors?.new     || 0,
    docChurn:      month.doctors?.churn   || 0,
    hospitalDeals: month.hospitalDeals    || 0,
  })
  const setF = (k, v) => setForm(p => ({ ...p, [k]: Number(v) || 0 }))
  const fields = [
    { section: 'Số ca thực tế', items: [
      { key: 'casesDoctor', label: 'Ca kênh Doctor' },
      { key: 'casesHospital', label: 'Ca kênh Hospital' },
      { key: 'casesDirect', label: 'Ca kênh Direct' },
      { key: 'casesInternal', label: 'Ca nội bộ' },
    ]},
    { section: 'Doanh thu thực tế (VND)', items: [
      { key: 'revDoctor', label: 'Doanh thu Doctor' },
      { key: 'revHospital', label: 'Doanh thu Hospital' },
      { key: 'revDirect', label: 'Doanh thu Direct' },
      { key: 'revInternal', label: 'Doanh thu Nội bộ' },
    ]},
    { section: 'Doctor funnel', items: [
      { key: 'docActive', label: 'Bác sĩ active' },
      { key: 'docNew', label: 'Bác sĩ mới' },
      { key: 'docChurn', label: 'Bác sĩ rời bỏ (churn)' },
      { key: 'hospitalDeals', label: 'Hợp đồng hospital' },
    ]},
  ]
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-800">📊 Nhập số liệu thực tế</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-5">
          {fields.map(sec => (
            <section key={sec.section}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{sec.section}</p>
              <div className="grid grid-cols-2 gap-3">
                {sec.items.map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input type="number" value={form[f.key]} onChange={e => setF(f.key, e.target.value)}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                ))}
              </div>
            </section>
          ))}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
            <button onClick={() => {
              onSave({
                cases:   { doctor: form.casesDoctor, hospital: form.casesHospital, direct: form.casesDirect, internal: form.casesInternal },
                revenue: { doctor: form.revDoctor,   hospital: form.revHospital,   direct: form.revDirect,   internal: form.revInternal   },
                doctors: { active: form.docActive,   new: form.docNew,             churn: form.docChurn },
                hospitalDeals: form.hospitalDeals,
              })
              onClose()
            }} className="px-5 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Lưu</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add sales rep modal ───────────────────────────────────────────────────────
function AddSalesModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Thêm nhân viên Sale</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tên nhân viên</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A..."
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
            <button disabled={!name.trim()} onClick={() => { onSave(name.trim()); onClose() }}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50">Thêm</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function KPISales() {
  const { auth } = useAuth()
  const isManager = auth?.role === 'admin' || auth?.role === 'giamdoc' || auth?.role === 'truongphong'

  const todayM = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const [kpiData, setKpiData]   = useState({})
  const [sites,   setSites]     = useState([])
  const [site,    setSite]      = useState('')
  const [month,   setMonth]     = useState(todayM)
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)

  const [modal, setModal] = useState(null) // 'target' | 'actuals' | 'sales-edit' | 'sales-add'
  const [editingRep, setEditingRep] = useState(null)

  // ── data helpers ─────────────────────────────────────────────────────────
  const siteData  = kpiData?.sites?.[site] || {}
  const targets   = { ...DEFAULT_TARGETS, ...(siteData.targets || {}) }
  const monthData = { ...DEFAULT_MONTH, ...(siteData.monthly?.[month] || {}) }

  const totalCases   = Object.values(monthData.cases).reduce((s, v) => s + num(v), 0)
  const totalRevenue = Object.values(monthData.revenue).reduce((s, v) => s + num(v), 0)
  const breakeven    = targets.avgPrice > 0 ? Math.round(targets.costs / targets.avgPrice) : 0
  const dailyBE      = breakeven > 0 ? Math.ceil(breakeven / 26) : 0

  const channelDefs = useMemo(() => {
    const split = targets.channelSplit
    const totalTarget = targets.revenue
    return [
      {
        key: 'doctor', label: '👨‍⚕️ Doctor Referral', color: 'doctor',
        actual: { cases: num(monthData.cases.doctor), revenue: num(monthData.revenue.doctor) },
        target: { cases: Math.round(breakeven * split.doctor / 100), revenue: Math.round(totalTarget * split.doctor / 100) },
        pctSplit: split.doctor,
      },
      {
        key: 'hospital', label: '🏥 Hospital Partner', color: 'hospital',
        actual: { cases: num(monthData.cases.hospital), revenue: num(monthData.revenue.hospital) },
        target: { cases: Math.round(breakeven * split.hospital / 100), revenue: Math.round(totalTarget * split.hospital / 100) },
        pctSplit: split.hospital,
      },
      {
        key: 'direct', label: '🚶 Direct / Walk-in', color: 'direct',
        actual: { cases: num(monthData.cases.direct), revenue: num(monthData.revenue.direct) },
        target: { cases: Math.round(breakeven * split.direct / 100), revenue: Math.round(totalTarget * split.direct / 100) },
        pctSplit: split.direct,
      },
      {
        key: 'internal', label: '🔄 Nội bộ', color: 'internal',
        actual: { cases: num(monthData.cases.internal), revenue: num(monthData.revenue.internal) },
        target: { cases: 0, revenue: 0 },
        pctSplit: 0,
      },
    ]
  }, [monthData, targets, breakeven])

  // ── load / save ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [kd, sd] = await Promise.all([getKPI(), getSites()])
      setKpiData(kd || {})
      const siteNames = (sd || []).map(s => s.name).filter(Boolean)
      setSites(siteNames)
      if (!site && siteNames.length > 0) setSite(siteNames[0])
    } finally {
      setLoading(false)
    }
  }, [site])

  useEffect(() => { load() }, []) // eslint-disable-line

  const persist = useCallback(async (updated) => {
    setSaving(true)
    try {
      await saveKPI(updated)
      setKpiData(updated)
    } finally {
      setSaving(false)
    }
  }, [])

  const updateTargets = useCallback((newTargets) => {
    const updated = {
      ...kpiData,
      sites: {
        ...(kpiData.sites || {}),
        [site]: { ...siteData, targets: newTargets },
      }
    }
    persist(updated)
  }, [kpiData, site, siteData, persist])

  const updateMonthActuals = useCallback((actuals) => {
    const updated = {
      ...kpiData,
      sites: {
        ...(kpiData.sites || {}),
        [site]: {
          ...siteData,
          monthly: {
            ...(siteData.monthly || {}),
            [month]: { ...monthData, ...actuals },
          }
        },
      }
    }
    persist(updated)
  }, [kpiData, site, siteData, month, monthData, persist])

  const updateSalesRep = useCallback((repData) => {
    const sales = [...(monthData.sales || [])]
    const idx = sales.findIndex(s => s.id === repData.id)
    if (idx >= 0) sales[idx] = repData
    else sales.push({ ...repData, id: Date.now().toString() })
    updateMonthActuals({ sales })
  }, [monthData, updateMonthActuals])

  const addSalesRep = useCallback((name) => {
    const sales = [...(monthData.sales || []), {
      id: Date.now().toString(), name, visits: 0, calls: 0, followups: 0,
      newDocs: 0, activeDocs: 0, revenue: 0,
    }]
    updateMonthActuals({ sales })
  }, [monthData, updateMonthActuals])

  const deleteSalesRep = useCallback((id) => {
    const sales = (monthData.sales || []).filter(s => s.id !== id)
    updateMonthActuals({ sales })
  }, [monthData, updateMonthActuals])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">KPI Sales & Manager</h2>
          <p className="text-xs text-gray-400 mt-0.5">B2B2C · Doctor-Driven Funnel</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Site selector */}
          <select value={site} onChange={e => setSite(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 outline-none focus:border-blue-400 bg-white">
            {sites.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Month selector */}
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 outline-none focus:border-blue-400 bg-white">
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {isManager && (
            <>
              <button onClick={() => setModal('actuals')}
                className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                📊 Nhập thực tế
              </button>
              <button onClick={() => setModal('target')}
                className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                ⚙ Mục tiêu
              </button>
            </>
          )}
          {saving && <span className="text-xs text-gray-400">Đang lưu...</span>}
        </div>
      </div>

      {/* ── Layer 1: Revenue KPIs ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lớp 1 · Doanh thu</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <KpiCard icon="💰" title="Doanh thu thực tế" actual={fmtB(totalRevenue)} target={0}
            note={`Mục tiêu: ${fmtB(targets.revenue)}`} color="blue" />
          <KpiCard icon="🎯" title="Hoàn thành DT" actual={`${pct(totalRevenue, targets.revenue)}%`}
            target={0} note={`${fmtB(totalRevenue)} / ${fmtB(targets.revenue)}`}
            color={pct(totalRevenue, targets.revenue) >= 90 ? 'green' : pct(totalRevenue, targets.revenue) >= 70 ? 'orange' : 'red'} />
          <KpiCard icon="📸" title="Số ca thực tế" actual={totalCases.toLocaleString('vi-VN')}
            target={0} note={`Mục tiêu break-even: ${breakeven.toLocaleString('vi-VN')} ca (~${dailyBE}/ngày)`} color="purple" />
          <KpiCard icon="⚖️" title="Tỷ lệ break-even" actual={`${pct(totalCases, breakeven)}%`}
            target={0} note={`${totalCases.toLocaleString('vi-VN')} / ${breakeven.toLocaleString('vi-VN')} ca`}
            color={pct(totalCases, breakeven) >= 100 ? 'green' : pct(totalCases, breakeven) >= 80 ? 'orange' : 'red'} />
        </div>
      </section>

      {/* ── Layer 2: Channels ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lớp 2 · Kênh</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {channelDefs.map(ch => <ChannelBar key={ch.key} {...ch} />)}
        </div>
      </section>

      {/* ── Layer 3: Doctor Funnel ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lớp 3 · Doctor Funnel</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <KpiCard icon="👨‍⚕️" title="Bác sĩ Active"
            actual={num(monthData.doctors.active)} target={targets.doctorActive}
            unit="" color="blue"
            note={`Cần ${targets.doctorActive} để đạt target (${targets.avgPrice > 0 ? Math.round(targets.revenue / targets.avgPrice / 10) : '?'} ca/BS)`} />
          <KpiCard icon="✨" title="Bác sĩ mới tháng này"
            actual={num(monthData.doctors.new)} target={targets.doctorNew}
            color="green" note="Từ hoạt động visit của team sale" />
          <KpiCard icon="📉" title="Bác sĩ churn"
            actual={num(monthData.doctors.churn)} target={0}
            color={num(monthData.doctors.churn) > 5 ? 'red' : 'orange'}
            note="Bác sĩ ngừng chỉ định trong tháng" />
          <KpiCard icon="🤝" title="Hợp đồng Hospital"
            actual={num(monthData.hospitalDeals)} target={0}
            color="purple" note="Kênh Hospital Partnership" />
        </div>

        {/* Net doctor growth indicator */}
        {(num(monthData.doctors.new) > 0 || num(monthData.doctors.churn) > 0) && (
          <div className="mt-3 bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-6">
            <span className="text-xs font-semibold text-gray-500 uppercase">Tăng trưởng bác sĩ net</span>
            <span className={`text-lg font-extrabold ${num(monthData.doctors.new) - num(monthData.doctors.churn) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {num(monthData.doctors.new) - num(monthData.doctors.churn) >= 0 ? '+' : ''}
              {num(monthData.doctors.new) - num(monthData.doctors.churn)} bác sĩ
            </span>
            <span className="text-xs text-gray-400">= {num(monthData.doctors.new)} mới − {num(monthData.doctors.churn)} churn</span>
            <div className="ml-auto text-xs text-gray-400">
              Formula: Bác sĩ active = (Visit × Conversion%) − Churn
            </div>
          </div>
        )}
      </section>

      {/* ── Layer 4: Sales Activity ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lớp 4 · Sales Activity</span>
          <div className="flex-1 h-px bg-gray-100" />
          {isManager && (
            <button onClick={() => setModal('sales-add')}
              className="text-xs px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium">
              + Thêm nhân viên
            </button>
          )}
        </div>

        {monthData.sales.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center">
            <p className="text-sm text-gray-400">Chưa có dữ liệu nhân viên sale</p>
            {isManager && (
              <button onClick={() => setModal('sales-add')}
                className="mt-3 text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                + Thêm nhân viên
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Nhân viên</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">
                      Visit
                      <span className="text-gray-300 font-normal ml-1">(mục tiêu {targets.salesVisits})</span>
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Cuộc gọi</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">
                      BS mới
                      <span className="text-gray-300 font-normal ml-1">(/{targets.doctorNew})</span>
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Conversion</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">
                      BS Active
                      <span className="text-gray-300 font-normal ml-1">(/{targets.doctorActive})</span>
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Doanh thu</th>
                    {isManager && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {monthData.sales.map(rep => (
                    <SalesRow key={rep.id} rep={rep} targets={targets} isManager={isManager}
                      onEdit={r => { setEditingRep(r); setModal('sales-edit') }} />
                  ))}
                </tbody>
                {/* Team totals */}
                {monthData.sales.length > 1 && (() => {
                  const totals = monthData.sales.reduce((acc, r) => ({
                    visits: acc.visits + num(r.visits),
                    calls: acc.calls + num(r.calls),
                    newDocs: acc.newDocs + num(r.newDocs),
                    activeDocs: acc.activeDocs + num(r.activeDocs),
                    revenue: acc.revenue + num(r.revenue),
                  }), { visits: 0, calls: 0, newDocs: 0, activeDocs: 0, revenue: 0 })
                  return (
                    <tfoot className="bg-indigo-50 border-t-2 border-indigo-100">
                      <tr>
                        <td className="px-4 py-2.5 text-xs font-bold text-indigo-700 uppercase">Tổng team</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-indigo-700">{totals.visits}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-indigo-700">{totals.calls}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-indigo-700">{totals.newDocs}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-indigo-700">
                          {totals.visits > 0 ? Math.round(totals.newDocs / totals.visits * 100) : 0}%
                        </td>
                        <td className="px-4 py-2.5 text-sm font-bold text-indigo-700">{totals.activeDocs}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-emerald-700">{fmtB(totals.revenue)}</td>
                        {isManager && <td />}
                      </tr>
                    </tfoot>
                  )
                })()}
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Layer 5: Manager Control ── */}
      {isManager && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lớp 5 · Manager Control</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {/* Revenue per sale */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Năng suất Sales</p>
              {monthData.sales.length > 0 ? (
                <div className="space-y-2">
                  {monthData.sales.map(rep => {
                    const repRev = num(rep.revenue)
                    const maxRev = Math.max(...monthData.sales.map(r => num(r.revenue)), 1)
                    return (
                      <div key={rep.id}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-gray-700 font-medium">{rep.name}</span>
                          <span className="text-emerald-700 font-bold">{fmtB(repRev)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct(repRev, maxRev)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-xs text-gray-400">Chưa có dữ liệu</p>}
            </div>

            {/* Formula box */}
            <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-xl p-4 text-white">
              <p className="text-xs font-bold text-indigo-200 uppercase mb-3">Core Formula</p>
              <div className="space-y-1.5 font-mono text-sm">
                <p className="text-white/90">Revenue =</p>
                <p className="pl-3 text-indigo-200">Bác sĩ active</p>
                <p className="pl-3 text-indigo-200">× Số ca / bác sĩ</p>
                <p className="pl-3 text-indigo-200">× Giá / ca</p>
                <div className="border-t border-indigo-600 my-2" />
                <p className="text-white/90">BS active =</p>
                <p className="pl-3 text-indigo-200">(Visit × {targets.salesConversion}%)</p>
                <p className="pl-3 text-indigo-200">− Churn</p>
              </div>
            </div>

            {/* KPI benchmark */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Benchmark chuẩn / Sale</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Visit/tháng', value: '150–200', icon: '🚗' },
                  { label: 'Bác sĩ mới', value: '20–40', icon: '👨‍⚕️' },
                  { label: 'BS active maintain', value: '50–80', icon: '🤝' },
                  { label: 'Doanh thu generate', value: '300–600M', icon: '💰' },
                  { label: 'Conversion rate', value: '≥20%', icon: '🎯' },
                  { label: 'Daily visit', value: '8–10', icon: '📅' },
                ].map(b => (
                  <div key={b.label} className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">{b.icon} {b.label}</span>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{b.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Modals ── */}
      {modal === 'target'     && <TargetModal  targets={targets}   onClose={() => setModal(null)} onSave={updateTargets} />}
      {modal === 'actuals'    && <ActualsModal month={monthData}   onClose={() => setModal(null)} onSave={updateMonthActuals} />}
      {modal === 'sales-add'  && <AddSalesModal                    onClose={() => setModal(null)} onSave={addSalesRep} />}
      {modal === 'sales-edit' && editingRep && (
        <EditSalesModal rep={editingRep} onClose={() => { setModal(null); setEditingRep(null) }} onSave={updateSalesRep} />
      )}
    </div>
  )
}
