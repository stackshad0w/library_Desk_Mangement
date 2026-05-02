const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, initialize } = require('./database');

require('dotenv').config();

initialize();

const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
const passwordHash = bcrypt.hashSync('admin123', rounds);

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existing) {
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), 'admin', 'admin@edutrack.local', passwordHash, 'admin');
  console.log('✅ Default admin user created (username: admin, password: admin123)');
} else {
  console.log('ℹ️  Admin user already exists, skipping seed.');
}

console.log('✅ Database seeded successfully.');
process.exit(0);
