const express = require('express')
const router = express.Router()
const { requireAuth, requireAdmin } = require('../middleware/auth')

// All catalog models
const ServiceType = require('../models/ServiceType')
const Service = require('../models/Service')
const Specialty = require('../models/Specialty')
const ReferralDoctor = require('../models/ReferralDoctor')
const PartnerFacility = require('../models/PartnerFacility')
const CommissionGroup = require('../models/CommissionGroup')
const CommissionRule = require('../models/CommissionRule')
const RegistrationReason = require('../models/RegistrationReason')
const BillingCancelReason = require('../models/BillingCancelReason')
const MedicalFacility = require('../models/MedicalFacility')
const TaxGroup = require('../models/TaxGroup')
const AdminUnit = require('../models/AdminUnit')
const User = require('../models/User')
const Patient = require('../models/Patient')

const now = () => new Date().toISOString()

// ── Generic CRUD factory ─────────────────────────────────
function catalogCRUD(Model, prefix, nameField = 'name') {
  // GET list
  router.get(`/${prefix}`, requireAuth, async (req, res) => {
    try {
      const filter = {}
      if (req.query.status) filter.status = req.query.status
      if (req.query.q) filter[nameField] = { $regex: req.query.q, $options: 'i' }
      // Extra filters
      if (req.query.type) filter.type = req.query.type
      if (req.query.level) filter.level = req.query.level
      if (req.query.parentCode) filter.parentCode = req.query.parentCode
      if (req.query.typeCode) filter.serviceTypeCode = req.query.typeCode
      if (req.query.modality) filter.modality = req.query.modality
      if (req.query.commissionGroupId) filter.commissionGroupId = req.query.commissionGroupId
      if (req.query.branchCode) filter.branchCode = req.query.branchCode
      const items = await Model.find(filter).sort({ [nameField]: 1 }).limit(+(req.query.limit || 500)).lean()
      res.json(items)
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // POST create
  router.post(`/${prefix}`, requireAdmin, async (req, res) => {
    try {
      const data = { ...req.body, _id: `${prefix.toUpperCase()}-${Date.now()}`, createdAt: now(), updatedAt: now() }
      if (!data.status) data.status = 'active'
      const item = new Model(data)
      await item.save()
      res.status(201).json(item)
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // PUT update
  router.put(`/${prefix}/:id`, requireAdmin, async (req, res) => {
    try {
      const update = { ...req.body, updatedAt: now() }
      delete update._id
      const item = await Model.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
      if (!item) return res.status(404).json({ error: 'Không tìm thấy' })
      res.json(item)
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // DELETE
  router.delete(`/${prefix}/:id`, requireAdmin, async (req, res) => {
    try {
      await Model.findByIdAndDelete(req.params.id)
      res.json({ ok: true })
    } catch (err) { res.status(500).json({ error: err.message }) }
  })
}

// Register all catalog CRUD routes
catalogCRUD(ServiceType, 'service-types')
catalogCRUD(Service, 'services')
catalogCRUD(Specialty, 'specialties')
catalogCRUD(ReferralDoctor, 'referral-doctors')
catalogCRUD(PartnerFacility, 'partner-facilities')
catalogCRUD(CommissionGroup, 'commission-groups')
catalogCRUD(CommissionRule, 'commission-rules')
catalogCRUD(RegistrationReason, 'registration-reasons')
catalogCRUD(BillingCancelReason, 'billing-cancel-reasons')
catalogCRUD(MedicalFacility, 'medical-facilities')
catalogCRUD(TaxGroup, 'tax-groups')
catalogCRUD(AdminUnit, 'admin-units')

// ── Public services endpoint (for booking form) ──────────
router.get('/services/public', async (req, res) => {
  try {
    const services = await Service.find({ status: 'active' }).sort({ serviceTypeCode: 1, name: 1 }).lean()
    res.json(services.map(s => ({ _id: s._id, code: s.code, name: s.name, serviceTypeCode: s.serviceTypeCode, modality: s.modality, basePrice: s.basePrice })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Users list (read-only for catalog) ───────────────────
router.get('/users', requireAuth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.q) filter.$or = [
      { _id: { $regex: req.query.q, $options: 'i' } },
      { displayName: { $regex: req.query.q, $options: 'i' } },
    ]
    if (req.query.role) filter.role = req.query.role
    const users = await User.find(filter).select('-password').sort({ displayName: 1 }).lean()
    res.json(users)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Patients list (read-only for catalog) ────────────────
router.get('/patients', requireAuth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.q) filter.$or = [
      { name: { $regex: req.query.q, $options: 'i' } },
      { patientId: { $regex: req.query.q, $options: 'i' } },
      { phone: { $regex: req.query.q, $options: 'i' } },
    ]
    const patients = await Patient.find(filter).sort({ createdAt: -1 }).limit(+(req.query.limit || 100)).lean()
    res.json(patients)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Bulk import admin units ──────────────────────────────
router.post('/admin-units/bulk', requireAdmin, async (req, res) => {
  try {
    const { items } = req.body
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Thiếu danh sách' })
    let count = 0
    for (const item of items) {
      await AdminUnit.findByIdAndUpdate(item._id || `AU-${Date.now()}-${count}`, {
        ...item, _id: item._id || `AU-${Date.now()}-${count}`, status: 'active',
      }, { upsert: true })
      count++
    }
    res.json({ imported: count })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
