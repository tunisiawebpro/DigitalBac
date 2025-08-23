const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../config/db');

// ============================
// 1. Get Online Teachers by Subject
// ============================
router.get('/teachers', async (req, res) => {
    try {
        const subject = req.query.subject;
        if (!subject) return res.status(400).json({ message: 'Subject is required' });

        const pool = await poolPromise;
        const result = await pool.request()
            .input('subject', sql.NVarChar, subject)
            .query(`
                SELECT teacher_id, name, subject, bio, profile_image, live_link
                FROM teachers
                WHERE live_status = 1 AND subject = @subject
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching teachers' });
    }
});

// ============================
// 2. Teacher Starts Live
// ============================
router.post('/start', async (req, res) => {
    try {
        const { teacher_id, live_link } = req.body;
        if (!teacher_id || !live_link) {
            return res.status(400).json({ message: 'teacher_id and live_link are required' });
        }

        const pool = await poolPromise;
        await pool.request()
            .input('teacher_id', sql.Int, teacher_id)
            .input('live_link', sql.NVarChar, live_link)
            .query(`
                UPDATE teachers
                SET live_status = 1, live_link = @live_link
                WHERE teacher_id = @teacher_id
            `);

        // Optional: Insert into live_sessions table
        await pool.request()
            .input('teacher_id', sql.Int, teacher_id)
            .query(`
                INSERT INTO live_sessions (teacher_id, subject)
                SELECT teacher_id, subject FROM teachers WHERE teacher_id = @teacher_id
            `);

        res.json({ message: 'Live session started successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error starting live session' });
    }
});

// ============================
// 3. Teacher Ends Live
// ============================
router.post('/end', async (req, res) => {
    try {
        const { teacher_id } = req.body;
        if (!teacher_id) {
            return res.status(400).json({ message: 'teacher_id is required' });
        }

        const pool = await poolPromise;
        await pool.request()
            .input('teacher_id', sql.Int, teacher_id)
            .query(`
                UPDATE teachers
                SET live_status = 0, live_link = NULL
                WHERE teacher_id = @teacher_id
            `);

        // Optional: Update end_time in live_sessions table
        await pool.request()
            .input('teacher_id', sql.Int, teacher_id)
            .query(`
                UPDATE live_sessions
                SET end_time = GETDATE()
                WHERE teacher_id = @teacher_id AND end_time IS NULL
            `);

        res.json({ message: 'Live session ended successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error ending live session' });
    }
});

module.exports = router;
