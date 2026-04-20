/**
 * Flow 1 — Exhaustive API tests for the NEW self-pick workflow:
 *   registration → study at pending_read → bacsi picks from pool
 *   → reading → report final → verified
 *
 * Key differences vs. old assignment workflow:
 *   - No more truongphong/admin assigns; bacsi picks.
 *   - No /request-telerad endpoint.
 *   - teleradStatus / teleradRequested fields removed from model.
 *   - bacsi filter = pool (unclaimed pending_read) + own picked cases.
 */
const mongoose = require('mongoose')

const BASE = process.env.BASE || 'http://localhost:3002'
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27018/linkrad_test_flow1'

const tokens = {}
let createdPatientId, createdAppointmentId, createdStudyId, createdReportId, criticalReportId
const failures = []
const passes = []

const log = (m) => console.log(m)
const ok = (name) => { passes.push(name); log(`  PASS  ${name}`) }
const fail = (name, detail) => {
  failures.push({ name, detail })
  log(`  FAIL  ${name}\n        ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}

async function call(method, path, { token, body, expect } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let data
  const text = await res.text()
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (expect !== undefined && res.status !== expect) {
    return { status: res.status, data, _wrong: true, _expected: expect }
  }
  return { status: res.status, data }
}

async function step(name, fn) {
  try { await fn() } catch (e) { fail(name, e.message || String(e)) }
}

async function login(username, password = 'pass') {
  const r = await call('POST', '/api/auth/login', { body: { username, password } })
  if (r.status !== 200) throw new Error(`login ${username} -> ${r.status} ${JSON.stringify(r.data)}`)
  tokens[username] = r.data.token
  return r.data
}

async function run() {
  log('\n=== Flow 1 API tests (self-pick workflow) ===\n')
  log(`Base: ${BASE}`)
  log(`Mongo: ${MONGODB_URI}\n`)

  await step('SETUP: login all 7 test users', async () => {
    for (const u of ['test_admin', 'test_giamdoc', 'test_tp', 'test_nv', 'test_bs', 'test_nv_other', 'test_bs2']) {
      const session = await login(u)
      if (!session.token) throw new Error(`no token for ${u}`)
    }
    ok('SETUP: login all 7 test users')
  })

  // ── 1. nhanvien creates patient ──
  await step('1. nhanvien creates patient', async () => {
    const r = await call('POST', '/api/registration/patients', {
      token: tokens.test_nv,
      body: { name: '_TEST_PATIENT_1', dob: '1990-01-15', gender: 'M', phone: '0900000001' },
    })
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.data)}`)
    createdPatientId = r.data._id
    ok(`1. nhanvien creates patient -> ${createdPatientId}`)
  })

  // ── 2. nhanvien creates appointment ──
  await step('2. nhanvien creates appointment', async () => {
    const r = await call('POST', '/api/registration/appointments', {
      token: tokens.test_nv,
      body: {
        patientId: createdPatientId, patientName: '_TEST_PATIENT_1',
        dob: '1990-01-15', gender: 'M', phone: '0900000001',
        site: 'TEST_SITE', modality: 'CT', room: 'CT-1',
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        clinicalInfo: 'Test exam — flow1',
      },
    })
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.data)}`)
    createdAppointmentId = r.data._id
    ok(`2. nhanvien creates appointment -> ${createdAppointmentId}`)
  })

  // ── 3. nhanvien → in_progress auto-creates Study ──
  await step('3. nhanvien moves appointment to in_progress (auto-creates Study)', async () => {
    const r = await call('PUT', `/api/registration/appointments/${createdAppointmentId}`, {
      token: tokens.test_nv, body: { status: 'in_progress' },
    })
    if (r.status !== 200) throw new Error(`status ${r.status}`)
    if (!r.data.studyId) throw new Error('no studyId')
    createdStudyId = r.data.studyId
    ok(`3. nhanvien moves appointment to in_progress -> study ${createdStudyId}`)
  })

  // ── 4. nhanvien → pending_read ──
  await step('4. nhanvien transitions study to pending_read', async () => {
    const r = await call('PUT', `/api/ris/studies/${createdStudyId}`, {
      token: tokens.test_nv,
      body: { status: 'pending_read', technician: 'test_nv', technicianName: 'TEST NV', studyDate: new Date().toISOString() },
    })
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.data)}`)
    if (r.data.status !== 'pending_read') throw new Error(`status=${r.data.status}`)
    ok('4. nhanvien transitions study to pending_read')
  })

  // ── 5. NEW: /request-telerad endpoint is gone ──
  await step('5. REMOVED: POST /studies/:id/request-telerad returns 404', async () => {
    const r = await call('POST', `/api/ris/studies/${createdStudyId}/request-telerad`, {
      token: tokens.test_nv, expect: 404,
    })
    if (r._wrong) throw new Error(`expected 404, got ${r.status}: ${JSON.stringify(r.data)}`)
    ok('5. REMOVED: POST /studies/:id/request-telerad returns 404')
  })

  // ── 6. NEW: bacsi sees the unclaimed study in the pool ──
  await step('6. POOL: test_bs sees unclaimed pending_read study', async () => {
    const r = await call('GET', '/api/ris/studies', { token: tokens.test_bs })
    if (r.status !== 200) throw new Error(`status ${r.status}`)
    const found = r.data.find(s => s._id === createdStudyId)
    if (!found) throw new Error(`test_bs cannot see unclaimed study in pool`)
    if (found.radiologist) throw new Error(`pool study should have no radiologist, got ${found.radiologist}`)
    ok('6. POOL: test_bs sees unclaimed pending_read study')
  })

  // ── 7. NEW: other bacsi ALSO sees the pool ──
  await step('7. POOL: test_bs2 also sees the same unclaimed pool study', async () => {
    const r = await call('GET', '/api/ris/studies', { token: tokens.test_bs2 })
    const found = r.data.find(s => s._id === createdStudyId)
    if (!found) throw new Error(`test_bs2 cannot see unclaimed study in pool`)
    ok('7. POOL: test_bs2 also sees the same unclaimed pool study')
  })

  // ── 8. NEW: nhanvien/truongphong CANNOT /pick ──
  await step('8. EDGE: truongphong gets 403 on /pick', async () => {
    const r = await call('POST', `/api/ris/studies/${createdStudyId}/pick`, {
      token: tokens.test_tp, expect: 403,
    })
    if (r._wrong) throw new Error(`expected 403, got ${r.status}`)
    ok('8. EDGE: truongphong gets 403 on /pick')
  })

  // ── 9. NEW: bacsi picks → status=reading, radiologist=self ──
  await step('9. PICK: test_bs picks → status=reading, radiologist=test_bs', async () => {
    const r = await call('POST', `/api/ris/studies/${createdStudyId}/pick`, { token: tokens.test_bs })
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.data)}`)
    if (r.data.status !== 'reading') throw new Error(`status=${r.data.status}, expected reading`)
    if (r.data.radiologist !== 'test_bs') throw new Error(`radiologist=${r.data.radiologist}`)
    if (!r.data.assignedAt) throw new Error('assignedAt not set')
    ok('9. PICK: test_bs picks → status=reading, radiologist=test_bs')
  })

  // ── 10. NEW: second bacsi cannot pick same study (409) ──
  await step('10. RACE: test_bs2 gets 409 picking already-claimed study', async () => {
    const r = await call('POST', `/api/ris/studies/${createdStudyId}/pick`, {
      token: tokens.test_bs2, expect: 409,
    })
    if (r._wrong) throw new Error(`expected 409, got ${r.status}: ${JSON.stringify(r.data)}`)
    ok('10. RACE: test_bs2 gets 409 picking already-claimed study')
  })

  // ── 11. NEW: test_bs2 no longer sees the study (it's out of pool + not theirs) ──
  await step('11. POOL: after pick, test_bs2 does NOT see the study', async () => {
    const r = await call('GET', '/api/ris/studies', { token: tokens.test_bs2 })
    const found = r.data.find(s => s._id === createdStudyId)
    if (found) throw new Error(`test_bs2 still sees study ${createdStudyId} after test_bs picked it`)
    ok('11. POOL: after pick, test_bs2 does NOT see the study')
  })

  // ── 12. EDGE: test_bs2 cannot update test_bs's study ──
  await step('12. EDGE: test_bs2 gets 403 updating study owned by test_bs', async () => {
    const r = await call('PUT', `/api/ris/studies/${createdStudyId}`, {
      token: tokens.test_bs2, expect: 403, body: { status: 'reading' },
    })
    if (r._wrong) throw new Error(`expected 403, got ${r.status}: ${JSON.stringify(r.data)}`)
    ok('12. EDGE: test_bs2 gets 403 updating study owned by test_bs')
  })

  // ── 13. bacsi writes draft report ──
  await step('13. bacsi writes draft report', async () => {
    const r = await call('POST', '/api/ris/reports', {
      token: tokens.test_bs,
      body: {
        studyId: createdStudyId, status: 'draft',
        technique: 'CT ngực với cản quang',
        findings: 'No abnormality.',
        impression: 'Normal CT chest.',
      },
    })
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.data)}`)
    if (r.data.radiologistId !== 'test_bs') throw new Error(`radiologistId=${r.data.radiologistId}`)
    createdReportId = r.data._id
    ok(`13. bacsi writes draft report -> ${createdReportId}`)
  })

  // ── 14. bacsi marks final → study=reported ──
  await step('14. bacsi marks report final → study=reported, reportedAt set', async () => {
    const r = await call('POST', '/api/ris/reports', {
      token: tokens.test_bs,
      body: { studyId: createdStudyId, status: 'final' },
    })
    if (r.status !== 200) throw new Error(`status ${r.status}`)
    if (r.data.status !== 'final') throw new Error(`report status=${r.data.status}`)
    const sr = await call('GET', '/api/ris/studies', { token: tokens.test_bs })
    const study = sr.data.find(s => s._id === createdStudyId)
    if (!study) throw new Error('study not found')
    if (study.status !== 'reported') throw new Error(`study status=${study.status}`)
    if (!study.reportedAt) throw new Error('reportedAt not set')
    ok('14. bacsi marks report final → study=reported, reportedAt set')
  })

  // ── 15. EDGE: truongphong cannot verify ──
  await step('15. EDGE: truongphong gets 403 setting status=verified', async () => {
    const r = await call('PUT', `/api/ris/studies/${createdStudyId}`, {
      token: tokens.test_tp, expect: 403, body: { status: 'verified' },
    })
    if (r._wrong) throw new Error(`expected 403, got ${r.status}`)
    ok('15. EDGE: truongphong gets 403 setting status=verified')
  })

  // ── 16. admin verifies ──
  await step('16. admin sets status=verified, verifiedAt', async () => {
    const verifiedAt = new Date().toISOString()
    const r = await call('PUT', `/api/ris/studies/${createdStudyId}`, {
      token: tokens.test_admin, body: { status: 'verified', verifiedAt },
    })
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.data)}`)
    if (r.data.status !== 'verified') throw new Error(`status=${r.data.status}`)
    ok('16. admin sets status=verified, verifiedAt')
  })

  // ── 17. EDGE: truongphong CANNOT /assign (admin-only now) ──
  await step('17. EDGE: truongphong gets 403 on /assign (admin-only)', async () => {
    const r = await call('POST', `/api/ris/studies/${createdStudyId}/assign`, {
      token: tokens.test_tp, expect: 403,
      body: { radiologistId: 'test_bs2', radiologistName: 'X' },
    })
    if (r._wrong) throw new Error(`expected 403, got ${r.status}`)
    ok('17. EDGE: truongphong gets 403 on /assign (admin-only)')
  })

  // ── 18. admin override: reassign to test_bs2 ──
  await step('18. ADMIN OVERRIDE: /assign reassigns to test_bs2', async () => {
    const r = await call('POST', `/api/ris/studies/${createdStudyId}/assign`, {
      token: tokens.test_admin,
      body: { radiologistId: 'test_bs2', radiologistName: 'TEST Bác sĩ 2' },
    })
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.data)}`)
    if (r.data.radiologist !== 'test_bs2') throw new Error(`radiologist=${r.data.radiologist}`)
    ok('18. ADMIN OVERRIDE: /assign reassigns to test_bs2')
  })

  // ── 19. EDGE: cross-site isolation still works for nhanvien ──
  await step('19. EDGE: OTHER_SITE nhanvien does NOT see TEST_SITE study', async () => {
    const r = await call('GET', '/api/ris/studies', { token: tokens.test_nv_other })
    const found = r.data.find(s => s._id === createdStudyId)
    if (found) throw new Error(`OTHER_SITE nv saw TEST_SITE study`)
    ok('19. EDGE: OTHER_SITE nhanvien does NOT see TEST_SITE study')
  })

  // ── 20. CRITICAL finding: pick + write report with critical=true ──
  await step('20. CRITICAL: 2nd study, pick + critical report', async () => {
    const p = await call('POST', '/api/registration/patients', {
      token: tokens.test_nv,
      body: { name: '_TEST_PATIENT_2_CRITICAL', dob: '1980-01-01', gender: 'F', phone: '0900000002' },
    })
    const a = await call('POST', '/api/registration/appointments', {
      token: tokens.test_nv,
      body: {
        patientId: p.data._id, patientName: '_TEST_PATIENT_2_CRITICAL', gender: 'F',
        site: 'TEST_SITE', modality: 'MRI',
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      },
    })
    const a2 = await call('PUT', `/api/registration/appointments/${a.data._id}`, {
      token: tokens.test_nv, body: { status: 'in_progress' },
    })
    const sid = a2.data.studyId
    await call('PUT', `/api/ris/studies/${sid}`, {
      token: tokens.test_nv, body: { status: 'pending_read', technician: 'test_nv', technicianName: 'TEST NV' },
    })
    // Bacsi picks (instead of truongphong assigning)
    const pick = await call('POST', `/api/ris/studies/${sid}/pick`, { token: tokens.test_bs })
    if (pick.status !== 200) throw new Error(`pick failed: ${pick.status}`)
    const r = await call('POST', '/api/ris/reports', {
      token: tokens.test_bs,
      body: {
        studyId: sid, status: 'draft',
        findings: 'Large mass detected.',
        impression: 'Suspicious mass.',
        criticalFinding: true,
        criticalNote: 'URGENT: Suspected malignancy.',
      },
    })
    if (r.status !== 200) throw new Error(`report ${r.status}: ${JSON.stringify(r.data)}`)
    criticalReportId = r.data._id
    ok(`20. CRITICAL: 2nd study, pick + critical report -> ${criticalReportId}`)
  })

  // ── 21. CRITICAL notification was created with correct targeting ──
  await step('21. CRITICAL: notification fired with toRoles & toSites=TEST_SITE', async () => {
    await mongoose.connect(MONGODB_URI)
    const Notification = require('../models/Notification')
    const notifs = await Notification.find({ resourceId: String(criticalReportId), type: 'critical_finding' }).lean()
    if (notifs.length === 0) throw new Error('no critical-finding notification')
    const n = notifs[0]
    if (n.severity !== 'critical') throw new Error(`severity=${n.severity}`)
    const expectRoles = ['admin', 'giamdoc', 'truongphong'].sort()
    const gotRoles = (n.toRoles || []).slice().sort()
    if (JSON.stringify(gotRoles) !== JSON.stringify(expectRoles))
      throw new Error(`toRoles=${JSON.stringify(gotRoles)}`)
    if (!n.toSites.includes('TEST_SITE')) throw new Error(`toSites=${JSON.stringify(n.toSites)}`)
    await mongoose.disconnect()
    ok('21. CRITICAL: notification fired with toRoles & toSites=TEST_SITE')
  })

  log(`\n=== SUMMARY ===`)
  log(`PASS: ${passes.length}`)
  log(`FAIL: ${failures.length}`)
  if (failures.length) {
    log('\nFailures:')
    failures.forEach(f => log(`  - ${f.name}\n    ${f.detail}`))
    process.exit(1)
  }
  process.exit(0)
}

run().catch(e => { console.error('FATAL:', e); process.exit(2) })
