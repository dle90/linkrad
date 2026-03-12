const express = require('express')
const cors = require('cors')
const path = require('path')

require('./db') // Connect to MongoDB

const { router: authRouter } = require('./routes/auth')
const sitesRouter = require('./routes/sites')
const plRouter = require('./routes/pl')
const cfRouter = require('./routes/cf')
const bsRouter = require('./routes/bs')
const breakevenRouter = require('./routes/breakeven')
const actualsRouter = require('./routes/actuals')
const tasksRouter = require('./routes/tasks')
const risRouter = require('./routes/ris')
const { requireAdmin } = require('./middleware/auth')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Auth routes (public — no token required)
app.use('/api/auth', authRouter)

// Middleware: protect PUT/DELETE across all /api routes
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
// Tasks: auth handled inside the router per endpoint
app.use('/api/tasks', tasksRouter)
// RIS: auth handled inside the router per endpoint
app.use('/api/ris', risRouter)

// Serve React build in production
const clientDist = path.join(__dirname, '../client/dist')
app.use(express.static(clientDist))
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`LinkRad server running on http://localhost:${PORT}`)
})
