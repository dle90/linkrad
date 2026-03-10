const mysql = require('mysql2/promise')

const pool = mysql.createPool(
  process.env.DATABASE_URL
    ? process.env.DATABASE_URL
    : {
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'linkrad',
        waitForConnections: true,
        connectionLimit: 10,
      }
)

module.exports = pool
