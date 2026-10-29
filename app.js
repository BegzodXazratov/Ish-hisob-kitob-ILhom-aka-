'use strict';

/* ===== Sozlamalar ===== */
const SB_URL = 'https://ljilvblrbdhdizvgqtyc.supabase.co';
const SB_KEY = 'sb_publishable_dtWXod3KZbYtDS2U5_z8fQ_dMBma7IV';
const TZ = 'Asia/Tashkent';
const TOKEN_KEY = 'ilhom_hk_token';

const CATS = [
  ['Kitob xaridi', '📦'], ['Ijara', '🏠'], ['Kommunal', '💡'], ['Ish haqi', '👥'],
  ['Internet va aloqa', '📶'], ['Transport', '🚚'], ['Reklama', '📣'], ['Soliq', '🧾'],
  ["Xo'jalik", '🧹'], ['Ovqat', '☕'], ['Boshqa', '•']
];
const CAT_ICON = Object.fromEntries(CATS);
const METHOD = { naqd: 'Naqd', karta: 'Karta', otkazma: "O'tkazma" };
const MONTHS = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
const WEEKDAYS = ['yakshanba','dushanba','seshanba','chorshanba','payshanba','juma','shanba'];

/* ===== Holat ===== */
let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch (_) {}
let templates = [];
let report = { mode: 'day', from: null, to: null, rows: [] };
let editing = null;      // tahrirlanayotgan harajat
let editingTpl = null;
let pickedTplId = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ===== Yordamchilar ===== */
function todayStr(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function parseD(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function fmtD(dt) { return dt.toISOString().slice(0, 10); }
function addDays(s, n) { const d = parseD(s); d.setUTCDate(d.getUTCDate() + n); return fmtD(d); }
function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`];
}
function human(s, withWeekday = true) {
  const d = parseD(s);
  const base = `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`;
  if (s === todayStr()) return 'Bugun, ' + base;
  if (s === todayStr(-1)) return 'Kecha, ' + base;
  return withWeekday ? `${base}, ${WEEKDAYS[d.getUTCDay()]}` : `${base} ${d.getUTCFullYear()}`;
}
function money(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('ru-RU').replace(/ /g, ' ') + " so'm";
}
function parseAmount(s) { return Number(String(s).replace(/[^\d]/g, '')) || 0; }
function bindAmount(input) {
  input.addEventListener('input', () => {
    const v = parseAmount(input.value);
    input.value = v ? v.toLocaleString('ru-RU').replace(/ /g, ' ') : '';
  });
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

const ERR = {
  WRONG_PASSWORD: "Parol noto'g'ri",
  TOO_MANY_ATTEMPTS: "Juda ko'p urinish. 10 daqiqadan so'ng qayta urinib ko'ring",
  AUTH_REQUIRED: 'Qaytadan kiring',
  PASSWORD_TOO_SHORT: "Yangi parol kamida 4 belgidan iborat bo'lsin",
  NAME_REQUIRED: 'Nomini kiriting'
};

async function rpc(fn, args = {}, withToken = true) {
  const body = withToken ? { p_token: token, ...args } : args;
  let res;
  try {
    res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error("Internet bilan aloqa yo'q");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = (data && data.message) || 'ERROR';
    if (code === 'AUTH_REQUIRED') { logout(true); }
    throw new Error(ERR[code] || 'Xatolik yuz berdi. Qayta urinib ko\'ring');
  }
  return data;
}

/* ===== Kirish ===== */
function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); setTimeout(() => $('#loginPw').focus(), 50); }
function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); }

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn'); btn.disabled = true; $('#loginErr').textContent = '';
  try {
    token = await rpc('ilhom_login', { p_password: $('#loginPw').value }, false);
    try { localStorage.setItem(TOKEN_KEY, token); } catch (_) {}
    $('#loginPw').value = '';
    showApp(); await boot();
  } catch (err) {
    $('#loginErr').textContent = err.message;
  } finally { btn.disabled = false; }
});

async function logout(silent) {
  if (!silent && token) { try { await rpc('ilhom_logout'); } catch (_) {} }
  token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
  showLogin();
}
$('#logoutBtn').addEventListener('click', () => { if (confirm('Chiqishni xohlaysizmi?')) logout(false); });

/* ===== Tablar ===== */
function switchTab(name) {
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.view').forEach((v) => v.classList.toggle('hidden', v.id !== 'view-' + name));
  if (name === 'report') loadReport();
  window.scrollTo({ top: 0 });
}
$$('.tab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
$$('[data-goto]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.goto)));

/* ===== Ro'yxat chizish ===== */
function itemHTML(e, showDate = false) {
  const icon = CAT_ICON[e.category] || '•';
  const sub = [e.note, METHOD[e.method] || e.method, showDate ? human(e.spent_on) : null].filter(Boolean).map(esc).join(' · ');
  return `<div class="item" data-id="${e.id}">
    <div class="dot">${icon}</div>
    <div class="mid"><div class="t">${esc(e.category)}</div><div class="s">${sub}</div></div>
    <div class="amt">${money(e.amount)}</div>
  </div>`;
}
function bindItems(container, rows) {
  container.querySelectorAll('.item[data-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const row = rows.find((r) => String(r.id) === el.dataset.id);
      if (row) openExpense(row);
    });
  });
}
const sum = (rows) => rows.reduce((a, r) => a + Number(r.amount), 0);

/* ===== Bugun ===== */
async function loadHome() {
  const t = todayStr(), y = todayStr(-1);
  const ym = t.slice(0, 7);
  const [mFrom] = monthBounds(ym);
  const from = y < mFrom ? y : mFrom;
  const rows = await rpc('ilhom_list_expenses', { p_from: from, p_to: t });
  const today = rows.filter((r) => r.spent_on === t);
  const yest = rows.filter((r) => r.spent_on === y);
  const month = rows.filter((r) => r.spent_on >= mFrom);
  $('#sToday').textContent = money(sum(today));
  $('#sTodayCount').textContent = today.length ? `${today.length} ta yozuv` : "Hali yozuv yo'q";
  $('#sYesterday').textContent = money(sum(yest));
  $('#sMonthLabel').textContent = MONTHS[parseD(t).getUTCMonth()][0].toUpperCase() + MONTHS[parseD(t).getUTCMonth()].slice(1) + ' oyi';
  $('#sMonth').textContent = money(sum(month));
  const list = $('#todayList');
  list.innerHTML = today.length ? today.map((e) => itemHTML(e)).join('') : '<div class="empty">Bugun hali harajat kiritilmagan</div>';
  bindItems(list, today);
}

/* ===== Shablonlar ===== */
async function loadTemplates() {
  templates = await rpc('ilhom_list_templates');
  renderTemplates();
}
function tplChip(t) {
  return `<button type="button" class="chip tpl" data-tpl="${t.id}"><b>${esc(t.name)}</b><small>${Number(t.amount) ? money(t.amount) : 'summa kiritiladi'}</small></button>`;
}
function renderTemplates() {
  const q = $('#quickTemplates');
  q.innerHTML = templates.length ? templates.map(tplChip).join('') : '<div class="empty">Shablonlar yo\'q — "Shablonlar" bo\'limida qo\'shing</div>';
  q.querySelectorAll('[data-tpl]').forEach((b) => b.addEventListener('click', () => quickAdd(Number(b.dataset.tpl))));

  const l = $('#tplList');
  l.innerHTML = templates.length ? templates.map((t) => `<div class="item" data-tid="${t.id}">
      <div class="dot">${CAT_ICON[t.category] || '•'}</div>
      <div class="mid"><div class="t">${esc(t.name)}</div><div class="s">${esc(t.category)}${t.note ? ' · ' + esc(t.note) : ''}</div></div>
      <div class="act"><span class="amt">${Number(t.amount) ? money(t.amount) : '—'}</span></div>
      <button class="btn small" data-use="${t.id}">+ Qo'shish</button>
    </div>`).join('') : '<div class="empty">Hozircha shablon yo\'q</div>';
  l.querySelectorAll('[data-tid]').forEach((el) => el.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-use]')) return;
    openTemplate(templates.find((t) => String(t.id) === el.dataset.tid));
  }));
  l.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => quickAdd(Number(b.dataset.use))));

  const ec = $('#expTplChips');
  ec.innerHTML = templates.map(tplChip).join('');
  $('#expTplWrap').classList.toggle('hidden', !templates.length);
  ec.querySelectorAll('[data-tpl]').forEach((b) => b.addEventListener('click', () => applyTemplate(Number(b.dataset.tpl))));
}
function quickAdd(id) {
  openExpense(null);
  applyTemplate(id);
}

/* ===== Kategoriya tanlagich ===== */
function renderCats(box, customInput, selected) {
  const known = CATS.some(([c]) => c === selected);
  box.innerHTML = CATS.map(([c, i]) => `<button type="button" class="chip${(known ? c === selected : c === 'Boshqa' && selected) ? ' on' : ''}" data-cat="${esc(c)}">${i} ${esc(c)}</button>`).join('');
  customInput.classList.toggle('hidden', known || !selected);
  customInput.value = known || !selected || selected === 'Boshqa' ? '' : selected;
  box.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    box.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    customInput.classList.toggle('hidden', b.dataset.cat !== 'Boshqa');
    if (b.dataset.cat === 'Boshqa') customInput.focus();
  }));
}
function readCat(box, customInput) {
  const on = box.querySelector('.chip.on');
  if (!on) return '';
  if (on.dataset.cat === 'Boshqa') return customInput.value.trim() || 'Boshqa';
  return on.dataset.cat;
}

/* ===== Harajat oynasi ===== */
function openExpense(row) {
  editing = row; pickedTplId = null;
  $('#expTitle').textContent = row ? 'Harajatni tahrirlash' : "Harajat qo'shish";
  $('#eAmount').value = row ? Math.round(row.amount).toLocaleString('ru-RU').replace(/ /g, ' ') : '';
  $('#eNote').value = row?.note || '';
  $('#eDate').value = row?.spent_on || todayStr();
  $('#eMethod').value = row?.method || 'naqd';
  $('#eSaveTpl').checked = false;
  $('#eSaveTplWrap').classList.toggle('hidden', !!row);
  $('#eDelete').classList.toggle('hidden', !row);
  $('#expTplWrap').classList.toggle('hidden', !!row || !templates.length);
  $('#expErr').textContent = '';
  renderCats($('#eCats'), $('#eCatCustom'), row?.category || '');
  $$('#expTplChips .chip').forEach((c) => c.classList.remove('on'));
  $('#expDlg').showModal();
  if (!row) setTimeout(() => $('#eAmount').focus(), 60);
}
function applyTemplate(id) {
  const t = templates.find((x) => x.id === id); if (!t) return;
  pickedTplId = id;
  $$('#expTplChips .chip').forEach((c) => c.classList.toggle('on', Number(c.dataset.tpl) === id));
  if (Number(t.amount)) $('#eAmount').value = Math.round(t.amount).toLocaleString('ru-RU').replace(/ /g, ' ');
  $('#eNote').value = t.note ? `${t.name} — ${t.note}` : t.name;
  renderCats($('#eCats'), $('#eCatCustom'), t.category);
  setTimeout(() => { const a = $('#eAmount'); a.focus(); a.select(); }, 60);
}
$('#addBtn').addEventListener('click', () => openExpense(null));

$('#expForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = parseAmount($('#eAmount').value);
  const category = readCat($('#eCats'), $('#eCatCustom'));
  if (!amount) { $('#expErr').textContent = 'Summani kiriting'; return; }
  if (!category) { $('#expErr').textContent = 'Harajat turini tanlang'; return; }
  const btn = $('#eSave'); btn.disabled = true;
  try {
    const note = $('#eNote').value;
    await rpc('ilhom_save_expense', {
      p_id: editing?.id ?? null, p_date: $('#eDate').value, p_amount: amount, p_category: category,
      p_note: note, p_method: $('#eMethod').value, p_template_id: editing ? null : pickedTplId
    });
    if (!editing && $('#eSaveTpl').checked) {
      await rpc('ilhom_save_template', { p_id: null, p_name: note.trim() || category, p_amount: amount, p_category: category, p_note: null });
      await loadTemplates();
    }
    $('#expDlg').close();
    toast(editing ? 'Saqlandi' : "Harajat qo'shildi ✓");
    await refresh();
  } catch (err) { $('#expErr').textContent = err.message; }
  finally { btn.disabled = false; }
});
$('#eDelete').addEventListener('click', async () => {
  if (!editing || !confirm("Bu harajatni o'chirasizmi?")) return;
  try { await rpc('ilhom_delete_expense', { p_id: editing.id }); $('#expDlg').close(); toast("O'chirildi"); await refresh(); }
  catch (err) { $('#expErr').textContent = err.message; }
});

/* ===== Shablon oynasi ===== */
function openTemplate(t) {
  editingTpl = t || null;
  $('#tplTitle').textContent = t ? 'Shablonni tahrirlash' : 'Yangi shablon';
  $('#tName').value = t?.name || '';
  $('#tAmount').value = t && Number(t.amount) ? Math.round(t.amount).toLocaleString('ru-RU').replace(/ /g, ' ') : '';
  $('#tNote').value = t?.note || '';
  $('#tDelete').classList.toggle('hidden', !t);
  $('#tplErr').textContent = '';
  renderCats($('#tCats'), $('#tCatCustom'), t?.category || '');
  $('#tplDlg').showModal();
}
$('#newTplBtn').addEventListener('click', () => openTemplate(null));
$('#tplForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const category = readCat($('#tCats'), $('#tCatCustom'));
  if (!category) { $('#tplErr').textContent = 'Harajat turini tanlang'; return; }
  try {
    await rpc('ilhom_save_template', { p_id: editingTpl?.id ?? null, p_name: $('#tName').value, p_amount: parseAmount($('#tAmount').value), p_category: category, p_note: $('#tNote').value });
    $('#tplDlg').close(); toast('Shablon saqlandi'); await loadTemplates();
  } catch (err) { $('#tplErr').textContent = err.message; }
});
$('#tDelete').addEventListener('click', async () => {
  if (!editingTpl || !confirm("Shablonni o'chirasizmi? (Avval kiritilgan harajatlar saqlanib qoladi)")) return;
  try { await rpc('ilhom_delete_template', { p_id: editingTpl.id }); $('#tplDlg').close(); toast("O'chirildi"); await loadTemplates(); }
  catch (err) { $('#tplErr').textContent = err.message; }
});

/* ===== Sozlamalar ===== */
$('#settingsBtn').addEventListener('click', () => { $('#setForm').reset(); $('#setErr').textContent = ''; $('#setDlg').showModal(); });
$('#setForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if ($('#sNew').value !== $('#sNew2').value) { $('#setErr').textContent = 'Yangi parollar bir xil emas'; return; }
  try {
    await rpc('ilhom_change_password', { p_old: $('#sOld').value, p_new: $('#sNew').value });
    $('#setDlg').close(); toast("Parol o'zgartirildi");
  } catch (err) { $('#setErr').textContent = err.message; }
});

/* Dialoglarni yopish */
$$('dialog').forEach((d) => {
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
});
[$('#eAmount'), $('#tAmount')].forEach(bindAmount);

/* ===== Hisobot ===== */
function setMode(mode) {
  report.mode = mode;
  $$('#periodSeg button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  $$('.period-inputs [data-for]').forEach((el) => el.classList.toggle('hidden', el.dataset.for !== mode));
}
$$('#periodSeg button').forEach((b) => b.addEventListener('click', () => { setMode(b.dataset.mode); loadReport(); }));
['#pDay', '#pMonth', '#pFrom', '#pTo'].forEach((s) => $(s).addEventListener('change', loadReport));
$$('.presets button').forEach((b) => b.addEventListener('click', () => {
  const t = todayStr();
  switch (b.dataset.preset) {
    case 'today': setMode('day'); $('#pDay').value = t; break;
    case 'yesterday': setMode('day'); $('#pDay').value = todayStr(-1); break;
    case 'week': setMode('range'); $('#pFrom').value = addDays(t, -6); $('#pTo').value = t; break;
    case 'month': setMode('month'); $('#pMonth').value = t.slice(0, 7); break;
    case 'lastmonth': { const d = parseD(t.slice(0, 7) + '-01'); d.setUTCMonth(d.getUTCMonth() - 1); setMode('month'); $('#pMonth').value = fmtD(d).slice(0, 7); break; }
  }
  loadReport();
}));

function currentRange() {
  if (report.mode === 'day') { const d = $('#pDay').value || todayStr(); return [d, d]; }
  if (report.mode === 'month') return monthBounds($('#pMonth').value || todayStr().slice(0, 7));
  let f = $('#pFrom').value || todayStr(-6), t = $('#pTo').value || todayStr();
  if (f > t) [f, t] = [t, f];
  return [f, t];
}

async function loadReport() {
  const [from, to] = currentRange();
  report.from = from; report.to = to;
  let rows;
  try { rows = await rpc('ilhom_list_expenses', { p_from: from, p_to: to }); }
  catch (err) { toast(err.message); return; }
  report.rows = rows;
  const total = sum(rows);
  const days = Math.round((parseD(to) - parseD(from)) / 864e5) + 1;
  const effDays = to > todayStr() ? Math.max(1, Math.round((parseD(todayStr()) - parseD(from)) / 864e5) + 1) : days;

  if (report.mode === 'day') $('#rTitle').textContent = human(from, false);
  else if (report.mode === 'month') { const d = parseD(from); $('#rTitle').textContent = `${MONTHS[d.getUTCMonth()][0].toUpperCase()}${MONTHS[d.getUTCMonth()].slice(1)} ${d.getUTCFullYear()} — jami`; }
  else $('#rTitle').textContent = `${human(from, false)} — ${human(to, false)}`;
  $('#rTotal').textContent = money(total);
  const naqd = sum(rows.filter((r) => r.method === 'naqd'));
  $('#rSub').textContent = rows.length ? `Naqd: ${money(naqd)} · Karta/o'tkazma: ${money(total - naqd)}` : '';
  $('#rCount').textContent = rows.length + ' ta';
  $('#rAvg').textContent = money(total / Math.max(1, Math.min(days, effDays)));

  // Kunlar kesimida
  const dailyCard = $('#dailyCard');
  if (days > 1 && days <= 92) {
    dailyCard.classList.remove('hidden');
    const byDay = {}; rows.forEach((r) => { byDay[r.spent_on] = (byDay[r.spent_on] || 0) + Number(r.amount); });
    const max = Math.max(1, ...Object.values(byDay));
    let html = '';
    for (let i = 0; i < days; i++) {
      const d = addDays(from, i), v = byDay[d] || 0;
      const label = parseD(d).getUTCDate();
      html += `<div class="col${v ? '' : ' zero'}" title="${human(d)}: ${money(v)}"><i style="height:${Math.max(2, (v / max) * 100)}%"></i><em>${days <= 10 || label === 1 || label % 5 === 0 ? label : ''}</em></div>`;
    }
    $('#dailyChart').innerHTML = html;
  } else dailyCard.classList.add('hidden');

  // Turlar bo'yicha
  const byCat = {}; rows.forEach((r) => { byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount); });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const cmax = cats.length ? cats[0][1] : 1;
  $('#catBreak').innerHTML = cats.length ? cats.map(([c, v]) => `<div class="bar">
      <div class="top"><span>${CAT_ICON[c] || '•'} ${esc(c)} <span class="pct">${Math.round((v / total) * 100)}%</span></span><span>${money(v)}</span></div>
      <div class="track"><div class="fill" style="width:${(v / cmax) * 100}%"></div></div></div>`).join('')
    : '<div class="empty">Bu davrda harajat yo\'q</div>';

  // Ro'yxat (kunlar bo'yicha guruhlangan)
  const list = $('#reportList');
  if (!rows.length) { list.innerHTML = '<div class="empty">Yozuvlar yo\'q</div>'; return; }
  const groups = {}; rows.forEach((r) => { (groups[r.spent_on] ||= []).push(r); });
  list.innerHTML = Object.keys(groups).sort().reverse().map((d) =>
    `<div class="day-head"><span>${human(d)}</span><span>${money(sum(groups[d]))}</span></div>` + groups[d].map((e) => itemHTML(e)).join('')
  ).join('');
  bindItems(list, rows);
}

$('#csvBtn').addEventListener('click', () => {
  if (!report.rows.length) { toast("Yuklash uchun yozuv yo'q"); return; }
  const head = ['Sana', 'Turi', 'Izoh', "To'lov", 'Summa'];
  const lines = [head, ...[...report.rows].sort((a, b) => a.spent_on.localeCompare(b.spent_on))
    .map((r) => [r.spent_on, r.category, r.note || '', METHOD[r.method] || r.method, Math.round(r.amount)]),
    ['', '', '', 'JAMI', Math.round(sum(report.rows))]];
  const csv = '﻿' + lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `harajatlar_${report.from}_${report.to}.csv`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* ===== Ishga tushirish ===== */
async function refresh() {
  const tasks = [loadHome()];
  if (!$('#view-report').classList.contains('hidden')) tasks.push(loadReport());
  await Promise.all(tasks);
}
async function boot() {
  const t = todayStr();
  $('#todayLabel').textContent = human(t);
  $('#pDay').value = t; $('#pMonth').value = t.slice(0, 7);
  $('#pFrom').value = addDays(t, -6); $('#pTo').value = t;
  try { await Promise.all([loadTemplates(), loadHome()]); }
  catch (err) { if (token) toast(err.message); }
}

(async function init() {
  if (!token) return showLogin();
  try {
    const ok = await rpc('ilhom_check', {});
    if (!ok) throw new Error();
    showApp(); await boot();
  } catch (_) { logout(true); }
})();
