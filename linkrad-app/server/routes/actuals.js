const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()
const FILE = path.join(__dirname, '../data/actuals.json')

const load = () => {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) }
  catch { return {} }
}

// GET all actuals
router.get('/', (req, res) => res.json(load()))

// PUT a single month entry: body = { key: "2026-03", data: { rev_mri, rev_ct, ... } }
router.put('/:key', (req, res) => {
  try {
    const all = load()
    all[req.params.key] = req.body
    fs.writeFileSync(FILE, JSON.stringify(all, null, 2))
    res.json(all)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE a single month
router.delete('/:key', (req, res) => {
  try {
    const all = load()
    delete all[req.params.key]
    fs.writeFileSync(FILE, JSON.stringify(all, null, 2))
    res.json(all)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
