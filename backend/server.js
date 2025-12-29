// Load environment variables FIRST, before any other modules
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./config/database');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/resumes', require('./routes/resumes'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/candidate-profiles', require('./routes/candidateProfiles'));
app.use('/api/timesheets', require('./routes/timesheets'));
app.use('/api/kpis', require('./routes/kpis'));
app.use('/api/users', require('./routes/users'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/crm', require('./routes/crm'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Start server first, then initialize database
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  
  // Initialize database in background
  db.init()
    .then(() => {
      console.log('✅ Database connection successful');
    })
    .catch((err) => {
      console.error('⚠️  Database initialization failed:', err.message);
      console.error('⚠️  Please check your database configuration in .env file');
      console.error('⚠️  Server is running but database features will not work');
      console.error('\nTo fix:');
      console.error('1. Make sure PostgreSQL is running');
      console.error('2. Create the database: createdb job_hunting_db');
      console.error('3. Check your .env file has correct DB credentials');
    });
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

module.exports = app;

