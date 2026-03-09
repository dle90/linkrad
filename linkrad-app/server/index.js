const express = require('express')
const cors = require('cors')
const path = require('path')

const sitesRouter = require('./routes/sites')
const plRouter = require('./routes/pl')
const cfRouter = require('./routes/cf')
const bsRouter = require('./routes/bs')
const breakevenRouter = require('./routes/breakeven')
const actualsRouter = require('./routes/actuals')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/sites', sitesRouter)
app.use('/api/pl', plRouter)
app.use('/api/cf', cfRouter)
app.use('/api/bs', bsRouter)
app.use('/api/breakeven', breakevenRouter)
app.use('/api/actuals', actualsRouter)

// Serve React build in production
const clientDist = path.join(__dirname, '../client/dist')
app.use(express.static(clientDist))
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`LinkRad server running on http://localhost:${PORT}`)
})
