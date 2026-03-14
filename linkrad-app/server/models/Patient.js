const mongoose = require('mongoose')

const patientSchema = new mongoose.Schema({
  _id: String,
  patientId: String,          // BN-YYYYMMDD-seq (display ID)
  name: { type: String, required: true },
  dob: String,                // YYYY-MM-DD
  gender: { type: String, enum: ['M', 'F', 'other'] },
  phone: String,
  address: String,
  idCard: String,
  insuranceNumber: String,
  registeredSite: String,     // site where first registered
  notes: String,
  createdAt: String,
  updatedAt: String,
}, { _id: false })

module.exports = mongoose.model('Patient', patientSchema)
