const pool = require('./db')
const fs = require('fs')
const path = require('path')

const SEED_DIR = path.join(__dirname, 'data')

async function initDb() {
  const conn = await pool.getConnection()
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(50) PRIMARY KEY,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        department VARCHAR(50),
        displayName VARCHAR(100)
      ) CHARACTER SET utf8mb4
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        deadline DATE,
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'todo',
        result TEXT,
        assignee VARCHAR(50),
        assigneeName VARCHAR(100),
        department VARCHAR(50),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id VARCHAR(36) PRIMARY KEY,
        taskId VARCHAR(36) NOT NULL,
        author VARCHAR(50),
        authorName VARCHAR(100),
        text TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_taskId (taskId)
      ) CHARACTER SET utf8mb4
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS actuals (
        month_key VARCHAR(10) PRIMARY KEY,
        data JSON NOT NULL
      )
    `)

    // Seed users if empty
    const [rows] = await conn.execute('SELECT COUNT(*) AS cnt FROM users')
    if (rows[0].cnt === 0) {
      const seedUsers = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'users.json'), 'utf8'))
      for (const [username, u] of Object.entries(seedUsers)) {
        await conn.execute(
          'INSERT IGNORE INTO users (username, password, role, department, displayName) VALUES (?, ?, ?, ?, ?)',
          [username, u.password, u.role, u.department || null, u.displayName || username]
        )
      }
      console.log('Seeded users from users.json')
    }

    console.log('Database initialized')
  } finally {
    conn.release()
  }
}

module.exports = initDb
