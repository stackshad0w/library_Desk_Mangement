import { api } from './api.js';
import { showToast } from '../utils/toast.js';
import { getInitials, escapeHtml, debounce } from '../utils/helpers.js';

/**
 * Library seat map — a configurable floor plan showing live occupancy, with
 * assign-to-student and release. The floors, seats-per-floor and column count
 * are driven by the `seat_config` setting (Settings → Library Layout); the API
 * returns the layout so this view renders whatever the owner configured.
 */

const SLOTS = ['Full Day', 'Early Morning', 'Morning', 'Afternoon', 'Evening'];

let currentFloor = null;       // resolved from the API on first load
let floors = [];               // [{ id, label, seats, cols }]
let gridTotal = 0;             // seats on the current floor
let gridCols = 10;             // columns on the current floor
let bookingsBySeat = {};
let pendingSeat = null;        // seat being assigned
let pendingStudent = null;     // chosen student for assignment

function floorLabel(id) {
  const f = floors.find(x => x.id === id);
  return f ? f.label : (id || '—');
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function plusMonthStr(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function renderFloorTabs() {
  const tabs = document.getElementById('seat-floor-tabs');
  if (!tabs) return;
  tabs.innerHTML = floors.map(f =>
    `<button type="button" class="seat-floor-tab${f.id === currentFloor ? ' active' : ''}" data-floor="${escapeHtml(f.id)}">${escapeHtml(f.label)}</button>`
  ).join('');
}

export async function renderSeatMap(floor) {
  if (floor) currentFloor = floor;

  const grid = document.getElementById('seat-grid');
  if (grid) grid.innerHTML = '<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>';

  try {
    const data = await api.get(`/seats?floor=${currentFloor || ''}`);
    floors = data.floors || floors;
    currentFloor = data.floor || currentFloor;
    gridTotal = data.total || 0;
    gridCols = data.cols || 10;

    bookingsBySeat = {};
    (data.bookings || []).forEach(b => { bookingsBySeat[b.seat_number] = b; });

    renderFloorTabs();
    const av = document.getElementById('seat-avail-count');
    const oc = document.getElementById('seat-occ-count');
    if (av) av.textContent = `${data.available} available`;
    if (oc) oc.textContent = `${data.occupied} occupied`;
    drawGrid();
  } catch {
    if (grid) grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--red)">Failed to load seat map</div>';
  }
}

function drawGrid() {
  const grid = document.getElementById('seat-grid');
  if (!grid) return;
  if (!gridTotal) { grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">No seats configured for this floor.</div>'; return; }

  const cols = Math.max(1, gridCols);
  const aislePos = cols >= 4 ? Math.floor(cols / 2) - 1 : -1; // gap in the middle of the row
  grid.style.minWidth = Math.min(cols * 44 + 40, 900) + 'px';

  const rows = [];
  for (let i = 0; i < gridTotal; i += cols) {
    const cells = [];
    for (let c = 0; c < cols; c++) {
      const sn = i + c + 1;
      if (sn > gridTotal) break;
      const b = bookingsBySeat[sn];
      const cls = b ? 'seat occ' : 'seat avail';
      const tip = b
        ? `${b.student_name}\nSeat ${sn} · ${b.slot || 'Full Day'}\n${b.from_date || '—'} → ${b.due_date || '—'}`
        : `Seat ${sn} · available`;
      cells.push(`<button type="button" class="${cls}" data-seat="${sn}" data-tip="${escapeHtml(tip)}">${sn}</button>`);
      if (c === aislePos) cells.push('<div class="seat-aisle"></div>');
    }
    rows.push(`<div class="seat-row">${cells.join('')}</div>`);
  }
  grid.innerHTML = rows.join('');
}

function onSeatClick(sn) {
  const b = bookingsBySeat[sn];
  if (b) openOccupiedSeat(sn, b);
  else openAssignSeat(sn);
}

/* ---------- Occupied seat: info + release ---------- */
function openOccupiedSeat(sn, b) {
  document.getElementById('seat-modal-title').textContent = `Seat ${sn} — ${floorLabel(currentFloor)}`;
  document.getElementById('seat-info').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="avatar" style="width:48px;height:48px;background:var(--accent-bg);color:var(--accent)">${getInitials(b.student_name || '?')}</div>
      <div><div style="font-weight:600">${escapeHtml(b.student_name || '—')}</div>
        <div style="font-size:12px;color:var(--text3)">${escapeHtml(b.student_phone || '')}${b.student_course ? ' · ' + escapeHtml(b.student_course) : ''}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
      <div><strong>Slot:</strong> ${escapeHtml(b.slot || 'Full Day')}</div>
      <div><strong>Seat:</strong> #${sn}</div>
      <div><strong>From:</strong> ${b.from_date || '—'}</div>
      <div><strong>Until:</strong> ${b.due_date || '—'}</div>
    </div>`;
  document.getElementById('seat-info').style.display = '';
  document.getElementById('seat-assign').style.display = 'none';
  const releaseBtn = document.getElementById('seat-release-btn');
  releaseBtn.style.display = '';
  releaseBtn.onclick = () => releaseSeat(b.id);
  document.getElementById('seat-book-btn').style.display = 'none';
  document.getElementById('seat-modal').classList.add('open');
}

async function releaseSeat(id) {
  try {
    await api.delete(`/seats/${id}`);
    showToast('Seat released', 'green');
    closeSeatModal();
    renderSeatMap();
  } catch (err) {
    showToast(err.message || 'Failed to release seat', 'red');
  }
}

/* ---------- Available seat: assign to student ---------- */
function openAssignSeat(sn) {
  pendingSeat = sn;
  pendingStudent = null;
  document.getElementById('seat-modal-title').textContent = `Assign Seat ${sn} — ${floorLabel(currentFloor)}`;
  document.getElementById('seat-info').style.display = 'none';
  document.getElementById('seat-assign').style.display = '';
  document.getElementById('seat-release-btn').style.display = 'none';
  const bookBtn = document.getElementById('seat-book-btn');
  bookBtn.style.display = '';
  bookBtn.disabled = true;

  document.getElementById('seat-search').value = '';
  document.getElementById('seat-search-results').innerHTML = '';
  document.getElementById('seat-chosen').style.display = 'none';
  document.getElementById('seat-from').value = todayStr();
  document.getElementById('seat-due').value = plusMonthStr(todayStr(), 1);
  const slotSel = document.getElementById('seat-slot');
  slotSel.innerHTML = SLOTS.map(s => `<option value="${s}">${s}</option>`).join('');
  document.getElementById('seat-modal').classList.add('open');
  setTimeout(() => document.getElementById('seat-search').focus(), 50);
}

const searchStudents = debounce(async (q) => {
  const box = document.getElementById('seat-search-results');
  if (!box) return;
  const ql = q.trim();
  if (!ql) { box.innerHTML = ''; return; }
  try {
    const data = await api.get(`/students?search=${encodeURIComponent(ql)}&limit=8`);
    const students = data.students || [];
    if (!students.length) { box.innerHTML = '<div style="padding:10px;color:var(--text3);font-size:13px">No students found</div>'; return; }
    box.innerHTML = students.map(s => `
      <div class="seat-search-item" data-id="${s.id}" data-name="${escapeHtml(s.name)}" data-phone="${escapeHtml(s.phone || '')}" data-course="${escapeHtml(s.course || '')}">
        <div class="avatar" style="width:30px;height:30px;font-size:12px;background:var(--accent-bg);color:var(--accent2)">${getInitials(s.name)}</div>
        <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">${escapeHtml(s.name)}</div>
          <div style="font-size:11px;color:var(--text3)">${escapeHtml(s.phone || '')} · ${escapeHtml(s.course || '')}</div></div>
      </div>`).join('');
  } catch {
    box.innerHTML = '<div style="padding:10px;color:var(--red);font-size:13px">Search failed</div>';
  }
}, 200);

function chooseStudent(el) {
  pendingStudent = { id: el.dataset.id, name: el.dataset.name, phone: el.dataset.phone, course: el.dataset.course };
  document.getElementById('seat-search-results').innerHTML = '';
  document.getElementById('seat-search').value = '';
  const chosen = document.getElementById('seat-chosen');
  chosen.style.display = '';
  chosen.innerHTML = `<div class="avatar" style="width:34px;height:34px;font-size:12px;background:var(--accent-bg);color:var(--accent)">${getInitials(pendingStudent.name)}</div>
    <div style="flex:1"><div style="font-weight:600;font-size:13px">${escapeHtml(pendingStudent.name)}</div>
    <div style="font-size:11px;color:var(--text3)">${escapeHtml(pendingStudent.phone)} · ${escapeHtml(pendingStudent.course)}</div></div>
    <button type="button" class="icon-btn" id="seat-clear-student" title="Change">✕</button>`;
  document.getElementById('seat-book-btn').disabled = false;
}

async function confirmBooking() {
  if (!pendingStudent || !pendingSeat) { showToast('Pick a student first', 'amber'); return; }
  try {
    await api.post('/seats', {
      floor: currentFloor,
      seat_number: pendingSeat,
      student_id: pendingStudent.id,
      slot: document.getElementById('seat-slot').value,
      from_date: document.getElementById('seat-from').value || null,
      due_date: document.getElementById('seat-due').value || null,
    });
    showToast(`Seat ${pendingSeat} booked for ${pendingStudent.name}`, 'green');
    closeSeatModal();
    renderSeatMap();
  } catch (err) {
    showToast(err.message || 'Failed to book seat', 'red');
  }
}

export function closeSeatModal() {
  document.getElementById('seat-modal')?.classList.remove('open');
  pendingSeat = null;
  pendingStudent = null;
}

export function initSeatMap() {
  const page = document.getElementById('page-seats');
  if (!page) return;

  // Floor tabs are rendered dynamically, so delegate clicks from the container.
  document.getElementById('seat-floor-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.seat-floor-tab');
    if (tab && tab.dataset.floor) renderSeatMap(tab.dataset.floor);
  });

  document.getElementById('seat-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.seat');
    if (btn && btn.dataset.seat) onSeatClick(Number(btn.dataset.seat));
  });

  document.getElementById('seat-search')?.addEventListener('input', (e) => searchStudents(e.target.value));
  document.getElementById('seat-search-results')?.addEventListener('click', (e) => {
    const item = e.target.closest('.seat-search-item');
    if (item) chooseStudent(item);
  });
  document.getElementById('seat-chosen')?.addEventListener('click', (e) => {
    if (e.target.closest('#seat-clear-student')) {
      pendingStudent = null;
      document.getElementById('seat-chosen').style.display = 'none';
      document.getElementById('seat-book-btn').disabled = true;
    }
  });
  document.getElementById('seat-book-btn')?.addEventListener('click', confirmBooking);
  document.getElementById('seat-modal-close')?.addEventListener('click', closeSeatModal);
  document.getElementById('seat-modal-cancel')?.addEventListener('click', closeSeatModal);
  document.getElementById('seat-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'seat-modal') closeSeatModal();
  });
}
