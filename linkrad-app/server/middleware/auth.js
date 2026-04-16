const { verify } = require('../routes/auth')

const requireAdmin = (req, res, next) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '')
  const session = token ? verify(token) : null
  if (!session || session.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ admin mới có quyền thực hiện thao tác này' })
  }
  req.user = session
  next()
}

// Any authenticated user (any role)
const requireAuth = (req, res, next) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '')
  const session = token ? verify(token) : null
  if (!session) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' })
  }
  req.user = session  // { username, role, department, displayName }
  next()
}

// Patient portal auth (token.type === 'patient')
const requirePatient = (req, res, next) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '')
  const session = token ? verify(token) : null
  if (!session || session.type !== 'patient') {
    return res.status(401).json({ error: 'Vui lòng đăng nhập cổng bệnh nhân' })
  }
  req.patient = session  // { type: 'patient', patientId, phone }
  next()
}

// Partner portal auth (token.type === 'partner')
const requirePartner = (req, res, next) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '')
  const session = token ? verify(token) : null
  if (!session || session.type !== 'partner') {
    return res.status(401).json({ error: 'Vui lòng đăng nhập cổng đối tác' })
  }
  req.partner = session  // { type: 'partner', facilityId, accountId, displayName }
  next()
}

// ── Permission-based auth (additive layer) ──────────────
let _permCache = {}
let _permCacheTime = 0

async function getRolePerms(role) {
  if (Date.now() - _permCacheTime < 300000 && _permCache[role]) return _permCache[role]
  const RolePermission = require('../models/RolePermission')
  const all = await RolePermission.find({}).lean()
  _permCache = {}
  all.forEach(r => { _permCache[r._id] = r.permissions || [] })
  _permCacheTime = Date.now()
  return _permCache[role] || []
}

const requirePermission = (permKey) => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' })
  if (req.user.role === 'admin') return next()
  // Fast path: check token-embedded permissions
  if (req.user.permissions && req.user.permissions.includes(permKey)) return next()
  // Fallback: check DB
  const perms = await getRolePerms(req.user.role)
  if (perms.includes(permKey) || perms.includes('system.admin')) return next()
  return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' })
}

module.exports = { requireAdmin, requireAuth, requirePatient, requirePartner, requirePermission }
