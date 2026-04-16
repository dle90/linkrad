const mongoose = require('mongoose')

const rolePermissionSchema = new mongoose.Schema({
  _id: String,           // role name: 'admin', 'bacsi', etc.
  label: String,
  description: String,
  permissions: [String], // array of permission keys
  updatedAt: String,
}, { _id: false })

module.exports = mongoose.model('RolePermission', rolePermissionSchema)
