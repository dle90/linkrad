const mongoose = require('mongoose')

const supplySchema = new mongoose.Schema({
  _id: String,
  code: String,
  name: String,
  categoryId: String,
  unit: String,
  packagingSpec: String,        // Quy cách đóng gói (e.g. "Hộp 10 ống")
  conversionRate: { type: Number, default: 1 }, // SL chuyển đổi: 1 package = N base units
  minimumStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
  site: String,
  supplierId: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: String,
  updatedAt: String,
}, { _id: false })

module.exports = mongoose.model('Supply', supplySchema)
