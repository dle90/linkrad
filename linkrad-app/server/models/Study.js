const mongoose = require('mongoose')

const studySchema = new mongoose.Schema({
  _id: String,
  studyUID: String,
  patientName: String,
  patientId: String,
  dob: String,
  gender: { type: String, enum: ['M', 'F'] },
  modality: { type: String, enum: ['CT', 'MRI', 'XR', 'US'] },
  bodyPart: String,
  clinicalInfo: String,
  site: String,
  scheduledDate: String,
  studyDate: String,
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'pending_read', 'reported', 'verified'],
    default: 'scheduled',
  },
  priority: {
    type: String,
    enum: ['routine', 'urgent', 'stat'],
    default: 'routine',
  },
  technician: String,
  technicianName: String,
  radiologist: String,
  radiologistName: String,
  reportText: { type: String, default: '' },
  reportedAt: String,
  verifiedAt: String,
  createdAt: String,
  updatedAt: String,
}, { _id: false })

module.exports = mongoose.model('Study', studySchema)
