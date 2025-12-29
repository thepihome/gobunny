#!/usr/bin/env node

/**
 * Standalone script to create an admin user
 * Usage: node create-admin.js [email] [password] [firstName] [lastName]
 */

require('dotenv').config();
const { createDefaultAdmin } = require('./config/createAdmin');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log('🔐 Create Admin User\n');

  // Get arguments from command line or prompt
  let email = process.argv[2];
  let password = process.argv[3];
  let firstName = process.argv[4];
  let lastName = process.argv[5];

  if (!email) {
    email = await question('Email (default: admin@jobhunting.com): ') || 'admin@jobhunting.com';
  }

  if (!password) {
    password = await question('Password (default: admin123): ') || 'admin123';
  }

  if (!firstName) {
    firstName = await question('First Name (default: Admin): ') || 'Admin';
  }

  if (!lastName) {
    lastName = await question('Last Name (default: User): ') || 'User';
  }

  // Set environment variables temporarily
  process.env.ADMIN_EMAIL = email;
  process.env.ADMIN_PASSWORD = password;
  process.env.ADMIN_FIRST_NAME = firstName;
  process.env.ADMIN_LAST_NAME = lastName;

  try {
    await createDefaultAdmin();
    console.log('\n✅ Admin user setup complete!');
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();


