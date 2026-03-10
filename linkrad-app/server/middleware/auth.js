const { tokens } = require('../routes/auth')

const requireAdmin = (req, res, next) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '')
  const session = token ? tokens.get(token) : null
  if (!session || session.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ admin mới có quyền thực hiện thao tác này' })
  }
  next()
}

// Any authenticated user (any role)
const requireAuth = (req, res, next) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '')
  const session = token ? tokens.get(token) : null
  if (!session) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' })
  }
  req.user = session  // { username, role, department, displayName }
  next()
}

module.exports = { requireAdmin, requireAuth }
