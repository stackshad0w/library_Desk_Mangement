require('dotenv').config();

const { initialize } = require('./database');

const created = initialize();
if (created) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  console.log(`Default admin user created (username: ${username}, password: ${password})`);
} else {
  console.log('Admin user already exists or default admin bootstrap is disabled.');
}

console.log('Database seeded successfully.');
process.exit(0);
