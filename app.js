const state = {
  queue: [],
  results: [],
  db: new Map(),
  template: null,
  stream: null,
  cvReady: false,
};

const el = {
  scanInput: document.getElementById('scanInput'),
  templateInput: document.getElementById('templateInput'),
  startCameraBtn: document.getElementById('startCameraBtn'),
  stopCameraBtn: document.getElementById('stopCameraBtn'),
  captureBtn: document.getElementById('captureBtn'),
  video: document.getElementById('video'),
  frameCanvas: document.getElementById('frameCanvas'),
  processBtn: document.getElementById('processBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  dbInput: document.getElementById('dbInput'),
  loadDbBtn: document.getElementById('loadDbBtn'),
  dbStatus: document.getElementById('dbStatus'),
  log: document.getElementById('log'),
  tbody: document.querySelector('#resultTable tbody'),
  rowTemplate: document.getElementById('rowTemplate'),
  topBand: document.getElementById('topBand'),
  bottomBand: document.getElementById('bottomBand'),
  noX: document.getElementById('noX'),
  noY: document.getElementById('noY'),
  noW: document.getElementById('noW'),
  noH: document.getElementById('noH'),
};

function log(msg) {
  const ts = new Date().toLocaleTimeString('id-ID');
  el.log.textContent += `[${ts}] ${msg}\n`;
  el.log.scrollTop = el.log.scrollHeight;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasFromImage(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

function parseDb(raw) {
  const map = new Map();
  raw.split(/\r?\n/).forEach(line => {
    const [no, nama = '', kelas = ''] = line.split(',').map(s => s.trim());
    if (no && /^\d+$/.test(no)) map.set(no, { nama, kelas });
  });
  return map;
}

function matMeanDarkness(gray, yStart, yEnd) {
  const h = gray.rows;
  const ys = Math.max(0, Math.min(h - 1, yStart));
  const ye = Math.max(ys + 1, Math.min(h, yEnd));
  const roi = gray.roi(new cv.Rect(0, ys, gray.cols, ye - ys));
  const mean = cv.mean(roi)[0];
  roi.delete();
  return 255 - mean;
}

function rotate180(mat) {
  const dst = new cv.Mat();
  cv.rotate(mat, dst, cv.ROTATE_180);
  return dst;
}

function autoOrient(matGray) {
  const topRatio = parseFloat(el.topBand.value) || 0.12;
  const botRatio = parseFloat(el.bottomBand.value) || 0.12;
  const topDark = matMeanDarkness(matGray, 0, Math.floor(matGray.rows * topRatio));
  const botDark = matMeanDarkness(matGray, Math.floor(matGray.rows * (1 - botRatio)), matGray.rows);
  if (botDark > topDark * 1.08) {
    const rotated = rotate180(matGray);
    return { mat: rotated, orientation: 'auto-rotated 180°' };
  }
  return { mat: matGray.clone(), orientation: 'normal' };
}

function perspectiveByCorners(srcGray) {
  const blur = new cv.Mat();
  const thr = new cv.Mat();
  cv.GaussianBlur(srcGray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
  cv.threshold(blur, thr, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(thr, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let best = null;
  for (let i = 0; i < contours.size(); i += 1) {
    const c = contours.get(i);
    const peri = cv.arcLength(c, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(c, approx, 0.02 * peri, true);
    if (approx.rows === 4) {
      const area = cv.contourArea(approx);
      if (!best || area > best.area) {
        if (best) best.approx.delete();
        best = { approx, area };
      } else {
        approx.delete();
      }
    } else {
      approx.delete();
    }
    c.delete();
  }

  let warped = srcGray.clone();
  if (best) {
    const pts = [];
    for (let i = 0; i < 4; i += 1) {
      pts.push({ x: best.approx.intPtr(i, 0)[0], y: best.approx.intPtr(i, 0)[1] });
    }
    pts.sort((a, b) => a.y - b.y);
    const top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
    const bot = pts.slice(2).sort((a, b) => a.x - b.x);
    const ordered = [top[0], top[1], bot[1], bot[0]];

    const width = Math.max(
      Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y),
      Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y)
    );
    const height = Math.max(
      Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y),
      Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y)
    );

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, ordered.flatMap(p => [p.x, p.y]));
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width - 1, 0, width - 1, height - 1, 0, height - 1]);
    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    warped.delete();
    warped = new cv.Mat();
    cv.warpPerspective(srcGray, warped, M, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    srcTri.delete(); dstTri.delete(); M.delete();
    best.approx.delete();
  }

  blur.delete(); thr.delete(); contours.delete(); hierarchy.delete();
  return warped;
}

function extractNoPeserta(gray) {
  const x = parseFloat(el.noX.value);
  const y = parseFloat(el.noY.value);
  const w = parseFloat(el.noW.value);
  const h = parseFloat(el.noH.value);

  const rx = Math.max(0, Math.floor(gray.cols * x));
  const ry = Math.max(0, Math.floor(gray.rows * y));
  const rw = Math.max(10, Math.floor(gray.cols * w));
  const rh = Math.max(10, Math.floor(gray.rows * h));

  const safeW = Math.min(rw, gray.cols - rx);
  const safeH = Math.min(rh, gray.rows - ry);
  const roi = gray.roi(new cv.Rect(rx, ry, safeW, safeH));

  const resized = new cv.Mat();
  cv.resize(roi, resized, new cv.Size(200, 60));
  const bw = new cv.Mat();
  cv.threshold(resized, bw, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  const digitWidth = 20;
  const digits = [];
  for (let i = 0; i < 10; i += 1) {
    const startX = i * digitWidth;
    if (startX + digitWidth > bw.cols) break;
    const dRoi = bw.roi(new cv.Rect(startX, 0, digitWidth, bw.rows));
    const ink = cv.countNonZero(dRoi);
    if (ink > 80) digits.push(String(i % 10));
    dRoi.delete();
  }

  roi.delete(); resized.delete(); bw.delete();
  return digits.join('').slice(0, 12) || 'UNKNOWN';
}

function simpleBubbleScore(gray) {
  const bw = new cv.Mat();
  cv.threshold(gray, bw, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  const nonZero = cv.countNonZero(bw);
  const max = gray.cols * gray.rows;
  bw.delete();
  return Number(((nonZero / max) * 100).toFixed(2));
}

async function processCanvas(canvas, fileName) {
  if (!state.cvReady) throw new Error('OpenCV belum siap.');
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  const corrected = perspectiveByCorners(gray);
  const oriented = autoOrient(corrected);
  const noPeserta = extractNoPeserta(oriented.mat);
  const score = simpleBubbleScore(oriented.mat);

  const peserta = state.db.get(noPeserta) || { nama: 'Tidak ditemukan', kelas: '-' };

  src.delete(); gray.delete(); corrected.delete(); oriented.mat.delete();
  return {
    file: fileName,
    nomor_peserta: noPeserta,
    nama: peserta.nama,
    kelas: peserta.kelas,
    skor_bubbling: score,
    orientasi: oriented.orientation,
  };
}

function renderRows() {
  el.tbody.innerHTML = '';
  state.results.forEach(r => {
    const tr = el.rowTemplate.content.firstElementChild.cloneNode(true);
    tr.querySelector('.file').textContent = r.file;
    tr.querySelector('.no').textContent = r.nomor_peserta;
    tr.querySelector('.nama').textContent = r.nama;
    tr.querySelector('.kelas').textContent = r.kelas;
    tr.querySelector('.score').textContent = r.skor_bubbling;
    tr.querySelector('.orient').textContent = r.orientasi;
    el.tbody.appendChild(tr);
  });
}

function downloadExcel() {
  const ws = XLSX.utils.json_to_sheet(state.results);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'HasilScan');
  XLSX.writeFile(wb, `hasil-scan-ljk-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

el.scanInput.addEventListener('change', async (ev) => {
  const files = [...ev.target.files];
  for (const file of files) {
    const img = await readImage(file);
    const canvas = canvasFromImage(img);
    state.queue.push({ name: file.name, canvas });
  }
  log(`${files.length} file ditambahkan ke antrean.`);
});

el.templateInput.addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  const img = await readImage(file);
  state.template = canvasFromImage(img);
  log(`Template dimuat: ${file.name}`);
});

el.loadDbBtn.addEventListener('click', () => {
  state.db = parseDb(el.dbInput.value);
  el.dbStatus.textContent = `Database termuat: ${state.db.size} peserta.`;
  log(`Database peserta dimuat (${state.db.size} baris valid).`);
});

el.startCameraBtn.addEventListener('click', async () => {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    el.video.srcObject = state.stream;
    el.captureBtn.disabled = false;
    el.stopCameraBtn.disabled = false;
    log('Kamera aktif. Siap mode paper feeder.');
  } catch (e) {
    log(`Gagal membuka kamera: ${e.message}`);
  }
});

el.stopCameraBtn.addEventListener('click', () => {
  if (!state.stream) return;
  state.stream.getTracks().forEach(t => t.stop());
  state.stream = null;
  el.captureBtn.disabled = true;
  el.stopCameraBtn.disabled = true;
  log('Kamera dihentikan.');
});

el.captureBtn.addEventListener('click', () => {
  const ctx = el.frameCanvas.getContext('2d');
  el.frameCanvas.width = el.video.videoWidth;
  el.frameCanvas.height = el.video.videoHeight;
  ctx.drawImage(el.video, 0, 0);
  const c = document.createElement('canvas');
  c.width = el.frameCanvas.width;
  c.height = el.frameCanvas.height;
  c.getContext('2d').drawImage(el.frameCanvas, 0, 0);
  state.queue.push({ name: `feeder-${Date.now()}.png`, canvas: c });
  log('Frame paper feeder ditangkap dan masuk antrean.');
});

el.processBtn.addEventListener('click', async () => {
  if (!state.cvReady) {
    log('OpenCV belum siap, tunggu sebentar.');
    return;
  }
  if (state.queue.length === 0) {
    log('Antrean kosong. Upload atau ambil frame dulu.');
    return;
  }

  const work = [...state.queue];
  state.queue = [];
  log(`Mulai proses ${work.length} lembar...`);

  for (const item of work) {
    try {
      const result = await processCanvas(item.canvas, item.name);
      state.results.push(result);
      log(`Selesai: ${item.name} -> no peserta ${result.nomor_peserta}`);
    } catch (e) {
      log(`Error ${item.name}: ${e.message}`);
    }
  }
  renderRows();
  el.downloadBtn.disabled = state.results.length === 0;
});

el.downloadBtn.addEventListener('click', downloadExcel);

function waitCv() {
  if (window.cv && cv.Mat) {
    state.cvReady = true;
    log('OpenCV siap.');
  } else {
    setTimeout(waitCv, 200);
  }
}
waitCv();
log('Aplikasi siap. Muat template, database, lalu scan.');
