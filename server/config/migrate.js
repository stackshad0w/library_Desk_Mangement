/**
 * Migration Script: localStorage → SQLite
 * 
 * Reads the old EduTrack localStorage JSON format and imports all students
 * and their payment history into the new SQLite database.
 * 
 * Usage:
 *   1. Open the old student_management_system.html in a browser
 *   2. Open DevTools console and run:  copy(localStorage.getItem('edu_students'))
 *   3. Paste the JSON into a file called data/legacy_students.json
 *   4. Run:  node server/config/migrate.js
 */

const fs = require('fs');
const path = require('path');
const { db, initialize } = require('./database');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

const LEGACY_FILE = path.resolve('./data/legacy_students.json');

function migrate() {
  initialize();

  if (!fs.existsSync(LEGACY_FILE)) {
    console.log('⚠️  No legacy data file found at data/legacy_students.json');
    console.log('');
    console.log('To export your old data:');
    console.log('  1. Open student_management_system.html in a browser');
    console.log('  2. Open DevTools → Console');
    console.log('  3. Run:  copy(localStorage.getItem("edu_students"))');
    console.log('  4. Create data/legacy_students.json and paste the content');
    console.log('  5. Run this script again: npm run migrate');
    process.exit(0);
  }

  const raw = fs.readFileSync(LEGACY_FILE, 'utf-8');
  let students;
  try {
    students = JSON.parse(raw);
  } catch (e) {
    console.error('❌ Failed to parse legacy_students.json:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(students) || students.length === 0) {
    console.log('⚠️  No students found in legacy data.');
    process.exit(0);
  }

  console.log(`📦 Found ${students.length} students in legacy data.\n`);

  // Get or create a default admin user for created_by references
  let adminUser = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminUser) {
    const bcrypt = require('bcryptjs');
    const adminId = uuidv4();
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(adminId, 'admin', 'admin@edutrack.local', hash, 'admin');
    adminUser = { id: adminId };
    console.log('✅ Created default admin user for migration.');
  }

  const insertStudent = db.prepare(`
    INSERT OR IGNORE INTO students (id, name, parent_name, phone, email, address, course, admission_date, due_date, total_fees, paid_fees, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO payments (id, student_id, amount, payment_date, payment_method, notes, receipt_number, processed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;
  let paymentsImported = 0;

  const transaction = db.transaction(() => {
    for (const s of students) {
      // Check if student already exists
      const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(s.id);
      if (existing) {
        skipped++;
        continue;
      }

      // Map old format to new schema
      const admissionDate = s.admissionDate || s.admission_date || new Date().toISOString().split('T')[0];
      const dueDate = s.dueDate || s.due_date || null;
      const totalFees = parseFloat(s.totalFees || s.total_fees || 0);
      const paidFees = parseFloat(s.paidFees || s.paid_fees || 0);

      insertStudent.run(
        s.id,
        s.name || 'Unknown',
        s.parent || s.parent_name || '',
        s.phone || '',
        s.email || '',
        s.address || '',
        s.course || 'Other',
        admissionDate,
        dueDate,
        totalFees,
        paidFees,
        'active',
        adminUser.id
      );
      imported++;

      // Import payment history if available
      const payments = s.payments || [];
      for (const p of payments) {
        const paymentId = uuidv4();
        const receiptNo = 'MIG-' + Date.now().toString().slice(-6) + '-' + Math.random().toString(36).slice(2, 5);
        const method = (p.method || 'cash').toLowerCase().replace(/ /g, '_');
        const validMethods = ['cash', 'online_transfer', 'cheque', 'upi', 'dd'];
        const paymentMethod = validMethods.includes(method) ? method : 'cash';

        insertPayment.run(
          paymentId,
          s.id,
          parseFloat(p.amount || 0),
          p.date || admissionDate,
          paymentMethod,
          p.notes || 'Migrated from legacy system',
          receiptNo,
          adminUser.id
        );
        paymentsImported++;
      }
    }
  });

  transaction();

  console.log('✅ Migration complete!');
  console.log(`   Students imported: ${imported}`);
  console.log(`   Students skipped (already exist): ${skipped}`);
  console.log(`   Payments imported: ${paymentsImported}`);
  console.log('');
}

migrate();
process.exit(0);
