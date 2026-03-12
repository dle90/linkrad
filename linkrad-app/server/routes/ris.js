const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
const Study = require('../models/Study')
const { requireAuth } = require('../middleware/auth')

// Helper: generate a fake DICOM-style Study UID
function genStudyUID() {
  return `1.2.840.10008.5.1.4.1.1.2.${Date.now()}.${Math.floor(Math.random() * 100000)}`
}

// Helper: build a base Mongoose query filter based on user role
function buildSiteFilter(user) {
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

    const study = new Study({
      _id: uuidv4(),
      studyUID: genStudyUID(),
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
        'status', 'verifiedAt', 'patientName', 'patientId', 'dob', 'gender',
        'modality', 'bodyPart', 'clinicalInfo', 'site', 'scheduledDate', 'studyDate',
        'priority', 'technician', 'technicianName', 'radiologist', 'radiologistName',
        'reportText', 'reportedAt',
      ]
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field]
        }
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

module.exports = router
