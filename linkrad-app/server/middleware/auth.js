const { tokens } = require('../routes/auth')

const requireAdmin = (req, res, next) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '')
  const session = token ? tokens.get(token) : null
  if (!session || session.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ admin mới có quyền thực hiện thao tác này' })
  }
  next()
}

module.exports = { requireAdmin }
