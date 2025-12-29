require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing database connection...\n');
console.log('Configuration:');
console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
console.log(`  Port: ${process.env.DB_PORT || 5432}`);
console.log(`  Database: ${process.env.DB_NAME || 'job_hunting_db'}`);
console.log(`  User: ${process.env.DB_USER || 'postgres'}`);
console.log(`  Password: ${process.env.DB_PASSWORD ? '***' : '(empty)'}\n`);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'job_hunting_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

pool.query('SELECT NOW() as time, current_database() as database, current_user as user')
  .then(result => {
    console.log('✅ Database connection successful!');
    console.log(`   Time: ${result.rows[0].time}`);
    console.log(`   Database: ${result.rows[0].database}`);
    console.log(`   User: ${result.rows[0].user}\n`);
    
    return pool.query('SELECT COUNT(*) as count FROM users');
  })
  .then(result => {
    console.log(`✅ Users table exists with ${result.rows[0].count} users`);
    return pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY table_name');
  })
  .then(result => {
    console.log(`✅ Found ${result.rows.length} tables in database:`);
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database connection failed:');
    console.error(`   Error: ${err.message}`);
    console.error(`   Code: ${err.code}`);
    process.exit(1);
  });


