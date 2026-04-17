const mongoose = require('mongoose')

const patientSchema = new mongoose.Schema({
  _id: String,
  patientId: String,          // BN-YYYYMMDD-seq (display ID)
  name: { type: String, required: true },
  phone: String,
  email: String,
  dob: String,                // YYYY-MM-DD
  gender: { type: String, enum: ['M', 'F', 'other'] },
  idCard: String,             // CMND/CCCD
  insuranceNumber: String,    // Mã BHYT
  province: String,           // Tỉnh/Thành phố
  district: String,           // Quận/huyện
  ward: String,               // Phường/Xã
  address: String,
  registeredSite: String,     // site where first registered
  notes: String,
  createdAt: String,
  updatedAt: String,
}, { _id: false })

module.exports = mongoose.model('Patient', patientSchema)
