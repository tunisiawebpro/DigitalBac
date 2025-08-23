const { sql } = require('../config/db');
const { poolPromise } = require('../config/db');

// Check if user exists by email
const findUserByEmail = async (email) => {
  const pool = await sql.connect();
  const result = await pool
    .request()
    .input('email', sql.NVarChar, email)
    .query('SELECT * FROM Users WHERE email = @email');
  return result.recordset[0];
};

// Get user by ID
const findUserById = async (id) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM Users WHERE id = @id');
  return result.recordset[0];
};

// Create a new user
const createUser = async (name, email, hashedPassword, phone, section) => {
  const pool = await poolPromise;
  await pool
    .request()
    .input('name', sql.NVarChar, name)
    .input('email', sql.NVarChar, email)
    .input('password', sql.NVarChar, hashedPassword)
    .input('phone', sql.NVarChar, phone)
    .input('section', sql.NVarChar, section)
    .query(`INSERT INTO Users (name, email, password, phone, section)
            VALUES (@name, @email, @password, @phone, @section)`);
};

// Update user subscription and wallet
const updateUserSubscription = async (userId, plan, price, expiryDate) => {
  const pool = await poolPromise;
  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('plan', sql.NVarChar, plan)
    .input('expiryDate', sql.DateTime, expiryDate)
    .input('price', sql.Decimal(10, 2), price)
    .query(`
      UPDATE Users 
      SET 
        wallet = wallet - @price,
        subscriptionPlan = @plan,
        subscriptionExpiry = @expiryDate,
        isSubscribed = 1
      WHERE id = @userId
    `);
};

module.exports = {
  findUserByEmail,
  findUserById,
  updateUserSubscription,
  createUser
};
