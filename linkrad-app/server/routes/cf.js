const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()

const ANNUAL_FILE = path.join(__dirname, '../data/annual-cf.json')
const MONTHLY_FILE = path.join(__dirname, '../data/monthly-cf.json')

router.get('/annual', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(ANNUAL_FILE, 'utf8'))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/annual', (req, res) => {
  try {
    const data = req.body
    fs.writeFileSync(ANNUAL_FILE, JSON.stringify(data, null, 2))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/monthly', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(MONTHLY_FILE, 'utf8'))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/monthly', (req, res) => {
  try {
    const data = req.body
    fs.writeFileSync(MONTHLY_FILE, JSON.stringify(data, null, 2))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
