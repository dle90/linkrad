const mongoose = require('mongoose')
const schema = new mongoose.Schema({
  _id: String,
  code: String,
  name: String,
  level: { type: String, enum: ['trung_uong', 'tinh', 'huyen', 'xa', 'phong_kham', 'other'], default: 'other' },
  address: String,
  phone: String,
  description: String,      // Mô tả
  provinceCode: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: String, updatedAt: String,
}, { _id: false })
module.exports = mongoose.model('MedicalFacility', schema)
