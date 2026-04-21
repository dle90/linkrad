/**
 * Wire the 3 existing Orthanc DICOM studies into RIS as Study records.
 *
 * Upserts by studyUID so this script is idempotent.
 * Uses MONGODB_URI from linkrad-app/server/.env (production Atlas).
 *
 * Created on 2026-04-20 after discovering Orthanc had 3 DICOM studies with
 * no corresponding RIS records — the synthetic seed had overwritten the
 * originals that used to link to these UIDs.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

const now = new Date().toISOString()
const today = now.slice(0, 10)

const STUDIES = [
  {
    _id: 'std-dicom-yetkieu-001',
    studyUID: '1.2.840.113619.2.25.4.2147483647.1773389964.250',
    patientName: 'NGUYEN AN BINH',
    patientId: 'PACS-ADM35884',
    dob: '2004-02-10',
    gender: 'F',
    modality: 'MRI',
    bodyPart: 'Sọ não',
    clinicalInfo: 'Sample DICOM — MR Ax T2 FLAIR FS (28 instances).',
    site: 'Hà Nội',                // LINKRAD YET KIEU — Yết Kiêu street, Hà Nội
    scheduledDate: today,
    studyDate: now,
    status: 'pending_read',
    priority: 'routine',
    imageStatus: 'available',
    imageCount: 28,
  },
  {
    _id: 'std-dicom-thanhhoa-001',
    studyUID: '1.2.840.113619.2.417.3.2831206913.16.1773879871.127',
    patientName: 'NGO THI THE',
    patientId: 'PACS-LR033915',
    dob: '1969-01-01',
    gender: 'F',
    modality: 'CT',
    bodyPart: 'Lồng ngực',
    clinicalInfo: 'Sample DICOM — CT lồng ngực 32 dãy, không cản quang (651 instances, 2 series).',
    site: 'Thanh Hóa',
    scheduledDate: today,
    studyDate: now,
    status: 'pending_read',
    priority: 'routine',
    imageStatus: 'available',
    imageCount: 651,
  },
  {
    _id: 'std-dicom-ttchandoan-001',
    studyUID: '123.181103650958491.1860141137938822',
    patientName: 'PHAM THI HUONG',
    patientId: 'PACS-LR033904',
    dob: '1976-01-01',
    gender: 'F',
    modality: 'MRI',
    bodyPart: 'Sọ não',
    clinicalInfo: 'Sample DICOM — MRI sọ não 1.5T (342 instances, 7 series).',
    site: 'Hà Nội',                // TT CHAN DOAN Y KHOA LINKRAD — pick Hà Nội as sensible default
    scheduledDate: today,
    studyDate: now,
    status: 'pending_read',
    priority: 'routine',
    imageStatus: 'available',
    imageCount: 342,
  },
]

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) { console.error('MONGODB_URI missing'); process.exit(1) }
  console.log('Connecting to Mongo...')
  await mongoose.connect(uri)
  const Study = require('../models/Study')

  for (const s of STUDIES) {
    const existing = await Study.findOne({ studyUID: s.studyUID }).lean()
    if (existing && existing._id !== s._id) {
      console.log(`SKIP  ${s.studyUID} already in Mongo as _id=${existing._id}, patient=${existing.patientName}`)
      continue
    }
    const doc = { ...s, createdAt: existing?.createdAt || now, updatedAt: now }
    await Study.findByIdAndUpdate(s._id, { $set: doc }, { upsert: true })
    console.log(`OK    ${s._id} → ${s.patientName} (${s.modality} @ ${s.site}), uid=${s.studyUID}`)
  }

  console.log('\n--- Verify ---')
  for (const s of STUDIES) {
    const saved = await Study.findById(s._id).lean()
    console.log(`${s._id}: status=${saved?.status}, imageStatus=${saved?.imageStatus}, imageCount=${saved?.imageCount}`)
  }

  await mongoose.disconnect()
  console.log('\nDone.')
}

main().catch(e => { console.error('ERR:', e); process.exit(1) })
