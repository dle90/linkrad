const mongoose = require('mongoose')

const employeeSchema = new mongoose.Schema({
  _id: String,
  employeeCode: { type: String, unique: true },
  userId: { type: String, index: true },
  fullName: String,
  phone: String,
  email: String,
  position: String,
  departmentId: String,
  departmentName: String,
  site: String,
  hireDate: String,
  birthDate: String,
  gender: { type: String, enum: ['M', 'F', 'other'] },
  address: String,
  idNumber: String,
  employmentStatus: { type: String, enum: ['active', 'inactive', 'resigned'], default: 'active' },
  notes: String,
  createdAt: String,
  updatedAt: String,
}, { _id: false })

module.exports = mongoose.model('Employee', employeeSchema)
