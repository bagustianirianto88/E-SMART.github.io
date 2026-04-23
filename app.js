const state = {
  cvReady: false,
  queue: [],
  results: [],
  db: new Map(),
  templateImage: null,
  templateFileName: '',
  stream: null,
  dragKey: null,
  boxes: {
    noPeserta: { x: 0.08, y: 0.14, w: 0.26, h: 0.11, color: '#22c55e', label: 'NO' },
    answers: { x: 0.42, y: 0.18, w: 0.5, h: 0.72, color: '#a855f7', label: 'ANS' },
    top1: { x: 0.06, y: 0.03, w: 0.08, h: 0.04, color: '#38bdf8', label: 'TOP1' },
    top2: { x: 0.46, y: 0.03, w: 0.08, h: 0.04, color: '#38bdf8', label: 'TOP2' },
    top3: { x: 0.86, y: 0.03, w: 0.08, h: 0.04, color: '#38bdf8', label: 'TOP3' },
    bot1: { x: 0.24, y: 0.93, w: 0.08, h: 0.04, color: '#fb923c', label: 'BOT1' },
    bot2: { x: 0.68, y: 0.93, w: 0.08, h: 0.04, color: '#fb923c', label: 'BOT2' },
  },
};

const el = {
  templateInput: document.getElementById('templateInput'),
  templatePreview: document.getElementById('templatePreview'),
  templateCanvas: document.getElementById('templateCanvas'),
  scanInput: document.getElementById('scanInput'),
  feederUrl: document.getElementById('feederUrl'),
  pullFeederBtn: document.getElementById('pullFeederBtn'),
  video: document.getElementById('video'),
  startCameraBtn: document.getElementById('startCameraBtn'),
  captureBtn: document.getElementById('captureBtn'),
  stopCameraBtn: document.getElementById('stopCameraBtn'),
  dbInput: document.getElementById('dbInput'),
  loadDbBtn: document.getElementById('loadDbBtn'),
  dbStatus: document.getElementById('dbStatus'),
  dbTableBody: document.querySelector('#dbTable tbody'),
  answerKey: document.getElementById('answerKey'),
  questionCount: document.getElementById('questionCount'),
  downloadBackupBtn: document.getElementById('downloadBackupBtn'),
  importBackupInput: document.getElementById('importBackupInput'),
  processBtn: document.getElementById('processBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  resultBody: document.querySelector('#resultTable tbody'),
  log: document.getElementById('log'),
};
const tctx = el.templateCanvas.getContext('2d');

const log = (m) => {
  el.log.textContent += `[${new Date().toLocaleTimeString('id-ID')}] ${m}\n`;
  el.log.scrollTop = el.log.scrollHeight;
};

function parseDb(raw) {
  const map = new Map();
  raw.split(/\r?\n/).forEach((line) => {
    const [nomor, nama = '', kelas = '', ruang = '', mapel = ''] = line.split(',').map(v => v.trim());
    if (nomor && /^\d+$/.test(nomor)) map.set(nomor, { nomor, nama, kelas, ruang, mapel });
  });
  return map;
}

function renderDb() {
  el.dbTableBody.innerHTML = '';
  [...state.db.values()].forEach((siswa) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${siswa.nomor}</td><td>${siswa.nama}</td><td>${siswa.kelas}</td><td>${siswa.ruang}</td><td>${siswa.mapel}</td>`;
    el.dbTableBody.appendChild(tr);
  });
}

function getCanvasClientRatio(evt) {
  const r = el.templateCanvas.getBoundingClientRect();
  const xr = (evt.clientX - r.left) / r.width;
  const yr = (evt.clientY - r.top) / r.height;
  return { x: xr, y: yr };
}

function drawTemplate() {
  if (!state.templateImage) return;
  const img = state.templateImage;
  const cssWidth = el.templatePreview.clientWidth || img.width;
  const scale = cssWidth / img.width;
  const cssHeight = img.height * scale;

  el.templateCanvas.width = img.width;
  el.templateCanvas.height = img.height;
  el.templateCanvas.style.width = `${cssWidth}px`;
  el.templateCanvas.style.height = `${cssHeight}px`;

  tctx.clearRect(0, 0, img.width, img.height);
  Object.values(state.boxes).forEach((b) => {
    const x = b.x * img.width, y = b.y * img.height, w = b.w * img.width, h = b.h * img.height;
    tctx.strokeStyle = b.color;
    tctx.lineWidth = 3;
    tctx.strokeRect(x, y, w, h);
    tctx.fillStyle = b.color;
    tctx.fillRect(x, Math.max(0, y - 18), 60, 18);
    tctx.fillStyle = '#fff';
    tctx.font = '12px sans-serif';
    tctx.fillText(b.label, x + 6, y - 5 < 10 ? 12 : y - 5);
  });
}

function hitTest(pos) {
  for (const [k, b] of Object.entries(state.boxes)) {
    if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) return k;
  }
  return null;
}
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));

el.templateCanvas.addEventListener('mousedown', (e) => {
  if (!state.templateImage) return;
  const p = getCanvasClientRatio(e);
  state.dragKey = hitTest(p);
  if (state.dragKey) {
    const b = state.boxes[state.dragKey];
    b.offsetX = p.x - b.x;
    b.offsetY = p.y - b.y;
  }
});
window.addEventListener('mouseup', () => { state.dragKey = null; });
window.addEventListener('mousemove', (e) => {
  if (!state.dragKey || !state.templateImage) return;
  const p = getCanvasClientRatio(e);
  const b = state.boxes[state.dragKey];
  b.x = clamp(p.x - b.offsetX, 0, 1 - b.w);
  b.y = clamp(p.y - b.offsetY, 0, 1 - b.h);
  drawTemplate();
});
window.addEventListener('resize', drawTemplate);

async function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });
}

el.templateInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const img = await fileToImage(file);
  state.templateImage = img;
  state.templateFileName = file.name;
  el.templatePreview.src = img.src;
  requestAnimationFrame(drawTemplate);
  log(`Template dimuat: ${file.name}. Preview sudah tampil dan sensor siap digeser.`);
});

el.scanInput.addEventListener('change', async (e) => {
  for (const f of [...e.target.files]) {
    const img = await fileToImage(f);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    state.queue.push({ name: f.name, canvas: c });
  }
  log(`Antrean scan bertambah. Total: ${state.queue.length}.`);
});

el.pullFeederBtn.addEventListener('click', async () => {
  try {
    const res = await fetch(el.feederUrl.value.trim());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const file = new File([blob], `feeder-${Date.now()}.png`, { type: blob.type || 'image/png' });
    const img = await fileToImage(file);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    state.queue.push({ name: file.name, canvas: c });
    log('Berhasil ambil 1 lembar dari feeder hardware bridge.');
  } catch (err) {
    log(`Gagal feeder hardware: ${err.message}. Gunakan kamera fallback jika perlu.`);
  }
});

el.startCameraBtn.addEventListener('click', async () => {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    el.video.srcObject = state.stream;
    el.captureBtn.disabled = false;
    el.stopCameraBtn.disabled = false;
    log('Kamera fallback aktif.');
  } catch (err) { log(`Tidak bisa akses kamera: ${err.message}`); }
});
el.stopCameraBtn.addEventListener('click', () => {
  if (!state.stream) return;
  state.stream.getTracks().forEach(t => t.stop());
  state.stream = null;
  el.captureBtn.disabled = true;
  el.stopCameraBtn.disabled = true;
  log('Kamera fallback berhenti.');
});
el.captureBtn.addEventListener('click', () => {
  const c = document.createElement('canvas');
  c.width = el.video.videoWidth; c.height = el.video.videoHeight;
  c.getContext('2d').drawImage(el.video, 0, 0);
  state.queue.push({ name: `camera-${Date.now()}.png`, canvas: c });
  log('Capture kamera masuk antrean.');
});

el.loadDbBtn.addEventListener('click', () => {
  state.db = parseDb(el.dbInput.value);
  renderDb();
  el.dbStatus.textContent = `Database termuat: ${state.db.size} peserta.`;
  log(`Database aktif ${state.db.size} peserta.`);
});

function roi(gray, box) {
  const x = Math.floor(gray.cols * box.x), y = Math.floor(gray.rows * box.y);
  const w = Math.max(1, Math.floor(gray.cols * box.w)), h = Math.max(1, Math.floor(gray.rows * box.h));
  return gray.roi(new cv.Rect(x, y, Math.min(w, gray.cols - x), Math.min(h, gray.rows - y)));
}
function darkness(mat) { return 255 - cv.mean(mat)[0]; }
function detectOrientation(gray) {
  const topSum = ['top1', 'top2', 'top3'].reduce((s, k) => { const r = roi(gray, state.boxes[k]); const v = darkness(r); r.delete(); return s + v; }, 0);
  const botSum = ['bot1', 'bot2'].reduce((s, k) => { const r = roi(gray, state.boxes[k]); const v = darkness(r); r.delete(); return s + v; }, 0);
  if (botSum > topSum * 0.9) {
    const rotated = new cv.Mat();
    cv.rotate(gray, rotated, cv.ROTATE_180);
    return { gray: rotated, orientation: 'rotated 180 (deteksi 3 atas vs 2 bawah)' };
  }
  return { gray: gray.clone(), orientation: 'normal (deteksi 3 atas vs 2 bawah)' };
}

function extractNo(gray) {
  const r = roi(gray, state.boxes.noPeserta);
  const rs = new cv.Mat();
  cv.resize(r, rs, new cv.Size(240, 70));
  const bw = new cv.Mat();
  cv.threshold(rs, bw, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  const out = [];
  for (let i = 0; i < 12; i += 1) {
    const x = i * 20;
    if (x + 20 > bw.cols) break;
    const cell = bw.roi(new cv.Rect(x, 0, 20, bw.rows));
    const ink = cv.countNonZero(cell);
    if (ink > 80) out.push(String(i % 10));
    cell.delete();
  }
  r.delete(); rs.delete(); bw.delete();
  return out.join('') || 'UNKNOWN';
}

function detectAnswers(gray) {
  const count = Math.max(1, parseInt(el.questionCount.value, 10) || 40);
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const r = roi(gray, state.boxes.answers);
  const bw = new cv.Mat();
  cv.threshold(r, bw, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  const answers = [];
  const qH = Math.floor(bw.rows / count);
  for (let q = 0; q < count; q += 1) {
    const y = q * qH;
    if (y + qH > bw.rows) break;
    let bestIdx = 0, bestInk = -1;
    for (let o = 0; o < 5; o += 1) {
      const x = Math.floor((o / 5) * bw.cols);
      const w = Math.floor(bw.cols / 5);
      const cell = bw.roi(new cv.Rect(x, y, Math.min(w, bw.cols - x), qH));
      const ink = cv.countNonZero(cell);
      if (ink > bestInk) { bestInk = ink; bestIdx = o; }
      cell.delete();
    }
    answers.push(letters[bestIdx]);
  }
  r.delete(); bw.delete();
  return answers.join('');
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
  state.results.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.file}</td><td>${r.nomor}</td><td>${r.nama}</td><td>${r.kelas}</td><td>${r.ruang}</td><td>${r.mapel}</td><td>${r.jawaban}</td><td>${r.benar}</td><td>${r.nilai}</td><td>${r.orientasi}</td>`;
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
  const scored = scoreAnswers(jawaban);
  const siswa = state.db.get(nomor) || { nama: 'Tidak ditemukan', kelas: '-', ruang: '-', mapel: '-' };
  src.delete(); gray.delete(); oriented.gray.delete();

  return {
    file: item.name,
    nomor,
    nama: siswa.nama,
    kelas: siswa.kelas,
    ruang: siswa.ruang,
    mapel: siswa.mapel,
    jawaban,
    benar: scored.benar,
    nilai: scored.nilai,
    orientasi: oriented.orientation,
  };
}

el.processBtn.addEventListener('click', async () => {
  if (!state.cvReady) return log('OpenCV belum siap.');
  if (!state.templateImage) return log('Upload template dulu agar sensor bisa dipakai.');
  if (!state.queue.length) return log('Tidak ada antrean scan.');

  const jobs = [...state.queue];
  state.queue = [];
  log(`Mulai proses ${jobs.length} lembar.`);
  for (const item of jobs) {
    try {
      const row = await processOne(item);
      state.results.push(row);
      log(`Selesai ${item.name}: ${row.nomor}, nilai ${row.nilai}`);
    } catch (err) {
      log(`Gagal ${item.name}: ${err.message}`);
    }
  }
  renderResults();
  el.downloadBtn.disabled = state.results.length === 0;
});

el.downloadBtn.addEventListener('click', () => {
  const ws = XLSX.utils.json_to_sheet(state.results);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hasil SAS-STS');
  XLSX.writeFile(wb, `hasil-sas-sts-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

el.downloadBackupBtn.addEventListener('click', () => {
  const backup = {
    version: 1,
    exported_at: new Date().toISOString(),
    template_file: state.templateFileName,
    boxes: state.boxes,
    db_csv: el.dbInput.value,
    answer_key: el.answerKey.value,
    question_count: el.questionCount.value,
    results: state.results,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup-sas-sts-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  log('Backup berhasil di-download.');
});

el.importBackupInput.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const raw = await f.text();
    const data = JSON.parse(raw);
    if (data.boxes) {
      Object.keys(state.boxes).forEach((k) => {
        if (data.boxes[k]) state.boxes[k] = { ...state.boxes[k], ...data.boxes[k] };
      });
    }
    if (typeof data.db_csv === 'string') {
      el.dbInput.value = data.db_csv;
      state.db = parseDb(data.db_csv);
      renderDb();
      el.dbStatus.textContent = `Database termuat: ${state.db.size} peserta (dari backup).`;
    }
    if (typeof data.answer_key === 'string') el.answerKey.value = data.answer_key;
    if (data.question_count) el.questionCount.value = data.question_count;
    if (Array.isArray(data.results)) {
      state.results = data.results;
      renderResults();
      el.downloadBtn.disabled = state.results.length === 0;
    }
    if (state.templateImage) drawTemplate();
    log('Backup berhasil di-import. Lanjutkan pengerjaan Anda.');
  } catch (err) {
    log(`Import backup gagal: ${err.message}`);
  }
});

(function waitCv() {
  if (window.cv?.Mat) {
    state.cvReady = true;
    log('OpenCV siap.');
  } else setTimeout(waitCv, 250);
})();
log('Aplikasi siap. Upload template untuk mulai konfigurasi sensor.');
