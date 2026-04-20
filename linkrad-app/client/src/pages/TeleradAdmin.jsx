import React, { useEffect, useState, useMemo } from 'react'
import api from '../api'

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const calcWait = (iso) => {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 0) return '—'
  if (mins < 60) return `${mins}p`
  return `${Math.floor(mins / 60)}h${mins % 60}p`
}

const STATUS_LABELS = {
  pending: { label: 'Chờ phân công', cls: 'bg-yellow-100 text-yellow-700' },
  assigned: { label: 'Đã phân công', cls: 'bg-blue-100 text-blue-700' },
  reading: { label: 'Đang đọc', cls: 'bg-orange-100 text-orange-700' },
  reported: { label: 'Đã có KQ', cls: 'bg-green-100 text-green-700' },
}

export default function TeleradAdmin() {
  const [studies, setStudies] = useState([])
  const [radiologists, setRadiologists] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [assignTarget, setAssignTarget] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const [studiesRes, radRes] = await Promise.all([
        api.get('/ris/studies'),
        api.get('/ris/radiologists'),
      ])
      setStudies((studiesRes.data || []).filter(s => s.teleradRequested))
      setRadiologists(radRes.data || [])
    } catch {} finally { setLoading(false) }
  }

  const pending = studies.filter(s => s.teleradStatus === 'pending')
  const assigned = studies.filter(s => s.teleradStatus === 'assigned')
  const reading = studies.filter(s => s.teleradStatus === 'reading')
  const done = studies.filter(s => s.teleradStatus === 'reported')

  const TABS = [
    { key: 'pending', label: 'Chờ phân công', list: pending },
    { key: 'assigned', label: 'Đã phân công', list: assigned },
    { key: 'reading', label: 'Đang đọc', list: reading },
    { key: 'done', label: 'Hoàn thành', list: done },
  ]

  const currentList = TABS.find(t => t.key === tab)?.list || []

  // Radiologist workload
  const radWorkload = useMemo(() => {
    const map = {}
    radiologists.forEach(r => { map[r.username] = { ...r, active: 0, today: 0, done: 0 } })
    studies.forEach(s => {
      if (!s.radiologist || !map[s.radiologist]) return
      if (s.teleradStatus === 'assigned' || s.teleradStatus === 'reading') map[s.radiologist].active++
      if (s.teleradStatus === 'reported') map[s.radiologist].done++
      map[s.radiologist].today++
    })
    return Object.values(map)
  }, [studies, radiologists])

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === currentList.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(currentList.map(s => s._id)))
    }
  }

  const handleAssign = async () => {
    if (!assignTarget || selectedIds.size === 0) return
    setAssigning(true)
    const rad = radiologists.find(r => r.username === assignTarget)
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          api.post(`/ris/studies/${id}/assign`, {
            radiologistId: assignTarget,
            radiologistName: rad?.displayName || assignTarget,
          })
        )
      )
      setSelectedIds(new Set())
      setAssignTarget('')
      load()
    } catch {} finally { setAssigning(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Quản lý đọc phim</h1>
          <p className="text-xs text-gray-400 mt-0.5">Admin nền tảng Teleradiology</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors">⟳ Làm mới</button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {TABS.map(t => (
          <div key={t.key} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className={`h-1 ${t.key === 'pending' ? 'bg-yellow-400' : t.key === 'assigned' ? 'bg-blue-500' : t.key === 'reading' ? 'bg-orange-400' : 'bg-green-500'}`} />
            <div className="px-4 py-3">
              <div className="text-xs text-gray-500 font-medium">{t.label}</div>
              <div className="text-2xl font-bold text-gray-800 mt-1">{t.list.length}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Left: Radiologist panel */}
        <div className="w-[260px] flex-shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Bác sĩ đọc phim</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {radWorkload.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">Chưa có BS</div>}
            {radWorkload.map(r => (
              <div key={r.username} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-800 truncate">{r.displayName}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>Đang đọc: <span className={`font-medium ${r.active > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{r.active}</span></span>
                  <span>Hoàn thành: <span className="font-medium text-green-600">{r.done}</span></span>
                </div>
                {r.department && <div className="text-xs text-gray-400 mt-0.5">{r.department}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Case list */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex gap-0 border-b border-gray-200 mb-4">
            {TABS.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setSelectedIds(new Set()) }}
                className={`px-5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  tab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t.list.length}</span>
              </button>
            ))}
          </div>

          {/* Assign toolbar (only for pending tab) */}
          {tab === 'pending' && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm text-blue-700 font-medium">{selectedIds.size} ca đã chọn</span>
              <select value={assignTarget} onChange={e => setAssignTarget(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400">
                <option value="">— Chọn BS đọc phim —</option>
                {radiologists.map(r => (
                  <option key={r.username} value={r.username}>{r.displayName} {r.department ? `(${r.department})` : ''}</option>
                ))}
              </select>
              <button onClick={handleAssign} disabled={!assignTarget || assigning}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors">
                {assigning ? 'Đang phân công...' : 'Phân công'}
              </button>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {tab === 'pending' && (
                      <th className="px-3 py-2.5 w-8">
                        <input type="checkbox" checked={selectedIds.size === currentList.length && currentList.length > 0}
                          onChange={selectAll} className="rounded" />
                      </th>
                    )}
                    {['STT', 'Mã BN', 'Bệnh nhân', 'Modality', 'Cơ sở', 'Thời gian gửi', 'Chờ', 'Trạng thái', 'BS đọc'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentList.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">Không có ca nào</td></tr>
                  ) : currentList.map((s, i) => (
                    <tr key={s._id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                      {tab === 'pending' && (
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selectedIds.has(s._id)} onChange={() => toggleSelect(s._id)} className="rounded" />
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{s.patientId || '—'}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{s.patientName || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">{s.modality}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{s.site || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{fmtDateTime(s.teleradRequestedAt)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{calcWait(s.teleradRequestedAt)}</td>
                      <td className="px-3 py-2.5">
                        {(() => {
                          const c = STATUS_LABELS[s.teleradStatus] || { label: s.teleradStatus || s.status, cls: 'bg-gray-100 text-gray-500' }
                          return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.cls}`}>{c.label}</span>
                        })()}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{s.radiologistName || <span className="text-gray-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
