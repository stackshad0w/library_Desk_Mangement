require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { initialize } = require('./config/database');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Route imports
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const paymentRoutes = require('./routes/payments');
const dashboardRoutes = require('./routes/dashboard');
const exportRoutes = require('./routes/export');
const settingsRoutes = require('./routes/settings');
const seatRoutes = require('./routes/seats');
const backupRoutes = require('./routes/backup');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initialize();
logger.info('Database initialized');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({
  origin: true,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('short'));

// Rate limiting
app.use('/api/', generalLimiter);

// Static files - serve the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/backup', backupRoutes);

// Serve login page as default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'pages', 'login.html'));
});

// Serve any HTML page from /pages/
app.get('/pages/:page', (req, res) => {
  const page = req.params.page.replace(/[^a-z0-9-]/gi, '');
  const filePath = path.join(__dirname, '..', 'public', 'pages', `${page}.html`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ message: 'Page not found' });
    }
  });
});

// Global error handler
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Swami Abhyasika server running on http://localhost:${PORT}`);
    console.log(`\nSwami Abhyasika server running at http://localhost:${PORT}\n`);
  });
}

module.exports = app;
