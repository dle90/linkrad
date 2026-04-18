import React, { useState, useEffect } from 'react'
import api from '../api'

const MODALITIES = ['', 'CT', 'MRI', 'XR', 'US']

export default function MWL() {
  const [data, setData] = useState({ count: 0, items: [], generatedAt: '', note: '' })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ modality: '', site: '' })
  const [selected, setSelected] = useState(new Set())
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/mwl', { params: filter })
      setData(r.data)
      setSelected(new Set())
    } catch (e) { setData({ count: 0, items: [] }) }
    setLoading(false)
  }

  useEffect(() => { load() }, [JSON.stringify(filter)])

  const toggle = (id) => setSelected(s => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const sync = async () => {
    if (selected.size === 0 && !confirm('Đẩy TOÀN BỘ worklist tới scanner?')) return
    setSyncing(true)
    try {
      const studyIds = selected.size > 0 ? [...selected] : null
      const r = await api.post('/mwl/sync', { studyIds })
      setLastResult(`✓ Đã đánh dấu ${r.data.syncedCount} ca đã đẩy.`)
      load()
    } catch (e) { setLastResult('✗ Lỗi: ' + (e.response?.data?.error || e.message)) }
    setSyncing(false)
    setTimeout(() => setLastResult(''), 5000)
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">Modality Worklist (MWL)</h2>
        <p className="text-sm text-gray-500">Worklist DICOM C-FIND để máy chụp tải lịch trình tự động.</p>
        <p className="text-xs text-gray-400 mt-1">{data.note}</p>
      </div>

      <div className="bg-white rounded-lg border p-3 mb-3 flex gap-2 items-end">
        <div>
          <div className="text-xs text-gray-500 mb-1">Modality</div>
          <select value={filter.modality} onChange={e => setFilter(f => ({ ...f, modality: e.target.value }))} className="border rounded px-2 py-1.5 text-sm">
            {MODALITIES.map(m => <option key={m} value={m}>{m || 'Tất cả'}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Site</div>
          <input value={filter.site} onChange={e => setFilter(f => ({ ...f, site: e.target.value }))} className="border rounded px-2 py-1.5 text-sm w-40" placeholder="Hải Dương..." />
        </div>
        <div className="flex-1" />
        <div className="text-xs text-gray-500 self-center mr-2">{data.count} ca · cập nhật {data.generatedAt && new Date(data.generatedAt).toLocaleTimeString('vi-VN')}</div>
        <button onClick={load} className="text-xs px-3 py-1.5 border rounded">↻</button>
        <button onClick={sync} disabled={syncing} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded">
          {syncing ? 'Đang đẩy...' : `↑ Đẩy ${selected.size > 0 ? selected.size + ' ca' : 'tất cả'}`}
        </button>
      </div>

      {lastResult && <div className={`mb-3 px-4 py-2 rounded text-sm ${lastResult.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{lastResult}</div>}

      <div className="bg-white rounded-lg border overflow-auto" style={{ maxHeight: 'calc(100vh - 18rem)' }}>
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="sticky top-0 bg-[#1e3a5f] text-white text-xs uppercase">
            <tr>
              <th className="px-3 py-2 w-8 text-center">
                <input type="checkbox" checked={data.items.length > 0 && selected.size === data.items.length}
                  onChange={() => selected.size === data.items.length ? setSelected(new Set()) : setSelected(new Set(data.items.map(i => i._internal.studyDbId)))} />
              </th>
              <th className="text-left px-3 py-2">AccessionNumber</th>
              <th className="text-left px-3 py-2">PatientID</th>
              <th className="text-left px-3 py-2">PatientName</th>
              <th className="text-left px-3 py-2">DOB</th>
              <th className="text-left px-3 py-2">Sex</th>
              <th className="text-left px-3 py-2">Modality</th>
              <th className="text-left px-3 py-2">RequestedProcedure</th>
              <th className="text-left px-3 py-2">ScheduledStation</th>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Time</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {loading ? (
              <tr><td colSpan={11} className="text-center py-8 text-gray-400">Đang tải...</td></tr>
            ) : data.items.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-8 text-gray-400">Worklist trống — không có ca scheduled hoặc in_progress.</td></tr>
            ) : data.items.map(it => {
              const id = it._internal.studyDbId
              return (
                <tr key={id} className="border-t hover:bg-blue-50/30">
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} />
                  </td>
                  <td className="px-3 py-1.5 text-blue-700">{it.AccessionNumber}</td>
                  <td className="px-3 py-1.5">{it.PatientID}</td>
                  <td className="px-3 py-1.5 font-sans text-gray-800">{it.PatientName}</td>
                  <td className="px-3 py-1.5">{it.PatientBirthDate}</td>
                  <td className="px-3 py-1.5 text-center">{it.PatientSex}</td>
                  <td className="px-3 py-1.5 font-sans">{it.Modality}</td>
                  <td className="px-3 py-1.5 font-sans text-gray-700">{it.RequestedProcedureDescription}</td>
                  <td className="px-3 py-1.5 text-purple-700">{it.ScheduledStationAETitle}</td>
                  <td className="px-3 py-1.5">{it.ScheduledProcedureStepStartDate}</td>
                  <td className="px-3 py-1.5">{it.ScheduledProcedureStepStartTime}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <details className="mt-3 text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700">ⓘ Cấu hình scanner để dùng MWL</summary>
        <div className="mt-2 bg-gray-50 border rounded p-3 space-y-1">
          <div>1. Bật Orthanc Worklist Plugin (xem <code>linkrad-app/pacs/orthanc.json</code>).</div>
          <div>2. Trên máy chụp, cấu hình MWL Server: AE Title <code>LINKRAD</code>, IP scanner-host, Port <code>4242</code>.</div>
          <div>3. Bấm "Đẩy" để LinkRad ghi worklist (.wl files) vào volume Orthanc đọc được.</div>
          <div>4. Máy chụp gọi C-FIND để tải lịch — tự động điền PatientID/Name/AccessionNumber.</div>
        </div>
      </details>
    </div>
  )
}
