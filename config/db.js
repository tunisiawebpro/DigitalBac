const sql = require('mssql');

const config = {
  user: 'digitalbac_user',
  password: 'DigitalBac@2024!Secure',
  server: 'DESKTOP-6J8F13G',
  database: 'DigitalBacDB',
  port: 1433,
  options: {
    encrypt: false, // You can set true only if using SSL
    trustServerCertificate: true
  }
};

// Create a single connection pool
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("✅ Connected with digitalbac_user");
    return pool;
  })
  .catch(err => {
    console.error("❌ DB Connection Error:", err.message);
    throw err;
  });

module.exports = { sql, poolPromise };