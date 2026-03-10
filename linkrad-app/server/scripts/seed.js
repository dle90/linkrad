/**
 * One-time seed script: import existing JSON files into MongoDB.
 * Run: node scripts/seed.js
 * Set MONGODB_URI env var to point to your MongoDB instance.
 */
const path = require('path')
const fs = require('fs')
require('../db')

const mongoose = require('mongoose')
const User = require('../models/User')
const Task = require('../models/Task')
const KVStore = require('../models/KVStore')

const DATA = path.join(__dirname, '../data')
const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'))

async function seed() {
  console.log('Seeding...')

  // Users
  const usersRaw = read('users.json')
  const userDocs = Object.entries(usersRaw).map(([username, u]) => ({
    _id: username,
    password: u.password,
    role: u.role,
    department: u.department || null,
    displayName: u.displayName || username,
  }))
  await User.deleteMany({})
  await User.insertMany(userDocs)
  console.log(`✓ Users: ${userDocs.length}`)

  // Tasks
  const tasksRaw = read('tasks.json')
  await Task.deleteMany({})
  if (tasksRaw.length > 0) {
    await Task.insertMany(tasksRaw)
    console.log(`✓ Tasks: ${tasksRaw.length}`)
  } else {
    console.log('✓ Tasks: 0 (empty)')
  }

  // KV Store entries
  const kvEntries = [
    { _id: 'sites',         data: read('sites.json') },
    { _id: 'annual-pl',     data: read('annual-pl.json') },
    { _id: 'monthly-pl',    data: read('monthly-pl.json') },
    { _id: 'annual-cf',     data: read('annual-cf.json') },
    { _id: 'monthly-cf',    data: read('monthly-cf.json') },
    { _id: 'balance-sheet', data: read('balance-sheet.json') },
    { _id: 'breakeven',     data: read('breakeven.json') },
    { _id: 'actuals',       data: read('actuals.json') },
  ]
  await KVStore.deleteMany({})
  await KVStore.insertMany(kvEntries)
  console.log(`✓ KVStore: ${kvEntries.map(e => e._id).join(', ')}`)

  console.log('Seed complete.')
  mongoose.disconnect()
}

seed().catch(err => {
  console.error('Seed failed:', err)
  mongoose.disconnect()
  process.exit(1)
})
