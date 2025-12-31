/**
 * Migration script to add job_classification (ID) to candidate_profiles table
 * Migrates existing current_job_title (text) values to job_classification (ID)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  console.log('🔄 Running migration: Add job_classification to candidate_profiles\n');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'job_hunting_db',
  });

  try {
    // Check if column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'candidate_profiles' AND column_name = 'job_classification'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Column job_classification already exists in candidate_profiles table');
      console.log('   Checking if migration is needed...\n');
      
      // Check if there are candidates with current_job_title but no job_classification
      const needsMigration = await pool.query(`
        SELECT COUNT(*) as count
        FROM candidate_profiles
        WHERE current_job_title IS NOT NULL 
        AND current_job_title != ''
        AND job_classification IS NULL
      `);
      
      if (parseInt(needsMigration.rows[0].count) === 0) {
        console.log('✅ All candidates already have job_classification set');
        console.log('   No migration needed.\n');
        await pool.end();
        return;
      } else {
        console.log(`📝 Found ${needsMigration.rows[0].count} candidates that need migration\n`);
      }
    } else {
      // Add the column
      console.log('📝 Adding job_classification column to candidate_profiles table...');
      await pool.query(`
        ALTER TABLE candidate_profiles 
        ADD COLUMN job_classification INTEGER REFERENCES job_roles(id)
      `);
      console.log('✅ Column added successfully\n');
    }

    // Migrate existing data
    console.log('📝 Migrating existing current_job_title values to job_classification IDs...');
    
    const migrationResult = await pool.query(`
      UPDATE candidate_profiles cp
      SET job_classification = (
        SELECT jr.id 
        FROM job_roles jr 
        WHERE TRIM(LOWER(jr.name)) = TRIM(LOWER(cp.current_job_title))
        AND jr.is_active = true
        LIMIT 1
      )
      WHERE cp.current_job_title IS NOT NULL 
      AND cp.current_job_title != ''
      AND cp.job_classification IS NULL
      RETURNING cp.id, cp.current_job_title, cp.job_classification
    `);

    const migrated = migrationResult.rows.length;
    console.log(`✅ Migrated ${migrated} candidate profiles\n`);

    // Show candidates that couldn't be migrated (no matching job role)
    const unmigrated = await pool.query(`
      SELECT DISTINCT current_job_title, COUNT(*) as count
      FROM candidate_profiles
      WHERE current_job_title IS NOT NULL 
      AND current_job_title != ''
      AND job_classification IS NULL
      GROUP BY current_job_title
    `);

    if (unmigrated.rows.length > 0) {
      console.log('⚠️  Warning: Some candidates could not be migrated (no matching job role):');
      unmigrated.rows.forEach(row => {
        console.log(`   - "${row.current_job_title}" (${row.count} candidate(s))`);
      });
      console.log('\n   Please create these job roles in the Metadata section or update candidate profiles manually.\n');
    }

    // Show summary
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(job_classification) as with_classification,
        COUNT(*) - COUNT(job_classification) as without_classification
      FROM candidate_profiles
    `);

    const stats = summary.rows[0];
    console.log('📊 Migration Summary:');
    console.log(`   Total candidates: ${stats.total}`);
    console.log(`   With job_classification: ${stats.with_classification}`);
    console.log(`   Without job_classification: ${stats.without_classification}`);
    console.log('\n✅ Migration completed successfully!\n');
    console.log('   Note: current_job_title is kept for backward compatibility.');
    console.log('   You can update your code to use job_classification instead.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure PostgreSQL is running');
    console.error('2. Check your database credentials in .env file');
    console.error('3. Make sure the job_roles table exists');
    console.error('4. Make sure you have ALTER TABLE permissions');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check if running directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };

