const mongoose = require('mongoose')

const txItemSchema = new mongoose.Schema({
  supplyId: String,
  supplyName: String,
  lotNumber: String,
  expiryDate: String,
  quantity: Number,
  unitPrice: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
}, { _id: false })

const inventoryTransactionSchema = new mongoose.Schema({
  _id: String,
  transactionNumber: String,
  type: { type: String, enum: ['import', 'export', 'adjustment', 'auto_deduct'] },
  site: String,
  items: [txItemSchema],
  totalAmount: { type: Number, default: 0 },
  supplierId: String,
  supplierName: String,
  reason: String,
  relatedServiceOrderId: String,
  relatedVisitId: String,
  status: { type: String, enum: ['draft', 'confirmed', 'cancelled'], default: 'draft' },
  confirmedBy: String,
  confirmedAt: String,
  createdBy: String,
  createdAt: String,
  updatedAt: String,
}, { _id: false })

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema)
