const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const { requireAuth, requirePermission } = require('../middleware/auth')
const Department = require('../models/Department')
const Employee = require('../models/Employee')
const RolePermission = require('../models/RolePermission')
const User = require('../models/User')
const { PERMISSIONS, PERMISSION_GROUPS } = require('../shared/permissions')

const now = () => new Date().toISOString()

// All HR routes require authentication
router.use(requireAuth)

// ═══════════════════════════════════════════════════════
// EMPLOYEES
// ═══════════════════════════════════════════════════════

router.get('/employees', async (req, res) => {
  try {
    const { q, departmentId, status, site, limit = 100 } = req.query
    const filter = {}
    if (q) {
      const re = new RegExp(q, 'i')
      filter.$or = [{ fullName: re }, { employeeCode: re }, { phone: re }, { email: re }]
    }
    if (departmentId) filter.departmentId = departmentId
    if (status) filter.employmentStatus = status
    if (site) filter.site = site
    const employees = await Employee.find(filter).sort({ employeeCode: 1 }).limit(Number(limit)).lean()
    res.json(employees)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/employees/:id', async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).lean()
    if (!emp) return res.status(404).json({ error: 'Không tìm thấy nhân viên' })
    res.json(emp)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/employees', requirePermission('hr.manage'), async (req, res) => {
  try {
    const { fullName, phone, email, position, departmentId, departmentName, site,
      hireDate, birthDate, gender, address, idNumber, notes, userId } = req.body
    if (!fullName) return res.status(400).json({ error: 'Vui lòng nhập họ tên' })

    // Auto-generate employee code
    const count = await Employee.countDocuments()
    const code = `NV-${String(count + 1).padStart(3, '0')}`

    const emp = new Employee({
      _id: crypto.randomUUID(),
      employeeCode: code,
      userId: userId || '',
      fullName, phone: phone || '', email: email || '',
      position: position || '', departmentId: departmentId || '',
      departmentName: departmentName || '', site: site || '',
      hireDate: hireDate || '', birthDate: birthDate || '',
      gender: gender || 'other', address: address || '',
      idNumber: idNumber || '', notes: notes || '',
      employmentStatus: 'active',
      createdAt: now(), updatedAt: now(),
    })
    await emp.save()
    res.status(201).json({ ok: true, employee: emp.toObject() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/employees/:id', requirePermission('hr.manage'), async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: now() }
    delete update._id
    delete update.employeeCode // cannot change code
    const emp = await Employee.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!emp) return res.status(404).json({ error: 'Không tìm thấy nhân viên' })
    res.json({ ok: true, employee: emp.toObject() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/employees/:id', requirePermission('hr.manage'), async (req, res) => {
  try {
    const emp = await Employee.findByIdAndUpdate(req.params.id, { employmentStatus: 'inactive', updatedAt: now() }, { new: true })
    if (!emp) return res.status(404).json({ error: 'Không tìm thấy nhân viên' })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════

router.get('/departments', async (req, res) => {
  try {
    const { type, status, q } = req.query
    const filter = {}
    if (type) filter.type = type
    if (status) filter.status = status
    if (q) filter.name = new RegExp(q, 'i')
    const depts = await Department.find(filter).sort({ type: 1, code: 1 }).lean()
    res.json(depts)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/departments', requirePermission('hr.manage'), async (req, res) => {
  try {
    const { code, name, type, parentId, headUserId, headName, phone, address, description } = req.body
    if (!code || !name) return res.status(400).json({ error: 'Vui lòng nhập mã và tên phòng ban' })

    const dept = new Department({
      _id: crypto.randomUUID(),
      code, name, type: type || 'hq',
      parentId: parentId || '', headUserId: headUserId || '', headName: headName || '',
      phone: phone || '', address: address || '', description: description || '',
      status: 'active', createdAt: now(), updatedAt: now(),
    })
    await dept.save()
    res.status(201).json({ ok: true, department: dept.toObject() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/departments/:id', requirePermission('hr.manage'), async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: now() }
    delete update._id
    const dept = await Department.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!dept) return res.status(404).json({ error: 'Không tìm thấy phòng ban' })
    res.json({ ok: true, department: dept.toObject() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/departments/:id', requirePermission('hr.manage'), async (req, res) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, { status: 'inactive', updatedAt: now() }, { new: true })
    if (!dept) return res.status(404).json({ error: 'Không tìm thấy phòng ban' })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════
// ROLES & PERMISSIONS
// ═══════════════════════════════════════════════════════

router.get('/permissions', (req, res) => {
  res.json({ permissions: PERMISSIONS, groups: PERMISSION_GROUPS })
})

router.get('/roles', async (req, res) => {
  try {
    const roles = await RolePermission.find({}).sort({ _id: 1 }).lean()
    res.json(roles)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/roles/:roleId', requirePermission('system.admin'), async (req, res) => {
  try {
    const { permissions, label, description } = req.body
    const update = { updatedAt: now() }
    if (permissions !== undefined) update.permissions = permissions
    if (label !== undefined) update.label = label
    if (description !== undefined) update.description = description

    const role = await RolePermission.findByIdAndUpdate(req.params.roleId, update, { new: true })
    if (!role) return res.status(404).json({ error: 'Không tìm thấy vai trò' })
    res.json({ ok: true, role })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════
// USERS (for linking employees to accounts)
// ═══════════════════════════════════════════════════════

router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password').lean()
    res.json(users)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
