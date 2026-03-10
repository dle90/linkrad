const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const router = express.Router()
const USERS_FILE = path.join(__dirname, '../data/users.json')

// In-memory token store: token -> { username, role }
const tokens = new Map()

const loadUsers = () => {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) }
  catch { return {} }
}

router.post('/login', (req, res) => {
  const { username, password } = req.body
  const users = loadUsers()
  const user = users[username]
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' })
  }
  const token = crypto.randomUUID()
  tokens.set(token, { username, role: user.role, department: user.department || null, displayName: user.displayName || username })
  res.json({ token, role: user.role, username, department: user.department || null, displayName: user.displayName || username })
})

router.post('/logout', (req, res) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '')
  if (token) tokens.delete(token)
  res.json({ ok: true })
})

module.exports = { router, tokens }
