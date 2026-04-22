import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const GENDERS = { M: 'Nam', F: 'Nữ', other: 'Khác' }

const REFERRAL_TYPES = [
  { value: 'doctor',      label: 'Bác sĩ giới thiệu' },
  { value: 'facility',    label: 'Cơ sở giới thiệu' },
  { value: 'salesperson', label: 'Nhân viên kinh doanh' },
]

const SERVICE_GROUPS = [
  { code: '',     name: 'Tất cả' },
  { code: 'CDHA', name: 'CDHA' },
  { code: 'XN',   name: 'XN' },
  { code: 'TDCN', name: 'TDCN' },
  { code: 'KH',   name: 'Khác' },
]

const ADDR_SHORTCUTS = [
  { key: 'xda', ward: 'Xã Đường An', city: 'Thành Phố Hải Phòng' },
  { key: 'ba',  ward: 'Phường Ba Đình', city: 'Thành Phố Hà Nội' },
  { key: 'hk',  ward: 'Phường Hoàn Kiếm', city: 'Thành Phố Hà Nội' },
  { key: 'cg',  ward: 'Phường Cầu Giấy', city: 'Thành Phố Hà Nội' },
  { key: 'tx',  ward: 'Phường Thanh Xuân', city: 'Thành Phố Hà Nội' },
  { key: 'bt',  ward: 'Quận Bình Thạnh', city: 'Thành Phố Hồ Chí Minh' },
  { key: 'td',  ward: 'Quận Thủ Đức', city: 'Thành Phố Hồ Chí Minh' },
  { key: 'q1',  ward: 'Quận 1', city: 'Thành Phố Hồ Chí Minh' },
  { key: 'hp',  ward: 'Quận Hồng Bàng', city: 'Thành Phố Hải Phòng' },
  { key: 'hd',  ward: 'Thành Phố Hải Dương', city: 'Tỉnh Hải Dương' },
]

// ── helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().slice(0, 10)
const isToday = (iso) => (iso || '').slice(0, 10) === todayISO()

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function calcAge(dob) {
  if (!dob) return ''
  const diff = Date.now() - new Date(dob).getTime()
  if (!Number.isFinite(diff) || diff < 0) return ''
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}
function fmtMoney(n) {
  return (n || 0).toLocaleString('vi-VN')
}
function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function isPhoneLike(q) {
  return /^[\d\s+()-]{3,}$/.test(q.trim())
}

// Highlight matched substring with yellow background
function Highlighted({ text, query }) {
  if (!query) return <>{text}</>
  const i = (text || '').toLowerCase().indexOf(query.toLowerCase())
  if (i === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="bg-yellow-200 px-0.5 rounded-sm">{text.slice(i, i + query.length)}</span>
      {text.slice(i + query.length)}
    </>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50'

function Field({ label, required, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-500 mb-0.5 block">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  )
}

// ── Header stepper ───────────────────────────────────────────────────────────

function HeaderStepper({ active, userName, date }) {
  const steps = [
    { n: 1, label: 'Tìm / Tạo BN' },
    { n: 2, label: 'Dịch vụ' },
    { n: 3, label: 'In phiếu' },
  ]
  return (
    <div className="flex items-center gap-6 px-4 py-2 border-b bg-white">
      <div className="flex items-baseline gap-2">
        <div className="text-lg font-semibold text-gray-800">Đăng ký</div>
        <div className="text-xs text-gray-400 font-mono">/tiếp đón</div>
      </div>
      <div className="flex-1 flex items-center justify-center gap-3">
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className={`flex items-center gap-2 ${s.n <= active ? '' : 'opacity-40'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
                ${s.n < active ? 'bg-gray-800 text-white'
                  : s.n === active ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-500 border border-gray-300'}`}>
                {s.n < active ? '✓' : s.n}
              </div>
              <div className="text-sm font-medium text-gray-700">{s.label}</div>
            </div>
            {i < steps.length - 1 && <div className="w-8 border-t border-dashed border-gray-300" />}
          </React.Fragment>
        ))}
      </div>
      <div className="flex gap-2 text-xs text-gray-500">
        {userName && <span className="px-2 py-1 bg-gray-100 rounded-md">👤 {userName}</span>}
        <span className="px-2 py-1 bg-gray-100 rounded-md">{fmtDate(date)}</span>
      </div>
    </div>
  )
}

// ── Left rail: Hôm nay ───────────────────────────────────────────────────────

function TodayRail({ patients, filter, onFilterChange, selectedId, onSelect }) {
  const list = useMemo(() => {
    if (filter === 'today') return patients.filter(p => isToday(p.createdAt))
    return patients
  }, [patients, filter])

  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-white border-r border-gray-200">
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <div className="text-base font-semibold text-gray-800">
            {filter === 'today' ? 'Hôm nay' : 'Tất cả'}
          </div>
          <div className="flex gap-1">
            {['today', 'all'].map(f => (
              <button key={f} onClick={() => onFilterChange(f)}
                className={`px-2 py-0.5 text-xs rounded-md transition-colors
                  ${filter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f === 'today' ? 'Hôm nay' : 'Tất cả'}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-gray-400 font-mono">{list.length} bệnh nhân</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {list.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-6">Chưa có bệnh nhân nào</div>
        )}
        {list.map(p => (
          <button key={p._id} onClick={() => onSelect(p)}
            className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors
              ${selectedId === p._id
                ? 'bg-blue-50 border-blue-400 shadow-sm'
                : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
            <div className="flex justify-between items-baseline gap-2">
              <div className="font-semibold text-sm text-gray-800 truncate">{p.name}</div>
              <div className="text-xs text-gray-400 font-mono flex-shrink-0">{fmtTime(p.createdAt)}</div>
            </div>
            <div className="flex justify-between items-center gap-2 mt-0.5">
              <div className="text-xs text-gray-500 truncate">{p.phone || '—'}</div>
              <div className="text-xs text-gray-400 font-mono flex-shrink-0">{p.patientId}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Search bar + dropdown ────────────────────────────────────────────────────

function SearchBar({ query, onQueryChange, results, loading, onPick, onCreateNew, focused, onFocus, onBlur }) {
  const [hoverIdx, setHoverIdx] = useState(0)
  useEffect(() => { setHoverIdx(0) }, [query])

  const phoneMode = isPhoneLike(query)
  const show = focused && query.trim().length >= 1

  const onKey = (e) => {
    if (!show) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHoverIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHoverIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[hoverIdx]) onPick(results[hoverIdx])
    } else if (e.key === 'Escape') {
      onBlur()
    }
  }

  return (
    <div className="relative max-w-3xl">
      <div className={`flex items-center gap-3 px-4 py-3 bg-white rounded-xl border-2 transition-all
        ${focused ? 'border-blue-400 shadow-md' : 'border-gray-200 shadow-sm'}`}>
        <span className="text-xl text-gray-400">🔎</span>
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={onKey}
          placeholder="Tìm bệnh nhân theo SĐT hoặc tên…"
          className="flex-1 text-base outline-none bg-transparent"
          autoFocus
        />
        {query && (
          <button onClick={() => onQueryChange('')}
            className="text-xs text-gray-400 hover:text-gray-700">✕ xoá</button>
        )}
      </div>

      {show && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-30">
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
            <div>
              {loading ? 'Đang tìm…' : `${results.length} kết quả cho "${query}"`} · tìm theo SĐT &amp; tên
            </div>
            <div className="flex gap-2">
              <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">↑↓</span>
              <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">↵</span>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!loading && results.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">Không tìm thấy bệnh nhân</div>
            )}
            {results.map((r, i) => (
              <button
                key={r._id}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseDown={(e) => { e.preventDefault(); onPick(r) }}
                className={`w-full text-left px-4 py-2.5 grid gap-3 items-center border-b border-gray-50 last:border-0
                  ${hoverIdx === i ? 'bg-blue-50' : 'bg-white'}`}
                style={{ gridTemplateColumns: '1.5fr 1.1fr 1fr 0.8fr' }}>
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    <Highlighted text={r.name} query={phoneMode ? '' : query} />
                  </div>
                  <div className="text-xs text-gray-400 font-mono">{r.patientId}</div>
                </div>
                <div className="text-sm font-mono text-gray-700">
                  <Highlighted text={r.phone || '—'} query={phoneMode ? query : ''} />
                </div>
                <div className="text-xs text-gray-500">
                  <div>DOB {fmtDate(r.dob) || '—'}</div>
                  {calcAge(r.dob) !== '' && <div className="text-gray-400">{calcAge(r.dob)} tuổi</div>}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  <div className="text-[10px] text-gray-400">Gần nhất</div>
                  {fmtDate(r.updatedAt) || '—'}
                </div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500 mr-2">Không thấy ai?</div>
            <button onClick={() => onCreateNew('phone')}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white hover:bg-gray-100 transition-colors">
              ＋ Tạo với SĐT "{query}"
            </button>
            <button onClick={() => onCreateNew('name')}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              ＋ Tạo với tên "{query}"
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Search view (step 1, idle) ───────────────────────────────────────────────

function SearchView({ query, onQueryChange, results, loading, onPick, onCreateNew }) {
  const [focused, setFocused] = useState(true)
  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Tìm hoặc tạo bệnh nhân</h2>
        <p className="text-xs text-gray-500">Gõ ≥ 1 ký tự để bắt đầu · ưu tiên SĐT, fallback tên · Esc để huỷ</p>
      </div>
      <SearchBar
        query={query}
        onQueryChange={onQueryChange}
        results={results}
        loading={loading}
        onPick={onPick}
        onCreateNew={onCreateNew}
        focused={focused}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {!query && (
        <div className="mt-12 text-center text-sm text-gray-400">
          ↑ bắt đầu bằng cách gõ SĐT hoặc tên bệnh nhân
        </div>
      )}
    </div>
  )
}

// ── Form view (step 1b, new/edit) ────────────────────────────────────────────

function FormView({ patient, prefill, onCancel, onSaved }) {
  const { auth } = useAuth()
  const emptyForm = {
    name: '', dob: '', gender: 'M', phone: '', address: '', idCard: '',
    insuranceNumber: '', notes: '', email: '', contact: '',
    sourceCode: '', sourceName: '',
    referralType: '', referralId: '', referralName: '',
    clinicalInfo: '',
    city: '', ward: '', street: '', _addrShortcut: '',
  }

  const [form, setForm] = useState(() => {
    const base = patient ? { ...emptyForm, ...patient } : emptyForm
    if (prefill?.phone) base.phone = prefill.phone
    if (prefill?.name) base.name = prefill.name
    return base
  })
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [sources, setSources] = useState([])
  const [referralOptions, setReferralOptions] = useState({ doctor: [], facility: [], salesperson: [] })

  useEffect(() => {
    api.get('/catalogs/customer-sources').then(r => setSources(r.data || [])).catch(() => setSources([]))
  }, [])

  const currentSource = sources.find(s => s.code === form.sourceCode) || null
  const showReferralPicker = !!currentSource?.requiresReferralPartner

  useEffect(() => {
    if (!form.referralType || referralOptions[form.referralType]?.length) return
    const load = async () => {
      try {
        if (form.referralType === 'doctor') {
          const r = await api.get('/catalogs/referral-doctors', { params: { status: 'active' } })
          setReferralOptions(o => ({ ...o, doctor: r.data || [] }))
        } else if (form.referralType === 'facility') {
          const r = await api.get('/catalogs/partner-facilities', { params: { status: 'active' } })
          setReferralOptions(o => ({ ...o, facility: r.data || [] }))
        } else if (form.referralType === 'salesperson') {
          const r = await api.get('/catalogs/users', { params: { role: 'sale' } })
          setReferralOptions(o => ({ ...o, salesperson: r.data || [] }))
        }
      } catch {}
    }
    load()
  }, [form.referralType])

  // Auto-expand accordion if patient has any extended data
  useEffect(() => {
    if (!patient) return
    const hasExtended = patient.idCard || patient.email || patient.insuranceNumber ||
      patient.address || patient.city || patient.ward || patient.clinicalInfo || patient.notes
    if (hasExtended) setExpanded(true)
  }, [patient])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErr('') }

  const applyAddrShortcut = (v) => {
    set('_addrShortcut', v)
    if (v.length >= 2) {
      const matched = ADDR_SHORTCUTS.find(a => a.key.includes(v.toLowerCase()))
      if (matched) { set('ward', matched.ward); set('city', matched.city) }
    }
  }

  const handleSave = async (advance) => {
    if (!form.name.trim()) { setErr('Họ tên là bắt buộc'); return }
    if (showReferralPicker && (!form.referralType || !form.referralId)) {
      setErr('Nguồn "Được giới thiệu" yêu cầu chọn đối tác giới thiệu')
      return
    }
    setSaving(true)
    try {
      const saved = patient?._id
        ? await api.put(`/registration/patients/${patient._id}`, form).then(r => r.data)
        : await api.post('/registration/patients', form).then(r => r.data)
      onSaved(saved, advance)
    } catch (e) {
      setErr(e.response?.data?.error || 'Lỗi lưu')
    }
    setSaving(false)
  }

  const isNew = !patient?._id
  const age = calcAge(form.dob)

  return (
    <div className="p-6 overflow-y-auto">
      {/* Status banner */}
      <div className="flex items-center gap-3 mb-5">
        <span className={`px-2 py-1 text-xs font-semibold rounded-md uppercase tracking-wide
          ${isNew ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
          {isNew ? 'Hồ sơ mới' : 'Sửa hồ sơ'}
        </span>
        {isNew && prefill?.phone && (
          <span className="text-xs text-gray-500">SĐT "{prefill.phone}" chưa có trong hệ thống</span>
        )}
        {!isNew && patient?.patientId && (
          <span className="text-xs text-gray-500 font-mono">{patient.patientId}</span>
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-1">Thông tin bệnh nhân</h2>
      <p className="text-xs text-gray-500 mb-4">Chỉ 5 trường bắt buộc · mọi thứ khác có thể điền sau</p>

      {err && <div className="mb-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{err}</div>}

      <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-5xl shadow-sm">
        {/* Essentials */}
        <div className="grid grid-cols-6 gap-x-4 gap-y-3">
          <Field label="Họ và tên" required className="col-span-3">
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className={inputCls} placeholder="Nguyễn Văn A" />
          </Field>
          <Field label="Số điện thoại" required className="col-span-3">
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              className={`${inputCls} font-mono`} placeholder="09x…" />
          </Field>

          <Field label="Giới tính" required className="col-span-2">
            <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
              {Object.entries(GENDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Ngày sinh" required className="col-span-2">
            <input type="date" value={form.dob || ''} onChange={e => set('dob', e.target.value)}
              className={`${inputCls} font-mono`} />
          </Field>
          <Field label="Tuổi" className="col-span-1">
            <input value={age} readOnly className={`${inputCls} bg-gray-50 font-mono`} />
          </Field>
          <Field label="Nguồn KH" required className="col-span-1">
            <select value={form.sourceCode}
              onChange={e => {
                const src = sources.find(s => s.code === e.target.value)
                setForm(f => ({
                  ...f,
                  sourceCode: e.target.value,
                  sourceName: src?.name || '',
                  referralType: src?.requiresReferralPartner ? f.referralType : '',
                  referralId:   src?.requiresReferralPartner ? f.referralId : '',
                  referralName: src?.requiresReferralPartner ? f.referralName : '',
                }))
                setErr('')
              }}
              className={inputCls}>
              <option value="">—</option>
              {sources.filter(s => s.status !== 'inactive').map(s => (
                <option key={s.code || s._id} value={s.code || s._id}>{s.name}</option>
              ))}
            </select>
          </Field>

          {showReferralPicker && (
            <>
              <Field label="Loại đối tác" required className="col-span-3">
                <select value={form.referralType}
                  onChange={e => setForm(f => ({ ...f, referralType: e.target.value, referralId: '', referralName: '' }))}
                  className={inputCls}>
                  <option value="">-- Chọn --</option>
                  {REFERRAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Đối tác giới thiệu" required className="col-span-3">
                <select value={form.referralId}
                  onChange={e => {
                    const list = referralOptions[form.referralType] || []
                    const picked = list.find(x => (x._id || '') === e.target.value)
                    setForm(f => ({
                      ...f,
                      referralId: e.target.value,
                      referralName: picked ? (picked.name || picked.displayName || picked._id) : '',
                    }))
                  }}
                  disabled={!form.referralType}
                  className={inputCls}>
                  <option value="">-- Chọn --</option>
                  {(referralOptions[form.referralType] || []).map(x => (
                    <option key={x._id} value={x._id}>
                      {(x.name || x.displayName || x._id)}
                      {x.department ? ` — ${x.department}` : ''}
                      {x.workplace ? ` — ${x.workplace}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>

        {/* Accordion */}
        <button type="button" onClick={() => setExpanded(x => !x)}
          className="mt-5 pt-4 border-t border-dashed border-gray-300 w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <span className={`inline-flex w-5 h-5 items-center justify-center rounded border border-gray-400 text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
            <span className="text-sm font-semibold text-gray-700">Thông tin bổ sung</span>
            <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded">
              CMND · Email · Địa chỉ · BHYT · Lâm sàng · Ghi chú
            </span>
          </div>
          <span className="text-xs text-gray-400">{expanded ? 'thu gọn' : 'mở rộng'}</span>
        </button>

        {expanded && (
          <div className="mt-4 grid grid-cols-6 gap-x-4 gap-y-3">
            <Field label="Căn cước / CCCD" className="col-span-2">
              <input value={form.idCard} onChange={e => set('idCard', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Mã BHYT" className="col-span-2">
              <input value={form.insuranceNumber} onChange={e => set('insuranceNumber', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Email" className="col-span-2">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
            </Field>

            <Field label="Người liên hệ" className="col-span-3">
              <input value={form.contact} onChange={e => set('contact', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Gõ tắt địa chỉ" className="col-span-3">
              <input value={form._addrShortcut || ''} onChange={e => applyAddrShortcut(e.target.value)}
                className={inputCls} placeholder="vd: hk, cg, q1…" />
            </Field>

            <Field label="Tỉnh thành" className="col-span-2">
              <input value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Xã/Phường" className="col-span-2">
              <input value={form.ward} onChange={e => set('ward', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Đường / Số nhà" className="col-span-2">
              <input value={form.street} onChange={e => set('street', e.target.value)} className={inputCls} />
            </Field>

            <Field label="Địa chỉ chi tiết" className="col-span-6">
              <input value={form.address} onChange={e => set('address', e.target.value)} className={inputCls} />
            </Field>

            <Field label="Triệu chứng / Chẩn đoán" className="col-span-6">
              <textarea value={form.clinicalInfo} onChange={e => set('clinicalInfo', e.target.value)}
                rows={2} className={`${inputCls} resize-none`} placeholder="KTSK" />
            </Field>
            <Field label="Ghi chú" className="col-span-6">
              <input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} />
            </Field>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-4 max-w-5xl">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
          ← Huỷ
        </button>
        <div className="flex-1" />
        <button onClick={() => handleSave(false)} disabled={saving}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50">
          Lưu &amp; tiếp tục sau
        </button>
        <button onClick={() => handleSave(true)} disabled={saving}
          className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Đang lưu…' : 'Lưu & chọn dịch vụ →'}
        </button>
      </div>
    </div>
  )
}

// ── Services view (step 2) ───────────────────────────────────────────────────

function PatientSummary({ patient, onEdit }) {
  const age = calcAge(patient.dob)
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
        {initials(patient.name)}
      </div>
      <div>
        <div className="font-semibold text-gray-800">{patient.name}</div>
        <div className="text-xs text-gray-500 font-mono">
          {patient.patientId}
          {' · '}{GENDERS[patient.gender] || '—'}
          {age !== '' && ` · ${age}t`}
          {patient.phone && ` · ${patient.phone}`}
        </div>
      </div>
      <div className="w-px h-8 bg-gray-200" />
      <div>
        <div className="text-[10px] uppercase text-gray-400 tracking-wide">Nguồn KH</div>
        <div className="text-sm text-gray-700">{patient.sourceName || '—'}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-gray-400 tracking-wide">BHYT</div>
        <div className="text-sm text-gray-700">{patient.insuranceNumber || '—'}</div>
      </div>
      <div className="flex-1" />
      <button onClick={onEdit}
        className="text-xs text-gray-500 hover:text-blue-600">✎ Sửa hồ sơ</button>
    </div>
  )
}

function ServicesView({ patient, onEdit, onBack, onPrint, printing }) {
  const [catalog, setCatalog] = useState([])
  const [catalogErr, setCatalogErr] = useState(false)
  const [group, setGroup] = useState('')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState([])
  const [payment, setPayment] = useState('cash')

  useEffect(() => {
    api.get('/catalogs/services/public')
      .then(r => setCatalog(r.data || []))
      .catch(() => setCatalogErr(true))
  }, [])

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase()
    return catalog.filter(s => {
      if (group && (s.serviceTypeCode || '').toUpperCase() !== group) return false
      if (lq && !(`${s.code} ${s.name}`).toLowerCase().includes(lq)) return false
      return true
    })
  }, [catalog, group, q])

  const groupCounts = useMemo(() => {
    const counts = { '': catalog.length }
    for (const s of catalog) {
      const g = (s.serviceTypeCode || '').toUpperCase()
      counts[g] = (counts[g] || 0) + 1
    }
    return counts
  }, [catalog])

  const toggle = (svc) => {
    setCart(prev => {
      const i = prev.findIndex(x => x.code === svc.code)
      if (i >= 0) return prev.filter((_, j) => j !== i)
      return [...prev, { code: svc.code, name: svc.name, price: svc.basePrice || 0, modality: svc.modality || 'OTHER', qty: 1 }]
    })
  }
  const setQty = (code, qty) => {
    setCart(prev => prev.map(x => x.code === code ? { ...x, qty: Math.max(1, qty) } : x))
  }
  const remove = (code) => setCart(prev => prev.filter(x => x.code !== code))

  const total = cart.reduce((s, x) => s + x.price * x.qty, 0)
  const selected = new Set(cart.map(x => x.code))

  return (
    <div className="p-5 h-full flex flex-col gap-4 min-h-0">
      <PatientSummary patient={patient} onEdit={onEdit} />

      {catalogErr && (
        <div className="px-3 py-2 text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded">
          Không tải được danh mục dịch vụ công khai — vui lòng liên hệ quản trị viên
        </div>
      )}

      <div className="grid grid-cols-[1fr_380px] gap-4 flex-1 min-h-0">
        {/* Service picker */}
        <div className="flex flex-col bg-white border border-gray-200 rounded-xl p-4 min-h-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-base font-semibold text-gray-800">Chọn dịch vụ</h3>
            <div className="flex-1 max-w-sm relative">
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Tìm theo mã hoặc tên…"
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔎</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {SERVICE_GROUPS.map(g => {
              const count = groupCounts[g.code] ?? 0
              const active = group === g.code
              return (
                <button key={g.code} onClick={() => setGroup(g.code)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors
                    ${active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}>
                  {g.name} · {count}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filtered.length === 0 && (
              <div className="text-center text-xs text-gray-400 py-8">
                {catalog.length === 0 ? 'Chưa có dịch vụ nào trong danh mục' : 'Không có dịch vụ phù hợp'}
              </div>
            )}
            {filtered.map(s => {
              const on = selected.has(s.code)
              return (
                <button key={s.code} onClick={() => toggle(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-colors
                    ${on ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                  style={{ display: 'grid', gridTemplateColumns: '20px 90px 1fr 70px 110px', gap: 10, alignItems: 'center' }}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs
                    ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-400'}`}>
                    {on ? '✓' : ''}
                  </span>
                  <span className="text-xs font-mono text-gray-500">{s.code}</span>
                  <span className="text-sm text-gray-800">{s.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-center">
                    {(s.serviceTypeCode || '—').toUpperCase()}
                  </span>
                  <span className="text-sm font-mono text-gray-700 text-right">{fmtMoney(s.basePrice)} đ</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Cart */}
        <div className="flex flex-col bg-white border border-gray-200 rounded-xl p-4 min-h-0">
          <div className="flex justify-between items-baseline mb-2">
            <h3 className="text-base font-semibold text-gray-800">Phiếu chỉ định</h3>
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{cart.length} dịch vụ</span>
          </div>
          <div className="border-t border-dashed border-gray-300 mb-2" />

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {cart.length === 0 && (
              <div className="text-center text-xs text-gray-400 py-8">
                Chọn dịch vụ bên trái để thêm vào phiếu
              </div>
            )}
            {cart.map(s => (
              <div key={s.code} className="px-3 py-2 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 leading-tight">{s.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{s.code}</div>
                  </div>
                  <button onClick={() => remove(s.code)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(s.code, s.qty - 1)}
                      className="w-6 h-6 border border-gray-300 rounded hover:bg-white text-sm">−</button>
                    <span className="w-8 text-center text-sm font-mono">{s.qty}</span>
                    <button onClick={() => setQty(s.code, s.qty + 1)}
                      className="w-6 h-6 border border-gray-300 rounded hover:bg-white text-sm">+</button>
                  </div>
                  <span className="text-sm font-mono text-gray-700">{fmtMoney(s.price * s.qty)} đ</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-300 mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span className="text-xs uppercase tracking-wide">Tạm tính</span>
              <span className="font-mono">{fmtMoney(total)} đ</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-base font-semibold text-gray-800">Tổng</span>
              <span className="text-lg font-bold text-blue-700 font-mono">{fmtMoney(total)} đ</span>
            </div>
          </div>

          <div className="flex gap-1.5 mt-3">
            {[
              { k: 'cash',     l: 'Tiền mặt' },
              { k: 'transfer', l: 'Chuyển khoản' },
              { k: 'bhyt',     l: 'BHYT' },
            ].map(p => (
              <button key={p.k} onClick={() => setPayment(p.k)}
                className={`flex-1 px-2 py-1 text-xs rounded-md border transition-colors
                  ${payment === p.k
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}>
                {p.l}
              </button>
            ))}
          </div>

          <button onClick={() => onPrint({ cart, payment })}
            disabled={cart.length === 0 || printing}
            className="mt-3 w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
            {printing ? 'Đang lưu…' : '🖨  In phiếu chỉ định'}
          </button>
          <button onClick={onBack}
            className="mt-1 w-full py-1.5 text-xs text-gray-500 hover:text-gray-800">
            ← Quay lại tìm kiếm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Registration() {
  const { auth } = useAuth()

  // View state machine: 'search' | 'form' | 'services'
  const [view, setView] = useState('search')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [formPrefill, setFormPrefill] = useState(null)

  // Left rail
  const [todayList, setTodayList] = useState([])
  const [railFilter, setRailFilter] = useState('today')

  // Search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  const [printing, setPrinting] = useState(false)

  // Load today rail (covers both 'today' and 'all' filters — client slices)
  const loadRail = useCallback(async () => {
    try {
      const r = await api.get('/registration/patients', { params: { limit: 60 } })
      setTodayList(r.data || [])
    } catch {}
  }, [])
  useEffect(() => { loadRail() }, [loadRail])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.get('/registration/patients', { params: { q: query, limit: 10 } })
        setResults(r.data || [])
      } catch { setResults([]) }
      setSearching(false)
    }, 250)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [query])

  const goSearch = () => {
    setView('search')
    setSelectedPatient(null)
    setFormPrefill(null)
    setQuery('')
    setResults([])
    loadRail()
  }

  const pickPatient = (p) => {
    setSelectedPatient(p)
    setFormPrefill(null)
    setView('services')
  }

  const createNew = (mode) => {
    const q = query.trim()
    const prefill = mode === 'phone' ? { phone: q } : { name: q }
    setSelectedPatient(null)
    setFormPrefill(prefill)
    setView('form')
  }

  const onFormSaved = (saved, advance) => {
    setSelectedPatient(saved)
    setFormPrefill(null)
    loadRail()
    setView(advance ? 'services' : 'search')
    if (!advance) {
      setQuery('')
      setResults([])
    }
  }

  const onPrint = async ({ cart, payment }) => {
    if (!selectedPatient?._id || cart.length === 0) return
    setPrinting(true)
    try {
      // Atomic server-side: creates 1 Invoice (draft, lands on Phiếu thu) +
      // N Appointments + N Studies (scheduled, lands on Ca chụp) for each
      // imaging service. Non-imaging services appear on Phiếu thu only.
      await api.post('/registration/check-in', {
        patientId: selectedPatient._id,
        services: cart.map(it => ({
          code: it.code,
          name: it.name,
          price: it.price,
          modality: it.modality,
          qty: it.qty,
        })),
        paymentMethod: payment === 'bhyt' ? 'mixed' : payment,
      })
      window.print()
      goSearch()
    } catch (e) {
      alert(e.response?.data?.error || 'Không lưu được phiếu chỉ định')
    }
    setPrinting(false)
  }

  const active = view === 'services' ? 2 : 1

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 bg-gray-50">
      <HeaderStepper
        active={active}
        userName={auth?.name || auth?.username}
        date={todayISO()}
      />
      <div className="flex-1 flex min-h-0">
        <TodayRail
          patients={todayList}
          filter={railFilter}
          onFilterChange={setRailFilter}
          selectedId={selectedPatient?._id}
          onSelect={pickPatient}
        />
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {view === 'search' && (
            <SearchView
              query={query}
              onQueryChange={setQuery}
              results={results}
              loading={searching}
              onPick={pickPatient}
              onCreateNew={createNew}
            />
          )}
          {view === 'form' && (
            <FormView
              patient={selectedPatient}
              prefill={formPrefill}
              onCancel={goSearch}
              onSaved={onFormSaved}
            />
          )}
          {view === 'services' && selectedPatient && (
            <ServicesView
              patient={selectedPatient}
              onEdit={() => setView('form')}
              onBack={goSearch}
              onPrint={onPrint}
              printing={printing}
            />
          )}
        </div>
      </div>
    </div>
  )
}
