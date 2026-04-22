import React, { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '-'
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('vi-VN') : '-'

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function calcAge(dob) {
  if (!dob) return ''
  const diff = Date.now() - new Date(dob).getTime()
  if (!Number.isFinite(diff) || diff < 0) return ''
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

// Starter for "Kỹ thuật chụp" when no draft exists yet — gives the doctor
// a scaffold they can elaborate on instead of starting from blank.
function techniqueStarter(study) {
  const parts = [study.modality, study.bodyPart].filter(Boolean)
  return parts.length ? parts.join(' ') : ''
}

// Hoisted out of the render scope so React doesn't unmount/remount the
// textarea on every parent re-render (which was stealing focus after each
// keystroke).
function ReportField({ label, value, rows = 3, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <textarea rows={rows} value={value} onChange={onChange}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-y" />
    </div>
  )
}

const ACTION_BUTTONS = [
  { key: 'receive',   label: 'Nhận ca',          icon: '🛎️',  variant: 'primary' },
  { key: 'view',      label: 'Xem ảnh',          icon: '👁️',  variant: 'default' },
  { key: 'view_v1',   label: 'Xem ảnh V1',       icon: '🔍',  variant: 'default' },
  { key: 'video',     label: 'Tải Video',        icon: '🎥',  variant: 'default' },
  { key: 'attach',    label: 'Tải tệp đính kèm', icon: '📎',  variant: 'default' },
  { key: 'print',     label: 'In kết quả',       icon: '🖨️',  variant: 'default' },
  { key: 'print_fast', label: 'In nhanh',        icon: '⚡',  variant: 'default' },
  { key: 'portal',    label: 'In Tra cứu Portal', icon: '🌐',  variant: 'default' },
]

// Open a print-formatted report in a new window (clinic letterhead, signatures, etc.)
function openPrintWindow(study, report, autoPrint = false) {
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) { alert('Trình duyệt chặn cửa sổ in'); return }
  const date = new Date().toLocaleString('vi-VN')
  const sig = (url, name, ts) => {
    const dateLine = ts ? `<div style="font-size:10px;color:#666">${new Date(ts).toLocaleString('vi-VN')}</div>` : ''
    if (url) {
      return `<div style="text-align:center"><img src="${url}" style="max-height:60px;max-width:160px;display:block;margin:0 auto"/><div style="font-size:11px;margin-top:4px"><strong>${name || ''}</strong></div>${dateLine}</div>`
    }
    if (name && ts) {
      // Signed with typed name (no image uploaded) — render as an italic serif
      // "signature block," which is how most Vietnamese clinical reports print a
      // typed signature.
      return `<div style="text-align:center;padding-top:12px"><div style="font-family:'Times New Roman',serif;font-style:italic;font-size:22px;color:#111;line-height:1">${name}</div><div style="font-size:11px;margin-top:6px"><strong>${name}</strong></div>${dateLine}</div>`
    }
    return `<div style="text-align:center;color:#999;font-size:11px;padding-top:30px">(chưa ký)</div>`
  }
  const html = `
<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Kết quả ${study.patientName || ''}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Times New Roman', serif; color: #111; font-size: 13px; line-height: 1.5; }
  h1, h2, h3 { font-family: Arial, sans-serif; }
  .header { display:flex; justify-content:space-between; border-bottom:2px solid #333; padding-bottom:8px; margin-bottom:12px; }
  .clinic { font-weight: bold; font-size: 16px; color: #1e3a5f; }
  .subtitle { font-size: 11px; color: #555; }
  .info-table { width:100%; margin: 8px 0; border-collapse: collapse; }
  .info-table td { padding: 3px 6px; vertical-align: top; }
  .info-table td.k { color:#666; width: 110px; }
  .section { margin-top: 14px; }
  .section h3 { font-size: 13px; color: #1e3a5f; border-bottom:1px solid #ccc; padding-bottom:3px; }
  .body { white-space: pre-wrap; }
  .signs { display:flex; justify-content:space-around; margin-top: 30px; padding-top: 10px; }
  .signs > div { width:45%; }
  .footer { margin-top: 20px; text-align:center; font-size: 10px; color: #777; border-top:1px solid #ddd; padding-top: 6px; }
  .critical { background: #fff3f3; border:2px solid #c00; padding: 8px; margin: 10px 0; color:#900; font-weight: bold; }
</style></head><body>
  <div class="header">
    <div>
      <div class="clinic">LINKRAD PACS — ${(study.site || '').toUpperCase()}</div>
      <div class="subtitle">Trung tâm Chẩn đoán Hình ảnh</div>
    </div>
    <div style="text-align:right;font-size:11px">
      <div>Số phiếu: <strong>${study._id || ''}</strong></div>
      <div>Ngày in: ${date}</div>
    </div>
  </div>
  <h2 style="text-align:center;margin:8px 0">KẾT QUẢ CHẨN ĐOÁN HÌNH ẢNH</h2>
  <h3 style="text-align:center;margin:0">${(study.bodyPart || study.modality || '').toUpperCase()}</h3>
  <table class="info-table">
    <tr><td class="k">Họ tên:</td><td><strong>${study.patientName || ''}</strong></td>
        <td class="k">PID:</td><td>${study.patientId || ''}</td></tr>
    <tr><td class="k">Năm sinh:</td><td>${(study.dob || '').slice(0, 4)}</td>
        <td class="k">Giới tính:</td><td>${study.gender === 'M' ? 'Nam' : study.gender === 'F' ? 'Nữ' : '-'}</td></tr>
    <tr><td class="k">Modality:</td><td>${study.modality || ''}</td>
        <td class="k">Ngày chụp:</td><td>${study.studyDate ? new Date(study.studyDate).toLocaleString('vi-VN') : ''}</td></tr>
    <tr><td class="k">CĐ lâm sàng:</td><td colspan="3">${study.clinicalInfo || ''}</td></tr>
  </table>
  ${report?.criticalFinding ? `<div class="critical">⚠ PHÁT HIỆN NGHIÊM TRỌNG: ${report.criticalNote || ''}</div>` : ''}
  <div class="section"><h3>Kỹ thuật</h3><div class="body">${(report?.technique || '').replace(/</g, '&lt;')}</div></div>
  <div class="section"><h3>Mô tả hình ảnh (Findings)</h3><div class="body">${(report?.findings || '').replace(/</g, '&lt;')}</div></div>
  <div class="section"><h3>Kết luận (Impression)</h3><div class="body" style="font-weight:600">${(report?.impression || '').replace(/</g, '&lt;')}</div></div>
  ${report?.recommendation ? `<div class="section"><h3>Đề nghị</h3><div class="body">${report.recommendation.replace(/</g, '&lt;')}</div></div>` : ''}
  <div class="signs">
    <div>
      <div style="text-align:center;font-size:11px;color:#555">Kỹ thuật viên</div>
      ${sig(report?.technicianSignatureUrl, report?.technicianSignerName, report?.technicianSignedAt)}
    </div>
    <div>
      <div style="text-align:center;font-size:11px;color:#555">Bác sĩ chẩn đoán</div>
      ${sig(report?.radiologistSignatureUrl, report?.radiologistName, report?.finalizedAt)}
    </div>
  </div>
  <div class="footer">LinkRad PACS · In ngày ${date}</div>
  <script>${autoPrint ? 'window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}' : ''}</script>
</body></html>`
  w.document.write(html)
  w.document.close()
}

function ActionToolbar({ study, report, onReceive, onViewImages }) {
  const variantCls = (v) => v === 'primary'
    ? 'bg-blue-600 hover:bg-blue-700 text-white'
    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'

  const handle = (key) => {
    switch (key) {
      case 'receive': return onReceive()
      case 'view':    return onViewImages(false)
      case 'view_v1': return onViewImages(true)
      case 'print':       return openPrintWindow(study, report, false)
      case 'print_fast':  return openPrintWindow(study, report, true)
      case 'portal':
        window.open(`/patient-portal?lookup=${encodeURIComponent(study.patientId)}`, '_blank')
        break
      case 'video':
      case 'attach':
        alert('Tính năng đang phát triển — kết nối với storage')
        break
    }
  }

  return (
    <div className="bg-white border-b border-gray-200 px-3 py-2 flex flex-wrap gap-1.5">
      {ACTION_BUTTONS.map(b => (
        <button key={b.key}
          onClick={() => handle(b.key)}
          className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 ${variantCls(b.variant)}`}
          title={b.label}
        >
          <span>{b.icon}</span>
          <span>{b.label}</span>
        </button>
      ))}
    </div>
  )
}

// Horizontal patient summary card — matches Đăng ký Screen C style.
// Replaces the old 256px-wide left sidebar, reclaiming horizontal space for
// the report editor. The always-visible right HistoryRail still handles
// prior-exam comparison.
function PatientSummaryCard({ study }) {
  const age = calcAge(study.dob)
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0">
        {initials(study.patientName)}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-gray-800 truncate">{study.patientName || '—'}</div>
        <div className="text-xs text-gray-500 font-mono">
          {study.patientId || '—'}
          {' · '}{study.gender === 'M' ? 'Nam' : study.gender === 'F' ? 'Nữ' : '—'}
          {age !== '' && ` · ${age}t`}
          {study.dob && ` · ${(study.dob || '').slice(0, 10)}`}
        </div>
      </div>
      <div className="w-px h-8 bg-gray-200" />
      <div>
        <div className="text-[10px] uppercase text-gray-400 tracking-wide">Modality</div>
        <div className="text-sm font-mono text-gray-700">{study.modality || '—'}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-gray-400 tracking-wide">Bộ phận</div>
        <div className="text-sm text-gray-700">{study.bodyPart || '—'}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-gray-400 tracking-wide">Ngày chụp</div>
        <div className="text-sm text-gray-700">{fmtDateTime(study.studyDate)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-gray-400 tracking-wide">Site</div>
        <div className="text-sm text-gray-700">{study.site || '—'}</div>
      </div>
      <div className="flex-1" />
      {study.priority && study.priority !== 'routine' && (
        <span className="px-2 py-1 text-xs font-semibold rounded-md bg-amber-100 text-amber-700 uppercase">
          {study.priority === 'urgent' ? 'Khẩn' : study.priority === 'stat' ? 'Cấp cứu' : study.priority}
        </span>
      )}
    </div>
  )
}

function HistoryRail({ patientId, currentStudyId, onOpenPrior }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId) return
    api.get(`/exam-history/${patientId}`)
      .then(r => setItems(r.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [patientId])

  return (
    <div className="bg-white border-l border-gray-200 w-60 flex-shrink-0 overflow-y-auto">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <strong className="text-xs uppercase tracking-wide text-gray-600">Lịch sử khám</strong>
        <span className="text-xs text-gray-400">{items.length}</span>
      </div>
      {loading ? (
        <div className="text-center text-xs text-gray-400 py-6">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-6">Không có ca chụp nào trước đây</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map(it => {
            const isCurrent = it._id === currentStudyId
            return (
              <li key={it._id}>
                <button
                  onClick={() => !isCurrent && onOpenPrior(it)}
                  disabled={isCurrent}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    isCurrent ? 'bg-blue-50' : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${isCurrent ? 'text-blue-700' : 'text-gray-700'}`}>{fmtDate(it.studyDate)}</span>
                    <span className="text-[10px] font-mono text-gray-500">{it.modality}</span>
                  </div>
                  <div className="text-gray-500 mt-0.5 truncate">{it.bodyPart || '—'}</div>
                  {it.reportImpression && <div className="text-gray-400 text-[10px] mt-1 line-clamp-2">{it.reportImpression}</div>}
                  {isCurrent && <div className="text-[10px] text-blue-500 mt-1">▸ Đang xem</div>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SignerPanel({ report, study, onSigned }) {
  const { auth } = useAuth()
  const [signers, setSigners] = useState([])
  const [techSigner, setTechSigner] = useState('')
  const [busy, setBusy] = useState(false)
  const [showRadiologistPicker, setShowRadiologistPicker] = useState(false)

  const loadSigners = () => {
    api.get('/signers').then(r => setSigners(r.data || [])).catch(() => {})
  }
  useEffect(loadSigners, [])

  const radiologists = signers.filter(s => s.role === 'bacsi' || s.role === 'admin' || s.role === 'truongphong')
  const technicians = signers.filter(s => s.role === 'nhanvien' || s.role === 'truongphong')

  // Keyboard shortcuts: Alt+1 (radiologist sign), Alt+2 (tech sign)
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return
      if (e.key === '1') { e.preventDefault(); signAs('radiologist', auth.username) }
      if (e.key === '2') { e.preventDefault(); if (techSigner) signAs('technician', techSigner) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [techSigner, auth, report])

  const signAs = async (kind, signerId) => {
    if (!report?._id) { alert('Chưa có kết quả — lưu trước khi ký'); return }
    setBusy(true)
    try {
      await api.post(`/reports/${report._id}/sign`, { kind, signerId })
      onSigned?.()
    } catch (e) { alert('Lỗi ký: ' + (e.response?.data?.error || e.message)) }
    setBusy(false)
  }

  return (
    <div className="grid grid-cols-2 gap-4 mt-3">
      <SignBlock
        title="Người ký (Alt+1)"
        signerName={report?.radiologistName}
        signedAt={report?.finalizedAt}
        signatureUrl={report?.radiologistSignatureUrl || signers.find(s => s.username === auth.username)?.signatureUrl}
        onSign={() => signAs('radiologist', auth.username)}
        busy={busy}
        uploadTargetUsername={auth.username}
        onUploaded={() => { loadSigners(); onSigned?.() }}
        picker={
          <select defaultValue={auth.username} onChange={(e) => signAs('radiologist', e.target.value)} className="border rounded px-2 py-1 text-xs flex-1">
            <option value={auth.username}>Tôi: {auth.displayName}</option>
            {radiologists.filter(r => r.username !== auth.username).map(r => (
              <option key={r.username} value={r.username}>{r.displayName}{!r.hasSignature ? ' (chưa có chữ ký)' : ''}</option>
            ))}
          </select>
        }
      />
      <SignBlock
        title="Kỹ thuật viên (Alt+2)"
        signerName={report?.technicianSignerName}
        signedAt={report?.technicianSignedAt}
        signatureUrl={report?.technicianSignatureUrl || signers.find(s => s.username === techSigner)?.signatureUrl}
        onSign={() => techSigner && signAs('technician', techSigner)}
        busy={busy}
        uploadTargetUsername={techSigner || null}
        onUploaded={() => { loadSigners(); onSigned?.() }}
        picker={
          <select value={techSigner} onChange={(e) => setTechSigner(e.target.value)} className="border rounded px-2 py-1 text-xs flex-1">
            <option value="">— Chọn KTV —</option>
            {technicians.map(t => (
              <option key={t.username} value={t.username}>{t.displayName}{!t.hasSignature ? ' (chưa có chữ ký)' : ''}</option>
            ))}
          </select>
        }
      />
    </div>
  )
}

function SignBlock({ title, signerName, signedAt, signatureUrl, onSign, busy, picker, uploadTargetUsername, onUploaded }) {
  const isSigned = !!signedAt
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    if (file.size > 150_000) {
      alert('Ảnh quá lớn (>150KB). Vui lòng dùng ảnh PNG/JPG nhỏ hơn.')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      setUploading(true)
      try {
        await api.post(`/users/${uploadTargetUsername}/signature`, { signatureUrl: dataUrl })
        onUploaded?.()
      } catch (e) { alert('Lỗi upload: ' + (e.response?.data?.error || e.message)) }
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className={`border rounded-lg p-3 ${isSigned ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <strong className="text-xs uppercase tracking-wide text-gray-600">{title}</strong>
        {isSigned && <span className="text-xs text-green-700">✓ {fmtDateTime(signedAt)}</span>}
      </div>
      <div className="h-16 mb-2 flex items-center justify-center bg-white border border-dashed border-gray-300 rounded relative group">
        {signatureUrl ? (
          <img src={signatureUrl} alt="signature" className="max-h-full max-w-full object-contain" />
        ) : isSigned ? (
          <span className="italic font-serif text-xl text-gray-800 leading-none">{signerName || '—'}</span>
        ) : (
          <span className="text-xs text-gray-400">Chưa ký</span>
        )}
        {uploadTargetUsername && (
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute top-0.5 right-0.5 text-[10px] bg-white/80 hover:bg-white border rounded px-1.5 py-0.5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            title={`Upload ảnh chữ ký cho ${uploadTargetUsername} (tuỳ chọn)`}
          >
            {uploading ? '…' : '📤 Ảnh'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} />
      </div>
      <div className="text-xs text-gray-700 mb-1">{signerName || '—'}</div>
      {!isSigned && (
        <div className="text-[10px] text-gray-400 mb-2">Bấm "Ký" để ký bằng tên · tuỳ chọn upload ảnh chữ ký</div>
      )}
      <div className="flex gap-2 items-center">
        {picker}
        <button
          onClick={onSign}
          disabled={busy}
          className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-3 py-1 rounded"
        >
          {busy ? '…' : (isSigned ? 'Ký lại' : 'Ký')}
        </button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────
// Main: Patient Detail View
// ───────────────────────────────────────────────────────────
function ConsumablesPanel({ study, onRefresh }) {
  const { auth } = useAuth()
  const role = auth?.role
  const canEdit = !study.consumablesDeductedAt && (role === 'nhanvien' || role === 'admin')
  const [rows, setRows] = useState(study.consumables || [])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    setRows(study.consumables || [])
  }, [study._id, study.consumables])

  const mergeStandard = async () => {
    setLoading(true)
    try {
      const r = await api.get(`/ris/studies/${study._id}/consumables-standard`)
      const standard = r.data || []
      setRows(prev => {
        const existing = new Map(prev.map(x => [x.supplyId, x]))
        const out = []
        for (const s of standard) {
          const cur = existing.get(s.supplyId)
          if (cur) {
            out.push({ ...cur, standardQty: s.standardQty })
          } else {
            out.push({ ...s, actualQty: s.standardQty, notes: '' })
          }
        }
        // Keep any previously-saved rows not in the latest standard
        for (const [id, cur] of existing) {
          if (!standard.find(s => s.supplyId === id)) out.push(cur)
        }
        return out
      })
    } catch (e) {
      alert(e.response?.data?.error || 'Không tải được định mức')
    } finally { setLoading(false) }
  }

  // Auto-prefill on first open if no consumables saved yet
  useEffect(() => {
    if (canEdit && (!study.consumables || study.consumables.length === 0)) {
      mergeStandard()
    }
  }, [study._id])

  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/ris/studies/${study._id}/consumables`, { consumables: rows })
      onRefresh?.()
    } catch (e) {
      alert(e.response?.data?.error || 'Lỗi lưu vật tư')
    } finally { setSaving(false) }
  }

  const updateRow = (idx, patch) => setRows(rs => rs.map((r, i) => i === idx ? { ...r, ...patch } : r))
  const removeRow = (idx) => setRows(rs => rs.filter((_, i) => i !== idx))

  const hasDiff = rows.some(r => Number(r.actualQty) !== Number(r.standardQty))

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setExpanded(x => !x)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-blue-600">
          <span className="text-xs text-gray-400 w-3">{expanded ? '▾' : '▸'}</span>
          Vật tư tiêu hao
          {study.consumablesDeductedAt && (
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-normal">
              ✓ Đã xuất kho · {fmtDateTime(study.consumablesDeductedAt)}
            </span>
          )}
          {!study.consumablesDeductedAt && rows.length > 0 && hasDiff && (
            <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-normal">
              Có điều chỉnh
            </span>
          )}
        </button>
        {expanded && canEdit && (
          <button onClick={mergeStandard} disabled={loading}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50">
            {loading ? 'Đang tải…' : 'Lấy định mức'}
          </button>
        )}
      </div>
      {expanded && (
        <>
          {rows.length === 0 ? (
            <div className="text-sm text-gray-400 py-3 text-center">
              {canEdit ? 'Chưa có định mức cho ca này.' : 'Chưa ghi nhận vật tư.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold">Mã</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Tên vật tư</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Đơn vị</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Định mức</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Thực tế</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Ghi chú</th>
                    {canEdit && <th className="px-2 py-1.5"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, idx) => {
                    const diff = Number(r.actualQty) !== Number(r.standardQty)
                    return (
                      <tr key={`${r.supplyId}-${idx}`}>
                        <td className="px-2 py-1 font-mono text-gray-500">{r.supplyCode}</td>
                        <td className="px-2 py-1">{r.supplyName}</td>
                        <td className="px-2 py-1 text-gray-500">{r.unit}</td>
                        <td className="px-2 py-1 text-right text-gray-500">{r.standardQty}</td>
                        <td className="px-2 py-1 text-right">
                          {canEdit ? (
                            <input type="number" min="0" step="any" value={r.actualQty ?? 0}
                              onChange={e => updateRow(idx, { actualQty: Number(e.target.value) || 0 })}
                              className={`w-20 text-right border rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-blue-50 ${
                                diff ? 'border-orange-300 bg-orange-50 focus:border-orange-400' : 'border-gray-200 focus:border-blue-400'
                              }`} />
                          ) : (
                            <span className={diff ? 'text-orange-700 font-medium' : ''}>{r.actualQty}</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {canEdit ? (
                            <input type="text" value={r.notes || ''}
                              onChange={e => updateRow(idx, { notes: e.target.value })}
                              className="w-full border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                          ) : (
                            <span className="text-gray-600">{r.notes}</span>
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-2 py-1 text-right">
                            <button onClick={() => removeRow(idx)}
                              className="text-red-400 hover:text-red-600" title="Xoá dòng">✕</button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {canEdit && rows.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Tự động xuất kho khi chuyển trạng thái sang "Chờ kết quả".
              </p>
              <button onClick={save} disabled={saving}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-lg font-medium">
                {saving ? 'Đang lưu…' : 'Lưu vật tư'}
              </button>
            </div>
          )}
          {!canEdit && !study.consumablesDeductedAt && rows.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">Chỉ KTV hoặc admin được chỉnh sửa.</p>
          )}
        </>
      )}
    </div>
  )
}

export default function PatientDetailView({ study, onRefresh, onOpenCase, showConsumables = true }) {
  const { auth } = useAuth()
  const [report, setReport] = useState(null)
  const [form, setForm] = useState({ technique: '', clinicalInfo: '', findings: '', impression: '', recommendation: '', criticalFinding: false, criticalNote: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState([])

  const loadReport = async () => {
    setLoading(true)
    try {
      const r = await api.get(`/ris/reports/${study._id}`).catch(() => ({ data: null }))
      if (r.data) {
        setReport(r.data)
        setForm({
          technique:        r.data.technique || techniqueStarter(study),
          clinicalInfo:     r.data.clinicalInfo || study.clinicalInfo || '',
          findings:         r.data.findings || '',
          impression:       r.data.impression || '',
          recommendation:   r.data.recommendation || '',
          criticalFinding:  !!r.data.criticalFinding,
          criticalNote:     r.data.criticalNote || '',
        })
      } else {
        setForm(f => ({
          ...f,
          technique: f.technique || techniqueStarter(study),
          clinicalInfo: study.clinicalInfo || '',
        }))
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { loadReport() }, [study._id])

  useEffect(() => {
    api.get('/templates', { params: { modality: study.modality, bodyPart: study.bodyPart } })
      .then(r => setTemplates(r.data || []))
      .catch(() => setTemplates([]))
  }, [study.modality, study.bodyPart])

  const save = async (status) => {
    setSaving(true)
    try {
      const r = await api.post('/ris/reports', { studyId: study._id, studyUID: study.studyUID, ...form, status })
      setReport(r.data)
      onRefresh?.()
    } finally { setSaving(false) }
  }

  const applyTemplate = async (t) => {
    if (!t) return
    if ((form.findings || form.impression) && !confirm('Áp dụng mẫu sẽ ghi đè nội dung đang có. Tiếp tục?')) return
    setForm(f => ({
      ...f,
      technique: t.technique || f.technique,
      clinicalInfo: t.clinicalInfo || f.clinicalInfo,
      findings: t.findings || f.findings,
      impression: t.impression || f.impression,
      recommendation: t.recommendation || f.recommendation,
    }))
    try { await api.post(`/templates/${t._id}/use`) } catch {}
  }

  const onReceive = async () => {
    try {
      await api.post(`/ris/studies/${study._id}/pick`)
      onRefresh?.()
    } catch (e) {
      alert(e.response?.data?.error || 'Không nhận được ca')
      onRefresh?.()
    }
  }

  const onViewImages = async (v1) => {
    try {
      const r = await api.get(`/ris/orthanc/viewer-url/${study.studyUID}`)
      window.open(r.data.url, '_blank', 'noopener,noreferrer')
    } catch (e) { alert('Chưa có ảnh DICOM') }
  }

  const onField = (name) => (e) => setForm(f => ({ ...f, [name]: e.target.value }))

  return (
    <div className="flex flex-1 overflow-hidden bg-gray-50">
      <div className="flex-1 flex flex-col overflow-hidden">
        <ActionToolbar study={study} report={report} onReceive={onReceive} onViewImages={onViewImages} />
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <PatientSummaryCard study={study} />
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Kết quả chẩn đoán — {(study.bodyPart || study.modality || '').toUpperCase()}</h2>
            {templates.length > 0 && (
              <div className="mb-3 bg-blue-50 border border-blue-200 rounded p-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-700">📋 Mẫu kết quả:</span>
                <select onChange={e => { applyTemplate(templates.find(t => t._id === e.target.value)); e.target.value = '' }}
                  className="flex-1 border border-blue-300 rounded px-2 py-1 text-xs bg-white" defaultValue="">
                  <option value="">Chọn mẫu để áp dụng nhanh ({templates.length})</option>
                  {templates.map(t => (<option key={t._id} value={t._id}>{t.name}</option>))}
                </select>
              </div>
            )}
            {loading ? (
              <div className="text-center py-8 text-gray-400 text-sm">Đang tải...</div>
            ) : (
              <div className="space-y-3">
                <ReportField label="Kỹ thuật chụp"             value={form.technique}      onChange={onField('technique')}      rows={2} />
                <ReportField label="Thông tin lâm sàng"        value={form.clinicalInfo}   onChange={onField('clinicalInfo')}   rows={2} />
                <ReportField label="Mô tả hình ảnh (Findings)" value={form.findings}       onChange={onField('findings')}       rows={5} />
                <ReportField label="Kết luận (Impression)"     value={form.impression}     onChange={onField('impression')}     rows={3} />
                <ReportField label="Đề nghị (Recommendation)"  value={form.recommendation} onChange={onField('recommendation')} rows={2} />
                <div className={`rounded-lg p-3 border ${form.criticalFinding ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={!!form.criticalFinding}
                      onChange={e => setForm(f => ({ ...f, criticalFinding: e.target.checked }))} />
                    ⚠ Phát hiện nghiêm trọng — cần thông báo khẩn
                  </label>
                  {form.criticalFinding && (
                    <textarea rows={2} value={form.criticalNote}
                      onChange={e => setForm(f => ({ ...f, criticalNote: e.target.value }))}
                      placeholder="Mô tả ngắn gọn (sẽ gửi tới admin/giám đốc/trưởng phòng)"
                      className="w-full mt-2 border border-red-200 rounded px-2 py-1 text-sm" />
                  )}
                </div>

                <SignerPanel report={report} study={study} onSigned={loadReport} />

                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <button onClick={() => save('preliminary')} disabled={saving}
                    className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm px-4 py-2 rounded-lg">
                    Lưu tạm
                  </button>
                  <button onClick={() => save('final')} disabled={saving || !form.findings.trim() || !form.impression.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
                    {saving ? 'Đang lưu...' : 'Lưu & Hoàn tất'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {showConsumables && <ConsumablesPanel study={study} onRefresh={onRefresh} />}
        </div>
      </div>
      <HistoryRail
        patientId={study.patientId}
        currentStudyId={study._id}
        onOpenPrior={(it) => {
          // Construct a study-shaped object: prior exam fields + current patient bio
          // (patient identity is the same; only exam-level fields differ)
          const priorAsStudy = {
            _id:           it._id,
            studyUID:      it.studyUID,
            studyDate:     it.studyDate,
            modality:      it.modality,
            bodyPart:      it.bodyPart,
            site:          it.site,
            status:        it.status,
            radiologistName: it.radiologistName,
            // Inherit patient bio from current case
            patientId:     study.patientId,
            patientName:   study.patientName,
            dob:           study.dob,
            gender:        study.gender,
            clinicalInfo:  '',  // older case may have its own; load from report on open
            priority:      'routine',
          }
          onOpenCase?.(priorAsStudy)
        }}
      />
    </div>
  )
}
