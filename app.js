const state = {
  cvReady: false,
  queue: [],
  results: [],
  db: new Map(),
  templateImage: null,
  templateFileName: '',
  stream: null,
  dragKey: null,
  resizeKey: null,
  zoom: 1,
  boxes: {
    noPeserta: { x: 0.07, y: 0.12, w: 0.24, h: 0.2, color: '#22c55e', label: 'NO' },
    top1: { x: 0.08, y: 0.03, w: 0.06, h: 0.035, color: '#38bdf8', label: 'TOP1' },
    top2: { x: 0.46, y: 0.03, w: 0.06, h: 0.035, color: '#38bdf8', label: 'TOP2' },
    top3: { x: 0.84, y: 0.03, w: 0.06, h: 0.035, color: '#38bdf8', label: 'TOP3' },
    bot1: { x: 0.24, y: 0.93, w: 0.06, h: 0.035, color: '#fb923c', label: 'BOT1' },
    bot2: { x: 0.68, y: 0.93, w: 0.06, h: 0.035, color: '#fb923c', label: 'BOT2' },
    ans1: { x: 0.36, y: 0.17, w: 0.24, h: 0.33, color: '#a855f7', label: 'ANS1' },
    ans2: { x: 0.62, y: 0.17, w: 0.24, h: 0.33, color: '#c026d3', label: 'ANS2' },
    ans3: { x: 0.36, y: 0.54, w: 0.24, h: 0.33, color: '#7c3aed', label: 'ANS3' },
  },
  answerAreas: [
    { id: 'ans1', active: true, start: 1, end: 20 },
    { id: 'ans2', active: true, start: 21, end: 40 },
    { id: 'ans3', active: false, start: 41, end: 60 },
  ],
};

const el = {
  templateInput: document.getElementById('templateInput'),
  zoomRange: document.getElementById('zoomRange'),
  templatePreview: document.getElementById('templatePreview'),
  templateCanvas: document.getElementById('templateCanvas'),
  activeBoxSelect: document.getElementById('activeBoxSelect'),
  boxX: document.getElementById('boxX'), boxY: document.getElementById('boxY'), boxW: document.getElementById('boxW'), boxH: document.getElementById('boxH'),
  applyBoxBtn: document.getElementById('applyBoxBtn'),
  noDigitCount: document.getElementById('noDigitCount'),
  noDirection: document.getElementById('noDirection'),
  questionCount: document.getElementById('questionCount'),
  optionCount: document.getElementById('optionCount'),
  answerAreaCount: document.getElementById('answerAreaCount'),
  applyAreaCountBtn: document.getElementById('applyAreaCountBtn'),
  areaConfigTableBody: document.querySelector('#areaConfigTable tbody'),
  scanInput: document.getElementById('scanInput'), feederUrl: document.getElementById('feederUrl'), pullFeederBtn: document.getElementById('pullFeederBtn'),
  video: document.getElementById('video'), startCameraBtn: document.getElementById('startCameraBtn'), captureBtn: document.getElementById('captureBtn'), stopCameraBtn: document.getElementById('stopCameraBtn'),
  dbInput: document.getElementById('dbInput'), loadDbBtn: document.getElementById('loadDbBtn'), dbStatus: document.getElementById('dbStatus'), dbTableBody: document.querySelector('#dbTable tbody'),
  answerKey: document.getElementById('answerKey'),
  downloadBackupBtn: document.getElementById('downloadBackupBtn'), importBackupInput: document.getElementById('importBackupInput'),
  processBtn: document.getElementById('processBtn'), downloadBtn: document.getElementById('downloadBtn'), resultBody: document.querySelector('#resultTable tbody'),
  log: document.getElementById('log'),
};
const tctx = el.templateCanvas.getContext('2d');
const clamp = (v, mi = 0, ma = 1) => Math.max(mi, Math.min(ma, v));
const log = (m) => { el.log.textContent += `[${new Date().toLocaleTimeString('id-ID')}] ${m}\n`; el.log.scrollTop = el.log.scrollHeight; };


function normalizeAreasByQuestionCount() {
  const total = Math.max(1, parseInt(el.questionCount.value, 10) || 40);
  const active = state.answerAreas.filter(a => a.active);
  if (!active.length) return;
  const chunk = Math.ceil(total / active.length);
  active.forEach((a, i) => {
    a.start = i * chunk + 1;
    a.end = Math.min(total, (i + 1) * chunk);
  });
}
function initBoxOptions() {
  el.activeBoxSelect.innerHTML = '';
  Object.keys(state.boxes).forEach((k) => {
    const o = document.createElement('option');
    o.value = k; o.textContent = `${k} (${state.boxes[k].label})`;
    el.activeBoxSelect.appendChild(o);
  });
  el.activeBoxSelect.value = 'noPeserta';
  syncBoxForm();
}
function syncBoxForm() {
  const b = state.boxes[el.activeBoxSelect.value];
  if (!b) return;
  el.boxX.value = b.x.toFixed(3); el.boxY.value = b.y.toFixed(3); el.boxW.value = b.w.toFixed(3); el.boxH.value = b.h.toFixed(3);
}
function applyBoxForm() {
  const b = state.boxes[el.activeBoxSelect.value];
  if (!b) return;
  b.x = clamp(parseFloat(el.boxX.value) || b.x, 0, 0.98);
  b.y = clamp(parseFloat(el.boxY.value) || b.y, 0, 0.98);
  b.w = clamp(parseFloat(el.boxW.value) || b.w, 0.01, 1 - b.x);
  b.h = clamp(parseFloat(el.boxH.value) || b.h, 0.01, 1 - b.y);
  drawTemplate();
}

function renderAreaConfig() {
  el.areaConfigTableBody.innerHTML = '';
  state.answerAreas.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>Area ${i + 1}</td>
      <td><input type="checkbox" data-k="active" data-i="${i}" ${a.active ? 'checked' : ''}></td>
      <td><input type="number" data-k="start" data-i="${i}" min="1" value="${a.start}"></td>
      <td><input type="number" data-k="end" data-i="${i}" min="1" value="${a.end}"></td>
      <td>${a.id}</td>`;
    el.areaConfigTableBody.appendChild(tr);
  });
}
el.areaConfigTableBody.addEventListener('change', (e) => {
  const i = Number(e.target.dataset.i);
  const k = e.target.dataset.k;
  if (Number.isNaN(i) || !k) return;
  state.answerAreas[i][k] = k === 'active' ? e.target.checked : parseInt(e.target.value, 10);
  drawTemplate();
});
el.applyAreaCountBtn.addEventListener('click', () => {
  const count = clamp(parseInt(el.answerAreaCount.value, 10) || 2, 1, 3);
  state.answerAreas.forEach((a, i) => { a.active = i < count; });
  normalizeAreasByQuestionCount();
  renderAreaConfig();
  drawTemplate();
});

function drawTemplate() {
  if (!state.templateImage) return;
  const img = state.templateImage;
  const baseW = img.naturalWidth || img.width;
  const baseH = img.naturalHeight || img.height;
  const cssWidth = baseW * state.zoom;
  const cssHeight = baseH * state.zoom;

  el.templatePreview.style.width = `${cssWidth}px`;
  el.templatePreview.style.height = `${cssHeight}px`;
  el.templateCanvas.width = baseW;
  el.templateCanvas.height = baseH;
  el.templateCanvas.style.width = `${cssWidth}px`;
  el.templateCanvas.style.height = `${cssHeight}px`;

  tctx.clearRect(0, 0, baseW, baseH);
  Object.entries(state.boxes).forEach(([k, b]) => {
    const x = b.x * baseW, y = b.y * baseH, w = b.w * baseW, h = b.h * baseH;
    tctx.strokeStyle = b.color; tctx.lineWidth = k === el.activeBoxSelect.value ? 4 : 2;
    tctx.strokeRect(x, y, w, h);
    tctx.fillStyle = b.color; tctx.fillRect(x, Math.max(0, y - 18), 62, 18);
    tctx.fillStyle = '#fff'; tctx.font = '12px sans-serif'; tctx.fillText(b.label, x + 6, y - 5 < 10 ? 12 : y - 5);
    tctx.fillStyle = '#fff'; tctx.fillRect(x + w - 8, y + h - 8, 12, 12); tctx.strokeRect(x + w - 8, y + h - 8, 12, 12);
  });

  // grid patokan interaktif untuk area soal
  const totalOpt = Math.max(2, parseInt(el.optionCount.value, 10) || 4);
  state.answerAreas.filter(a => a.active).sort((a,b)=>a.start-b.start).forEach((area) => {
    const b = state.boxes[area.id];
    if (!b) return;
    const qCount = Math.max(1, area.end - area.start + 1);
    const x = b.x * baseW, y = b.y * baseH, w = b.w * baseW, h = b.h * baseH;
    tctx.strokeStyle = 'rgba(255,255,255,.45)';
    tctx.lineWidth = 1;
    for (let qi = 1; qi < qCount; qi += 1) {
      const yy = y + (qi * h / qCount);
      tctx.beginPath(); tctx.moveTo(x, yy); tctx.lineTo(x + w, yy); tctx.stroke();
    }
    for (let oi = 1; oi < totalOpt; oi += 1) {
      const xx = x + (oi * w / totalOpt);
      tctx.beginPath(); tctx.moveTo(xx, y); tctx.lineTo(xx, y + h); tctx.stroke();
    }
  });
}

function getPos(evt) {
  const r = el.templateCanvas.getBoundingClientRect();
  return { x: (evt.clientX - r.left) / r.width, y: (evt.clientY - r.top) / r.height };
}
function hitBox(p) {
  for (const [k, b] of Object.entries(state.boxes)) {
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return k;
  }
  return null;
}
function nearResizeHandle(p, key) {
  const b = state.boxes[key];
  return p.x > b.x + b.w - 0.02 && p.y > b.y + b.h - 0.02;
}

el.templateCanvas.addEventListener('mousedown', (e) => {
  if (!state.templateImage) return;
  const p = getPos(e);
  const key = hitBox(p);
  if (!key) return;
  el.activeBoxSelect.value = key;
  syncBoxForm();
  if (nearResizeHandle(p, key)) state.resizeKey = key;
  else {
    state.dragKey = key;
    const b = state.boxes[key]; b.offX = p.x - b.x; b.offY = p.y - b.y;
  }
});
window.addEventListener('mouseup', () => { state.dragKey = null; state.resizeKey = null; });
window.addEventListener('mousemove', (e) => {
  if ((!state.dragKey && !state.resizeKey) || !state.templateImage) return;
  const p = getPos(e);
  if (state.dragKey) {
    const b = state.boxes[state.dragKey];
    b.x = clamp(p.x - b.offX, 0, 1 - b.w);
    b.y = clamp(p.y - b.offY, 0, 1 - b.h);
  }
  if (state.resizeKey) {
    const b = state.boxes[state.resizeKey];
    b.w = clamp(p.x - b.x, 0.01, 1 - b.x);
    b.h = clamp(p.y - b.y, 0.01, 1 - b.y);
  }
  syncBoxForm();
  drawTemplate();
});
el.activeBoxSelect.addEventListener('change', () => { syncBoxForm(); drawTemplate(); });
el.applyBoxBtn.addEventListener('click', applyBoxForm);
el.zoomRange.addEventListener('input', () => {
  state.zoom = (parseInt(el.zoomRange.value, 10) || 100) / 100;
  drawTemplate();
});
el.questionCount.addEventListener('change', () => {
  normalizeAreasByQuestionCount();
  renderAreaConfig();
  drawTemplate();
});
el.optionCount.addEventListener('change', drawTemplate);

function parseDb(raw) {
  const m = new Map();
  raw.split(/\r?\n/).forEach((line) => {
    const [nomor, nama = '', kelas = '', ruang = '', mapel = ''] = line.split(',').map(v => v.trim());
    if (nomor && /^\d+$/.test(nomor)) m.set(nomor, { nomor, nama, kelas, ruang, mapel });
  });
  return m;
}
function renderDb() {
  el.dbTableBody.innerHTML = '';
  [...state.db.values()].forEach((s) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.nomor}</td><td>${s.nama}</td><td>${s.kelas}</td><td>${s.ruang}</td><td>${s.mapel}</td>`;
    el.dbTableBody.appendChild(tr);
  });
}

function meanCircleInk(mat, x, y, r) {
  let sum = 0, n = 0;
  const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(mat.cols - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(mat.rows - 1, Math.ceil(y + r));
  for (let yy = y0; yy <= y1; yy += 1) {
    for (let xx = x0; xx <= x1; xx += 1) {
      const dx = xx - x, dy = yy - y;
      if (dx * dx + dy * dy <= r * r) {
        sum += mat.ucharPtr(yy, xx)[0];
        n += 1;
      }
    }
  }
  const mean = n ? sum / n : 255;
  return 255 - mean;
}

function roi(gray, box) {
  const x = Math.floor(gray.cols * box.x), y = Math.floor(gray.rows * box.y);
  const w = Math.max(1, Math.floor(gray.cols * box.w)), h = Math.max(1, Math.floor(gray.rows * box.h));
  return gray.roi(new cv.Rect(x, y, Math.min(w, gray.cols - x), Math.min(h, gray.rows - y)));
}
function detectOrientation(gray) {
  const ds = (k) => { const r = roi(gray, state.boxes[k]); const v = 255 - cv.mean(r)[0]; r.delete(); return v; };
  const top = ds('top1') + ds('top2') + ds('top3');
  const bot = ds('bot1') + ds('bot2');
  if (bot > top * 0.9) { const rt = new cv.Mat(); cv.rotate(gray, rt, cv.ROTATE_180); return { gray: rt, orientation: 'rotated 180' }; }
  return { gray: gray.clone(), orientation: 'normal' };
}

function extractNo(gray) {
  const digits = Math.max(4, parseInt(el.noDigitCount.value, 10) || 10);
  const box = roi(gray, state.boxes.noPeserta);
  const bw = new cv.Mat();
  cv.GaussianBlur(box, box, new cv.Size(3,3), 0);
  cv.adaptiveThreshold(box, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 31, 4);
  const result = [];

  if (el.noDirection.value === 'vertical') {
    const colW = bw.cols / digits;
    const rowH = bw.rows / 10;
    for (let d = 0; d < digits; d += 1) {
      let best = 0, bestInk = -1;
      for (let r = 0; r < 10; r += 1) {
        const cx = (d + 0.5) * colW;
        const cy = (r + 0.5) * rowH;
        const ink = meanCircleInk(bw, cx, cy, Math.min(colW, rowH) * 0.32);
        if (ink > bestInk) { bestInk = ink; best = r; }
      }
      result.push(String(best));
    }
  } else {
    const rowH = bw.rows / digits;
    const colW = bw.cols / 10;
    for (let d = 0; d < digits; d += 1) {
      let best = 0, bestInk = -1;
      for (let c = 0; c < 10; c += 1) {
        const cx = (c + 0.5) * colW;
        const cy = (d + 0.5) * rowH;
        const ink = meanCircleInk(bw, cx, cy, Math.min(colW, rowH) * 0.32);
        if (ink > bestInk) { bestInk = ink; best = c; }
      }
      result.push(String(best));
    }
  }

  box.delete(); bw.delete();
  return result.join('');
}

function detectAnswers(gray) {
  const totalQ = Math.max(1, parseInt(el.questionCount.value, 10) || 40);
  const opt = Math.max(2, parseInt(el.optionCount.value, 10) || 4);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, opt).split('');
  const answers = Array(totalQ).fill('');

  state.answerAreas.filter(a => a.active).sort((a,b)=>a.start-b.start).forEach((area) => {
    const start = clamp(area.start, 1, totalQ);
    const end = clamp(area.end, start, totalQ);
    const qCount = end - start + 1;
    const b = roi(gray, state.boxes[area.id]);
    const bw = new cv.Mat();
    cv.GaussianBlur(b, b, new cv.Size(3,3), 0);
    cv.adaptiveThreshold(b, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 31, 4);

    const qH = bw.rows / qCount;
    const oW = bw.cols / opt;
    for (let qi = 0; qi < qCount; qi += 1) {
      let best = 0, bestInk = -1;
      for (let oi = 0; oi < opt; oi += 1) {
        const cx = (oi + 0.5) * oW;
        const cy = (qi + 0.5) * qH;
        const ink = meanCircleInk(bw, cx, cy, Math.min(oW, qH) * 0.28);
        if (ink > bestInk) { bestInk = ink; best = oi; }
      }
      answers[start - 1 + qi] = letters[best];
    }
    b.delete(); bw.delete();
  });

  return answers.map(a => a || '-').join('');
}

function scoreAnswers(ans) {
  const key = (el.answerKey.value || '').trim().toUpperCase();
  if (!key) return { benar: 0, nilai: 0 };
  let benar = 0;
  for (let i = 0; i < Math.min(ans.length, key.length); i += 1) if (ans[i] === key[i]) benar += 1;
  return { benar, nilai: Number(((benar / key.length) * 100).toFixed(2)) };
}

function renderResults() {
  el.resultBody.innerHTML = '';
  state.results.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.file}</td><td>${r.nomor}</td><td>${r.nama}</td><td>${r.kelas}</td><td>${r.jawaban}</td><td>${r.benar}</td><td>${r.nilai}</td><td>${r.orientasi}</td>`;
    el.resultBody.appendChild(tr);
  });
}

async function processOne(item) {
  const src = cv.imread(item.canvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const oriented = detectOrientation(gray);
  const nomor = extractNo(oriented.gray);
  const jawaban = detectAnswers(oriented.gray);
  const sc = scoreAnswers(jawaban);
  const siswa = state.db.get(nomor) || { nama: 'Tidak ditemukan', kelas: '-' };
  src.delete(); gray.delete(); oriented.gray.delete();
  return { file: item.name, nomor, nama: siswa.nama, kelas: siswa.kelas, jawaban, benar: sc.benar, nilai: sc.nilai, orientasi: oriented.orientation };
}

function backupData() {
  return {
    version: 3,
    exported_at: new Date().toISOString(),
    boxes: state.boxes,
    answer_areas: state.answerAreas,
    zoom: state.zoom,
    db_csv: el.dbInput.value,
    answer_key: el.answerKey.value,
    no_digit_count: el.noDigitCount.value,
    no_direction: el.noDirection.value,
    question_count: el.questionCount.value,
    option_count: el.optionCount.value,
    results: state.results,
  };
}

el.templateInput.addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const img = new Image();
  img.onload = () => {
    state.templateImage = img;
    state.templateFileName = f.name;
    el.templatePreview.src = img.src;
    drawTemplate();
    log(`Template ${f.name} dimuat.`);
  };
  img.src = URL.createObjectURL(f);
});
el.scanInput.addEventListener('change', async (e) => {
  for (const f of [...e.target.files]) {
    const i = new Image();
    await new Promise((ok) => { i.onload = ok; i.src = URL.createObjectURL(f); });
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; c.getContext('2d').drawImage(i, 0, 0);
    state.queue.push({ name: f.name, canvas: c });
  }
  log(`Antrean scan: ${state.queue.length}`);
});

el.pullFeederBtn.addEventListener('click', async () => {
  try {
    const r = await fetch(el.feederUrl.value.trim());
    const b = await r.blob();
    const i = new Image();
    await new Promise((ok) => { i.onload = ok; i.src = URL.createObjectURL(b); });
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; c.getContext('2d').drawImage(i, 0, 0);
    state.queue.push({ name: `feeder-${Date.now()}.png`, canvas: c });
    log('1 lembar ditarik dari feeder bridge.');
  } catch (e) { log(`Gagal feeder: ${e.message}`); }
});
el.startCameraBtn.addEventListener('click', async () => {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    el.video.srcObject = state.stream; el.captureBtn.disabled = false; el.stopCameraBtn.disabled = false;
  } catch (e) { log(`Kamera gagal: ${e.message}`); }
});
el.stopCameraBtn.addEventListener('click', () => {
  if (!state.stream) return;
  state.stream.getTracks().forEach(t => t.stop());
  state.stream = null; el.captureBtn.disabled = true; el.stopCameraBtn.disabled = true;
});
el.captureBtn.addEventListener('click', () => {
  const c = document.createElement('canvas'); c.width = el.video.videoWidth; c.height = el.video.videoHeight;
  c.getContext('2d').drawImage(el.video, 0, 0);
  state.queue.push({ name: `cam-${Date.now()}.png`, canvas: c });
  log('Capture kamera ditambahkan ke antrean.');
});

el.loadDbBtn.addEventListener('click', () => {
  state.db = parseDb(el.dbInput.value);
  renderDb();
  el.dbStatus.textContent = `Database termuat: ${state.db.size}`;
});

el.processBtn.addEventListener('click', async () => {
  if (!state.cvReady) return log('OpenCV belum siap');
  if (!state.templateImage) return log('Upload template dulu');
  if (!state.queue.length) return log('Antrean kosong');
  const jobs = [...state.queue]; state.queue = [];
  for (const job of jobs) {
    try { state.results.push(await processOne(job)); }
    catch (e) { log(`Error ${job.name}: ${e.message}`); }
  }
  renderResults();
  el.downloadBtn.disabled = !state.results.length;
  log('Proses selesai.');
});

el.downloadBtn.addEventListener('click', () => {
  const ws = XLSX.utils.json_to_sheet(state.results);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hasil OMR');
  XLSX.writeFile(wb, `hasil-omr-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

el.downloadBackupBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(backupData(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'backup-omr.json'; a.click(); URL.revokeObjectURL(a.href);
});
el.importBackupInput.addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.boxes) Object.keys(state.boxes).forEach((k) => { if (d.boxes[k]) state.boxes[k] = { ...state.boxes[k], ...d.boxes[k] }; });
    if (Array.isArray(d.answer_areas)) state.answerAreas = d.answer_areas;
    if (d.zoom) { state.zoom = d.zoom; el.zoomRange.value = Math.round(state.zoom * 100); }
    if (typeof d.db_csv === 'string') { el.dbInput.value = d.db_csv; state.db = parseDb(d.db_csv); renderDb(); }
    if (d.answer_key) el.answerKey.value = d.answer_key;
    if (d.no_digit_count) el.noDigitCount.value = d.no_digit_count;
    if (d.no_direction) el.noDirection.value = d.no_direction;
    if (d.question_count) el.questionCount.value = d.question_count;
    if (d.option_count) el.optionCount.value = d.option_count;
    if (Array.isArray(d.results)) { state.results = d.results; renderResults(); }
    renderAreaConfig(); syncBoxForm(); drawTemplate();
    log('Backup berhasil di-import');
  } catch (err) { log(`Import backup gagal: ${err.message}`); }
});

(function waitCV() {
  if (window.cv?.Mat) { state.cvReady = true; log('OpenCV siap'); }
  else setTimeout(waitCV, 250);
})();

initBoxOptions();
normalizeAreasByQuestionCount();
renderAreaConfig();
log('Siap. OMR lingkaran: no peserta vertikal, jawaban horizontal multi-area didukung.');
