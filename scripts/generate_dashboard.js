/**
 * 퍼플식스 스튜디오 KGI 대시보드 HTML 생성기
 *
 * Google Sheets KGI 주간 시트 데이터를 읽어 dashboard/index.html 생성
 * 실행: node scripts/generate_dashboard.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const OAUTH_KEYS_PATH  = 'C:\\Users\\유효영\\.claude\\gcp-oauth.keys.json';
const WRITE_TOKEN_PATH = 'C:\\Users\\유효영\\.claude\\.gdrive-write-credentials.json';
const SHEETS_ID = '1wx0OvGgl4m-t7lQLqahi9JKZA5adJzXtglYVVWB6JE8';
const SHEET_NAME = 'KGI 주간';
const OUTPUT_PATH = path.join(__dirname, '../docs/index.html');

// ── 2026 연간 KPI 목표 ────────────────────────────────────────────────────────
const KPI_TARGETS = {
  web: 24000,   // 연간 누적 홈페이지 유입수
  nl:   5000,   // 뉴스레터 구독자
  yt:  20000,   // 유튜브 구독자
};

function makeClient() {
  const keys = JSON.parse(fs.readFileSync(OAUTH_KEYS_PATH)).installed;
  const client = new google.auth.OAuth2(keys.client_id, keys.client_secret, 'http://localhost:3000/oauth2callback');
  client.setCredentials(JSON.parse(fs.readFileSync(WRITE_TOKEN_PATH)));
  return client;
}

async function fetchSheetData() {
  const client = makeClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range: `${SHEET_NAME}!A2:K`,
  });
  return res.data.values || [];
}

function processData(rows) {
  const weekly = rows
    .filter(r => r[0] && r[1])
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(r => ({
      week:       r[0],   // "2026-W02"
      period:     r[1],   // "2026-01-05 ~ 2026-01-11"
      webSessions: Number(r[2]) || 0,
      webDiff:    Number(r[3]) || 0,
      webMonthly: Number(r[4]) || 0,
      consult:    r[5] !== undefined && r[5] !== '' ? Number(r[5]) : null,
      nlSubs:     Number(r[6]) || 0,
      nlDiff:     Number(r[7]) || 0,
      ytSubs:     Number(r[8]) || 0,
      ytDiff:     Number(r[9]) || 0,
    }));

  // 월별 집계: 주차 시작일 기준, 해당 월의 마지막 누적값 사용
  const monthMap = {};
  for (const d of weekly) {
    const startDate = d.period.split(' ~ ')[0]?.trim();
    const month = startDate?.substring(0, 7); // "YYYY-MM"
    if (!month) continue;
    if (!monthMap[month] || d.webMonthly > (monthMap[month].webMonthly || 0)) {
      monthMap[month] = { month, webMonthly: d.webMonthly };
    }
  }
  const monthly = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

  // 연간 누적 웹 유입 (각 월의 최대 webMonthly 합산)
  const webAnnual = monthly.reduce((sum, m) => sum + m.webMonthly, 0);

  return { weekly, monthly, webAnnual };
}

function monthLabel(m) {
  const [, mm] = m.split('-');
  return `${Number(mm)}월`;
}

function weekLabel(w) {
  return w.replace('2026-', ''); // "W02"
}

function sign(n) {
  if (n === null || n === undefined) return '—';
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
}

function generateHTML(data) {
  const { weekly, monthly, webAnnual } = data;
  const latest = weekly[weekly.length - 1];
  const prev = weekly[weekly.length - 2];

  const webDiffPct = prev && prev.webSessions
    ? ((latest.webSessions - prev.webSessions) / prev.webSessions * 100).toFixed(1)
    : null;

  const now = new Date().toLocaleString('ko-KR');

  // ── KPI 달성율 계산 ─────────────────────────────────────────────────────────
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearEnd   = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);
  const yearPct   = (new Date() - yearStart) / (yearEnd - yearStart) * 100;

  function kpiBlock({ id, label, icon, current, target, color, gradFrom, gradTo }) {
    const pct = Math.min(current / target * 100, 100);
    const isAhead = pct >= yearPct;
    const noData  = current === 0;
    const remaining = (target - current).toLocaleString();
    const statusText = noData
      ? '데이터 없음'
      : isAhead
        ? `▲ 페이스 초과 · 잔여 ${remaining} 달성 시 완료`
        : `▼ 페이스 대비 ${(yearPct - pct).toFixed(1)}%p 지연 · 잔여 ${remaining} 필요`;
    const statusColor = noData ? '#636366' : isAhead ? '#30d158' : '#ff9f0a';

    return `
    <div class="kpi-goal-card" style="border-top: 3px solid ${gradFrom}">
      <div class="kpi-goal-name">${icon} ${label}</div>
      <div class="kpi-goal-nums">
        <span class="kpi-goal-current" style="color:${color}">${noData ? '—' : current.toLocaleString()}</span>
        <span class="kpi-goal-sep"> / </span>
        <span class="kpi-goal-target">목표 ${target.toLocaleString()}</span>
        <span class="kpi-goal-pct" style="color:${color}">${noData ? '—' : pct.toFixed(1) + '%'}</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width:${noData ? 0 : pct}%;background:linear-gradient(90deg,${gradFrom},${gradTo})"></div>
        <div class="progress-bar-pace" style="left:${yearPct.toFixed(1)}%"></div>
      </div>
      <div class="kpi-goal-status" style="color:${statusColor}">${statusText}</div>
      <div class="kpi-goal-pace-label">연도 경과 ${yearPct.toFixed(0)}% 기준 (페이스 마커 ▏)</div>
    </div>`;
  }

  const kpiSection = `
  <!-- 2026 KPI 목표 달성율 -->
  <div class="section-title" style="margin-top:0">2026 KPI 목표 달성율</div>
  <div class="kpi-goal-row">
    ${kpiBlock({ id:'web', label:'연간 누적 홈페이지 유입수', icon:'🌐', current: webAnnual, target: KPI_TARGETS.web, color:'#0a84ff', gradFrom:'#0a84ff', gradTo:'#5ac8fa' })}
    ${kpiBlock({ id:'nl',  label:'뉴스레터 구독자', icon:'📧', current: latest.nlSubs, target: KPI_TARGETS.nl, color:'#bf5af2', gradFrom:'#bf5af2', gradTo:'#da8fff' })}
    ${kpiBlock({ id:'yt',  label:'퍼플식스 TV 유튜브 구독자', icon:'▶️', current: latest.ytSubs, target: KPI_TARGETS.yt, color:'#ff453a', gradFrom:'#ff453a', gradTo:'#ff6b6b' })}
  </div>`;

  // chart data
  const weekLabels = JSON.stringify(weekly.map(d => weekLabel(d.week)));
  const webSessionsData = JSON.stringify(weekly.map(d => d.webSessions));
  const nlSubsData = JSON.stringify(weekly.map(d => d.nlSubs));
  const ytSubsData = JSON.stringify(weekly.map(d => d.ytSubs));
  const nlDiffData = JSON.stringify(weekly.map(d => d.nlDiff));
  const ytDiffData = JSON.stringify(weekly.map(d => d.ytDiff));
  const webDiffData = JSON.stringify(weekly.map(d => d.webDiff));
  const monthLabels = JSON.stringify(monthly.map(d => monthLabel(d.month)));
  const monthWebData = JSON.stringify(monthly.map(d => d.webMonthly));

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>퍼플식스 스튜디오 KGI 대시보드</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #111;
    color: #f5f5f7;
    font-family: -apple-system, 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', sans-serif;
    min-height: 100vh;
    padding: 32px 24px 64px;
  }

  .container { max-width: 1200px; margin: 0 auto; }

  /* Header */
  .header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 40px;
    padding-bottom: 20px;
    border-bottom: 1px solid #2c2c2e;
  }
  .header h1 {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }
  .header .subtitle { font-size: 13px; color: #636366; margin-top: 4px; }
  .header .updated { font-size: 12px; color: #48484a; }

  /* Section title */
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: #636366;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 16px;
    margin-top: 44px;
  }

  /* KPI Cards */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }
  .kpi-card {
    background: #1c1c1e;
    border: 1px solid #2c2c2e;
    border-radius: 16px;
    padding: 24px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .kpi-card:hover { border-color: #48484a; }
  .kpi-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    border-radius: 16px 16px 0 0;
  }
  .kpi-card.blue::before  { background: #0a84ff; }
  .kpi-card.green::before { background: #30d158; }
  .kpi-card.purple::before{ background: #bf5af2; }
  .kpi-card.red::before   { background: #ff453a; }

  .kpi-label { font-size: 12px; color: #636366; font-weight: 500; margin-bottom: 10px; }
  .kpi-value { font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 1; }
  .kpi-value.blue   { color: #0a84ff; }
  .kpi-value.green  { color: #30d158; }
  .kpi-value.purple { color: #bf5af2; }
  .kpi-value.red    { color: #ff453a; }
  .kpi-unit { font-size: 16px; font-weight: 500; margin-left: 2px; color: #98989d; }

  .kpi-delta {
    margin-top: 12px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .kpi-delta .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
  }
  .badge.up   { background: rgba(48,209,88,0.15);  color: #30d158; }
  .badge.down { background: rgba(255,69,58,0.15);  color: #ff453a; }
  .badge.flat { background: rgba(99,99,102,0.2);   color: #636366; }
  .kpi-delta .sub { color: #48484a; font-size: 12px; font-weight: 400; }

  .kpi-period { margin-top: 8px; font-size: 11px; color: #48484a; }

  /* Chart Grid */
  .chart-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .chart-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  @media (max-width: 900px) {
    .chart-grid-2, .chart-grid-3 { grid-template-columns: 1fr; }
  }

  .chart-card {
    background: #1c1c1e;
    border: 1px solid #2c2c2e;
    border-radius: 16px;
    padding: 24px;
  }
  .chart-card.full { grid-column: 1 / -1; }

  .chart-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
  .chart-desc  { font-size: 12px; color: #636366; margin-bottom: 20px; }
  .chart-wrap  { position: relative; height: 240px; }
  .chart-wrap.tall { height: 300px; }

  /* Week table */
  .table-wrap { overflow-x: auto; margin-top: 12px; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    background: #2c2c2e;
    color: #98989d;
    font-weight: 600;
    text-align: center;
    padding: 10px 12px;
    white-space: nowrap;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  th:first-child { text-align: left; border-radius: 8px 0 0 8px; }
  th:last-child  { border-radius: 0 8px 8px 0; }
  td {
    padding: 10px 12px;
    text-align: center;
    border-bottom: 1px solid #2c2c2e;
    color: #d1d1d6;
    white-space: nowrap;
  }
  td:first-child { text-align: left; font-weight: 600; color: #f5f5f7; }
  tr:last-child td { border-bottom: none; }
  tr.latest td { background: rgba(255,255,255,0.03); }

  .pos { color: #30d158; }
  .neg { color: #ff453a; }
  .null { color: #48484a; }

  /* KPI 목표 달성율 */
  .kpi-goal-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 8px;
  }
  @media (max-width: 900px) { .kpi-goal-row { grid-template-columns: 1fr; } }

  .kpi-goal-card {
    background: #1c1c1e;
    border: 1px solid #2c2c2e;
    border-radius: 16px;
    padding: 20px 22px 16px;
  }
  .kpi-goal-name { font-size: 12px; color: #636366; margin-bottom: 10px; }
  .kpi-goal-nums { display: flex; align-items: baseline; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
  .kpi-goal-current { font-size: 28px; font-weight: 700; letter-spacing: -1px; line-height: 1; }
  .kpi-goal-sep    { font-size: 16px; color: #48484a; }
  .kpi-goal-target { font-size: 13px; color: #636366; flex: 1; }
  .kpi-goal-pct    { font-size: 18px; font-weight: 700; margin-left: auto; }

  .progress-bar-bg { background: #2c2c2e; border-radius: 99px; height: 6px; position: relative; margin-bottom: 10px; }
  .progress-bar-fill { height: 100%; border-radius: 99px; }
  .progress-bar-pace {
    position: absolute; top: -4px; width: 2px; height: 14px;
    background: rgba(255,255,255,0.4); border-radius: 1px;
  }
  .kpi-goal-status { font-size: 11px; font-weight: 500; }
  .kpi-goal-pace-label { font-size: 10px; color: #48484a; margin-top: 4px; }
</style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div class="header">
    <div>
      <h1>퍼플식스 스튜디오 KGI 대시보드</h1>
      <div class="subtitle">주간 핵심 지표 현황</div>
    </div>
    <div class="updated">업데이트: ${now}</div>
  </div>

  ${kpiSection}

  <!-- KPI Cards -->
  <div class="section-title">최신 주차 — ${latest.week} &nbsp;|&nbsp; ${latest.period}</div>
  <div class="kpi-grid">

    <div class="kpi-card blue">
      <div class="kpi-label">홈페이지 주간 유입</div>
      <div class="kpi-value blue">${latest.webSessions.toLocaleString()}<span class="kpi-unit">명</span></div>
      <div class="kpi-delta">
        <span class="badge ${latest.webDiff > 0 ? 'up' : latest.webDiff < 0 ? 'down' : 'flat'}">
          ${sign(latest.webDiff)}
        </span>
        ${webDiffPct !== null ? `<span class="sub">${webDiffPct > 0 ? '+' : ''}${webDiffPct}% 전주 대비</span>` : ''}
      </div>
      <div class="kpi-period">월간 누적 ${latest.webMonthly.toLocaleString()}명</div>
    </div>

    <div class="kpi-card green">
      <div class="kpi-label">상담 신청수</div>
      <div class="kpi-value green">${latest.consult !== null ? latest.consult.toLocaleString() : '—'}<span class="kpi-unit">${latest.consult !== null ? '건' : ''}</span></div>
      <div class="kpi-delta"><span class="sub">Salesforce 기준</span></div>
    </div>

    <div class="kpi-card purple">
      <div class="kpi-label">뉴스레터 구독자</div>
      <div class="kpi-value purple">${latest.nlSubs.toLocaleString()}<span class="kpi-unit">명</span></div>
      <div class="kpi-delta">
        <span class="badge ${latest.nlDiff > 0 ? 'up' : latest.nlDiff < 0 ? 'down' : 'flat'}">
          ${sign(latest.nlDiff)}
        </span>
        <span class="sub">전주 대비</span>
      </div>
    </div>

    <div class="kpi-card red">
      <div class="kpi-label">유튜브 구독자</div>
      <div class="kpi-value red">${latest.ytSubs.toLocaleString()}<span class="kpi-unit">명</span></div>
      <div class="kpi-delta">
        <span class="badge ${latest.ytDiff > 0 ? 'up' : latest.ytDiff < 0 ? 'down' : 'flat'}">
          ${sign(latest.ytDiff)}
        </span>
        <span class="sub">전주 대비</span>
      </div>
    </div>

  </div>

  <!-- 주별 추이 -->
  <div class="section-title">주별 추이</div>
  <div class="chart-grid-2">

    <div class="chart-card full">
      <div class="chart-title">홈페이지 주간 유입 추이</div>
      <div class="chart-desc">주차별 세션 수 및 전주 대비 증감</div>
      <div class="chart-wrap tall">
        <canvas id="chartWebWeekly"></canvas>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-title">뉴스레터 구독자 추이</div>
      <div class="chart-desc">주차별 누적 구독자 수</div>
      <div class="chart-wrap">
        <canvas id="chartNlWeekly"></canvas>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-title">유튜브 구독자 추이</div>
      <div class="chart-desc">주차별 누적 구독자 수</div>
      <div class="chart-wrap">
        <canvas id="chartYtWeekly"></canvas>
      </div>
    </div>

  </div>

  <!-- 순증분 비교 -->
  <div class="section-title">주간 순증분 비교</div>
  <div class="chart-grid-2">

    <div class="chart-card">
      <div class="chart-title">뉴스레터 주간 순증분</div>
      <div class="chart-desc">전주 대비 신규 구독자 수</div>
      <div class="chart-wrap">
        <canvas id="chartNlDiff"></canvas>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-title">유튜브 주간 순증분</div>
      <div class="chart-desc">전주 대비 신규 구독자 수</div>
      <div class="chart-wrap">
        <canvas id="chartYtDiff"></canvas>
      </div>
    </div>

  </div>

  <!-- 월별 추이 -->
  <div class="section-title">월별 추이</div>
  <div class="chart-grid-2">

    <div class="chart-card full">
      <div class="chart-title">월간 누적 홈페이지 유입</div>
      <div class="chart-desc">월별 최종 누적 세션 수</div>
      <div class="chart-wrap">
        <canvas id="chartMonthly"></canvas>
      </div>
    </div>

  </div>

  <!-- 전체 데이터 테이블 -->
  <div class="section-title">전체 주차 데이터</div>
  <div class="chart-card">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>주차</th>
            <th>기간</th>
            <th>홈 유입</th>
            <th>홈 증감</th>
            <th>월간 누적</th>
            <th>상담</th>
            <th>뉴스레터</th>
            <th>NL 증감</th>
            <th>유튜브</th>
            <th>YT 증감</th>
          </tr>
        </thead>
        <tbody>
          ${weekly.slice().reverse().map((d, i) => `
          <tr class="${i === 0 ? 'latest' : ''}">
            <td>${weekLabel(d.week)}</td>
            <td>${d.period.replace('2026-', '').replace(/ ~ 2026-/, ' ~ ')}</td>
            <td>${d.webSessions.toLocaleString()}</td>
            <td class="${d.webDiff > 0 ? 'pos' : d.webDiff < 0 ? 'neg' : ''}">${sign(d.webDiff)}</td>
            <td>${d.webMonthly.toLocaleString()}</td>
            <td>${d.consult !== null ? d.consult : '<span class="null">—</span>'}</td>
            <td>${d.nlSubs.toLocaleString()}</td>
            <td class="${d.nlDiff > 0 ? 'pos' : d.nlDiff < 0 ? 'neg' : ''}">${sign(d.nlDiff)}</td>
            <td>${d.ytSubs.toLocaleString()}</td>
            <td class="${d.ytDiff > 0 ? 'pos' : d.ytDiff < 0 ? 'neg' : ''}">${sign(d.ytDiff)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

</div>

<script>
Chart.defaults.color = '#636366';
Chart.defaults.borderColor = '#2c2c2e';
Chart.defaults.font.family = "-apple-system, 'Apple SD Gothic Neo', 'Pretendard', sans-serif";
Chart.defaults.font.size = 12;

const weekLabels = ${weekLabels};
const monthLabels = ${monthLabels};

// ── 홈페이지 주간 유입 (복합: 막대 + 꺾은선)
new Chart(document.getElementById('chartWebWeekly'), {
  data: {
    labels: weekLabels,
    datasets: [
      {
        type: 'bar',
        label: '주간 유입수',
        data: ${webSessionsData},
        backgroundColor: 'rgba(10,132,255,0.3)',
        borderColor: '#0a84ff',
        borderWidth: 1.5,
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: '전주 대비',
        data: ${webDiffData},
        borderColor: '#ffd60a',
        backgroundColor: 'rgba(255,214,10,0.1)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#ffd60a',
        tension: 0.3,
        yAxisID: 'y2',
        fill: false,
      },
    ],
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } } },
    scales: {
      x: { grid: { color: '#2c2c2e' } },
      y:  { grid: { color: '#2c2c2e' }, title: { display: true, text: '세션 수', color: '#48484a' } },
      y2: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '증감', color: '#48484a' } },
    },
  },
});

// ── 뉴스레터 구독자 누적
new Chart(document.getElementById('chartNlWeekly'), {
  type: 'line',
  data: {
    labels: weekLabels,
    datasets: [{
      label: '구독자 수',
      data: ${nlSubsData},
      borderColor: '#bf5af2',
      backgroundColor: 'rgba(191,90,242,0.1)',
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: '#bf5af2',
      tension: 0.3,
      fill: true,
    }],
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#2c2c2e' } },
      y: { grid: { color: '#2c2c2e' } },
    },
  },
});

// ── 유튜브 구독자 누적
new Chart(document.getElementById('chartYtWeekly'), {
  type: 'line',
  data: {
    labels: weekLabels,
    datasets: [{
      label: '구독자 수',
      data: ${ytSubsData},
      borderColor: '#ff453a',
      backgroundColor: 'rgba(255,69,58,0.1)',
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: '#ff453a',
      tension: 0.3,
      fill: true,
    }],
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#2c2c2e' } },
      y: { grid: { color: '#2c2c2e' } },
    },
  },
});

// ── 뉴스레터 순증분
const nlDiffData = ${nlDiffData};
new Chart(document.getElementById('chartNlDiff'), {
  type: 'bar',
  data: {
    labels: weekLabels,
    datasets: [{
      label: '순증분',
      data: nlDiffData,
      backgroundColor: nlDiffData.map(v => v >= 0 ? 'rgba(191,90,242,0.5)' : 'rgba(255,69,58,0.4)'),
      borderColor: nlDiffData.map(v => v >= 0 ? '#bf5af2' : '#ff453a'),
      borderWidth: 1.5,
      borderRadius: 4,
    }],
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#2c2c2e' } },
      y: { grid: { color: '#2c2c2e' } },
    },
  },
});

// ── 유튜브 순증분
const ytDiffData = ${ytDiffData};
new Chart(document.getElementById('chartYtDiff'), {
  type: 'bar',
  data: {
    labels: weekLabels,
    datasets: [{
      label: '순증분',
      data: ytDiffData,
      backgroundColor: ytDiffData.map(v => v >= 0 ? 'rgba(255,69,58,0.45)' : 'rgba(255,69,58,0.2)'),
      borderColor: '#ff453a',
      borderWidth: 1.5,
      borderRadius: 4,
    }],
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#2c2c2e' } },
      y: { grid: { color: '#2c2c2e' } },
    },
  },
});

// ── 월간 누적 유입
new Chart(document.getElementById('chartMonthly'), {
  type: 'bar',
  data: {
    labels: monthLabels,
    datasets: [{
      label: '월간 누적 유입',
      data: ${monthWebData},
      backgroundColor: 'rgba(10,132,255,0.45)',
      borderColor: '#0a84ff',
      borderWidth: 1.5,
      borderRadius: 6,
    }],
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#2c2c2e' } },
      y: { grid: { color: '#2c2c2e' } },
    },
  },
});
</script>
</body>
</html>`;
}

async function main() {
  console.log('\n📊 KGI 대시보드 HTML 생성 중...');
  console.log('  Google Sheets 데이터 읽는 중...');

  const rows = await fetchSheetData();
  console.log(`  ${rows.length}행 읽음`);

  const data = processData(rows);
  console.log(`  주간 ${data.weekly.length}주, 월별 ${data.monthly.length}개월 처리 완료`);

  const html = generateHTML(data);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, html, 'utf8');

  console.log(`\n  ✅ 대시보드 생성 완료`);
  console.log(`  📂 ${OUTPUT_PATH}`);
  console.log('\n');
}

main().catch(e => {
  console.error('❌ 오류:', e.message);
  if (e.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
