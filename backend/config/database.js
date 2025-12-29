// Ensure dotenv is loaded (in case this module is required directly)
require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Log what we're using for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('📋 Database config loaded:');
  console.log(`   User: ${process.env.DB_USER || 'postgres (default)'}`);
  console.log(`   Database: ${process.env.DB_NAME || 'job_hunting_db (default)'}`);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'job_hunting_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Test database connection
const testConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Initialize database schema
const init = async () => {
  try {
    // Log connection details (without password)
    console.log('🔌 Attempting database connection...');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Port: ${process.env.DB_PORT || 5432}`);
    console.log(`   Database: ${process.env.DB_NAME || 'job_hunting_db'}`);
    console.log(`   User: ${process.env.DB_USER || 'postgres'}`);
    
    // Test connection first
    const connectionResult = await testConnection();
    if (!connectionResult.success) {
      throw new Error(`Cannot connect to database: ${connectionResult.error}`);
    }
    
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema - use IF NOT EXISTS where possible to avoid errors on re-run
    await pool.query(schema);
    console.log('✅ Database schema initialized successfully');
    
    // Create default admin user if none exists
    const { createDefaultAdmin } = require('./createAdmin');
    await createDefaultAdmin();
    
    return true;
  } catch (error) {
    // If tables already exist, that's okay - still check for admin user
    if (error.message.includes('already exists') || error.code === '42P07') {
      console.log('✅ Database tables already exist');
      // Still create admin if needed
      try {
        const { createDefaultAdmin } = require('./createAdmin');
        await createDefaultAdmin();
      } catch (adminError) {
        // Ignore admin creation errors if tables exist
        console.log('ℹ️  Skipping admin creation (may already exist)');
      }
      return true;
    }
    // Log the full error for debugging
    console.error('❌ Database error details:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    throw error;
  }
};

module.exports = {
  pool,
  init,
  query: (text, params) => pool.query(text, params),
};

