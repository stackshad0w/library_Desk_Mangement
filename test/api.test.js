// Integration tests against an in-memory database. node:sqlite prints an
// experimental warning to stderr — that's expected and does not fail the run.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.SEED_DEFAULT_ADMIN = 'true';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../server/index.js');

let server, base, token;

before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}`;
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  token = (await res.json()).token;
});

after(() => server && server.close());

const h = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
const api = async (path, opts = {}) => {
  const res = await fetch(`${base}${path}`, { headers: h(), ...opts });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

test('login returns a token', () => {
  assert.ok(token && token.length > 20);
});

test('partial admission records a pending balance', async () => {
  const { body } = await api('/api/students', {
    method: 'POST',
    body: JSON.stringify({ name: 'Partial', phone: '9000000001', course: 'OTHER', total_fees: 1000, paid_fees: 600, due_date: '2999-12-31' }),
  });
  const s = (await api(`/api/students/${body.student.id}`)).body;
  assert.equal(s.total_fees, 1000);
  assert.equal(s.paid_fees, 600);
  assert.equal(s.remaining_fees, 400);
  assert.equal(s.fee_status, 'Pending');
  assert.equal(s.payments.length, 1);
});

test('renewal bills the full period fee and credits the amount paid', async () => {
  const created = (await api('/api/students', {
    method: 'POST',
    body: JSON.stringify({ name: 'Renewer', phone: '9000000002', course: 'OTHER', total_fees: 1000, paid_fees: 1000, due_date: '2999-12-31' }),
  })).body.student;

  const { body } = await api('/api/payments', {
    method: 'POST',
    body: JSON.stringify({ student_id: created.id, amount: 600, period_fee: 1000, payment_date: '2026-06-22', payment_method: 'cash', new_due_date: '2999-12-31', from_date: '2026-07-01' }),
  });
  assert.equal(body.receipt.totalFees, 2000);
  assert.equal(body.receipt.totalPaid, 1600);
  assert.equal(body.receipt.remaining, 400);
});

test('soft-delete archives and restore brings back', async () => {
  const id = (await api('/api/students', {
    method: 'POST',
    body: JSON.stringify({ name: 'Temp', phone: '9000000003', course: 'OTHER', total_fees: 100, paid_fees: 100 }),
  })).body.student.id;

  await api(`/api/students/${id}`, { method: 'DELETE' });
  const active = (await api('/api/students')).body;
  assert.ok(!active.students.some(s => s.id === id), 'archived student should not appear in active list');

  const archived = (await api('/api/students?archived=1')).body;
  assert.ok(archived.students.some(s => s.id === id), 'archived student should appear in archived list');

  await api(`/api/students/${id}/restore`, { method: 'POST' });
  const restored = (await api('/api/students')).body;
  assert.ok(restored.students.some(s => s.id === id), 'restored student should reappear');
});
