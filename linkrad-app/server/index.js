const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const { router: authRouter } = require('./routes/auth')
const sitesRouter = require('./routes/sites')
const plRouter = require('./routes/pl')
const cfRouter = require('./routes/cf')
const bsRouter = require('./routes/bs')
const breakevenRouter = require('./routes/breakeven')
const actualsRouter = require('./routes/actuals')
const tasksRouter = require('./routes/tasks')
const { requireAdmin } = require('./middleware/auth')
const initDb = require('./initDb')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Copy seed JSON files to DATA_DIR volume on first deploy
const DATA_DIR = process.env.DATA_DIR
const SEED_DIR = path.join(__dirname, 'data')
if (DATA_DIR && DATA_DIR !== SEED_DIR) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const VOLUME_FILES = ['sites.json', 'annual-pl.json', 'monthly-pl.json', 'annual-cf.json', 'monthly-cf.json', 'balance-sheet.json', 'breakeven.json']
  for (const file of VOLUME_FILES) {
    const dest = path.join(DATA_DIR, file)
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(SEED_DIR, file), dest)
      console.log(`Seeded ${file} to volume`)
    }
  }
}

// Auth routes (public)
app.use('/api/auth', authRouter)

// Guard writes for financial data routes (admin only)
const guardWrites = (req, res, next) => {
  if (req.method === 'GET') return next()
  return requireAdmin(req, res, next)
}

app.use('/api/sites', guardWrites, sitesRouter)
app.use('/api/pl', guardWrites, plRouter)
app.use('/api/cf', guardWrites, cfRouter)
app.use('/api/bs', guardWrites, bsRouter)
app.use('/api/breakeven', guardWrites, breakevenRouter)
app.use('/api/actuals', guardWrites, actualsRouter)
app.use('/api/tasks', tasksRouter)

// Serve React build in production
const clientDist = path.join(__dirname, '../client/dist')
app.use(express.static(clientDist))
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

// Initialize DB then start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LinkRad server running on http://localhost:${PORT}`)
    })
  })
  .catch(err => {
    console.error('Failed to initialize database:', err)
    process.exit(1)
  })
