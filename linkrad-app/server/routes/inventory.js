const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const Supplier = require('../models/Supplier')
const SupplyCategory = require('../models/SupplyCategory')
const Supply = require('../models/Supply')
const InventoryTransaction = require('../models/InventoryTransaction')
const InventoryLot = require('../models/InventoryLot')
const Warehouse = require('../models/Warehouse')
const CancelReason = require('../models/CancelReason')
const SupplyServiceMapping = require('../models/SupplyServiceMapping')
const { requireAuth, requirePermission } = require('../middleware/auth')
const manageInventory = requirePermission('inventory.manage')

const now = () => new Date().toISOString()
const today = () => now().slice(0, 10)

// ═══════════════════════════════════════════════════════════
//  SUPPLIERS
// ═══════════════════════════════════════════════════════════
router.get('/suppliers', requireAuth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.q) filter.name = { $regex: req.query.q, $options: 'i' }
    const suppliers = await Supplier.find(filter).sort({ name: 1 }).lean()
    res.json(suppliers)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/suppliers', manageInventory, async (req, res) => {
  try {
    const { code, name, contactPerson, phone, email, address, taxCode } = req.body
    if (!name) return res.status(400).json({ error: 'Tên nhà cung cấp là bắt buộc' })
    const supplier = new Supplier({
      _id: `SUP-${Date.now()}`,
      code: code || `NCC-${Date.now().toString().slice(-6)}`,
      name, contactPerson, phone, email, address, taxCode,
      status: 'active',
      createdAt: now(), updatedAt: now(),
    })
    await supplier.save()
    res.status(201).json(supplier)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/suppliers/:id', manageInventory, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: now() }
    delete update._id
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!supplier) return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp' })
    res.json(supplier)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════
//  SUPPLY CATEGORIES
// ═══════════════════════════════════════════════════════════
router.get('/categories', requireAuth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    const categories = await SupplyCategory.find(filter).sort({ name: 1 }).lean()
    res.json(categories)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/categories', manageInventory, async (req, res) => {
  try {
    const { code, name, parentId } = req.body
    if (!name) return res.status(400).json({ error: 'Tên nhóm vật tư là bắt buộc' })
    const cat = new SupplyCategory({
      _id: `SCAT-${Date.now()}`,
      code: code || `NVT-${Date.now().toString().slice(-6)}`,
      name, parentId: parentId || null,
      status: 'active',
      createdAt: now(), updatedAt: now(),
    })
    await cat.save()
    res.status(201).json(cat)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/categories/:id', manageInventory, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: now() }
    delete update._id
    const cat = await SupplyCategory.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!cat) return res.status(404).json({ error: 'Không tìm thấy nhóm vật tư' })
    res.json(cat)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════
//  SUPPLIES
// ═══════════════════════════════════════════════════════════
router.get('/supplies', requireAuth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.site) filter.site = req.query.site
    if (req.query.categoryId) filter.categoryId = req.query.categoryId
    if (req.query.status) filter.status = req.query.status
    if (req.query.q) filter.name = { $regex: req.query.q, $options: 'i' }
    if (req.query.lowStock === 'true') {
      filter.$expr = { $lte: ['$currentStock', '$minimumStock'] }
    }
    const supplies = await Supply.find(filter).sort({ name: 1 }).lean()
    res.json(supplies)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/supplies', manageInventory, async (req, res) => {
  try {
    const { code, name, categoryId, unit, packagingSpec, conversionRate, minimumStock, site, supplierId } = req.body
    if (!name) return res.status(400).json({ error: 'Tên vật tư là bắt buộc' })
    const supply = new Supply({
      _id: `SPL-${Date.now()}`,
      code: code || `VT-${Date.now().toString().slice(-6)}`,
      name, categoryId, unit: unit || 'cái', packagingSpec: packagingSpec || '',
      conversionRate: conversionRate || 1,
      minimumStock: minimumStock || 0,
      currentStock: 0, site, supplierId,
      status: 'active',
      createdAt: now(), updatedAt: now(),
    })
    await supply.save()
    res.status(201).json(supply)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/supplies/:id', manageInventory, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: now() }
    delete update._id
    delete update.currentStock // don't allow direct stock editing
    const supply = await Supply.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!supply) return res.status(404).json({ error: 'Không tìm thấy vật tư' })
    res.json(supply)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════
//  TRANSACTIONS (Import / Export)
// ═══════════════════════════════════════════════════════════
async function nextTxNumber(type) {
  const prefix = type === 'import' ? 'NK' : type === 'export' ? 'XK' : 'DC'
  const d = today().replace(/-/g, '')
  const count = await InventoryTransaction.countDocuments({
    transactionNumber: { $regex: `^${prefix}-${d}` },
  })
  return `${prefix}-${d}-${String(count + 1).padStart(3, '0')}`
}

router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.type) filter.type = req.query.type
    if (req.query.site) filter.site = req.query.site
    if (req.query.warehouseId) filter.warehouseId = req.query.warehouseId
    if (req.query.status) filter.status = req.query.status
    if (req.query.accountingPeriod) filter.accountingPeriod = req.query.accountingPeriod
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {}
      if (req.query.dateFrom) filter.createdAt.$gte = req.query.dateFrom
      if (req.query.dateTo) filter.createdAt.$lte = req.query.dateTo + 'T23:59:59'
    }
    const txs = await InventoryTransaction.find(filter).sort({ createdAt: -1 }).limit(+req.query.limit || 100).lean()
    res.json(txs)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/transactions', requireAuth, async (req, res) => {
  try {
    const { type, site, items, supplierId, supplierName, reason, notes,
            warehouseId, warehouseName, warehouseCode, accountingPeriod } = req.body
    if (!type || !items || items.length === 0) {
      return res.status(400).json({ error: 'Thiếu loại phiếu hoặc danh sách vật tư' })
    }
    // Calculate item-level totals
    const mappedItems = items.map(it => {
      const qty = it.quantity || 0
      const convQty = it.conversionQuantity || 0
      const purchasePrice = it.purchasePrice || it.unitPrice || 0
      const unitPr = convQty > 0 ? purchasePrice / (convQty / qty || 1) : purchasePrice
      const amtBefore = purchasePrice * qty
      const vatRate = it.vatRate || 0
      const vatAmt = Math.round(amtBefore * vatRate / 100)
      const amtAfter = amtBefore + vatAmt
      const discPct = it.discountPercent || 0
      const discAmt = it.discountAmount || Math.round(amtAfter * discPct / 100)
      const finalAmt = amtAfter - discAmt
      return {
        supplyId: it.supplyId,
        supplyName: it.supplyName,
        supplyCode: it.supplyCode || '',
        unit: it.unit || '',
        packagingSpec: it.packagingSpec || '',
        lotNumber: it.lotNumber || '',
        manufacturingDate: it.manufacturingDate || '',
        expiryDate: it.expiryDate || '',
        quantity: qty,
        conversionQuantity: convQty,
        purchasePrice,
        unitPrice: unitPr,
        amountBeforeTax: amtBefore,
        vatRate,
        vatAmount: vatAmt,
        amountAfterTax: amtAfter,
        discountPercent: discPct,
        discountAmount: discAmt,
        amount: finalAmt,
        notes: it.notes || '',
      }
    })
    const totalAmountBeforeTax = mappedItems.reduce((s, it) => s + it.amountBeforeTax, 0)
    const totalVat = mappedItems.reduce((s, it) => s + it.vatAmount, 0)
    const totalDiscount = mappedItems.reduce((s, it) => s + it.discountAmount, 0)
    const totalAmount = mappedItems.reduce((s, it) => s + it.amount, 0)

    const tx = new InventoryTransaction({
      _id: `TX-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
      transactionNumber: await nextTxNumber(type),
      type, site: site || req.user.department,
      warehouseId: warehouseId || '', warehouseName: warehouseName || '', warehouseCode: warehouseCode || '',
      accountingPeriod: accountingPeriod || '',
      items: mappedItems,
      totalAmountBeforeTax, totalVat, totalDiscount, totalAmount,
      supplierId, supplierName, reason, notes: notes || '',
      status: 'draft',
      createdBy: req.user.username,
      createdAt: now(), updatedAt: now(),
    })
    await tx.save()
    res.status(201).json(tx)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Confirm transaction → update stock + create lots
router.put('/transactions/:id/confirm', requireAuth, async (req, res) => {
  try {
    const tx = await InventoryTransaction.findById(req.params.id)
    if (!tx) return res.status(404).json({ error: 'Không tìm thấy phiếu' })
    if (tx.status !== 'draft') return res.status(400).json({ error: 'Phiếu đã xác nhận hoặc đã hủy' })

    for (const item of tx.items) {
      const supply = await Supply.findById(item.supplyId)
      if (!supply) continue

      if (tx.type === 'import') {
        supply.currentStock += item.quantity
        // Create lot for tracking
        const lot = new InventoryLot({
          _id: `LOT-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
          supplyId: item.supplyId,
          site: tx.site,
          warehouseId: tx.warehouseId || '',
          lotNumber: item.lotNumber || `L-${Date.now().toString().slice(-6)}`,
          manufacturingDate: item.manufacturingDate || '',
          expiryDate: item.expiryDate || '',
          importTransactionId: tx._id,
          importDate: today(),
          initialQuantity: item.quantity,
          currentQuantity: item.quantity,
          unitPrice: item.unitPrice || 0,
          status: 'available',
          createdAt: now(),
        })
        await lot.save()
      } else if (tx.type === 'export' || tx.type === 'auto_deduct') {
        supply.currentStock = Math.max(0, supply.currentStock - item.quantity)
        // FIFO: deduct from oldest lots
        let remaining = item.quantity
        const lots = await InventoryLot.find({
          supplyId: item.supplyId, site: tx.site, status: 'available', currentQuantity: { $gt: 0 },
        }).sort({ createdAt: 1 })
        for (const lot of lots) {
          if (remaining <= 0) break
          const deduct = Math.min(lot.currentQuantity, remaining)
          lot.currentQuantity -= deduct
          if (lot.currentQuantity <= 0) lot.status = 'depleted'
          await lot.save()
          remaining -= deduct
        }
      } else if (tx.type === 'adjustment') {
        supply.currentStock += item.quantity // can be negative for reduction
      }
      supply.updatedAt = now()
      await supply.save()
    }

    tx.status = 'confirmed'
    tx.confirmedBy = req.user.username
    tx.confirmedAt = now()
    tx.updatedAt = now()
    await tx.save()
    res.json(tx)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/transactions/:id/cancel', requireAuth, async (req, res) => {
  try {
    const tx = await InventoryTransaction.findById(req.params.id)
    if (!tx) return res.status(404).json({ error: 'Không tìm thấy phiếu' })
    if (tx.status !== 'draft') return res.status(400).json({ error: 'Chỉ hủy được phiếu nháp' })
    tx.status = 'cancelled'
    tx.updatedAt = now()
    await tx.save()
    res.json(tx)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════
//  LOTS
// ═══════════════════════════════════════════════════════════
router.get('/lots', requireAuth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.supplyId) filter.supplyId = req.query.supplyId
    if (req.query.site) filter.site = req.query.site
    if (req.query.status) filter.status = req.query.status
    const lots = await InventoryLot.find(filter).sort({ createdAt: 1 }).lean()
    res.json(lots)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════
//  REPORTS
// ═══════════════════════════════════════════════════════════

// Current stock report
router.get('/reports/stock', requireAuth, async (req, res) => {
  try {
    const filter = { status: 'active' }
    if (req.query.site) filter.site = req.query.site
    const supplies = await Supply.find(filter).sort({ name: 1 }).lean()
    const lowStock = supplies.filter(s => s.currentStock <= s.minimumStock)
    res.json({ supplies, lowStockCount: lowStock.length, lowStock })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Movement report (import/export summary)
router.get('/reports/movement', requireAuth, async (req, res) => {
  try {
    const filter = { status: 'confirmed' }
    if (req.query.site) filter.site = req.query.site
    if (req.query.dateFrom || req.query.dateTo) {
      filter.confirmedAt = {}
      if (req.query.dateFrom) filter.confirmedAt.$gte = req.query.dateFrom
      if (req.query.dateTo) filter.confirmedAt.$lte = req.query.dateTo + 'T23:59:59'
    }
    const txs = await InventoryTransaction.find(filter).sort({ confirmedAt: -1 }).lean()
    const totalImport = txs.filter(t => t.type === 'import').reduce((s, t) => s + t.totalAmount, 0)
    const totalExport = txs.filter(t => t.type === 'export' || t.type === 'auto_deduct').reduce((s, t) => s + t.totalAmount, 0)
    res.json({ transactions: txs, totalImport, totalExport })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Stock card (the kho) for a specific supply
router.get('/reports/card/:supplyId', requireAuth, async (req, res) => {
  try {
    const supply = await Supply.findById(req.params.supplyId).lean()
    if (!supply) return res.status(404).json({ error: 'Không tìm thấy vật tư' })

    const filter = { 'items.supplyId': req.params.supplyId, status: 'confirmed' }
    if (req.query.site) filter.site = req.query.site
    if (req.query.dateFrom || req.query.dateTo) {
      filter.confirmedAt = {}
      if (req.query.dateFrom) filter.confirmedAt.$gte = req.query.dateFrom
      if (req.query.dateTo) filter.confirmedAt.$lte = req.query.dateTo + 'T23:59:59'
    }
    const txs = await InventoryTransaction.find(filter).sort({ confirmedAt: 1 }).lean()

    // Build ledger
    let balance = 0
    const entries = []
    for (const tx of txs) {
      for (const item of tx.items) {
        if (item.supplyId !== req.params.supplyId) continue
        const qty = (tx.type === 'import' || tx.type === 'adjustment') ? item.quantity : -item.quantity
        balance += qty
        entries.push({
          date: tx.confirmedAt?.slice(0, 10),
          transactionNumber: tx.transactionNumber,
          type: tx.type,
          inQty: qty > 0 ? qty : 0,
          outQty: qty < 0 ? Math.abs(qty) : 0,
          balance,
          unitPrice: item.unitPrice,
          note: tx.reason || '',
        })
      }
    }

    res.json({ supply, entries, currentBalance: supply.currentStock })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Expiring lots
router.get('/reports/expiring', requireAuth, async (req, res) => {
  try {
    const days = +(req.query.days || 30)
    const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
    const lots = await InventoryLot.find({
      status: 'available',
      currentQuantity: { $gt: 0 },
      expiryDate: { $ne: '', $lte: cutoff },
    }).sort({ expiryDate: 1 }).lean()
    res.json(lots)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════
//  WAREHOUSES (Kho hang)
// ═══════════════════════════════════════════════════════════
router.get('/warehouses', requireAuth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.site) filter.site = req.query.site
    const warehouses = await Warehouse.find(filter).sort({ name: 1 }).lean()
    res.json(warehouses)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/warehouses', manageInventory, async (req, res) => {
  try {
    const { code, name, site, address, manager, phone, description } = req.body
    if (!name) return res.status(400).json({ error: 'Tên kho là bắt buộc' })
    const wh = new Warehouse({
      _id: `WH-${Date.now()}`,
      code: code || `KH-${Date.now().toString().slice(-6)}`,
      name, site, address, manager, phone, description,
      status: 'active', createdAt: now(), updatedAt: now(),
    })
    await wh.save()
    res.status(201).json(wh)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/warehouses/:id', manageInventory, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: now() }
    delete update._id
    const wh = await Warehouse.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!wh) return res.status(404).json({ error: 'Không tìm thấy kho' })
    res.json(wh)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════
//  CANCEL REASONS (Ly do huy)
// ═══════════════════════════════════════════════════════════
router.get('/cancel-reasons', requireAuth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.type) filter.type = req.query.type
    if (req.query.status) filter.status = req.query.status
    const reasons = await CancelReason.find(filter).sort({ name: 1 }).lean()
    res.json(reasons)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/cancel-reasons', manageInventory, async (req, res) => {
  try {
    const { code, name, type } = req.body
    if (!name) return res.status(400).json({ error: 'Tên lý do là bắt buộc' })
    const cr = new CancelReason({
      _id: `CR-${Date.now()}`,
      code: code || `LDH-${Date.now().toString().slice(-6)}`,
      name, type: type || 'import',
      status: 'active', createdAt: now(), updatedAt: now(),
    })
    await cr.save()
    res.status(201).json(cr)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/cancel-reasons/:id', manageInventory, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: now() }
    delete update._id
    const cr = await CancelReason.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!cr) return res.status(404).json({ error: 'Không tìm thấy lý do' })
    res.json(cr)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════
//  SUPPLY-SERVICE MAPPING (Hang hoa HIS / Dinh muc CLS)
// ═══════════════════════════════════════════════════════════
router.get('/his-mapping', requireAuth, async (req, res) => {
  try {
    const filter = {}
    if (req.query.serviceId) filter.serviceId = req.query.serviceId
    if (req.query.supplyId) filter.supplyId = req.query.supplyId
    const mappings = await SupplyServiceMapping.find(filter).sort({ serviceName: 1 }).lean()
    res.json(mappings)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/his-mapping', manageInventory, async (req, res) => {
  try {
    const { serviceId, serviceCode, serviceName, supplyId, supplyCode, supplyName, quantity, unit } = req.body
    if (!serviceId || !supplyId) return res.status(400).json({ error: 'Thiếu dịch vụ hoặc vật tư' })
    const existing = await SupplyServiceMapping.findOne({ serviceId, supplyId })
    if (existing) return res.status(400).json({ error: 'Mapping đã tồn tại' })
    const m = new SupplyServiceMapping({
      _id: `HSM-${Date.now()}`,
      serviceId, serviceCode, serviceName, supplyId, supplyCode, supplyName,
      quantity: quantity || 1, unit: unit || '',
      createdAt: now(), updatedAt: now(),
    })
    await m.save()
    res.status(201).json(m)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/his-mapping/:id', manageInventory, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: now() }
    delete update._id
    const m = await SupplyServiceMapping.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!m) return res.status(404).json({ error: 'Không tìm thấy mapping' })
    res.json(m)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/his-mapping/:id', manageInventory, async (req, res) => {
  try {
    await SupplyServiceMapping.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════
//  REPORTS — Import only
// ═══════════════════════════════════════════════════════════
router.get('/reports/import', requireAuth, async (req, res) => {
  try {
    const filter = { type: 'import', status: 'confirmed' }
    if (req.query.site) filter.site = req.query.site
    if (req.query.dateFrom || req.query.dateTo) {
      filter.confirmedAt = {}
      if (req.query.dateFrom) filter.confirmedAt.$gte = req.query.dateFrom
      if (req.query.dateTo) filter.confirmedAt.$lte = req.query.dateTo + 'T23:59:59'
    }
    const txs = await InventoryTransaction.find(filter).sort({ confirmedAt: -1 }).lean()
    const total = txs.reduce((s, t) => s + t.totalAmount, 0)
    res.json({ transactions: txs, total, count: txs.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// REPORTS — Export only
router.get('/reports/export', requireAuth, async (req, res) => {
  try {
    const filter = { type: { $in: ['export', 'auto_deduct'] }, status: 'confirmed' }
    if (req.query.site) filter.site = req.query.site
    if (req.query.dateFrom || req.query.dateTo) {
      filter.confirmedAt = {}
      if (req.query.dateFrom) filter.confirmedAt.$gte = req.query.dateFrom
      if (req.query.dateTo) filter.confirmedAt.$lte = req.query.dateTo + 'T23:59:59'
    }
    const txs = await InventoryTransaction.find(filter).sort({ confirmedAt: -1 }).lean()
    const total = txs.reduce((s, t) => s + t.totalAmount, 0)
    res.json({ transactions: txs, total, count: txs.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// REPORTS — Import/Export/Balance (xuat nhap ton)
router.get('/reports/balance', requireAuth, async (req, res) => {
  try {
    const supplies = await Supply.find({ status: 'active' }).lean()
    const filter = { status: 'confirmed' }
    if (req.query.dateFrom || req.query.dateTo) {
      filter.confirmedAt = {}
      if (req.query.dateFrom) filter.confirmedAt.$gte = req.query.dateFrom
      if (req.query.dateTo) filter.confirmedAt.$lte = req.query.dateTo + 'T23:59:59'
    }
    const txs = await InventoryTransaction.find(filter).lean()

    const bySupply = {}
    for (const s of supplies) {
      bySupply[s._id] = { supplyId: s._id, code: s.code, name: s.name, unit: s.unit, currentStock: s.currentStock, totalIn: 0, totalOut: 0, totalInAmount: 0, totalOutAmount: 0 }
    }
    for (const tx of txs) {
      for (const item of tx.items) {
        if (!bySupply[item.supplyId]) continue
        if (tx.type === 'import') {
          bySupply[item.supplyId].totalIn += item.quantity
          bySupply[item.supplyId].totalInAmount += item.amount || 0
        } else {
          bySupply[item.supplyId].totalOut += item.quantity
          bySupply[item.supplyId].totalOutAmount += item.amount || 0
        }
      }
    }
    res.json(Object.values(bySupply).filter(s => s.totalIn > 0 || s.totalOut > 0 || s.currentStock > 0))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
