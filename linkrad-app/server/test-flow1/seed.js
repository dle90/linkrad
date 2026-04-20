/**
 * Seed minimal test data for Flow 1 (registration → verified) tests.
 * Connects via MONGODB_URI env var (caller is responsible for pointing it at the test DB).
 *
 * Creates: 1 site, RolePermission for each role, 5 test users (one per role).
 * All test users prefixed with "test_" to make cleanup obvious.
 */
const path = require('path')
const mongoose = require('mongoose')
const { DEFAULT_ROLE_PERMISSIONS } = require('../shared/permissions')

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

async function main() {
  await mongoose.connect(URI)
  console.log('connected to', URI)

  const User = require('../models/User')
  const RolePermission = require('../models/RolePermission')

  // 1) Role-permission rows (consumed by auth login + middleware)
  await RolePermission.deleteMany({})
  const rpDocs = Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, perms]) => ({
    _id: role, permissions: perms,
  }))
  await RolePermission.insertMany(rpDocs)
  console.log(`inserted ${rpDocs.length} role-permission rows`)

  // 2) Test users — all at site "TEST_SITE"
  const TEST_SITE = 'TEST_SITE'
  const users = [
    { _id: 'test_admin',   password: 'pass', role: 'admin',      department: null,       displayName: 'TEST Admin' },
    { _id: 'test_giamdoc', password: 'pass', role: 'giamdoc',    department: null,       displayName: 'TEST Giám đốc' },
    { _id: 'test_tp',      password: 'pass', role: 'truongphong', department: TEST_SITE, displayName: 'TEST Trưởng phòng' },
    { _id: 'test_nv',      password: 'pass', role: 'nhanvien',   department: TEST_SITE,  displayName: 'TEST Nhân viên' },
    { _id: 'test_bs',      password: 'pass', role: 'bacsi',      department: null,       displayName: 'TEST Bác sĩ' },
    // a 2nd nhanvien at a different site, to test cross-site isolation
    { _id: 'test_nv_other', password: 'pass', role: 'nhanvien',  department: 'OTHER_SITE', displayName: 'TEST NV Khác site' },
    // a 2nd bacsi to test cross-doctor isolation
    { _id: 'test_bs2',     password: 'pass', role: 'bacsi',      department: null,       displayName: 'TEST Bác sĩ 2' },
  ]
  await User.deleteMany({ _id: /^test_/ })
  await User.insertMany(users)
  console.log(`inserted ${users.length} test users`)

  await mongoose.disconnect()
  console.log('seed done')
}

main().catch(e => { console.error(e); process.exit(1) })
