const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { connectDB } = require('./config/db');
const dotenv = require('dotenv');
const cors = require('cors');
const sql = require('mssql');
const { poolPromise } = require('./config/db');




// Load environment variables
dotenv.config();

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const contactRoutes = require('./routes/contactRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const liveRoutes = require('./routes/liveRoutes')
const subscriptionRoutes = require("./routes/subscriptionRoutes");

const app = express();
app.use(cookieParser());
app.use(cors())
app.use(bodyParser.json());

poolPromise.then(() => console.log("✅ Connected to SQL Server"))
           .catch(err => console.error("❌ DB connection failed:", err));

app.use(express.json());
app.use("/api/admin", adminRoutes);
app.use('/api/auth', authRoutes);   // for /api/auth/...
app.use('/api', profileRoutes);     // for /api/profile
app.use('/api/wallet', walletRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', contactRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/live', liveRoutes);
app.use('/api', subscriptionRoutes);

app.get('/test', (req, res) => {
  res.json({ message: '✅ Server is working' });
});

// Log unmatched requests before 404 handler
app.use((req, res, next) => {
  console.log(`🔍 Unmatched request: ${req.method} ${req.originalUrl}`);
  next();
});

// 404 handler (last)
app.use((req, res) => {
  res.status(404).json({ message: '❌ Route not found' });
});

// Now _router is defined, safe to iterate
if (app._router && app._router.stack) {
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      console.log('Route:', middleware.route.path);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          console.log('Route:', handler.route.path);
        }
      });
    }
  });
}

app.listen(5000, () => {
  console.log('🔥 Server running on port 5000');
});
