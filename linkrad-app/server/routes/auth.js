const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const router = express.Router()
const USERS_FILE = path.join(__dirname, '../data/users.json')
const SECRET = process.env.SESSION_SECRET || 'linkrad-secret-2024'

const loadUsers = () => {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) }
  catch { return {} }
}

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

router.post('/login', (req, res) => {
  const { username, password } = req.body
  const users = loadUsers()
  const user = users[username]
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' })
  }
  const session = { username, role: user.role, department: user.department || null, displayName: user.displayName || username }
  const token = sign(session)
  res.json({ token, ...session })
})

router.post('/logout', (req, res) => {
  // Stateless — client discards the token
  res.json({ ok: true })
})

module.exports = { router, verify }
