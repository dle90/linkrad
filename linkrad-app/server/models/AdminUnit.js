const mongoose = require('mongoose')
const schema = new mongoose.Schema({
  _id: String,
  code: String,
  name: String,
  level: { type: String, enum: ['province', 'district', 'ward'] },
  parentCode: String,
  fullName: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { _id: false })
module.exports = mongoose.model('AdminUnit', schema)
