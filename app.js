const state = {
  cvReady: false,
  queue: [],
  results: [],
  db: new Map(),
  templateImage: null,
  stream: null,
  zoom: 1,
  dragKey: null,
  resizeKey: null,
  previewData: null,
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
  activeBoxSelect: $('activeBoxSelect'), boxX: $('boxX'), boxY: $('boxY'), boxW: $('boxW'), boxH: $('boxH'),
  noDigitCount: $('noDigitCount'), noDirection: $('noDirection'), questionCount: $('questionCount'), optionCount: $('optionCount'),
  markThreshold: $('markThreshold'), orientThreshold: $('orientThreshold'), sensorBlackThreshold: $('sensorBlackThreshold'),
  answerAreaCount: $('answerAreaCount'), applyAreaCountBtn: $('applyAreaCountBtn'), areaConfigTableBody: document.querySelector('#areaConfigTable tbody'),
  scanInput: $('scanInput'), feederUrl: $('feederUrl'), pullFeederBtn: $('pullFeederBtn'), video: $('video'), startCameraBtn: $('startCameraBtn'), captureBtn: $('captureBtn'), stopCameraBtn: $('stopCameraBtn'),
  dbInput: $('dbInput'), loadDbBtn: $('loadDbBtn'), dbStatus: $('dbStatus'), dbTableBody: document.querySelector('#dbTable tbody'), answerKey: $('answerKey'),
  processBtn: $('processBtn'), downloadBtn: $('downloadBtn'), downloadBackupBtn: $('downloadBackupBtn'), importBackupInput: $('importBackupInput'),
  resultBody: document.querySelector('#resultTable tbody'), log: $('log'),
};
const tctx = el.templateCanvas.getContext('2d');
const pctx = el.previewCanvas.getContext('2d');
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const log = (m) => { el.log.textContent += `[${new Date().toLocaleTimeString('id-ID')}] ${m}\n`; el.log.scrollTop = el.log.scrollHeight; };

function activateTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === id));
  if (id === 'previewTab') drawPreviewScan();
}

function normalizeAreas() {
  const total = Math.max(1, +el.questionCount.value || 40);
  const act = state.answerAreas.filter(a => a.active);
  const chunk = Math.ceil(total / Math.max(1, act.length));
  act.forEach((a, i) => { a.start = i * chunk + 1; a.end = Math.min(total, (i + 1) * chunk); });
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
  const b = state.boxes[el.activeBoxSelect.value]; if (!b) return;
  el.boxX.value = b.x.toFixed(3); el.boxY.value = b.y.toFixed(3); el.boxW.value = b.w.toFixed(3); el.boxH.value = b.h.toFixed(3);
}
function applyBoxRealtime() {
  const b = state.boxes[el.activeBoxSelect.value]; if (!b) return;
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
    tr.innerHTML = `<td>Area ${i + 1}</td><td><input type="checkbox" data-i="${i}" data-k="active" ${a.active ? 'checked' : ''}></td><td><input type="number" data-i="${i}" data-k="start" value="${a.start}"></td><td><input type="number" data-i="${i}" data-k="end" value="${a.end}"></td><td>${a.id}</td>`;
    el.areaConfigTableBody.appendChild(tr);
  });
}

function drawCircleGrid(ctx, w, h, box, cols, rows, color, showHandle = false) {
  const x = box.x * w, y = box.y * h, bw = box.w * w, bh = box.h * h;
  const r = Math.min(bw / cols, bh / rows) * 0.26;
  ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1.35;
  for (let ri = 0; ri < rows; ri++) for (let ci = 0; ci < cols; ci++) {
    const cx = x + (ci + 0.5) * (bw / cols), cy = y + (ri + 0.5) * (bh / rows);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  if (showHandle) {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = color; ctx.strokeRect(x, y, bw, bh); ctx.setLineDash([]);
    ctx.fillStyle = '#9ca3af'; ctx.fillRect(x + bw - 10, y + bh - 10, 14, 14); // handle abu-abu
  }
}

function drawTemplate() {
  if (!state.templateImage) return;
  const img = state.templateImage;
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const cssW = w * state.zoom, cssH = h * state.zoom;
  el.templatePreview.style.width = `${cssW}px`; el.templatePreview.style.height = `${cssH}px`;
  el.templateCanvas.width = w; el.templateCanvas.height = h;
  el.templateCanvas.style.width = `${cssW}px`; el.templateCanvas.style.height = `${cssH}px`;
  tctx.clearRect(0, 0, w, h);

  ['top1','top2','top3','bot1','bot2'].forEach((k) => {
    const b = state.boxes[k];
    tctx.strokeStyle = b.color; tctx.lineWidth = 2;
    tctx.strokeRect(b.x * w, b.y * h, b.w * w, b.h * h);
  });

  const digits = Math.max(4, +el.noDigitCount.value || 10);
  drawCircleGrid(tctx, w, h, state.boxes.noPeserta, el.noDirection.value === 'vertical' ? digits : 10, el.noDirection.value === 'vertical' ? 10 : digits, state.boxes.noPeserta.color, el.activeBoxSelect.value === 'noPeserta');

  const opt = Math.max(2, +el.optionCount.value || 4);
  const totalQ = Math.max(1, +el.questionCount.value || 40);
  state.answerAreas.filter(a=>a.active).sort((a,b)=>a.start-b.start).forEach((a)=>{
    const q = clamp(a.end,1,totalQ)-clamp(a.start,1,totalQ)+1;
    drawCircleGrid(tctx, w, h, state.boxes[a.id], opt, Math.max(1,q), state.boxes[a.id].color, el.activeBoxSelect.value === a.id);
  });
}

function drawPreviewScan() {
  if (!state.previewData) return;
  const { canvas, answers, choices } = state.previewData;
  el.previewCanvas.width = canvas.width; el.previewCanvas.height = canvas.height;
  pctx.drawImage(canvas, 0, 0);

  const w = el.previewCanvas.width, h = el.previewCanvas.height;
  const opt = Math.max(2, +el.optionCount.value || 4);
  const totalQ = Math.max(1, +el.questionCount.value || 40);

  state.answerAreas.filter(a=>a.active).forEach((a) => {
    const box = state.boxes[a.id];
    const qCount = clamp(a.end,1,totalQ)-clamp(a.start,1,totalQ)+1;
    const x = box.x * w, y = box.y * h, bw = box.w * w, bh = box.h * h;
    const r = Math.min(bw / opt, bh / qCount) * 0.26;
    for (let qi = 0; qi < qCount; qi++) {
      const qNo = a.start + qi;
      for (let oi = 0; oi < opt; oi++) {
        const cx = x + (oi + 0.5) * (bw / opt);
        const cy = y + (qi + 0.5) * (bh / qCount);
        pctx.strokeStyle = '#9ca3af'; pctx.lineWidth = 1.2;
        pctx.beginPath(); pctx.arc(cx, cy, r, 0, Math.PI * 2); pctx.stroke();
        if ((choices[qNo - 1] ?? -1) === oi && answers[qNo - 1] !== '-') {
          pctx.fillStyle = 'rgba(34,197,94,0.45)';
          pctx.beginPath(); pctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); pctx.fill();
        }
      }
    }
  });
}

function getTemplatePos(e){ const r=el.templateCanvas.getBoundingClientRect(); return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}; }
function hitBox(p){ return Object.entries(state.boxes).find(([,b])=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)?.[0] || null; }

function parseDb(raw){ const m=new Map(); raw.split(/\r?\n/).forEach(l=>{ const [n,nm='',k='']=l.split(',').map(s=>s.trim()); if(n&&/^\d+$/.test(n)) m.set(n,{nomor:n,nama:nm,kelas:k});}); return m; }
function renderDb(){ el.dbTableBody.innerHTML=''; [...state.db.values()].forEach(s=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${s.nomor}</td><td>${s.nama}</td><td>${s.kelas}</td><td>-</td><td>-</td>`; el.dbTableBody.appendChild(tr);}); }

function roi(gray, box){ const x=Math.floor(gray.cols*box.x),y=Math.floor(gray.rows*box.y),w=Math.max(1,Math.floor(gray.cols*box.w)),h=Math.max(1,Math.floor(gray.rows*box.h)); return gray.roi(new cv.Rect(x,y,Math.min(w,gray.cols-x),Math.min(h,gray.rows-y))); }
function meanCircleInk(mat,x,y,r){ let sum=0,n=0; for(let yy=Math.max(0,Math.floor(y-r));yy<=Math.min(mat.rows-1,Math.ceil(y+r));yy++) for(let xx=Math.max(0,Math.floor(x-r));xx<=Math.min(mat.cols-1,Math.ceil(x+r));xx++){ const dx=xx-x,dy=yy-y; if(dx*dx+dy*dy<=r*r){sum+=mat.ucharPtr(yy,xx)[0];n++;}} return 255-(n?sum/n:255); }

function sensorStats(gray, key){ const r=roi(gray,state.boxes[key]); const mean=255-cv.mean(r)[0]; const bw=new cv.Mat(); cv.threshold(r,bw,0,255,cv.THRESH_BINARY_INV+cv.THRESH_OTSU); const fill=(cv.countNonZero(bw)/(bw.rows*bw.cols))*100; r.delete(); bw.delete(); return {mean,fill}; }
function detectOrientationRobust(gray){
  const orientTh = Math.max(0, +el.orientThreshold.value || 18);
  const fillTh = Math.max(0, +el.sensorBlackThreshold.value || 8);
  let current = gray.clone();
  for(let tries=0; tries<4; tries++){
    const top = ['top1','top2','top3'].map(k=>sensorStats(current,k));
    const bot = ['bot1','bot2'].map(k=>sensorStats(current,k));
    const topOk = top.every(s=>s.mean>=orientTh && s.fill>=fillTh);
    const botOk = bot.every(s=>s.mean>=orientTh && s.fill>=fillTh);
    if(topOk && !botOk) return {gray: current.clone(), orientation: `normal@${tries}`};
    if(botOk && !topOk){ const r=new cv.Mat(); cv.rotate(current,r,cv.ROTATE_180); current.delete(); current=r; continue; }
    const r=new cv.Mat(); cv.rotate(current,r,cv.ROTATE_90_CLOCKWISE); current.delete(); current=r;
  }
  return {gray: current.clone(), orientation:'fallback-rotated'};
}

function decodeNo(gray){
  const digits=Math.max(4,+el.noDigitCount.value||10), markTh=Math.max(0,+el.markThreshold.value||22);
  const r=roi(gray,state.boxes.noPeserta), bw=new cv.Mat();
  cv.GaussianBlur(r,r,new cv.Size(3,3),0); cv.adaptiveThreshold(r,bw,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,4);
  const out=[], margins=[];
  const vertical = el.noDirection.value==='vertical';
  for(let d=0; d<digits; d++){
    let best=0,m=-1,sec=-1;
    for(let n=0;n<10;n++){
      const cw=vertical?bw.cols/digits:bw.cols/10;
      const rh=vertical?bw.rows/10:bw.rows/digits;
      const cx=(vertical?d:n)+0.5, cy=(vertical?n:d)+0.5;
      const ink=meanCircleInk(bw,cx*cw,cy*rh,Math.min(cw,rh)*.32);
      if(ink>m){sec=m;m=ink;best=n;} else if(ink>sec){sec=ink;}
    }
    margins.push(m-sec);
    out.push((m-sec)>=markTh?String(best):'X');
  }
  r.delete(); bw.delete();
  return {text: out.join(''), margins};
}

function decodeAnswers(gray){
  const totalQ=Math.max(1,+el.questionCount.value||40), opt=Math.max(2,+el.optionCount.value||4), letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0,opt).split('');
  const markTh=Math.max(0,+el.markThreshold.value||22);
  const answers=Array(totalQ).fill('-'), choices=Array(totalQ).fill(-1), margins=Array(totalQ).fill(0);

  state.answerAreas.filter(a=>a.active).sort((a,b)=>a.start-b.start).forEach((a)=>{
    const st=clamp(a.start,1,totalQ), en=clamp(a.end,st,totalQ), qc=en-st+1;
    const r=roi(gray,state.boxes[a.id]), bw=new cv.Mat();
    cv.GaussianBlur(r,r,new cv.Size(3,3),0); cv.adaptiveThreshold(r,bw,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,4);
    for(let qi=0; qi<qc; qi++){
      let best=0,m=-1,sec=-1;
      for(let oi=0; oi<opt; oi++){
        const oW=bw.cols/opt, qH=bw.rows/qc;
        const ink=meanCircleInk(bw,(oi+.5)*oW,(qi+.5)*qH,Math.min(oW,qH)*.28);
        if(ink>m){sec=m;m=ink;best=oi;} else if(ink>sec){sec=ink;}
      }
      const qNo=st-1+qi;
      margins[qNo]=m-sec; choices[qNo]=best;
      answers[qNo]=(m-sec)>=markTh?letters[best]:'-';
    }
    r.delete(); bw.delete();
  });
  return {text:answers.join(''), answers, choices, margins};
}

function scoreAnswers(text){ const key=(el.answerKey.value||'').trim().toUpperCase(); if(!key) return {benar:0,nilai:0}; let b=0; for(let i=0;i<Math.min(text.length,key.length);i++) if(text[i]===key[i]) b++; return {benar:b,nilai:Number(((b/key.length)*100).toFixed(2))}; }

function renderResults(){ el.resultBody.innerHTML=''; state.results.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.file}</td><td>${r.nomor}</td><td>${r.nama}</td><td>${r.kelas}</td><td>${r.jawaban}</td><td>${r.benar}</td><td>${r.nilai}</td><td>${r.orientasi}</td>`; el.resultBody.appendChild(tr);}); }

async function processOne(item){
  const src=cv.imread(item.canvas), gray=new cv.Mat(); cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
  const ori=detectOrientationRobust(gray);
  const no=decodeNo(ori.gray);
  const ans=decodeAnswers(ori.gray);
  const sc=scoreAnswers(ans.text);
  const siswa=state.db.get(no.text)||{nama:'Tidak ditemukan',kelas:'-'};
  src.delete(); gray.delete(); ori.gray.delete();
  state.previewData = { canvas: item.canvas, answers: ans.answers, choices: ans.choices, margins: ans.margins };
  drawPreviewScan();
  return {file:item.name, nomor:no.text, nama:siswa.nama, kelas:siswa.kelas, jawaban:ans.text, benar:sc.benar, nilai:sc.nilai, orientasi:ori.orientation};
}

function backup(){ return {version:6, boxes:state.boxes, answer_areas:state.answerAreas, zoom:state.zoom, mark_threshold:el.markThreshold.value, orient_threshold:el.orientThreshold.value, sensor_black_threshold:el.sensorBlackThreshold.value, no_digit_count:el.noDigitCount.value, no_direction:el.noDirection.value, question_count:el.questionCount.value, option_count:el.optionCount.value, db_csv:el.dbInput.value, answer_key:el.answerKey.value, results:state.results}; }

// events
initBoxOptions(); normalizeAreas(); renderAreaConfig();
document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
activateTab('configTab');

el.templateInput.addEventListener('change',(e)=>{ const f=e.target.files?.[0]; if(!f) return; const img=new Image(); img.onload=()=>{state.templateImage=img; el.templatePreview.src=img.src; drawTemplate();}; img.src=URL.createObjectURL(f);});
el.zoomRange.addEventListener('input',()=>{ state.zoom=(+el.zoomRange.value||100)/100; drawTemplate(); });
['boxX','boxY','boxW','boxH'].forEach(id=>$(id).addEventListener('input',applyBoxRealtime));
el.activeBoxSelect.addEventListener('change',()=>{ syncBoxForm(); drawTemplate(); });
el.questionCount.addEventListener('input',()=>{ normalizeAreas(); renderAreaConfig(); drawTemplate(); });
el.optionCount.addEventListener('input',drawTemplate);
el.noDigitCount.addEventListener('input',drawTemplate);
el.noDirection.addEventListener('change',drawTemplate);
el.markThreshold.addEventListener('input',()=>{ drawTemplate(); drawPreviewScan(); });

el.areaConfigTableBody.addEventListener('input',(e)=>{ const i=+e.target.dataset.i, k=e.target.dataset.k; if(Number.isNaN(i)||!k) return; state.answerAreas[i][k]=k==='active'?e.target.checked:+e.target.value; drawTemplate(); drawPreviewScan(); });
el.applyAreaCountBtn.addEventListener('click',()=>{ const c=clamp(+el.answerAreaCount.value||2,1,3); state.answerAreas.forEach((a,i)=>a.active=i<c); normalizeAreas(); renderAreaConfig(); drawTemplate(); });

el.templateCanvas.addEventListener('mousedown',(e)=>{ const p=getTemplatePos(e), k=hitBox(p); if(!k) return; el.activeBoxSelect.value=k; syncBoxForm(); const b=state.boxes[k]; if(p.x>b.x+b.w-0.02&&p.y>b.y+b.h-0.02) state.resizeKey=k; else {state.dragKey=k; b.offX=p.x-b.x; b.offY=p.y-b.y;} });
window.addEventListener('mouseup',()=>{ state.dragKey=null; state.resizeKey=null; });
window.addEventListener('mousemove',(e)=>{ if(!state.dragKey&&!state.resizeKey) return; const p=getTemplatePos(e); if(state.dragKey){ const b=state.boxes[state.dragKey]; b.x=clamp(p.x-b.offX,0,1-b.w); b.y=clamp(p.y-b.offY,0,1-b.h);} if(state.resizeKey){ const b=state.boxes[state.resizeKey]; b.w=clamp(p.x-b.x,0.01,1-b.x); b.h=clamp(p.y-b.y,0.01,1-b.y);} syncBoxForm(); drawTemplate(); drawPreviewScan(); });

el.previewCanvas.addEventListener('click',(e)=>{ if(!state.previewData) return; const rect=el.previewCanvas.getBoundingClientRect(); const px=(e.clientX-rect.left)/rect.width; const py=(e.clientY-rect.top)/rect.height; const opt=Math.max(2,+el.optionCount.value||4); const totalQ=Math.max(1,+el.questionCount.value||40); for(const a of state.answerAreas.filter(x=>x.active)){ const b=state.boxes[a.id]; if(px>=b.x&&px<=b.x+b.w&&py>=b.y&&py<=b.y+b.h){ const qCount=clamp(a.end,1,totalQ)-clamp(a.start,1,totalQ)+1; const relX=(px-b.x)/b.w; const relY=(py-b.y)/b.h; const q=Math.floor(relY*qCount); const o=Math.floor(relX*opt); const qNo=a.start+q-1; if(qNo>=0&&qNo<state.previewData.answers.length&&o>=0&&o<opt){ state.previewData.choices[qNo]=o; state.previewData.answers[qNo]='ABCDEFGHIJKLMNOPQRSTUVWXYZ'[o]; drawPreviewScan(); log(`Jawaban Q${qNo+1} diubah manual -> ${state.previewData.answers[qNo]}`); } break; }} });

el.scanInput.addEventListener('change', async (e)=>{ for(const f of [...e.target.files]){ const i=new Image(); await new Promise(ok=>{i.onload=ok;i.src=URL.createObjectURL(f)}); const c=document.createElement('canvas'); c.width=i.width; c.height=i.height; c.getContext('2d').drawImage(i,0,0); state.queue.push({name:f.name,canvas:c}); } log(`Antrean: ${state.queue.length}`); });
el.pullFeederBtn.addEventListener('click', async ()=>{ try{ const r=await fetch(el.feederUrl.value.trim()); const b=await r.blob(); const i=new Image(); await new Promise(ok=>{i.onload=ok;i.src=URL.createObjectURL(b)}); const c=document.createElement('canvas'); c.width=i.width;c.height=i.height;c.getContext('2d').drawImage(i,0,0); state.queue.push({name:`feeder-${Date.now()}.png`,canvas:c}); }catch(err){log(`Feeder gagal: ${err.message}`);} });
el.startCameraBtn.addEventListener('click', async ()=>{ try{ state.stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false}); el.video.srcObject=state.stream; el.captureBtn.disabled=false; el.stopCameraBtn.disabled=false; }catch(err){ log(`Kamera gagal: ${err.message}`);} });
el.stopCameraBtn.addEventListener('click',()=>{ if(!state.stream) return; state.stream.getTracks().forEach(t=>t.stop()); state.stream=null; el.captureBtn.disabled=true; el.stopCameraBtn.disabled=true; });
el.captureBtn.addEventListener('click',()=>{ const c=document.createElement('canvas'); c.width=el.video.videoWidth;c.height=el.video.videoHeight;c.getContext('2d').drawImage(el.video,0,0); state.queue.push({name:`cam-${Date.now()}.png`,canvas:c}); });

el.loadDbBtn.addEventListener('click',()=>{ state.db=parseDb(el.dbInput.value); renderDb(); el.dbStatus.textContent=`Database: ${state.db.size}`; });
el.processBtn.addEventListener('click', async ()=>{ if(!state.cvReady) return log('OpenCV belum siap'); if(!state.templateImage) return log('Upload template dulu'); if(!state.queue.length) return log('Antrean kosong'); const jobs=[...state.queue]; state.queue=[]; for(const j of jobs){ try{ state.results.push(await processOne(j)); }catch(err){ log(`Error ${j.name}: ${err.message}`);} } renderResults(); el.downloadBtn.disabled=!state.results.length; activateTab('previewTab'); });
el.downloadBtn.addEventListener('click',()=>{ const ws=XLSX.utils.json_to_sheet(state.results); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Hasil OMR'); XLSX.writeFile(wb,`hasil-omr-${new Date().toISOString().slice(0,10)}.xlsx`); });
el.downloadBackupBtn.addEventListener('click',()=>{ const blob=new Blob([JSON.stringify(backup(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='backup-omr.json'; a.click(); URL.revokeObjectURL(a.href); });
el.importBackupInput.addEventListener('change', async (e)=>{ const f=e.target.files?.[0]; if(!f) return; try{ const d=JSON.parse(await f.text()); if(d.boxes) Object.keys(state.boxes).forEach(k=>{ if(d.boxes[k]) state.boxes[k]={...state.boxes[k],...d.boxes[k]};}); if(Array.isArray(d.answer_areas)) state.answerAreas=d.answer_areas; if(d.zoom){state.zoom=d.zoom; el.zoomRange.value=Math.round(d.zoom*100);} if(d.mark_threshold) el.markThreshold.value=d.mark_threshold; if(d.orient_threshold) el.orientThreshold.value=d.orient_threshold; if(d.sensor_black_threshold) el.sensorBlackThreshold.value=d.sensor_black_threshold; if(d.no_digit_count) el.noDigitCount.value=d.no_digit_count; if(d.no_direction) el.noDirection.value=d.no_direction; if(d.question_count) el.questionCount.value=d.question_count; if(d.option_count) el.optionCount.value=d.option_count; if(d.db_csv){ el.dbInput.value=d.db_csv; state.db=parseDb(d.db_csv); renderDb(); } if(d.answer_key) el.answerKey.value=d.answer_key; if(Array.isArray(d.results)){ state.results=d.results; renderResults(); } normalizeAreas(); renderAreaConfig(); syncBoxForm(); drawTemplate(); }catch(err){ log(`Import backup gagal: ${err.message}`);} });

(function waitCV(){ if(window.cv?.Mat){ state.cvReady=true; log('OpenCV siap'); } else setTimeout(waitCV,250); })();
log('Siap: kontrol sensor real-time, preview editable, threshold real-time.');
