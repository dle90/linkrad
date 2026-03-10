const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()
const DATA_FILE = path.join(__dirname, '../data/balance-sheet.json')

router.get('/', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/', (req, res) => {
  try {
    const data = req.body
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
