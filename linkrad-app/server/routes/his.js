const express = require('express')
const router = express.Router()
const Patient = require('../models/Patient')
const Appointment = require('../models/Appointment')
const Study = require('../models/Study')
const { requireAuth } = require('../middleware/auth')

// Helper: site filter based on role
function buildSiteFilter(user) {
  if (user.role === 'nhanvien' || user.role === 'truongphong') {
    return { site: user.department }
  }
  return {} // giamdoc, admin, bacsi: all sites
}

// Generate IDs
function genPatientId() {
  const d = new Date()
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '')
  return `BN-${ymd}-${Math.floor(Math.random() * 9000) + 1000}`
}

function genAppointmentId() {
  return `APT-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function now() {
  return new Date().toISOString()
}

// ─── PATIENTS ────────────────────────────────────────────────────────────────

// GET /his/patients?q=&site=&limit=
router.get('/patients', requireAuth, async (req, res) => {
  try {
    const { q, site, limit = 50 } = req.query
    const filter = {}
    if (q) {
      const re = new RegExp(q, 'i')
      filter.$or = [{ name: re }, { patientId: re }, { phone: re }, { idCard: re }]
    }
    if (site) filter.registeredSite = site
    const patients = await Patient.find(filter).limit(Number(limit)).lean()
    res.json(patients)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /his/patients/:id
router.get('/patients/:id', requireAuth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).lean()
    if (!patient) return res.status(404).json({ error: 'Not found' })
    // fetch appointment history
    const appointments = await Appointment.find({ patientId: req.params.id })
      .sort({ scheduledAt: -1 }).limit(20).lean()
    res.json({ ...patient, appointments })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /his/patients
router.post('/patients', requireAuth, async (req, res) => {
  try {
    const { name, dob, gender, phone, address, idCard, insuranceNumber, notes } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const id = genPatientId()
    const patient = new Patient({
      _id: id,
      patientId: id,
      name, dob, gender, phone, address, idCard, insuranceNumber, notes,
      registeredSite: req.user.department || '',
      createdAt: now(),
      updatedAt: now(),
    })
    await patient.save()
    res.json(patient)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /his/patients/:id
router.put('/patients/:id', requireAuth, async (req, res) => {
  try {
    const allowed = ['name', 'dob', 'gender', 'phone', 'address', 'idCard', 'insuranceNumber', 'notes']
    const update = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k] })
    update.updatedAt = now()
    const patient = await Patient.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!patient) return res.status(404).json({ error: 'Not found' })
    res.json(patient)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

// GET /his/appointments?site=&date=YYYY-MM-DD&week=YYYY-MM-DD&status=
router.get('/appointments', requireAuth, async (req, res) => {
  try {
    const { site, date, week, status, patientId } = req.query
    const filter = { ...buildSiteFilter(req.user) }

    if (site && (req.user.role === 'admin' || req.user.role === 'giamdoc')) {
      filter.site = site
    }
    if (patientId) filter.patientId = patientId
    if (status) filter.status = status

    if (week) {
      // week = start date (Monday), fetch 7 days
      const start = new Date(week)
      const end = new Date(week)
      end.setDate(end.getDate() + 7)
      filter.scheduledAt = { $gte: start.toISOString(), $lt: end.toISOString() }
    } else if (date) {
      filter.scheduledAt = { $gte: `${date}T00:00:00`, $lt: `${date}T23:59:59` }
    }

    const appointments = await Appointment.find(filter)
      .sort({ scheduledAt: 1 }).lean()
    res.json(appointments)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /his/appointments
router.post('/appointments', requireAuth, async (req, res) => {
  try {
    const {
      patientId, patientName, dob, gender, phone,
      site, modality, room, scheduledAt, duration,
      referringDoctor, clinicalInfo, notes,
    } = req.body
    if (!site || !modality || !scheduledAt) {
      return res.status(400).json({ error: 'site, modality, scheduledAt required' })
    }
    const id = genAppointmentId()
    const appt = new Appointment({
      _id: id,
      patientId, patientName, dob, gender, phone,
      site, modality, room, scheduledAt,
      duration: duration || 30,
      status: 'scheduled',
      referringDoctor, clinicalInfo, notes,
      createdBy: req.user.username,
      createdAt: now(),
      updatedAt: now(),
    })
    await appt.save()
    res.json(appt)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /his/appointments/:id
router.put('/appointments/:id', requireAuth, async (req, res) => {
  try {
    const allowed = [
      'status', 'scheduledAt', 'room', 'duration', 'modality',
      'referringDoctor', 'clinicalInfo', 'notes', 'site',
    ]
    const update = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k] })
    update.updatedAt = now()

    // When appointment moves to in_progress, auto-create a RIS Study
    if (update.status === 'in_progress') {
      const appt = await Appointment.findById(req.params.id).lean()
      if (appt && !appt.studyId) {
        const studyId = `std-${Date.now()}`
        const study = new Study({
          _id: studyId,
          patientName: appt.patientName,
          patientId: appt.patientId || '',
          dob: appt.dob || '',
          gender: appt.gender || 'M',
          modality: appt.modality,
          clinicalInfo: appt.clinicalInfo || '',
          site: appt.site,
          scheduledDate: appt.scheduledAt ? appt.scheduledAt.slice(0, 10) : '',
          studyDate: new Date().toISOString().slice(0, 10),
          status: 'in_progress',
          priority: 'routine',
          studyUID: `1.2.840.10008.5.1.4.1.1.2.${Date.now()}.${Math.floor(Math.random() * 100000)}`,
          imageStatus: 'no_images',
          imageCount: 0,
          createdAt: now(),
          updatedAt: now(),
        })
        await study.save()
        update.studyId = studyId
      }
    }

    const appt = await Appointment.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!appt) return res.status(404).json({ error: 'Not found' })
    res.json(appt)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /his/appointments/:id  (cancel only — set status=cancelled)
router.delete('/appointments/:id', requireAuth, async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled', updatedAt: now() },
      { new: true }
    ).lean()
    if (!appt) return res.status(404).json({ error: 'Not found' })
    res.json(appt)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /his/sites — list distinct sites from appointments (for filter dropdown)
router.get('/sites', requireAuth, async (req, res) => {
  try {
    const sites = await Appointment.distinct('site')
    res.json(sites)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
