const mongoose = require('mongoose')

const inventoryLotSchema = new mongoose.Schema({
  _id: String,
  supplyId: String,
  site: String,
  lotNumber: String,
  expiryDate: String,
  importTransactionId: String,
  importDate: String,
  initialQuantity: Number,
  currentQuantity: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 },
  status: { type: String, enum: ['available', 'expired', 'depleted'], default: 'available' },
  createdAt: String,
}, { _id: false })

module.exports = mongoose.model('InventoryLot', inventoryLotSchema)
