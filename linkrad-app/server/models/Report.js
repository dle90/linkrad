const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema({
  studyId:           { type: String, required: true },
  studyUID:          String,
  radiologistId:     String,
  radiologistName:   String,
  status:            { type: String, enum: ['draft', 'preliminary', 'final'], default: 'draft' },
  technique:         { type: String, default: '' },
  clinicalInfo:      { type: String, default: '' },
  findings:          { type: String, default: '' },
  impression:        { type: String, default: '' },
  recommendation:    { type: String, default: '' },
  createdAt:         String,
  updatedAt:         String,
  finalizedAt:       String,
})

module.exports = mongoose.model('Report', reportSchema)
