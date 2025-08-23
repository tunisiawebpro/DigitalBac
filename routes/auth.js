const express = require('express');
const bcrypt = require('bcrypt');
const { sql } = require('../config/db');
const { findUserByEmail, createUser } = require('../models/User');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { sendResetCodeEmail } = require('../utils/mailer');
require('dotenv').config();
const { authenticateToken } = require('../middleware/auth');
const REFRESH_COOKIE_MAX_AGE = 4 * 24 * 60 * 60 * 1000;
const { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_MS } = require('../config/auth');
const { poolPromise } = require('../config/db');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  console.log('Register request body:', req.body); // debug incoming data
  const { name, email, password, phone, school, section } = req.body;

  try {
    const pool = await poolPromise;
    console.log('Connected to DB'); // debug db connection
     console.log("✅ auth.js loaded");

    const userCheck = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');

    console.log('User check result:', userCheck.recordset);

    if (userCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Hashed password:', hashedPassword);

    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('phone', sql.NVarChar, phone)
      .input('school', sql.NVarChar, school)
      .input('section', sql.NVarChar, section)
      .query(`INSERT INTO Users (name, email, password, phone, school, section) 
        VALUES (@name, @email, @password, @phone, @school, @section)`);

    console.log('User inserted successfully');
    res.status(201).json({ message: 'User registered successfully' });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error' });
  }
})
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, stream: user.stream },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Shorter lifetime for better security
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    // Update user tokens in a transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);
      await request
        .input('id', sql.Int, user.id)
        .input('refreshToken', sql.NVarChar, refreshToken)
        .input('refreshExpiresAt', sql.DateTime, refreshExpiresAt)
        .query(`
          UPDATE Users 
          SET refreshToken = @refreshToken, 
              refreshExpiresAt = @refreshExpiresAt, 
              lastLoginAt = GETDATE()
          WHERE id = @id
        `);

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    // Set cookies and respond
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: REFRESH_TOKEN_TTL_MS
    });

    res.json({
      message: 'Login successful',
      token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        section: user.section,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/send-reset-code', async (req, res) => {
  const { email } = req.body;
  console.log('📩 Incoming reset request for:', email);

  try {
    const pool = await poolPromise;

    const userResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');

    if (userResult.recordset.length === 0) {
      console.log('❌ Email not found:', email);
      return res.status(404).json({ message: 'Email not found' });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    const expires = new Date(Date.now() + 15 * 60 * 1000);

    // Defensive logging
    if (expires instanceof Date) {
      console.log('⏰ Expires:', expires.toISOString());
    } else {
      console.log('⏰ Expires is NOT a Date:', expires);
    }

    await pool.request()
      .input('email', sql.NVarChar, email)
      .input('resetCode', sql.NVarChar, resetCode)
      .input('expires', sql.DateTime2, expires)
     .query(`UPDATE Users SET resetCode = @resetCode, resetCodeExpires = @expires WHERE email = @email`);

    console.log('✅ Reset code saved:', resetCode);

    // Email setup
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Digital Bac" <${process.env.EMAIL_USER}>`,
      to: email,
text: `Your password reset code is: ${resetCode}`,
    };

    await transporter.sendMail(mailOptions);
    console.log('📧 Reset email sent successfully');

    res.json({ message: 'Reset code sent successfully' });

  } catch (err) {
    console.error('❌ Full Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
router.post('/verify-reset-code', async (req, res) => {
  const email = req.body.email?.trim();
  const code = req.body.code?.trim();

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT resetCode, resetCodeExpires FROM Users WHERE email = @email');

    const user = result.recordset[0];

    const now = new Date();
    const expiresAt = new Date(user?.resetCodeExpires);

    console.log('✅ Stored resetCode:', user?.resetCode);
    console.log('📩 Provided resetCode:', code);
    console.log('⏰ Stored expires:', expiresAt.toISOString());
    console.log('🕓 Current time:', now.toISOString());

    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.resetCode !== code) {
      console.log('❌ Code does not match');
      return res.status(400).json({ message: 'Invalid reset code' });
    }

    if (expiresAt < now) {
      console.log('❌ Code expired');
      return res.status(400).json({ message: 'Reset code expired' });
    }

    console.log('✅ Code is valid and not expired');
    return res.json({ message: 'Code verified successfully' });

  } catch (err) {
    console.error('Code verification error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/set-new-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Email, code, and new password are required.' });
  }

  try {
    const pool = await poolPromise;

    // Fetch user reset info
    const result = await pool.request()
      .input('email', sql.NVarChar, email.trim())
      .query('SELECT resetCode, resetCodeExpires FROM Users WHERE email = @email');

    const user = result.recordset[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const now = new Date();
    const expiresAt = new Date(user.resetCodeExpires);

    if (user.resetCode !== code) {
      return res.status(400).json({ message: 'Invalid reset code.' });
    }

    if (expiresAt < now) {
      return res.status(400).json({ message: 'Reset code expired.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset fields
    await pool.request()
      .input('email', sql.NVarChar, email.trim())
      .input('password', sql.NVarChar, hashedPassword)
      .query(`
        UPDATE Users
        SET password = @password,
            resetCode = NULL,
            resetCodeExpires = NULL
        WHERE email = @email
      `);

    res.json({ message: 'Password has been reset successfully.' });

  } catch (err) {
    console.error('Set new password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/update-profile', authenticateToken, async (req, res) => {
  const { name, email, phone, section, emailNotifications, appNotifications } = req.body;
  const userId = req.user.userId; // <-- make sure your JWT really contains userId

  try {
    const pool = await poolPromise; // <-- you were missing this in your snippet

    await pool.request()
      .input('id', sql.Int, userId)
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone)
      .input('section', sql.NVarChar, section)
      .input('emailNotifications', sql.Bit, emailNotifications ? 1 : 0)
      .input('appNotifications', sql.Bit, appNotifications ? 1 : 0)
      .query(`
        UPDATE Users
        SET name = @name,
            email = @email,
            phone = @phone,
            section = @section,
            emailNotifications = @emailNotifications,
            appNotifications = @appNotifications
        WHERE id = @id
      `);

    // Return the fresh user so the FE can store the right values
    const updated = await pool.request()
      .input('id', sql.Int, userId)
      .query(`
        SELECT id, name, email, phone, section,
               emailNotifications, appNotifications
        FROM Users
        WHERE id = @id
      `);

    return res.json({
      message: 'تم تحديث البيانات بنجاح',
      user: updated.recordset[0]
    });

  } catch (err) {
    console.error('Update Profile Error:', err);
    return res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

router.put('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  try {
    const pool = await poolPromise;
    const user = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT password FROM Users WHERE id = @id');

    if (!user.recordset[0]) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const hashedPassword = user.recordset[0].password;
    const isMatch = await bcrypt.compare(currentPassword, hashedPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
    }

    const newHashed = await bcrypt.hash(newPassword, 10);
    await pool.request()
      .input('id', sql.Int, userId)
      .input('password', sql.NVarChar, newHashed)
      .query('UPDATE Users SET password = @password WHERE id = @id');

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    console.error('Change Password Error:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, req.user.userId)
      .query('UPDATE Users SET currentToken = NULL, refreshToken = NULL, refreshExpiresAt = NULL WHERE id = @id');

    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/refresh-token', async (req, res) => {
  const incomingRefresh = req.cookies?.refreshToken || req.body?.refreshToken;
  
  if (!incomingRefresh) {
    return res.status(401).json({ message: 'No refresh token provided' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('refreshToken', sql.NVarChar, incomingRefresh)
      .query(`SELECT id, email, role, refreshExpiresAt FROM Users WHERE refreshToken = @refreshToken`);

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });

    if (new Date(user.refreshExpiresAt) < new Date()) {
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    // Generate new tokens
    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newRefreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    // Update in database
    await pool.request()
      .input('id', sql.Int, user.id)
      .input('refreshToken', sql.NVarChar, newRefreshToken)
      .input('refreshExpiresAt', sql.DateTime, newRefreshExpiresAt)
      .query(`
        UPDATE Users 
        SET refreshToken = @refreshToken,
            refreshExpiresAt = @refreshExpiresAt
        WHERE id = @id
      `);

    // Set new cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: REFRESH_TOKEN_TTL_MS
    });

    res.json({ token: newAccessToken });

  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;