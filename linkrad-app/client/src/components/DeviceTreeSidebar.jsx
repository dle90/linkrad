import React, { useState, useMemo } from 'react'

// MINERVA-style left rail: groups sites by modality, each modality
// expands to a list of rooms/sites. Click filters the worklist.
//
// `sites` shape from server: [{ name, modalities: [], rooms: [{name, modality}] }]
// — but our /api/sites endpoint returns flat. We derive groupings from
// the studies themselves so the tree stays in sync with real data.
export default function DeviceTreeSidebar({ studies, selected, onSelect, collapsed, onToggle }) {
  const [openGroups, setOpenGroups] = useState({ all: true, US: true, MR: true, CT: true, XR: true })

  const tree = useMemo(() => {
    // Group: modality → site → count
    const map = {}
    for (const s of studies) {
      const mod = s.modality || '?'
      const site = s.site || '(không rõ)'
      if (!map[mod]) map[mod] = {}
      if (!map[mod][site]) map[mod][site] = 0
      map[mod][site]++
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([modality, sites]) => ({
        modality,
        total: Object.values(sites).reduce((a, b) => a + b, 0),
        sites: Object.entries(sites)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([site, count]) => ({ site, count })),
      }))
  }, [studies])

  const total = studies.length

  if (collapsed) {
    return (
      <div className="bg-white border-r border-gray-200 flex flex-col items-center py-2 w-10">
        <button onClick={onToggle} className="p-2 hover:bg-gray-100 rounded text-gray-500" title="Mở rộng">»</button>
      </div>
    )
  }

  const ItemBtn = ({ active, onClick, children, count }) => (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-sm rounded ${
        active ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="truncate">{children}</span>
      {count != null && <span className="text-xs text-gray-400 ml-2">{count}</span>}
    </button>
  )

  return (
    <div className="bg-white border-r border-gray-200 w-56 flex-shrink-0 flex flex-col">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <strong className="text-xs uppercase tracking-wide text-gray-600">Danh sách máy</strong>
        <button onClick={onToggle} className="p-1 hover:bg-gray-100 rounded text-gray-400" title="Thu gọn">«</button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <ItemBtn active={!selected} onClick={() => onSelect(null)} count={total}>📂 Toàn bộ</ItemBtn>
        {tree.map(grp => {
          const open = openGroups[grp.modality] ?? true
          return (
            <div key={grp.modality} className="mt-1">
              <button onClick={() => setOpenGroups(g => ({ ...g, [grp.modality]: !open }))}
                className="w-full flex items-center justify-between px-2 py-1 text-xs uppercase tracking-wide text-gray-500 hover:bg-gray-50 rounded">
                <span>{open ? '▾' : '▸'} {grp.modality}</span>
                <span className="text-gray-400">{grp.total}</span>
              </button>
              {open && (
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {grp.sites.map(({ site, count }) => {
                    const key = `${grp.modality}|${site}`
                    return (
                      <ItemBtn
                        key={key}
                        active={selected === key}
                        onClick={() => onSelect(key)}
                        count={count}
                      >
                        ▫ {site}
                      </ItemBtn>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
