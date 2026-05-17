import { API_BASE } from '../utils/constants.js';

const LOCAL_SETTINGS_KEY = 'edutrack_settings';
const LOCAL_STUDENTS_KEY = 'edutrack_students';
const LOCAL_PAYMENTS_KEY = 'edutrack_payments';
const LOCAL_USER = { id: 'local-admin', username: 'admin', role: 'admin' };
const DEFAULT_SETTINGS = {
  theme: localStorage.getItem('selectedTheme') || 'default',
  fee_tiers: [{ gender: 'Male', shift: 'Day', months: 1, fee: 1000 }],
};

function getToken() {
  return localStorage.getItem('edutrack_token');
}

function setToken(token) {
  localStorage.setItem('edutrack_token', token);
}

function setRefreshToken(token) {
  localStorage.setItem('edutrack_refresh_token', token);
}

function getRefreshToken() {
  return localStorage.getItem('edutrack_refresh_token');
}

function clearTokens() {
  localStorage.removeItem('edutrack_token');
  localStorage.removeItem('edutrack_refresh_token');
  localStorage.removeItem('edutrack_user');
}

async function refreshAccessToken() {
  const rToken = getRefreshToken();
  if (!rToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setToken(data.token);
    return true;
  } catch {
    return false;
  }
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    const fallback = handleLocalRequest(endpoint, options);
    if (fallback) return fallback;
    throw err;
  }

  // If 401, try refreshing the token once
  if (res.status === 401 && !options._retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      res = await fetch(url, { ...options, headers, _retried: true });
    } else {
      const fallback = handleLocalRequest(endpoint, options);
      if (fallback) return fallback;
      clearTokens();
      window.location.href = '/pages/login.html';
      throw new Error('Session expired');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if ([404, 405].includes(res.status)) {
      const fallback = handleLocalRequest(endpoint, options);
      if (fallback) return fallback;
    }
    const err = new Error(data.message || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function parseBody(options) {
  if (!options.body) return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return {};
  }
}

function getLocalSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson(LOCAL_SETTINGS_KEY, {}) };
}

function getLocalStudents() {
  return readJson(LOCAL_STUDENTS_KEY, []);
}

function saveLocalStudents(students) {
  writeJson(LOCAL_STUDENTS_KEY, students);
}

function getLocalPayments() {
  return readJson(LOCAL_PAYMENTS_KEY, []);
}

function saveLocalPayments(payments) {
  writeJson(LOCAL_PAYMENTS_KEY, payments);
}

function feeStatus(student) {
  if (student.status === 'inactive') return 'Inactive';
  const balance = Math.max(0, Number(student.total_fees || 0) - Number(student.paid_fees || 0));
  if (balance <= 0) return 'Paid';
  if (student.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(student.due_date);
    due.setHours(0, 0, 0, 0);
    if (due < today) return 'Overdue';
  }
  return 'Pending';
}

function enrichStudent(student) {
  return {
    ...student,
    fee_status: feeStatus(student),
    remaining_fees: Math.max(0, Number(student.total_fees || 0) - Number(student.paid_fees || 0)),
  };
}

function nextStudentId(students) {
  const max = students.reduce((highest, student) => {
    const match = String(student.id || '').match(/^STU-(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `STU-${String(max + 1).padStart(4, '0')}`;
}

function localDashboardStats() {
  const students = getLocalStudents().map(enrichStudent);
  const payments = getLocalPayments();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  let feesPending = 0;
  let feesOverdue = 0;
  const paymentTotal = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const paidTotal = students.reduce((sum, student) => sum + Math.min(Number(student.paid_fees) || 0, Number(student.total_fees) || 0), 0);
  const feesCollected = paymentTotal || paidTotal;
  const statusBreakdown = { paid: 0, pending: 0, overdue: 0 };

  students.forEach(student => {
    const total = Number(student.total_fees) || 0;
    const paid = Number(student.paid_fees) || 0;
    const balance = Math.max(0, total - paid);
    if (student.fee_status === 'Paid') statusBreakdown.paid++;
    else if (student.fee_status === 'Overdue' || student.fee_status === 'Inactive') {
      statusBreakdown.overdue++;
      feesOverdue += balance;
    } else {
      statusBreakdown.pending++;
      feesPending += balance;
    }
  });

  const courseCounts = students.reduce((acc, student) => {
    acc[student.course] = (acc[student.course] || 0) + 1;
    return acc;
  }, {});

  return {
    totalStudents: students.length,
    newThisMonth: students.filter(s => s.admission_date >= monthStart).length,
    feesCollected,
    feesPending,
    feesOverdue,
    totalBilled: feesCollected + feesPending + feesOverdue,
    statusBreakdown,
    courseDistribution: Object.entries(courseCounts).map(([course, count]) => ({ course, count })),
    recentAdmissions: students.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 5),
    monthlyRevenue: [],
  };
}

function handleLocalRequest(endpoint, options = {}) {
  const method = options.method || 'GET';
  const [path, queryString = ''] = endpoint.split('?');
  const body = parseBody(options);

  if (path === '/auth/login' && method === 'POST') {
    if (body.username === 'admin' && body.password === 'admin123') {
      return { token: 'local-token', refreshToken: 'local-refresh-token', user: LOCAL_USER };
    }
    const err = new Error('Invalid username or password');
    err.status = 401;
    throw err;
  }

  if (path === '/settings' && method === 'GET') {
    return getLocalSettings();
  }
  if (path === '/settings' && method === 'PUT') {
    const settings = getLocalSettings();
    settings[body.key] = body.value;
    writeJson(LOCAL_SETTINGS_KEY, settings);
    return { message: 'Setting saved locally' };
  }

  if (path === '/dashboard/stats' && method === 'GET') {
    return localDashboardStats();
  }

  if (path === '/students/courses' && method === 'GET') {
    return [...new Set(getLocalStudents().map(s => s.course).filter(Boolean))].sort();
  }

  if (path === '/students' && method === 'GET') {
    const params = new URLSearchParams(queryString);
    const page = Math.max(1, Number(params.get('page')) || 1);
    const limit = Math.max(1, Number(params.get('limit')) || 20);
    const course = params.get('course') || '';
    const status = params.get('status') || '';
    const search = (params.get('search') || '').toLowerCase();
    let students = getLocalStudents().map(enrichStudent);
    if (course) students = students.filter(s => s.course === course);
    if (status) students = students.filter(s => s.fee_status === status);
    if (search) students = students.filter(s =>
      [s.name, s.phone, s.id, s.email].some(v => String(v || '').toLowerCase().includes(search))
    );
    const total = students.length;
    students = students.slice((page - 1) * limit, page * limit);
    return { students, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  if (path === '/students' && method === 'POST') {
    const students = getLocalStudents();
    const now = new Date().toISOString();
    const student = {
      ...body,
      id: nextStudentId(students),
      paid_fees: Number(body.paid_fees) || 0,
      total_fees: Number(body.total_fees) || 0,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    students.push(student);
    saveLocalStudents(students);
    if (student.paid_fees > 0) {
      const payments = getLocalPayments();
      payments.push({
        id: `PAY-${Date.now()}`,
        student_id: student.id,
        amount: student.paid_fees,
        payment_date: student.admission_date,
        payment_method: 'cash',
        notes: 'Initial admission payment',
      });
      saveLocalPayments(payments);
    }
    return { message: 'Student saved locally', student: enrichStudent(student) };
  }

  const studentMatch = path.match(/^\/students\/([^/]+)$/);
  if (studentMatch) {
    const id = studentMatch[1];
    const students = getLocalStudents();
    const index = students.findIndex(s => s.id === id);
    if (index < 0) {
      const err = new Error('Student not found');
      err.status = 404;
      throw err;
    }
    if (method === 'GET') {
      const payments = getLocalPayments().filter(p => p.student_id === id);
      return { ...enrichStudent(students[index]), payments };
    }
    if (method === 'PUT') {
      students[index] = { ...students[index], ...body, updated_at: new Date().toISOString() };
      saveLocalStudents(students);
      return { message: 'Student updated locally', student: enrichStudent(students[index]) };
    }
    if (method === 'DELETE') {
      students.splice(index, 1);
      saveLocalStudents(students);
      saveLocalPayments(getLocalPayments().filter(p => p.student_id !== id));
      return { message: 'Student deleted locally' };
    }
  }

  if (path === '/payments' && method === 'POST') {
    const students = getLocalStudents();
    const index = students.findIndex(s => s.id === body.student_id);
    if (index < 0) {
      const err = new Error('Student not found');
      err.status = 404;
      throw err;
    }
    const amount = Number(body.amount) || 0;
    if (amount <= 0) {
      const err = new Error('Payment amount must be greater than zero');
      err.status = 400;
      throw err;
    }
    const student = students[index];
    if (body.new_due_date) {
      student.total_fees = Number(student.total_fees || 0) + amount;
      student.paid_fees = Number(student.paid_fees || 0) + amount;
      student.due_date = body.new_due_date;
    } else {
      student.paid_fees = Math.min(Number(student.total_fees) || 0, Number(student.paid_fees || 0) + amount);
    }
    student.status = 'active';
    student.updated_at = new Date().toISOString();
    students[index] = student;
    saveLocalStudents(students);

    const payment = {
      id: `PAY-${Date.now()}`,
      student_id: body.student_id,
      amount,
      payment_date: body.payment_date,
      payment_method: body.payment_method,
      notes: body.notes || '',
      receipt_number: `RCP-${Date.now().toString().slice(-6)}`,
      from_date: body.from_date || null,
      till_date: body.new_due_date || null,
    };
    const payments = getLocalPayments();
    payments.push(payment);
    saveLocalPayments(payments);

    const updated = enrichStudent(student);
    return {
      message: 'Payment saved locally',
      payment,
      receipt: {
        receiptNumber: payment.receipt_number,
        studentName: updated.name,
        studentId: updated.id,
        course: updated.course,
        amount,
        date: body.payment_date,
        method: body.payment_method,
        notes: body.notes,
        totalPaid: updated.paid_fees,
        remaining: updated.remaining_fees,
        totalFees: updated.total_fees,
      },
      student: updated,
    };
  }

  return null;
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
  setToken,
  setRefreshToken,
  getToken,
  clearTokens,
  setUser: (user) => localStorage.setItem('edutrack_user', JSON.stringify(user)),
  getUser: () => { try { return JSON.parse(localStorage.getItem('edutrack_user')); } catch { return null; } },
};
