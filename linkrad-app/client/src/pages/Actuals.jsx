import React, { useEffect, useState, useCallback } from 'react'
import { getActuals, saveActual, deleteActual, getAnnualPL } from '../api'

const MONTH_LABELS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']

const n = (v) => v === '' ? 0 : Number(v) || 0

export default function Actuals() {
  const [actuals, setActuals] = useState({})
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const nextMonth = now.getMonth() + 2 > 12
    ? { year: now.getFullYear() + 1, month: 1 }
    : { year: now.getFullYear(), month: now.getMonth() + 2 }

  const [inputYear, setInputYear]   = useState(nextMonth.year)
  const [inputMonth, setInputMonth] = useState(nextMonth.month)
  const [inputSite, setInputSite]   = useState('')
  const [saving, setSaving]         = useState(false)
  const [inputValues, setInputValues] = useState({
    rev_mri: '', rev_ct: '', rev_mammo: '', rev_xq: '', rev_ua: '',
    vc_total: '', fc_staff: '', fc_rent: '', fc_ops: '', fc_other: ''
  })

  useEffect(() => {
    Promise.all([getActuals(), getAnnualPL()]).then(([acts, apl]) => {
      setActuals(acts)
      const mainSites = (apl.sites || []).filter(s => s !== 'HO' && s !== 'Site LK')
      setSites(mainSites)
      if (mainSites.length > 0) setInputSite(mainSites[0])
      setLoading(false)
    })
  }, [])

  // Load existing data when month/year/site changes
  useEffect(() => {
    if (!inputSite) return
    const key = `${inputYear}-${String(inputMonth).padStart(2, '0')}-${inputSite}`
    const existing = actuals[key]
    if (existing) {
      setInputValues({
        rev_mri:   existing.rev_mri   ?? '',
        rev_ct:    existing.rev_ct    ?? '',
        rev_mammo: existing.rev_mammo ?? '',
        rev_xq:    existing.rev_xq    ?? '',
        rev_ua:    existing.rev_ua    ?? '',
        vc_total:  existing.vc_total  ?? '',
        fc_staff:  existing.fc_staff  ?? '',
        fc_rent:   existing.fc_rent   ?? '',
        fc_ops:    existing.fc_ops    ?? '',
        fc_other:  existing.fc_other  ?? '',
      })
    } else {
      setInputValues({ rev_mri:'', rev_ct:'', rev_mammo:'', rev_xq:'', rev_ua:'', vc_total:'', fc_staff:'', fc_rent:'', fc_ops:'', fc_other:'' })
    }
  }, [inputYear, inputMonth, inputSite, actuals])

  const setField = (k, v) => setInputValues(prev => ({ ...prev, [k]: v }))

  const derivedRev    = n(inputValues.rev_mri) + n(inputValues.rev_ct) + n(inputValues.rev_mammo) + n(inputValues.rev_xq) + n(inputValues.rev_ua)
  const derivedVC     = n(inputValues.vc_total)
  const derivedFC     = n(inputValues.fc_staff) + n(inputValues.fc_rent) + n(inputValues.fc_ops) + n(inputValues.fc_other)
  const derivedEBITDA = derivedRev - derivedVC - derivedFC

  const handleSave = useCallback(async () => {
    if (!inputSite) return
    setSaving(true)
    const key = `${inputYear}-${String(inputMonth).padStart(2, '0')}-${inputSite}`
    const payload = {
      ...Object.fromEntries(Object.entries(inputValues).map(([k, v]) => [k, n(v)])),
      site:      inputSite,
      rev_total: derivedRev,
      vc_total:  derivedVC,
      fc_total:  derivedFC,
      ebitda:    derivedEBITDA,
    }
    const updated = await saveActual(key, payload)
    setActuals(updated)
    setSaving(false)
  }, [inputYear, inputMonth, inputSite, inputValues, derivedRev, derivedVC, derivedFC, derivedEBITDA])

  const handleDelete = useCallback(async (key) => {
    const updated = await deleteActual(key)
    setActuals(updated)
  }, [])

  const currentKey = `${inputYear}-${String(inputMonth).padStart(2, '0')}-${inputSite}`
  const hasExisting = !!actuals[currentKey]

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Đang tải...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Nhập Số Liệu Thực Tế</h2>
          <p className="text-sm text-gray-500 mt-0.5">Cập nhật doanh thu và chi phí theo chi nhánh / tháng</p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">VND triệu</span>
      </div>

      {/* Selector bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Chi nhánh:</span>
        <select value={inputSite} onChange={e => setInputSite(e.target.value)}
          className="text-sm border border-gray-200 rounded px-3 py-1.5 outline-none text-gray-700 focus:border-blue-400 min-w-[140px]">
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <span className="text-gray-300">|</span>

        <span className="text-sm font-medium text-gray-600">Tháng:</span>
        <select value={inputYear} onChange={e => setInputYear(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded px-3 py-1.5 outline-none text-gray-700 focus:border-blue-400">
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>
        <select value={inputMonth} onChange={e => setInputMonth(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded px-3 py-1.5 outline-none text-gray-700 focus:border-blue-400">
          {MONTH_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>

        {hasExisting && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Đã có số liệu — đang chỉnh sửa</span>
        )}
      </div>

      {/* Input form */}
      <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Số liệu <span className="text-blue-700">{inputSite}</span> — tháng {inputMonth}/{inputYear}
        </h3>
        <div className="grid grid-cols-2 gap-8">

          {/* Doanh thu */}
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Doanh thu (VND triệu)</p>
            <div className="space-y-2.5">
              {[
                { key: 'rev_mri',   label: 'MRI' },
                { key: 'rev_ct',    label: 'CT' },
                { key: 'rev_mammo', label: 'Mammo X-Quang' },
                { key: 'rev_xq',    label: 'X-Quang' },
                { key: 'rev_ua',    label: 'Siêu âm' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-sm text-gray-500 w-36 shrink-0">{label}</label>
                  <input type="number" step="0.1" placeholder="0"
                    value={inputValues[key]}
                    onChange={e => setField(key, e.target.value)}
                    className="flex-1 text-right text-sm border border-gray-200 rounded px-3 py-1.5 outline-none focus:border-blue-400 focus:bg-blue-50"
                  />
                </div>
              ))}
              <div className="flex items-center gap-3 border-t pt-2.5 mt-1">
                <span className="text-sm font-semibold text-blue-700 w-36">Tổng doanh thu</span>
                <span className="flex-1 text-right text-sm font-bold text-blue-700">
                  {derivedRev.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                </span>
              </div>
            </div>
          </div>

          {/* Chi phí */}
          <div>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">Chi phí (VND triệu)</p>
            <div className="space-y-2.5">
              {[
                { key: 'vc_total', label: 'Tổng biến phí' },
                { key: 'fc_staff', label: 'Chi phí nhân sự' },
                { key: 'fc_rent',  label: 'Chi phí thuê địa điểm' },
                { key: 'fc_ops',   label: 'Chi phí vận hành' },
                { key: 'fc_other', label: 'Chi phí khác' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-sm text-gray-500 w-36 shrink-0">{label}</label>
                  <input type="number" step="0.1" placeholder="0"
                    value={inputValues[key]}
                    onChange={e => setField(key, e.target.value)}
                    className="flex-1 text-right text-sm border border-gray-200 rounded px-3 py-1.5 outline-none focus:border-red-300 focus:bg-red-50"
                  />
                </div>
              ))}
              <div className="flex items-center gap-3 border-t pt-2.5 mt-1">
                <span className="text-sm font-semibold text-gray-600 w-36">Tổng chi phí</span>
                <span className="flex-1 text-right text-sm font-bold text-gray-600">
                  {(derivedVC + derivedFC).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* EBITDA preview */}
        <div className={`mt-5 rounded-lg px-5 py-4 flex items-center justify-between ${derivedEBITDA >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <span className="text-base font-semibold text-gray-700">
            EBITDA — {inputSite} T{inputMonth}/{inputYear}
          </span>
          <span className={`text-2xl font-bold ${derivedEBITDA >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {derivedEBITDA >= 0 ? '+' : ''}{derivedEBITDA.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr.
          </span>
          <span className={`text-sm font-medium ${derivedEBITDA >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Margin: {derivedRev > 0 ? (derivedEBITDA / derivedRev * 100).toFixed(1) : '0'}%
          </span>
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={handleSave} disabled={saving || !inputSite}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm disabled:opacity-50">
            {saving ? 'Đang lưu...' : `Lưu ${inputSite} T${inputMonth}/${inputYear}`}
          </button>
        </div>
      </div>

      {/* Saved actuals list */}
      {Object.keys(actuals).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Số liệu đã lưu</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b-2 border-gray-200">
                  <th className="py-2 px-3 text-gray-600 font-semibold">Tháng</th>
                  <th className="py-2 px-3 text-gray-600 font-semibold">Chi nhánh</th>
                  <th className="py-2 px-3 text-right text-gray-600 font-semibold">Doanh thu (tr.)</th>
                  <th className="py-2 px-3 text-right text-gray-600 font-semibold">Biến phí (tr.)</th>
                  <th className="py-2 px-3 text-right text-gray-600 font-semibold">Định phí (tr.)</th>
                  <th className="py-2 px-3 text-right text-gray-600 font-semibold">EBITDA (tr.)</th>
                  <th className="py-2 px-3 text-right text-gray-600 font-semibold">Margin</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(actuals).sort(([a],[b]) => a.localeCompare(b)).map(([key, d], i) => {
                  const parts = key.split('-')
                  const yr = parts[0]
                  const mo = parts[1]
                  const site = parts.slice(2).join('-') || d.site || '—'
                  const ebitdaOk = (d.ebitda || 0) >= 0
                  const margin = d.rev_total > 0 ? (d.ebitda / d.rev_total * 100).toFixed(1) : '0'
                  return (
                    <tr key={key}
                      onClick={() => {
                        setInputYear(Number(yr))
                        setInputMonth(Number(mo))
                        if (site !== '—') setInputSite(site)
                      }}
                      className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${key === currentKey ? 'ring-2 ring-blue-300 ring-inset' : ''}`}>
                      <td className="py-2 px-3 font-medium text-gray-700 whitespace-nowrap">
                        T{parseInt(mo)}/{yr}
                        {key === currentKey && <span className="ml-2 text-xs text-blue-600">(đang chỉnh sửa)</span>}
                      </td>
                      <td className="py-2 px-3 text-indigo-700 font-medium whitespace-nowrap">{site}</td>
                      <td className="py-2 px-3 text-right text-blue-700">{(d.rev_total||0).toLocaleString('vi-VN',{maximumFractionDigits:0})}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{(d.vc_total||0).toLocaleString('vi-VN',{maximumFractionDigits:0})}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{(d.fc_total||0).toLocaleString('vi-VN',{maximumFractionDigits:0})}</td>
                      <td className={`py-2 px-3 text-right font-medium ${ebitdaOk ? 'text-green-600' : 'text-red-600'}`}>
                        {ebitdaOk ? '+' : ''}{(d.ebitda||0).toLocaleString('vi-VN',{maximumFractionDigits:0})}
                      </td>
                      <td className={`py-2 px-3 text-right ${ebitdaOk ? 'text-green-600' : 'text-red-600'}`}>{margin}%</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(key) }}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded hover:bg-red-50">
                          Xóa
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
