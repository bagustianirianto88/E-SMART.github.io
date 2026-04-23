const state = {
  cvReady: false, queue: [], results: [], db: new Map(), templateImage: null, stream: null,
  dragKey: null, resizeKey: null, zoom: 1, lastScanCanvas: null,
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

const $ = (id) => document.getElementById(id);
const el = {
  templateInput: $('templateInput'), zoomRange: $('zoomRange'), templatePreview: $('templatePreview'), templateCanvas: $('templateCanvas'), previewCanvas: $('previewCanvas'),
  activeBoxSelect: $('activeBoxSelect'), boxX: $('boxX'), boxY: $('boxY'), boxW: $('boxW'), boxH: $('boxH'), applyBoxBtn: $('applyBoxBtn'),
  noDigitCount: $('noDigitCount'), noDirection: $('noDirection'), questionCount: $('questionCount'), optionCount: $('optionCount'),
  answerAreaCount: $('answerAreaCount'), applyAreaCountBtn: $('applyAreaCountBtn'), areaConfigTableBody: document.querySelector('#areaConfigTable tbody'),
  scanInput: $('scanInput'), feederUrl: $('feederUrl'), pullFeederBtn: $('pullFeederBtn'), video: $('video'), startCameraBtn: $('startCameraBtn'), captureBtn: $('captureBtn'), stopCameraBtn: $('stopCameraBtn'),
  dbInput: $('dbInput'), loadDbBtn: $('loadDbBtn'), dbStatus: $('dbStatus'), dbTableBody: document.querySelector('#dbTable tbody'), answerKey: $('answerKey'),
  downloadBackupBtn: $('downloadBackupBtn'), importBackupInput: $('importBackupInput'), processBtn: $('processBtn'), downloadBtn: $('downloadBtn'),
  resultBody: document.querySelector('#resultTable tbody'), log: $('log'),
};
const tctx = el.templateCanvas.getContext('2d');
const pctx = el.previewCanvas.getContext('2d');
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const log = (m) => { el.log.textContent += `[${new Date().toLocaleTimeString('id-ID')}] ${m}\n`; el.log.scrollTop = el.log.scrollHeight; };

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(btn.dataset.tab).classList.add('active');
    });
  });
}

function normalizeAreas() {
  const total = Math.max(1, parseInt(el.questionCount.value, 10) || 40);
  const active = state.answerAreas.filter(a => a.active);
  if (!active.length) return;
  const chunk = Math.ceil(total / active.length);
  active.forEach((a, i) => { a.start = i * chunk + 1; a.end = Math.min(total, (i + 1) * chunk); });
}
function initBoxOptions() {
  el.activeBoxSelect.innerHTML = '';
  Object.keys(state.boxes).forEach((k) => {
    const o = document.createElement('option'); o.value = k; o.textContent = `${k} (${state.boxes[k].label})`; el.activeBoxSelect.appendChild(o);
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
  const b = state.boxes[el.activeBoxSelect.value]; if (!b) return;
  b.x = clamp(parseFloat(el.boxX.value) || b.x, 0, 0.98); b.y = clamp(parseFloat(el.boxY.value) || b.y, 0, 0.98);
  b.w = clamp(parseFloat(el.boxW.value) || b.w, 0.01, 1 - b.x); b.h = clamp(parseFloat(el.boxH.value) || b.h, 0.01, 1 - b.y);
  drawTemplate();
}

function renderAreaConfig() {
  el.areaConfigTableBody.innerHTML = '';
  state.answerAreas.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>Area ${i + 1}</td><td><input type="checkbox" data-i="${i}" data-k="active" ${a.active ? 'checked' : ''}></td><td><input type="number" data-i="${i}" data-k="start" value="${a.start}"></td><td><input type="number" data-i="${i}" data-k="end" value="${a.end}"></td><td>${a.id}</td>`;
    el.areaConfigTableBody.appendChild(tr);
  });
}

function drawCircleGrid(ctx, box, cols, rows, color) {
  const w = el.templateCanvas.width, h = el.templateCanvas.height;
  const x = box.x * w, y = box.y * h, bw = box.w * w, bh = box.h * h;
  const r = Math.min(bw / cols, bh / rows) * 0.26;
  ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  for (let rIdx = 0; rIdx < rows; rIdx += 1) {
    for (let cIdx = 0; cIdx < cols; cIdx += 1) {
      const cx = x + (cIdx + 0.5) * (bw / cols);
      const cy = y + (rIdx + 0.5) * (bh / rows);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function drawTemplate() {
  if (!state.templateImage) return;
  const img = state.templateImage;
  const baseW = img.naturalWidth || img.width, baseH = img.naturalHeight || img.height;
  const cssW = baseW * state.zoom, cssH = baseH * state.zoom;

  el.templatePreview.style.width = `${cssW}px`; el.templatePreview.style.height = `${cssH}px`;
  el.templateCanvas.width = baseW; el.templateCanvas.height = baseH;
  el.templateCanvas.style.width = `${cssW}px`; el.templateCanvas.style.height = `${cssH}px`;

  tctx.clearRect(0, 0, baseW, baseH);

  // draw non-OMR control boxes as rectangles
  ['top1', 'top2', 'top3', 'bot1', 'bot2'].forEach((k) => {
    const b = state.boxes[k];
    const x = b.x * baseW, y = b.y * baseH, w = b.w * baseW, h = b.h * baseH;
    tctx.strokeStyle = b.color; tctx.lineWidth = 2; tctx.strokeRect(x, y, w, h);
    tctx.fillStyle = b.color; tctx.fillRect(x, Math.max(0, y - 18), 62, 18); tctx.fillStyle = '#fff'; tctx.fillText(b.label, x + 5, y - 5 < 10 ? 12 : y - 5);
  });

  // no peserta as circle grid
  const noBox = state.boxes.noPeserta;
  const digits = Math.max(4, parseInt(el.noDigitCount.value, 10) || 10);
  if (el.noDirection.value === 'vertical') drawCircleGrid(tctx, noBox, digits, 10, noBox.color);
  else drawCircleGrid(tctx, noBox, 10, digits, noBox.color);

  // answer areas as circle grid per area
  const opt = Math.max(2, parseInt(el.optionCount.value, 10) || 4);
  const totalQ = Math.max(1, parseInt(el.questionCount.value, 10) || 40);
  state.answerAreas.filter(a => a.active).sort((a,b)=>a.start-b.start).forEach((a) => {
    const box = state.boxes[a.id];
    const qCount = clamp(a.end, 1, totalQ) - clamp(a.start, 1, totalQ) + 1;
    drawCircleGrid(tctx, box, opt, Math.max(1, qCount), box.color);
  });

  // active selector helper rectangle
  const ab = state.boxes[el.activeBoxSelect.value];
  if (ab) {
    const x = ab.x * baseW, y = ab.y * baseH, w = ab.w * baseW, h = ab.h * baseH;
    tctx.setLineDash([6, 4]); tctx.strokeStyle = '#fff'; tctx.lineWidth = 2; tctx.strokeRect(x, y, w, h); tctx.setLineDash([]);
    tctx.fillStyle = '#fff'; tctx.fillRect(x + w - 8, y + h - 8, 12, 12); tctx.strokeRect(x + w - 8, y + h - 8, 12, 12);
  }
}

function drawPreviewScan() {
  if (!state.lastScanCanvas) return;
  el.previewCanvas.width = state.lastScanCanvas.width;
  el.previewCanvas.height = state.lastScanCanvas.height;
  pctx.drawImage(state.lastScanCanvas, 0, 0);
  const ratioX = el.previewCanvas.width, ratioY = el.previewCanvas.height;
  const drawGridOnPreview = (box, cols, rows, color) => {
    const x = box.x * ratioX, y = box.y * ratioY, bw = box.w * ratioX, bh = box.h * ratioY;
    const r = Math.min(bw / cols, bh / rows) * 0.26;
    pctx.strokeStyle = color; pctx.lineWidth = 1;
    for (let ri = 0; ri < rows; ri += 1) for (let ci = 0; ci < cols; ci += 1) {
      const cx = x + (ci + 0.5) * (bw / cols), cy = y + (ri + 0.5) * (bh / rows);
      pctx.beginPath(); pctx.arc(cx, cy, r, 0, Math.PI * 2); pctx.stroke();
    }
  };
  const digits = Math.max(4, parseInt(el.noDigitCount.value, 10) || 10);
  if (el.noDirection.value === 'vertical') drawGridOnPreview(state.boxes.noPeserta, digits, 10, '#22c55e');
  else drawGridOnPreview(state.boxes.noPeserta, 10, digits, '#22c55e');
  const opt = Math.max(2, parseInt(el.optionCount.value, 10) || 4);
  const totalQ = Math.max(1, parseInt(el.questionCount.value, 10) || 40);
  state.answerAreas.filter(a => a.active).forEach((a) => {
    const q = clamp(a.end, 1, totalQ) - clamp(a.start, 1, totalQ) + 1;
    drawGridOnPreview(state.boxes[a.id], opt, Math.max(1, q), state.boxes[a.id].color);
  });
}

function getPos(e) { const r = el.templateCanvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }
function hitBox(p) { return Object.entries(state.boxes).find(([,b]) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h)?.[0] || null; }

el.templateCanvas.addEventListener('mousedown', (e) => {
  const p = getPos(e), key = hitBox(p); if (!key) return;
  el.activeBoxSelect.value = key; syncBoxForm();
  const b = state.boxes[key];
  if (p.x > b.x + b.w - 0.02 && p.y > b.y + b.h - 0.02) state.resizeKey = key;
  else { state.dragKey = key; b.offX = p.x - b.x; b.offY = p.y - b.y; }
});
window.addEventListener('mouseup', () => { state.dragKey = null; state.resizeKey = null; });
window.addEventListener('mousemove', (e) => {
  if (!state.dragKey && !state.resizeKey) return;
  const p = getPos(e);
  if (state.dragKey) { const b = state.boxes[state.dragKey]; b.x = clamp(p.x - b.offX, 0, 1 - b.w); b.y = clamp(p.y - b.offY, 0, 1 - b.h); }
  if (state.resizeKey) { const b = state.boxes[state.resizeKey]; b.w = clamp(p.x - b.x, 0.01, 1 - b.x); b.h = clamp(p.y - b.y, 0.01, 1 - b.y); }
  syncBoxForm(); drawTemplate();
});

el.activeBoxSelect.addEventListener('change', () => { syncBoxForm(); drawTemplate(); });
el.applyBoxBtn.addEventListener('click', applyBoxForm);
el.zoomRange.addEventListener('input', () => { state.zoom = (parseInt(el.zoomRange.value, 10) || 100) / 100; drawTemplate(); });
el.questionCount.addEventListener('change', () => { normalizeAreas(); renderAreaConfig(); drawTemplate(); });
el.optionCount.addEventListener('change', drawTemplate);
el.noDigitCount.addEventListener('change', drawTemplate); el.noDirection.addEventListener('change', drawTemplate);

el.areaConfigTableBody.addEventListener('change', (e) => {
  const i = Number(e.target.dataset.i), k = e.target.dataset.k; if (Number.isNaN(i) || !k) return;
  state.answerAreas[i][k] = k === 'active' ? e.target.checked : parseInt(e.target.value, 10);
  drawTemplate();
});
el.applyAreaCountBtn.addEventListener('click', () => {
  const c = clamp(parseInt(el.answerAreaCount.value, 10) || 2, 1, 3);
  state.answerAreas.forEach((a, i) => { a.active = i < c; });
  normalizeAreas(); renderAreaConfig(); drawTemplate();
});

function parseDb(raw) { const m = new Map(); raw.split(/\r?\n/).forEach((l) => { const [n,nm='',k=''] = l.split(',').map(s=>s.trim()); if (n && /^\d+$/.test(n)) m.set(n,{nomor:n,nama:nm,kelas:k}); }); return m; }
function renderDb() { el.dbTableBody.innerHTML=''; [...state.db.values()].forEach((s)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${s.nomor}</td><td>${s.nama}</td><td>${s.kelas}</td><td>-</td><td>-</td>`; el.dbTableBody.appendChild(tr);}); }

function roi(gray, box){ const x=Math.floor(gray.cols*box.x),y=Math.floor(gray.rows*box.y),w=Math.max(1,Math.floor(gray.cols*box.w)),h=Math.max(1,Math.floor(gray.rows*box.h)); return gray.roi(new cv.Rect(x,y,Math.min(w,gray.cols-x),Math.min(h,gray.rows-y))); }
function meanCircleInk(mat,x,y,r){ let sum=0,n=0; for(let yy=Math.max(0,Math.floor(y-r));yy<=Math.min(mat.rows-1,Math.ceil(y+r));yy++) for(let xx=Math.max(0,Math.floor(x-r));xx<=Math.min(mat.cols-1,Math.ceil(x+r));xx++){ const dx=xx-x,dy=yy-y; if(dx*dx+dy*dy<=r*r){sum+=mat.ucharPtr(yy,xx)[0];n++;}} return 255-(n?sum/n:255); }
function detectOrientation(gray){ const d=(k)=>{const r=roi(gray,state.boxes[k]); const v=255-cv.mean(r)[0]; r.delete(); return v;}; const top=d('top1')+d('top2')+d('top3'); const bot=d('bot1')+d('bot2'); if(bot>top*0.9){const rt=new cv.Mat(); cv.rotate(gray,rt,cv.ROTATE_180); return {gray:rt,orientation:'rotated 180'};} return {gray:gray.clone(),orientation:'normal'}; }

function extractNo(gray){
  const digits=Math.max(4,parseInt(el.noDigitCount.value,10)||10); const r=roi(gray,state.boxes.noPeserta); const bw=new cv.Mat();
  cv.GaussianBlur(r,r,new cv.Size(3,3),0); cv.adaptiveThreshold(r,bw,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,4);
  const out=[];
  if(el.noDirection.value==='vertical'){ const cw=bw.cols/digits, rh=bw.rows/10; for(let d=0;d<digits;d++){ let best=0,m=-1; for(let n=0;n<10;n++){ const ink=meanCircleInk(bw,(d+.5)*cw,(n+.5)*rh,Math.min(cw,rh)*.32); if(ink>m){m=ink;best=n;} } out.push(String(best)); } }
  else { const rh=bw.rows/digits, cw=bw.cols/10; for(let d=0;d<digits;d++){ let best=0,m=-1; for(let n=0;n<10;n++){ const ink=meanCircleInk(bw,(n+.5)*cw,(d+.5)*rh,Math.min(cw,rh)*.32); if(ink>m){m=ink;best=n;} } out.push(String(best)); } }
  r.delete(); bw.delete(); return out.join('');
}
function detectAnswers(gray){
  const totalQ=Math.max(1,parseInt(el.questionCount.value,10)||40), opt=Math.max(2,parseInt(el.optionCount.value,10)||4), letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0,opt).split('');
  const ans=Array(totalQ).fill('-');
  state.answerAreas.filter(a=>a.active).sort((a,b)=>a.start-b.start).forEach((a)=>{
    const st=clamp(a.start,1,totalQ), en=clamp(a.end,st,totalQ), qc=en-st+1; const r=roi(gray,state.boxes[a.id]); const bw=new cv.Mat();
    cv.GaussianBlur(r,r,new cv.Size(3,3),0); cv.adaptiveThreshold(r,bw,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,4);
    const qh=bw.rows/qc, ow=bw.cols/opt;
    for(let q=0;q<qc;q++){ let best=0,m=-1; for(let o=0;o<opt;o++){ const ink=meanCircleInk(bw,(o+.5)*ow,(q+.5)*qh,Math.min(ow,qh)*.28); if(ink>m){m=ink;best=o;} } ans[st-1+q]=letters[best]; }
    r.delete(); bw.delete();
  });
  return ans.join('');
}
function scoreAnswers(ans){ const key=(el.answerKey.value||'').trim().toUpperCase(); if(!key) return {benar:0,nilai:0}; let b=0; for(let i=0;i<Math.min(ans.length,key.length);i++) if(ans[i]===key[i]) b++; return {benar:b,nilai:Number(((b/key.length)*100).toFixed(2))}; }

function renderResults(){ el.resultBody.innerHTML=''; state.results.forEach((r)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.file}</td><td>${r.nomor}</td><td>${r.nama}</td><td>${r.kelas}</td><td>${r.jawaban}</td><td>${r.benar}</td><td>${r.nilai}</td><td>${r.orientasi}</td>`; el.resultBody.appendChild(tr); }); }

async function processOne(item){ const src=cv.imread(item.canvas); const gray=new cv.Mat(); cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY); const o=detectOrientation(gray); const nomor=extractNo(o.gray); const jawaban=detectAnswers(o.gray); const sc=scoreAnswers(jawaban); const s=state.db.get(nomor)||{nama:'Tidak ditemukan',kelas:'-'}; src.delete(); gray.delete(); o.gray.delete(); return {file:item.name,nomor,nama:s.nama,kelas:s.kelas,jawaban,benar:sc.benar,nilai:sc.nilai,orientasi:o.orientation}; }

function backup(){ return {version:4,boxes:state.boxes,answer_areas:state.answerAreas,zoom:state.zoom,db_csv:el.dbInput.value,answer_key:el.answerKey.value,no_digit_count:el.noDigitCount.value,no_direction:el.noDirection.value,question_count:el.questionCount.value,option_count:el.optionCount.value,results:state.results}; }

el.templateInput.addEventListener('change', (e)=>{ const f=e.target.files?.[0]; if(!f) return; const img=new Image(); img.onload=()=>{ state.templateImage=img; el.templatePreview.src=img.src; drawTemplate();}; img.src=URL.createObjectURL(f);});
el.scanInput.addEventListener('change', async (e)=>{ for(const f of [...e.target.files]){ const i=new Image(); await new Promise(ok=>{i.onload=ok;i.src=URL.createObjectURL(f)}); const c=document.createElement('canvas'); c.width=i.width;c.height=i.height;c.getContext('2d').drawImage(i,0,0); state.queue.push({name:f.name,canvas:c}); } log(`Antrean scan: ${state.queue.length}`);});
el.pullFeederBtn.addEventListener('click', async ()=>{ try{ const r=await fetch(el.feederUrl.value.trim()); const b=await r.blob(); const i=new Image(); await new Promise(ok=>{i.onload=ok;i.src=URL.createObjectURL(b)}); const c=document.createElement('canvas'); c.width=i.width;c.height=i.height;c.getContext('2d').drawImage(i,0,0); state.queue.push({name:`feeder-${Date.now()}.png`,canvas:c}); }catch(err){log(`Feeder gagal: ${err.message}`)} });
el.startCameraBtn.addEventListener('click', async ()=>{ try{ state.stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false}); el.video.srcObject=state.stream; el.captureBtn.disabled=false; el.stopCameraBtn.disabled=false;}catch(err){log(`Kamera gagal: ${err.message}`)} });
el.stopCameraBtn.addEventListener('click', ()=>{ if(!state.stream) return; state.stream.getTracks().forEach(t=>t.stop()); state.stream=null; el.captureBtn.disabled=true; el.stopCameraBtn.disabled=true;});
el.captureBtn.addEventListener('click', ()=>{ const c=document.createElement('canvas'); c.width=el.video.videoWidth;c.height=el.video.videoHeight;c.getContext('2d').drawImage(el.video,0,0); state.queue.push({name:`cam-${Date.now()}.png`,canvas:c}); });
el.loadDbBtn.addEventListener('click', ()=>{ state.db=parseDb(el.dbInput.value); renderDb(); el.dbStatus.textContent=`Database: ${state.db.size}`;});

el.processBtn.addEventListener('click', async ()=>{ if(!state.cvReady) return log('OpenCV belum siap'); if(!state.templateImage) return log('Upload template dulu'); if(!state.queue.length) return log('Antrean kosong'); const jobs=[...state.queue]; state.queue=[]; for(const job of jobs){ try{ state.lastScanCanvas=job.canvas; state.results.push(await processOne(job)); drawPreviewScan(); }catch(err){ log(`Error ${job.name}: ${err.message}`);} } renderResults(); el.downloadBtn.disabled=!state.results.length; log('Proses selesai'); });
el.downloadBtn.addEventListener('click', ()=>{ const ws=XLSX.utils.json_to_sheet(state.results); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Hasil OMR'); XLSX.writeFile(wb,`hasil-omr-${new Date().toISOString().slice(0,10)}.xlsx`);});
el.downloadBackupBtn.addEventListener('click', ()=>{ const blob=new Blob([JSON.stringify(backup(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='backup-omr.json'; a.click(); URL.revokeObjectURL(a.href);});
el.importBackupInput.addEventListener('change', async (e)=>{ const f=e.target.files?.[0]; if(!f) return; try{ const d=JSON.parse(await f.text()); if(d.boxes) Object.keys(state.boxes).forEach(k=>{ if(d.boxes[k]) state.boxes[k]={...state.boxes[k],...d.boxes[k]};}); if(Array.isArray(d.answer_areas)) state.answerAreas=d.answer_areas; if(d.zoom){state.zoom=d.zoom;el.zoomRange.value=Math.round(d.zoom*100);} if(d.db_csv){el.dbInput.value=d.db_csv; state.db=parseDb(d.db_csv); renderDb();} if(d.answer_key) el.answerKey.value=d.answer_key; if(d.no_digit_count) el.noDigitCount.value=d.no_digit_count; if(d.no_direction) el.noDirection.value=d.no_direction; if(d.question_count) el.questionCount.value=d.question_count; if(d.option_count) el.optionCount.value=d.option_count; if(Array.isArray(d.results)){state.results=d.results; renderResults();} normalizeAreas(); renderAreaConfig(); syncBoxForm(); drawTemplate(); }catch(err){ log(`Import backup gagal: ${err.message}`);} });

(function waitCV(){ if(window.cv?.Mat){ state.cvReady=true; log('OpenCV siap'); } else setTimeout(waitCV,250); })();
initTabs(); initBoxOptions(); normalizeAreas(); renderAreaConfig();
log('Siap: sensor no & jawaban berbentuk lingkaran per opsi/soal.');
