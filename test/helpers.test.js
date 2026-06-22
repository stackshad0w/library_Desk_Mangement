const { test } = require('node:test');
const assert = require('node:assert');
const { getFeeStatus, paginate, generateStudentId } = require('../server/utils/helpers');

const future = '2999-12-31';
const past = '2000-01-01';

test('getFeeStatus: inactive student is Inactive (not Overdue)', () => {
  assert.equal(getFeeStatus({ total_fees: 100, paid_fees: 0, status: 'inactive', due_date: past }), 'Inactive');
});

test('getFeeStatus: fully paid is Paid', () => {
  assert.equal(getFeeStatus({ total_fees: 100, paid_fees: 100, status: 'active' }), 'Paid');
});

test('getFeeStatus: unpaid with past due date is Overdue', () => {
  assert.equal(getFeeStatus({ total_fees: 100, paid_fees: 0, status: 'active', due_date: past }), 'Overdue');
});

test('getFeeStatus: unpaid with future due date is Pending', () => {
  assert.equal(getFeeStatus({ total_fees: 100, paid_fees: 0, status: 'active', due_date: future }), 'Pending');
});

test('paginate: defaults and clamping', () => {
  assert.deepEqual(paginate({}), { page: 1, limit: 20, offset: 0 });
  assert.equal(paginate({ limit: '500' }).limit, 100); // clamped to max 100
  assert.equal(paginate({ page: '0' }).page, 1);       // clamped to min 1
  assert.equal(paginate({ page: '3', limit: '10' }).offset, 20);
});

test('generateStudentId: sequence', () => {
  assert.equal(generateStudentId(null), 'STU-0001');
  assert.equal(generateStudentId('STU-0007'), 'STU-0008');
  assert.equal(generateStudentId('STU-0099'), 'STU-0100');
});
