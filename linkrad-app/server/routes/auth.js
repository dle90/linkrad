const express = require('express')
const crypto = require('crypto')
const User = require('../models/User')

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
  try {
    const { username, password } = req.body
    const user = await User.findById(username)
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' })
    }
    const session = { username, role: user.role, department: user.department || null, displayName: user.displayName || username }
    const token = sign(session)
    res.json({ token, ...session })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/logout', (req, res) => {
  // Stateless — client discards the token
  res.json({ ok: true })
})

// POST /auth/users — admin only: create or update a user
router.post('/users', async (req, res) => {
  try {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '')
    const session = token ? verify(token) : null
    if (!session || session.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' })
    }
    const { username, password, role, department, displayName } = req.body
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'username, password, role required' })
    }
    const user = await User.findByIdAndUpdate(
      username,
      { _id: username, password, role, department: department || null, displayName: displayName || username },
      { upsert: true, new: true }
    )
    res.json({ ok: true, user: { username: user._id, role: user.role, displayName: user.displayName } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /auth/users — admin only: list all users
router.get('/users', async (req, res) => {
  try {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '')
    const session = token ? verify(token) : null
    if (!session || session.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' })
    }
    const users = await User.find({}).select('-password')
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = { router, verify }
