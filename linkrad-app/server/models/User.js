const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  _id: String,          // username
  password: String,
  role: String,
  department: String,
  displayName: String,
}, { _id: false })

// Use _id as the primary key (username)
userSchema.set('_id', true)

module.exports = mongoose.model('User', userSchema)
