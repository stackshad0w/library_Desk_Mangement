import { api } from './api.js';
import { formatCurrency, getInitials, getColor, statusBadgeClass } from '../utils/helpers.js';
import { showToast } from '../utils/toast.js';

let feeChart = null, courseChart = null;

export async function renderDashboard() {
  try {
    const data = await api.get('/dashboard/stats');
    document.getElementById('stat-total').textContent = data.totalStudents;
    document.getElementById('stat-new').textContent = data.newThisMonth;
    document.getElementById('stat-collected').textContent = formatCurrency(data.feesCollected);
    document.getElementById('stat-pending').textContent = formatCurrency(data.feesPending);
    const overdueEl = document.getElementById('stat-overdue');
    if (overdueEl) overdueEl.textContent = formatCurrency(data.feesOverdue);
    renderRecentTable(data.recentAdmissions);
    renderCharts(data);
    updateReminderBadge(data.statusBreakdown.overdue + data.statusBreakdown.pending);
  } catch (err) {
    showToast('Failed to load dashboard', 'red');
  }
}

function renderRecentTable(recent) {
  const tbody = document.getElementById('recent-table');
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text3)">No students yet. Add your first student!</td></tr>';
    return;
  }
  tbody.innerHTML = recent.map((s, i) => `<tr onclick="window.SwamiAbhyasika.showStudentDetails('${s.id}')" style="cursor:pointer">
    <td><div class="student-cell">
      <div class="avatar" style="background:${getColor(i)}20;color:${getColor(i)}">${getInitials(s.name)}</div>
      <div><div class="student-name">${s.name}</div><div class="student-id">${s.id}</div></div>
    </div></td>
    <td>${s.course}</td>
    <td style="color:var(--text2)">${s.admission_date}</td>
    <td><span class="status-pill ${statusBadgeClass(s.fee_status)}">${s.fee_status}</span></td>
  </tr>`).join('');
}

function renderCharts(data) {
  if (typeof Chart === 'undefined') return;
  if (feeChart) feeChart.destroy();
  if (courseChart) courseChart.destroy();

  // Pull colors from the active theme so charts stay readable in light/sepia themes.
  const css = getComputedStyle(document.body);
  const tickColor = css.getPropertyValue('--text2').trim() || '#8b90a0';
  const gridColor = css.getPropertyValue('--border2').trim() || 'rgba(128,128,128,0.15)';
  const accent = css.getPropertyValue('--accent').trim() || '#6c63ff';

  const feeCtx = document.getElementById('feeChart')?.getContext('2d');
  if (feeCtx) {
    const feeLabels = ['Collected', 'Pending'];
    const feeValues = [data.feesCollected, data.feesPending];
    const feeColors = ['#22c55e', '#f59e0b'];
    if (data.feesOverdue > 0) {
      feeLabels.push('Overdue');
      feeValues.push(data.feesOverdue);
      feeColors.push('#ef4444');
    }

    feeChart = new Chart(feeCtx, {
      type: 'doughnut',
      data: {
        labels: feeLabels,
        datasets: [{ data: feeValues, backgroundColor: feeColors, borderWidth: 0, hoverOffset: 4 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: tickColor, font: { size: 12 } } } } }
    });
  }

  const cCtx = document.getElementById('courseChart')?.getContext('2d');
  if (cCtx && data.courseDistribution.length) {
    courseChart = new Chart(cCtx, {
      type: 'bar',
      data: {
        labels: data.courseDistribution.map(c => c.course),
        datasets: [{ label: 'Students', data: data.courseDistribution.map(c => c.count), backgroundColor: accent, borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } }, y: { ticks: { color: tickColor, stepSize: 1 }, grid: { color: gridColor } } }
      }
    });
  }
}

function updateReminderBadge(count) {
  const el = document.getElementById('reminder-badge');
  if (el) el.textContent = count || 0;
}
