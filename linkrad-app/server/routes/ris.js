const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const Study = require('../models/Study')
const Report = require('../models/Report')
const User = require('../models/User')
const StudyAnnotation = require('../models/StudyAnnotation')
const KeyImage = require('../models/KeyImage')
const { requireAuth } = require('../middleware/auth')

const ORTHANC_BASE = process.env.ORTHANC_URL || 'http://localhost:8042'
// Public URL the browser uses to open the OHIF viewer
const _rawOhif = process.env.OHIF_URL || 'http://localhost:3000'
const OHIF_PUBLIC = _rawOhif.startsWith('http') ? _rawOhif : `https://${_rawOhif}`

// Helper: generate a fake DICOM-style Study UID
function genStudyUID() {
  return `1.2.840.10008.5.1.4.1.1.2.${Date.now()}.${Math.floor(Math.random() * 100000)}`
}

// Helper: build a base Mongoose query filter based on user role
function buildSiteFilter(user) {
  if (user.role === 'bacsi') {
    return { radiologist: user.username }
  }
  if (user.role === 'nhanvien' || user.role === 'truongphong') {
    return { site: user.department }
  }
  // giamdoc, admin: all sites
  return {}
}

// GET /studies
router.get('/studies', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'guest') {
      return res.status(403).json({ error: 'Không có quyền truy cập' })
    }

    const filter = buildSiteFilter(req.user)

    // Optional query param filters
    if (req.query.site && (req.user.role === 'admin' || req.user.role === 'giamdoc')) {
      filter.site = req.query.site
    }
    if (req.query.modality) {
      filter.modality = req.query.modality
    }
    if (req.query.status) {
      filter.status = req.query.status
    }
    if (req.query.date) {
      // Filter by studyDate prefix, e.g. "2026-03"
      filter.studyDate = { $regex: `^${req.query.date}` }
    }

    const studies = await Study.find(filter).sort({ scheduledDate: -1 })
    res.json(studies)
  } catch (err) {
    console.error('GET /studies error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// GET /stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'guest') {
      return res.status(403).json({ error: 'Không có quyền truy cập' })
    }

    const baseFilter = buildSiteFilter(req.user)
    const studies = await Study.find(baseFilter)

    const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"

    const byModality = { CT: 0, MRI: 0, XR: 0, US: 0 }
    const byStatus = { scheduled: 0, in_progress: 0, pending_read: 0, reported: 0, verified: 0 }
    const bySite = {}
    let todayTotal = 0
    let urgentPending = 0

    for (const s of studies) {
      // byModality
      if (s.modality && byModality[s.modality] !== undefined) {
        byModality[s.modality]++
      }
      // byStatus
      if (s.status && byStatus[s.status] !== undefined) {
        byStatus[s.status]++
      }
      // bySite
      if (s.site) {
        bySite[s.site] = (bySite[s.site] || 0) + 1
      }
      // todayTotal: studies whose studyDate matches today
      if (s.studyDate && s.studyDate.startsWith(today)) {
        todayTotal++
      }
      // urgentPending: urgent/stat studies that are pending_read
      if (
        s.status === 'pending_read' &&
        (s.priority === 'urgent' || s.priority === 'stat')
      ) {
        urgentPending++
      }
    }

    res.json({
      total: studies.length,
      byModality,
      byStatus,
      bySite,
      pendingRead: byStatus.pending_read,
      todayTotal,
      urgentPending,
    })
  } catch (err) {
    console.error('GET /stats error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// POST /studies
router.post('/studies', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'truongphong' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Không có quyền tạo ca chụp' })
    }

    const {
      patientName,
      patientId,
      dob,
      gender,
      modality,
      bodyPart,
      clinicalInfo,
      site,
      scheduledDate,
      priority,
    } = req.body

    const now = new Date().toISOString()

    const uid = genStudyUID()
    const study = new Study({
      _id: uid,
      studyUID: uid,
      patientName,
      patientId,
      dob,
      gender,
      modality,
      bodyPart,
      clinicalInfo,
      site,
      scheduledDate,
      priority: priority || 'routine',
      status: 'scheduled',
      reportText: '',
      createdAt: now,
      updatedAt: now,
    })

    await study.save()
    res.status(201).json(study)
  } catch (err) {
    console.error('POST /studies error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// PUT /studies/:id
router.put('/studies/:id', requireAuth, async (req, res) => {
  try {
    const study = await Study.findById(req.params.id)
    if (!study) {
      return res.status(404).json({ error: 'Không tìm thấy ca chụp' })
    }

    const role = req.user.role
    const body = req.body
    const now = new Date().toISOString()
    const updates = { updatedAt: now }

    if (role === 'nhanvien') {
      // Can set status to in_progress or pending_read, studyDate, technician/technicianName
      if (body.status !== undefined) {
        if (body.status !== 'in_progress' && body.status !== 'pending_read') {
          return res.status(403).json({ error: 'Nhanvien chỉ được cập nhật trạng thái in_progress hoặc pending_read' })
        }
        updates.status = body.status
      }
      if (body.studyDate !== undefined) updates.studyDate = body.studyDate
      if (body.technician !== undefined) updates.technician = body.technician
      if (body.technicianName !== undefined) updates.technicianName = body.technicianName

    } else if (role === 'truongphong') {
      // Can add reportText, set status to 'reported', set radiologist/radiologistName, reportedAt
      if (body.status !== undefined) {
        if (body.status !== 'reported') {
          return res.status(403).json({ error: 'Truongphong chỉ được cập nhật trạng thái reported' })
        }
        updates.status = body.status
      }
      if (body.reportText !== undefined) updates.reportText = body.reportText
      if (body.radiologist !== undefined) updates.radiologist = body.radiologist
      if (body.radiologistName !== undefined) updates.radiologistName = body.radiologistName
      if (body.reportedAt !== undefined) updates.reportedAt = body.reportedAt

    } else if (role === 'admin' || role === 'giamdoc') {
      // Can set any field
      const allowedFields = [
        'status', 'teleradStatus', 'verifiedAt', 'patientName', 'patientId', 'dob', 'gender',
        'modality', 'bodyPart', 'clinicalInfo', 'site', 'scheduledDate', 'studyDate',
        'priority', 'technician', 'technicianName', 'radiologist', 'radiologistName',
        'reportText', 'reportedAt', 'imageStatus', 'imageCount', 'studyUID',
      ]
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field]
        }
      }
    } else if (role === 'bacsi') {
      // Bacsi can only update studies assigned to them
      if (study.radiologist !== req.user.username) {
        return res.status(403).json({ error: 'Ca chụp không được giao cho bạn' })
      }
      if (body.teleradStatus !== undefined) {
        if (!['reading', 'reported'].includes(body.teleradStatus)) {
          return res.status(403).json({ error: 'Bác sĩ chỉ được cập nhật teleradStatus reading hoặc reported' })
        }
        updates.teleradStatus = body.teleradStatus
        if (body.teleradStatus === 'reported') {
          updates.status = 'reported'
        }
      } else if (body.status !== undefined) {
        if (!['reading', 'reported'].includes(body.status)) {
          return res.status(403).json({ error: 'Bác sĩ chỉ được cập nhật trạng thái reading hoặc reported' })
        }
        updates.status = body.status
      }
    } else {
      return res.status(403).json({ error: 'Không có quyền cập nhật ca chụp' })
    }

    const updated = await Study.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    )

    res.json(updated)
  } catch (err) {
    console.error('PUT /studies/:id error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// GET /radiologists — list all bacsi users for assignment dropdown
router.get('/radiologists', requireAuth, async (req, res) => {
  try {
    const users = await User.find({ role: 'bacsi' }).select('_id displayName department')
    res.json(users.map(u => ({ username: u._id, displayName: u.displayName || u._id, department: u.department })))
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// POST /studies/:id/request-telerad — NV cơ sở gửi yêu cầu đọc phim
router.post('/studies/:id/request-telerad', requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString()
    const updated = await Study.findByIdAndUpdate(
      req.params.id,
      { $set: { teleradStatus: 'pending', teleradRequested: true, teleradRequestedAt: now, teleradRequestedBy: req.user.username, updatedAt: now } },
      { new: true }
    )
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy ca chụp' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// POST /studies/:id/assign — admin nền tảng phân công BS đọc phim
router.post('/studies/:id/assign', requireAuth, async (req, res) => {
  try {
    const role = req.user.role
    if (role !== 'admin' && role !== 'truongphong') {
      return res.status(403).json({ error: 'Không có quyền phân công' })
    }
    const { radiologistId, radiologistName } = req.body
    const now = new Date().toISOString()
    const study = await Study.findById(req.params.id)
    if (!study) return res.status(404).json({ error: 'Không tìm thấy ca chụp' })
    // Determine next status based on current
    const setFields = { radiologist: radiologistId, radiologistName, assignedAt: now, updatedAt: now }
    if (study.teleradRequested) {
      setFields.teleradStatus = 'assigned'
    } else {
      setFields.status = 'pending_read'
    }
    const updated = await Study.findByIdAndUpdate(
      req.params.id,
      { $set: setFields },
      { new: true }
    )
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// GET /reports/:studyId — get report for a study
router.get('/reports/:studyId', requireAuth, async (req, res) => {
  try {
    const report = await Report.findOne({ studyId: req.params.studyId })
    if (!report) return res.status(404).json({ error: 'Chưa có kết quả' })
    res.json(report)
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// POST /reports — create or update report for a study
router.post('/reports', requireAuth, async (req, res) => {
  try {
    const role = req.user.role
    if (role !== 'bacsi' && role !== 'admin' && role !== 'truongphong') {
      return res.status(403).json({ error: 'Không có quyền viết kết quả' })
    }
    const { studyId, studyUID, technique, clinicalInfo, findings, impression, recommendation, status, criticalFinding, criticalNote, templateUsedId } = req.body
    const now = new Date().toISOString()

    let report = await Report.findOne({ studyId })
    const wasCritical = report && report.criticalFinding
    if (report) {
      report.technique = technique ?? report.technique
      report.clinicalInfo = clinicalInfo ?? report.clinicalInfo
      report.findings = findings ?? report.findings
      report.impression = impression ?? report.impression
      report.recommendation = recommendation ?? report.recommendation
      if (criticalFinding !== undefined) report.criticalFinding = !!criticalFinding
      if (criticalNote !== undefined) report.criticalNote = criticalNote
      if (templateUsedId !== undefined) report.templateUsedId = templateUsedId
      report.updatedAt = now
      if (status) report.status = status
      if (status === 'final') report.finalizedAt = now
      await report.save()
    } else {
      report = await Report.create({
        studyId, studyUID,
        radiologistId: req.user.username,
        radiologistName: req.user.displayName || req.user.username,
        technique: technique || '', clinicalInfo: clinicalInfo || '',
        findings: findings || '', impression: impression || '',
        recommendation: recommendation || '',
        criticalFinding: !!criticalFinding,
        criticalNote: criticalNote || '',
        templateUsedId: templateUsedId || '',
        status: status || 'draft',
        createdAt: now, updatedAt: now,
        finalizedAt: status === 'final' ? now : null,
      })
    }

    // Critical-finding notification: fire when newly flagged or first set on creation
    if (report.criticalFinding && !wasCritical) {
      try {
        const Notification = require('../models/Notification')
        const studyForNotif = await Study.findById(studyId).lean()
        await Notification.create({
          ts: now,
          type: 'critical_finding',
          severity: 'critical',
          title: `⚠ Phát hiện nghiêm trọng — ${studyForNotif?.patientName || studyId}`,
          message: criticalNote || `${studyForNotif?.modality || ''} ${studyForNotif?.bodyPart || ''} — BS: ${req.user.displayName || req.user.username}`,
          toRoles: ['admin', 'giamdoc', 'truongphong'],
          toSites: studyForNotif?.site ? [studyForNotif.site] : [],
          resource: 'report',
          resourceId: String(report._id),
          createdBy: req.user.username,
          createdAt: now,
        })
      } catch (e) { console.warn('[critical notify]', e.message) }
    }

    // Sync study status — if telerad case, update teleradStatus instead of status
    const studyDoc = await Study.findById(studyId)
    if (studyDoc && studyDoc.teleradRequested) {
      const teleradSt = status === 'final' ? 'reported' : 'reading'
      const setObj = { teleradStatus: teleradSt, reportId: String(report._id), updatedAt: now }
      if (status === 'final') {
        setObj.status = 'reported'
        setObj.reportedAt = now
      }
      await Study.findByIdAndUpdate(studyId, { $set: setObj })
    } else {
      const studyStatus = status === 'final' ? 'reported' : 'reading'
      await Study.findByIdAndUpdate(studyId, {
        $set: { status: studyStatus, reportId: String(report._id), updatedAt: now,
                ...(status === 'final' ? { reportedAt: now } : {}) }
      })
    }

    res.json(report)
  } catch (err) {
    console.error('POST /reports error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// GET /orthanc/studies — proxy list of studies from Orthanc
router.get('/orthanc/studies', requireAuth, async (req, res) => {
  try {
    const response = await fetch(`${ORTHANC_BASE}/studies?expand`)
    if (!response.ok) return res.status(response.status).json({ error: 'Orthanc error' })
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(503).json({ error: 'Orthanc không kết nối được', detail: err.message })
  }
})

// GET /orthanc/viewer-url/:studyUID — resolve StudyInstanceUID → OHIF viewer URL
router.get('/orthanc/viewer-url/:studyUID', requireAuth, async (req, res) => {
  try {
    const uid = req.params.studyUID
    // Query Orthanc for the study with this UID
    const response = await fetch(`${ORTHANC_BASE}/studies?StudyInstanceUID=${encodeURIComponent(uid)}`)
    if (!response.ok) return res.status(502).json({ error: 'Orthanc error' })
    const ids = await response.json()
    if (!ids || ids.length === 0) {
      return res.json({ url: `${OHIF_PUBLIC}/`, found: false })
    }
    const orthancId = ids[0]
    const viewerUrl = `${OHIF_PUBLIC}/viewer?StudyInstanceUIDs=${encodeURIComponent(uid)}`
    res.json({ url: viewerUrl, orthancId, found: true })
  } catch (err) {
    res.json({ url: `${OHIF_PUBLIC}/`, found: false, error: err.message })
  }
})

// GET /orthanc/status — check if Orthanc is reachable
router.get('/orthanc/status', requireAuth, async (req, res) => {
  try {
    const response = await fetch(`${ORTHANC_BASE}/system`)
    if (!response.ok) return res.status(response.status).json({ online: false })
    const data = await response.json()
    res.json({ online: true, version: data.Version, dicomAet: data.DicomAet })
  } catch (err) {
    res.json({ online: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════════
// MEASUREMENT PERSISTENCE (annotations)
// ═══════════════════════════════════════════════════════

// GET /annotations/:studyId — load saved measurements
router.get('/annotations/:studyId', requireAuth, async (req, res) => {
  try {
    const ann = await StudyAnnotation.findOne({ studyId: req.params.studyId }).lean()
    if (!ann) return res.json({ measurements: null })
    res.json(ann)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /annotations — save measurements for a study
router.post('/annotations', requireAuth, async (req, res) => {
  try {
    const { studyId, studyUID, measurements, measurementCount } = req.body
    if (!studyId) return res.status(400).json({ error: 'studyId required' })

    const now = new Date().toISOString()
    const ann = await StudyAnnotation.findOneAndUpdate(
      { studyId },
      {
        $setOnInsert: { _id: crypto.randomUUID(), studyId, studyUID: studyUID || '', createdAt: now },
        $set: {
          measurements: typeof measurements === 'string' ? measurements : JSON.stringify(measurements),
          measurementCount: measurementCount || 0,
          savedBy: req.user.username,
          savedByName: req.user.displayName,
          updatedAt: now,
        },
      },
      { upsert: true, new: true }
    )
    res.json({ ok: true, annotation: ann })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════
// KEY IMAGE FLAGGING
// ═══════════════════════════════════════════════════════

// GET /key-images/:studyId — list key images for a study
router.get('/key-images/:studyId', requireAuth, async (req, res) => {
  try {
    const images = await KeyImage.find({ studyId: req.params.studyId }).sort({ createdAt: 1 }).lean()
    res.json(images)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /key-images — flag a key image
router.post('/key-images', requireAuth, async (req, res) => {
  try {
    const { studyId, studyUID, seriesUID, instanceUID, frameNumber, description } = req.body
    if (!studyId) return res.status(400).json({ error: 'studyId required' })

    const ki = new KeyImage({
      _id: crypto.randomUUID(),
      studyId, studyUID: studyUID || '',
      seriesUID: seriesUID || '', instanceUID: instanceUID || '',
      frameNumber: frameNumber || 0,
      description: description || '',
      flaggedBy: req.user.username,
      flaggedByName: req.user.displayName,
      createdAt: new Date().toISOString(),
    })
    await ki.save()
    res.status(201).json({ ok: true, keyImage: ki.toObject() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /key-images/:id — unflag a key image
router.delete('/key-images/:id', requireAuth, async (req, res) => {
  try {
    await KeyImage.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════
// PRIOR STUDY COMPARISON
// ═══════════════════════════════════════════════════════

// GET /priors/:patientId — find prior studies for comparison
router.get('/priors/:patientId', requireAuth, async (req, res) => {
  try {
    const { modality, excludeStudyId } = req.query
    const filter = { patientId: req.params.patientId }
    if (modality) filter.modality = modality
    if (excludeStudyId) filter._id = { $ne: excludeStudyId }
    // Only studies that have been reported/verified and have images
    filter.status = { $in: ['reported', 'verified'] }

    const priors = await Study.find(filter)
      .sort({ studyDate: -1, createdAt: -1 })
      .limit(10)
      .lean()

    res.json(priors)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /compare-url — generate OHIF URL for multi-study comparison
router.get('/compare-url', requireAuth, async (req, res) => {
  try {
    const { studyUIDs } = req.query // comma-separated UIDs
    if (!studyUIDs) return res.status(400).json({ error: 'studyUIDs required' })

    const uids = studyUIDs.split(',').map(u => u.trim()).filter(Boolean)
    // OHIF supports multiple StudyInstanceUIDs as comma-separated
    const viewerUrl = `${OHIF_PUBLIC}/viewer?StudyInstanceUIDs=${uids.map(u => encodeURIComponent(u)).join(',')}`
    res.json({ url: viewerUrl, count: uids.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════
// DICOM UPLOAD PROXY
// ═══════════════════════════════════════════════════════

// POST /orthanc/upload — proxy DICOM file upload to Orthanc
router.post('/orthanc/upload', requireAuth, async (req, res) => {
  try {
    // Forward the raw body to Orthanc's /instances endpoint
    const chunks = []
    for await (const chunk of req) { chunks.push(chunk) }
    const body = Buffer.concat(chunks)

    const response = await fetch(`${ORTHANC_BASE}/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/dicom' },
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({ error: 'Orthanc upload failed', detail: text })
    }

    const data = await response.json()
    res.json({ ok: true, ...data })
  } catch (err) {
    res.status(503).json({ error: 'Không thể upload lên Orthanc', detail: err.message })
  }
})

// POST /orthanc/upload-zip — proxy ZIP file upload to Orthanc
router.post('/orthanc/upload-zip', requireAuth, async (req, res) => {
  try {
    const chunks = []
    for await (const chunk of req) { chunks.push(chunk) }
    const body = Buffer.concat(chunks)

    // Orthanc accepts ZIP uploads at /instances too
    const response = await fetch(`${ORTHANC_BASE}/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip' },
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({ error: 'Orthanc upload failed', detail: text })
    }

    const data = await response.json()
    res.json({ ok: true, ...data })
  } catch (err) {
    res.status(503).json({ error: 'Không thể upload lên Orthanc', detail: err.message })
  }
})

module.exports = router
