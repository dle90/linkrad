const express = require('express')
const path    = require('path')
const fs      = require('fs')

const router   = express.Router()
const DATA_FILE = path.join(__dirname, '../data/crm.json')

const readData  = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}')
const writeData = (d) => fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2))

// GET /api/crm
router.get('/', (req, res) => {
  try { res.json(readData()) }
  catch { res.json({}) }
})

// PUT /api/crm  — admin only (guarded by server-level middleware)
router.put('/', (req, res) => {
  try {
    writeData(req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
