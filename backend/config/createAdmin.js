const bcrypt = require('bcryptjs');
const db = require('./database');

/**
 * Create default admin user if no admin users exist
 */
const createDefaultAdmin = async () => {
  try {
    // Check if any admin users exist
    const adminCheck = await db.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (adminCheck.rows.length > 0) {
      console.log('✅ Admin user already exists');
      return { created: false, message: 'Admin user already exists' };
    }

    // Get admin credentials from environment or use defaults
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@jobhunting.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminFirstName = process.env.ADMIN_FIRST_NAME || 'Admin';
    const adminLastName = process.env.ADMIN_LAST_NAME || 'User';

    // Check if email already exists
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );

    if (emailCheck.rows.length > 0) {
      console.log(`⚠️  Email ${adminEmail} already exists, skipping admin creation`);
      return { created: false, message: 'Email already exists' };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role`,
      [adminEmail, passwordHash, adminFirstName, adminLastName, 'admin', true]
    );

    const admin = result.rows[0];

    console.log('\n🎉 Default admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Name:     ${admin.first_name} ${admin.last_name}`);
    console.log(`   Role:     ${admin.role}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Please change the default password after first login!\n');

    return {
      created: true,
      user: admin,
      password: adminPassword,
      message: 'Admin user created successfully'
    };
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    throw error;
  }
};

module.exports = { createDefaultAdmin };


