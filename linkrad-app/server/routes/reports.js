const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')

const Invoice = require('../models/Invoice')
const Patient = require('../models/Patient')
const ReferralDoctor = require('../models/ReferralDoctor')
const Service = require('../models/Service')
const User = require('../models/User')

const PAYMENT_LABELS = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', card: 'Thẻ', mixed: 'Hỗn hợp' }

// GET /reports/revenue-detail
router.get('/revenue-detail', requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo, branch } = req.query
    const filter = {}

    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom).toISOString()
      if (dateTo) {
        const end = new Date(dateTo)
        end.setDate(end.getDate() + 1)
        filter.createdAt.$lt = end.toISOString()
      }
    }
    if (branch) filter.site = { $regex: branch, $options: 'i' }

    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(500).lean()

    // Batch lookups
    const patientIds = [...new Set(invoices.map(b => b.patientId).filter(Boolean))]
    const [patients, doctors, users, services] = await Promise.all([
      Patient.find({ _id: { $in: patientIds } }).lean(),
      ReferralDoctor.find({}).lean(),
      User.find({}).select('-password').lean(),
      Service.find({}).lean(),
    ])
    const patientMap = Object.fromEntries(patients.map(p => [p._id, p]))
    const doctorMap = Object.fromEntries(doctors.map(d => [d.code, d]))
    const userMap = Object.fromEntries(users.map(u => [u._id, u]))
    const serviceMap = Object.fromEntries(services.map(s => [s.code, s]))

    // Build report rows — one row per invoice line item
    const rows = []
    for (const inv of invoices) {
      const patient = patientMap[inv.patientId] || {}
      const doctor = inv.referringDoctorCode ? doctorMap[inv.referringDoctorCode] : null
      const staff = inv.cashierId ? userMap[inv.cashierId] : (inv.createdBy ? userMap[inv.createdBy] : null)

      const baseRow = {
        branch: inv.site || '',
        date: inv.createdAt,
        billingCode: inv.invoiceNumber || inv._id,
        doctorCode: inv.referringDoctorCode || '',
        doctorName: doctor?.name || '',
        doctorWorkplace: doctor?.workplace || '',
        doctorPhone: doctor?.phone || '',
        staffCode: staff?._id || inv.cashierId || inv.createdBy || '',
        staffName: staff?.displayName || '',
        patientCode: patient.patientId || inv.patientId || '',
        patientName: inv.patientName || patient.name || '',
        patientPhone: inv.phone || patient.phone || '',
        patientAddress: [patient.ward, patient.district, patient.province].filter(Boolean).join(', ') || patient.address || '',
        patientDob: patient.dob || '',
        patientIdCard: patient.idCard || '',
        paymentMethod: PAYMENT_LABELS[inv.paymentMethod] || inv.paymentMethod || '',
      }

      const items = inv.items || []
      if (items.length === 0) {
        rows.push({
          ...baseRow,
          _id: inv._id,
          customerSource: doctor ? 'Đối tác giới thiệu' : 'Tự đến',
          serviceCode: '', serviceTypeCode: '', serviceName: '',
          unitPrice: inv.grandTotal || 0, quantity: 1,
          subtotal: inv.grandTotal || 0, consultFee: 0,
          revenue: inv.grandTotal || 0,
          discount: inv.totalDiscount || 0,
          collected: inv.paidAmount || 0,
          remaining: (inv.grandTotal || 0) - (inv.paidAmount || 0),
          injectionLot: '', injectionType: '',
          notes: inv.notes || '', paymentInfo: '',
        })
      } else {
        for (const item of items) {
          const svc = item.serviceCode ? serviceMap[item.serviceCode] : null
          const subtotal = (item.unitPrice || 0) * (item.quantity || 1)
          const disc = item.discountAmount || 0
          rows.push({
            ...baseRow,
            _id: `${inv._id}-${item.serviceCode}`,
            customerSource: doctor ? 'Đối tác giới thiệu' : 'Tự đến',
            serviceCode: item.serviceCode || '',
            serviceTypeCode: svc?.serviceTypeCode || '',
            serviceName: item.serviceName || svc?.name || '',
            unitPrice: item.unitPrice || 0,
            quantity: item.quantity || 1,
            subtotal,
            consultFee: 0,
            revenue: subtotal,
            discount: disc,
            collected: ['paid', 'partially_paid'].includes(inv.status) ? subtotal - disc : 0,
            remaining: ['paid', 'partially_paid'].includes(inv.status) ? 0 : subtotal - disc,
            injectionLot: '', injectionType: '',
            notes: inv.notes || '', paymentInfo: '',
          })
        }
      }
    }

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /reports/customer-detail
router.get('/customer-detail', requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query
    const filter = {}

    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom).toISOString()
      if (dateTo) {
        const end = new Date(dateTo)
        end.setDate(end.getDate() + 1)
        filter.createdAt.$lt = end.toISOString()
      }
    }

    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(500).lean()

    const patientIds = [...new Set(invoices.map(b => b.patientId).filter(Boolean))]
    const patients = await Patient.find({ _id: { $in: patientIds } }).lean()
    const patientMap = Object.fromEntries(patients.map(p => [p._id, p]))

    const rows = invoices.map(inv => {
      const patient = patientMap[inv.patientId] || {}
      const totalAmount = inv.grandTotal || 0
      const totalDiscount = inv.totalDiscount || 0
      const paidAmount = inv.paidAmount || 0
      return {
        _id: inv._id,
        date: inv.createdAt,
        patientName: inv.patientName || patient.name || '',
        patientAddress: [patient.ward, patient.district, patient.province].filter(Boolean).join(', ') || patient.address || '',
        patientDob: patient.dob || '',
        amount: totalAmount,
        discount: totalDiscount,
        paid: paidAmount,
        collected: paidAmount,
        paymentMethod: PAYMENT_LABELS[inv.paymentMethod] || inv.paymentMethod || '',
      }
    })

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /reports/promotion-detail
router.get('/promotion-detail', requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query
    const filter = {}
    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom).toISOString()
      if (dateTo) {
        const end = new Date(dateTo)
        end.setDate(end.getDate() + 1)
        filter.createdAt.$lt = end.toISOString()
      }
    }
    // Only invoices with discounts
    filter.totalDiscount = { $gt: 0 }

    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(500).lean()

    const patientIds = [...new Set(invoices.map(b => b.patientId).filter(Boolean))]
    const Promotion = require('../models/Promotion')
    const [patients, promotions] = await Promise.all([
      Patient.find({ _id: { $in: patientIds } }).lean(),
      Promotion.find({}).lean(),
    ])
    const patientMap = Object.fromEntries(patients.map(p => [p._id, p]))
    // Build a lookup: try to match discount to a promotion
    const promoList = promotions.sort((a, b) => (b.currentUsage || 0) - (a.currentUsage || 0))

    const rows = invoices.map(inv => {
      const patient = patientMap[inv.patientId] || {}
      const totalAmount = inv.grandTotal || 0
      const discountAmount = inv.totalDiscount || 0
      // Try matching promotion by code in notes or by active promos
      let promo = null
      if (inv.promoCode) {
        promo = promoList.find(p => p.code === inv.promoCode)
      }
      if (!promo && inv.promotionId) {
        promo = promoList.find(p => p._id === inv.promotionId)
      }
      if (!promo) {
        // Best-effort: pick first active promo
        promo = promoList.find(p => p.status === 'active') || promoList[0]
      }
      return {
        _id: inv._id,
        promoCode: promo?.code || inv.promoCode || '-',
        promoName: promo?.name || inv.promotionName || '-',
        date: inv.createdAt,
        patientName: inv.patientName || patient.name || '',
        patientAddress: [patient.ward, patient.district, patient.province].filter(Boolean).join(', ') || patient.address || '',
        paymentMethod: PAYMENT_LABELS[inv.paymentMethod] || inv.paymentMethod || '',
        totalAmount,
        discountAmount,
        netAmount: totalAmount - discountAmount,
      }
    })

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /reports/clinic-revenue
router.get('/clinic-revenue', requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo, tab } = req.query
    const filter = {}

    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom).toISOString()
      if (dateTo) {
        const end = new Date(dateTo)
        end.setDate(end.getDate() + 1)
        filter.createdAt.$lt = end.toISOString()
      }
    }

    // tab=collection: only mixed/transfer payments (thu hộ)
    // tab=revenue (default): all
    if (tab === 'collection') {
      filter.paymentMethod = { $in: ['transfer', 'mixed'] }
    }

    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(1000).lean()

    const patientIds = [...new Set(invoices.map(b => b.patientId).filter(Boolean))]
    const [patients, doctors, services] = await Promise.all([
      Patient.find({ _id: { $in: patientIds } }).lean(),
      ReferralDoctor.find({}).lean(),
      Service.find({}).lean(),
    ])
    const patientMap = Object.fromEntries(patients.map(p => [p._id, p]))
    const doctorMap = Object.fromEntries(doctors.map(d => [d.code, d]))
    const serviceMap = Object.fromEntries(services.map(s => [s.code, s]))

    // One row per invoice line item
    const rows = []
    for (const inv of invoices) {
      const patient = patientMap[inv.patientId] || {}
      const doctor = inv.referringDoctorCode ? doctorMap[inv.referringDoctorCode] : null

      const base = {
        date: inv.createdAt,
        invoiceNumber: inv.invoiceNumber || inv._id,
        doctorCode: doctor?.code || inv.referringDoctorCode || '',
        doctorName: doctor?.name || '',
        patientCode: patient.patientId || inv.patientId || '',
        patientName: inv.patientName || patient.name || '',
        patientAddress: [patient.ward, patient.district, patient.province].filter(Boolean).join(', ') || patient.address || '',
        patientDob: patient.dob || '',
        paymentMethod: PAYMENT_LABELS[inv.paymentMethod] || inv.paymentMethod || '',
      }

      const items = inv.items || []
      if (items.length === 0) {
        rows.push({
          ...base,
          _id: inv._id,
          serviceTypeCode: '',
          serviceName: '',
          amount: inv.grandTotal || 0,
          discount: inv.totalDiscount || 0,
          netAmount: (inv.grandTotal || 0) - (inv.totalDiscount || 0),
        })
      } else {
        for (const item of items) {
          const svc = item.serviceCode ? serviceMap[item.serviceCode] : null
          const amt = (item.unitPrice || 0) * (item.quantity || 1)
          const disc = item.discountAmount || 0
          rows.push({
            ...base,
            _id: `${inv._id}-${item.serviceCode}`,
            serviceTypeCode: svc?.serviceTypeCode || '',
            serviceName: item.serviceName || svc?.name || '',
            amount: amt,
            discount: disc,
            netAmount: amt - disc,
          })
        }
      }
    }

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /reports/refund-exchange
router.get('/refund-exchange', requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo, tab } = req.query
    const filter = {}

    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom).toISOString()
      if (dateTo) {
        const end = new Date(dateTo)
        end.setDate(end.getDate() + 1)
        filter.createdAt.$lt = end.toISOString()
      }
    }

    // refund: cancelled/refunded invoices; exchange: modified invoices
    if (tab === 'exchange') {
      // Invoices that were updated (have updatedAt != createdAt) — service changes
      filter.status = { $in: ['issued', 'paid', 'partially_paid'] }
      filter.updatedAt = { $exists: true }
    } else {
      // Default: refunded/cancelled
      filter.status = { $in: ['refunded', 'cancelled'] }
    }

    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(500).lean()

    const patientIds = [...new Set(invoices.map(b => b.patientId).filter(Boolean))]
    const [patients, doctors, services] = await Promise.all([
      Patient.find({ _id: { $in: patientIds } }).lean(),
      ReferralDoctor.find({}).lean(),
      Service.find({}).lean(),
    ])
    const patientMap = Object.fromEntries(patients.map(p => [p._id, p]))
    const doctorMap = Object.fromEntries(doctors.map(d => [d.code, d]))
    const serviceMap = Object.fromEntries(services.map(s => [s.code, s]))

    const rows = []
    for (const inv of invoices) {
      const patient = patientMap[inv.patientId] || {}
      const doctor = inv.referringDoctorCode ? doctorMap[inv.referringDoctorCode] : null

      const base = {
        date: inv.cancelledAt || inv.updatedAt || inv.createdAt,
        invoiceNumber: inv.invoiceNumber || inv._id,
        doctorCode: doctor?.code || inv.referringDoctorCode || '',
        doctorName: doctor?.name || '',
        patientCode: patient.patientId || inv.patientId || '',
        patientName: inv.patientName || patient.name || '',
        patientAddress: [patient.ward, patient.district, patient.province].filter(Boolean).join(', ') || patient.address || '',
        patientDob: patient.dob || '',
        reason: inv.cancelReason || '',
        paymentMethod: PAYMENT_LABELS[inv.paymentMethod] || inv.paymentMethod || '',
      }

      const items = inv.items || []
      if (items.length === 0) {
        rows.push({
          ...base,
          _id: inv._id,
          serviceTypeCode: '',
          serviceName: '',
          amount: inv.grandTotal || 0,
          discount: inv.totalDiscount || 0,
          netAmount: (inv.grandTotal || 0) - (inv.totalDiscount || 0),
        })
      } else {
        for (const item of items) {
          const svc = item.serviceCode ? serviceMap[item.serviceCode] : null
          const amt = (item.unitPrice || 0) * (item.quantity || 1)
          const disc = item.discountAmount || 0
          rows.push({
            ...base,
            _id: `${inv._id}-${item.serviceCode}`,
            serviceTypeCode: svc?.serviceTypeCode || '',
            serviceName: item.serviceName || svc?.name || '',
            amount: amt,
            discount: disc,
            netAmount: amt - disc,
          })
        }
      }
    }

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /reports/e-invoice
router.get('/e-invoice', requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo, tab } = req.query
    const filter = {}

    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom).toISOString()
      if (dateTo) {
        const end = new Date(dateTo)
        end.setDate(end.getDate() + 1)
        filter.createdAt.$lt = end.toISOString()
      }
    }

    // Get all paid/issued invoices for stats
    const allFilter = { ...filter, status: { $in: ['paid', 'issued', 'partially_paid'] } }
    const allInvoices = await Invoice.find(allFilter).lean()

    // Simulate e-invoice status: invoices with issuedAt are "issued", others "not_issued"
    const notIssued = allInvoices.filter(inv => !inv.issuedAt || inv.status === 'paid')
    const issued = allInvoices.filter(inv => inv.issuedAt && inv.status === 'issued')

    const stats = {
      notIssuedCount: notIssued.length,
      notIssuedTotal: notIssued.reduce((s, inv) => s + (inv.grandTotal || 0), 0),
      issuedCount: issued.length,
      issuedTotal: issued.reduce((s, inv) => s + (inv.grandTotal || 0), 0),
    }

    const targetInvoices = tab === 'issued' ? issued : notIssued
    const patientIds = [...new Set(targetInvoices.map(b => b.patientId).filter(Boolean))]
    const patients = await Patient.find({ _id: { $in: patientIds } }).lean()
    const patientMap = Object.fromEntries(patients.map(p => [p._id, p]))

    const rows = targetInvoices.map(inv => {
      const patient = patientMap[inv.patientId] || {}
      return {
        _id: inv._id,
        date: inv.createdAt,
        invoiceNumber: inv.invoiceNumber || inv._id,
        patientName: inv.patientName || patient.name || '',
        patientPhone: inv.phone || patient.phone || '',
        email: patient.email || '',
        patientAddress: [patient.ward, patient.district, patient.province].filter(Boolean).join(', ') || patient.address || '',
        patientCode: patient.patientId || inv.patientId || '',
        amount: inv.grandTotal || 0,
      }
    })

    res.json({ rows, stats })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
