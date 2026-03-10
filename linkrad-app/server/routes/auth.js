const express = require('express')
const crypto = require('crypto')
const pool = require('../db')

const router = express.Router()
const SECRET = process.env.SESSION_SECRET || 'linkrad-secret-2024'

// Stateless HMAC-signed tokens — survive server restarts
const sign = (payload) => {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

const verify = (token) => {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const data = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
    if (sig !== expected) return null
    return JSON.parse(Buffer.from(data, 'base64url').toString())
  } catch { return null }
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ? AND password = ?',
      [username, password]
    )
    const user = rows[0]
    if (!user) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' })
    }
    const session = {
      username: user.username,
      role: user.role,
      department: user.department || null,
      displayName: user.displayName || user.username,
    }
    const token = sign(session)
    res.json({ token, ...session })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/logout', (req, res) => {
  res.json({ ok: true })
})

module.exports = { router, verify }
