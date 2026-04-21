const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { requireAuth, requirePermission } = require('../middleware/auth')
const managePartners = requirePermission('partners.manage')
const PartnerAccount = require('../models/PartnerAccount')
const PartnerReferral = require('../models/PartnerReferral')
const Patient = require('../models/Patient')
const Appointment = require('../models/Appointment')
const Study = require('../models/Study')

const now = () => new Date().toISOString()

// ── Admin: list partner accounts ────────────────────────
router.get('/accounts', managePartners, async (req, res) => {
  try {
    const accounts = await PartnerAccount.find({}).select('-password').sort({ createdAt: -1 }).lean()
    res.json(accounts)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Admin: create partner account ───────────────────────
router.post('/accounts', managePartners, async (req, res) => {
  try {
    const { username, password, facilityId, displayName, email, phone, commissionGroupId } = req.body
    if (!username || !password || !facilityId) {
      return res.status(400).json({ error: 'username, password, facilityId required' })
    }

    const account = await PartnerAccount.findOneAndUpdate(
      { username },
      {
        $setOnInsert: { _id: crypto.randomUUID(), createdAt: now() },
        $set: { username, password, facilityId, displayName: displayName || username, email: email || '', phone: phone || '', commissionGroupId: commissionGroupId || '', status: 'active', updatedAt: now() },
      },
      { upsert: true, new: true }
    )
    res.json({ ok: true, account: { ...account.toObject(), password: undefined } })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Admin: update partner account ───────────────────────
router.put('/accounts/:id', managePartners, async (req, res) => {
  try {
    const { displayName, email, phone, commissionGroupId, status, password } = req.body
    const update = { updatedAt: now() }
    if (displayName !== undefined) update.displayName = displayName
    if (email !== undefined) update.email = email
    if (phone !== undefined) update.phone = phone
    if (commissionGroupId !== undefined) update.commissionGroupId = commissionGroupId
    if (status !== undefined) update.status = status
    if (password) update.password = password

    const account = await PartnerAccount.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password')
    if (!account) return res.status(404).json({ error: 'Không tìm thấy tài khoản' })
    res.json({ ok: true, account })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Staff: list all referrals ───────────────────────────
router.get('/referrals', requireAuth, async (req, res) => {
  try {
    const { status } = req.query
    const filter = {}
    if (status) filter.status = status
    const referrals = await PartnerReferral.find(filter).sort({ createdAt: -1 }).lean()
    res.json(referrals)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Staff: accept referral → create appointment ─────────
router.put('/referrals/:id/accept', requireAuth, async (req, res) => {
  try {
    const referral = await PartnerReferral.findById(req.params.id)
    if (!referral) return res.status(404).json({ error: 'Không tìm thấy chuyển gửi' })
    if (referral.status !== 'pending') {
      return res.status(400).json({ error: 'Chỉ có thể chấp nhận chuyển gửi đang chờ' })
    }

    // Find or create patient by phone
    let patient = await Patient.findOne({ phone: referral.patientPhone }).lean()
    if (!patient) {
      const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const seq = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
      const newPatient = new Patient({
        _id: crypto.randomUUID(),
        patientId: `BN-${d}-${seq}`,
        name: referral.patientName,
        phone: referral.patientPhone,
        dob: referral.patientDob || '',
        gender: referral.patientGender || 'other',
        idCard: referral.patientIdCard || '',
        registeredSite: referral.site,
        createdAt: now(), updatedAt: now(),
      })
      await newPatient.save()
      patient = newPatient.toObject()
    }

    // Create appointment
    const apt = new Appointment({
      _id: `APT-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
      patientId: patient._id,
      patientName: referral.patientName,
      dob: referral.patientDob || patient.dob || '',
      gender: referral.patientGender || patient.gender || 'other',
      phone: referral.patientPhone,
      site: referral.site,
      modality: referral.modality || 'US',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      duration: 30,
      status: 'scheduled',
      clinicalInfo: referral.clinicalInfo || '',
      notes: `Chuyển gửi từ đối tác - Ref: ${referral._id}`,
      createdBy: req.user.username,
      createdAt: now(), updatedAt: now(),
    })
    await apt.save()

    // Update referral
    referral.status = 'appointment_created'
    referral.appointmentId = apt._id
    referral.patientId = patient._id
    referral.updatedAt = now()
    await referral.save()

    res.json({ ok: true, referral: referral.toObject(), appointment: apt.toObject() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
