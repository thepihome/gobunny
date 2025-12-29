const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function setupDatabase() {
  console.log('📦 Database Setup for Job Hunting Platform\n');
  
  // Get database credentials
  const dbHost = process.env.DB_HOST || await question('Database host (default: localhost): ') || 'localhost';
  const dbPort = process.env.DB_PORT || await question('Database port (default: 5432): ') || '5432';
  const dbUser = process.env.DB_USER || await question('Database user (default: postgres): ') || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || await question('Database password: ') || '';
  const dbName = process.env.DB_NAME || await question('Database name (default: job_hunting_db): ') || 'job_hunting_db';

  // Connect to PostgreSQL (without specifying database first)
  const adminPool = new Pool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres', // Connect to default postgres database
  });

  try {
    console.log('\n🔌 Connecting to PostgreSQL...');
    await adminPool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL\n');

    // Check if database exists
    const dbCheck = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (dbCheck.rows.length === 0) {
      console.log(`📝 Creating database: ${dbName}...`);
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created\n`);
    } else {
      console.log(`✅ Database '${dbName}' already exists\n`);
    }

    // Close admin connection
    await adminPool.end();

    // Connect to the new database
    const pool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
    });

    console.log('📋 Initializing database schema...');
    const schemaPath = path.join(__dirname, 'database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    console.log('✅ Database schema initialized successfully\n');

    await pool.end();

    console.log('🎉 Database setup complete!\n');
    console.log('Next steps:');
    console.log('1. Make sure your .env file has these values:');
    console.log(`   DB_HOST=${dbHost}`);
    console.log(`   DB_PORT=${dbPort}`);
    console.log(`   DB_USER=${dbUser}`);
    console.log(`   DB_PASSWORD=${dbPassword}`);
    console.log(`   DB_NAME=${dbName}`);
    console.log('2. Start the server: npm run dev');

  } catch (error) {
    console.error('\n❌ Error setting up database:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure PostgreSQL is running');
    console.error('2. Check your database credentials');
    console.error('3. Make sure you have permission to create databases');
    process.exit(1);
  } finally {
    rl.close();
  }
}

setupDatabase();


