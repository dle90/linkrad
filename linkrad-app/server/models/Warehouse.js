const mongoose = require('mongoose')

const warehouseSchema = new mongoose.Schema({
  _id: String,
  code: String,
  name: String,
  site: String,
  address: String,
  manager: String,
  phone: String,
  description: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: String,
  updatedAt: String,
}, { _id: false })

module.exports = mongoose.model('Warehouse', warehouseSchema)
