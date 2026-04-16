const mongoose = require('mongoose')

const supplySchema = new mongoose.Schema({
  _id: String,
  code: String,
  name: String,
  categoryId: String,
  unit: String,
  minimumStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
  site: String,
  supplierId: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: String,
  updatedAt: String,
}, { _id: false })

module.exports = mongoose.model('Supply', supplySchema)
