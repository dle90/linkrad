const express = require('express')
const pool = require('../db')

const router = express.Router()

const getAll = async () => {
  const [rows] = await pool.execute('SELECT month_key, data FROM actuals')
  const result = {}
  rows.forEach(r => { result[r.month_key] = typeof r.data === 'string' ? JSON.parse(r.data) : r.data })
  return result
}

router.get('/', async (req, res) => {
  try { res.json(await getAll()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:key', async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT month_key FROM actuals WHERE month_key = ?', [req.params.key])
    if (existing.length > 0) {
      await pool.execute('UPDATE actuals SET data = ? WHERE month_key = ?', [JSON.stringify(req.body), req.params.key])
    } else {
      await pool.execute('INSERT INTO actuals (month_key, data) VALUES (?, ?)', [req.params.key, JSON.stringify(req.body)])
    }
    res.json(await getAll())
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:key', async (req, res) => {
  try {
    await pool.execute('DELETE FROM actuals WHERE month_key = ?', [req.params.key])
    res.json(await getAll())
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
