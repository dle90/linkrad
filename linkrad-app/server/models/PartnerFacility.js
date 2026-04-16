const mongoose = require('mongoose')
const schema = new mongoose.Schema({
  _id: String,
  code: String,
  name: String,
  type: { type: String, enum: ['hospital', 'clinic', 'lab', 'other'], default: 'hospital' },
  address: String,
  phone: String,
  contactPerson: String,
  email: String,
  notes: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: String, updatedAt: String,
}, { _id: false })
module.exports = mongoose.model('PartnerFacility', schema)
