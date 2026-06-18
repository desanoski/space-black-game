/* ============================================================
   SPACE BLACK — Desafio do Pneu
   Ajuste fácil dos parâmetros aqui em cima:
   ============================================================ */
const CONFIG = {
  TIME_LIMIT:     20,    // segundos para concluir
  WIN_THRESHOLD:  0.95,  // fração do pneu que precisa ser coberta (0.95 = 95%)
  BRUSH_RADIUS:   95,    // tamanho do "dedo/aplicador" (px internos do canvas)
  WIN_DISPLAY:    8,     // segundos que a tela de vitória fica antes de voltar
  IDLE_RESET:     25,    // segundos sem toque -> volta pra tela inicial

  // OBS: a roda já vem recortada (transparente) na própria imagem do pneu sujo,
  // então a contagem é automática. Centro/raio usados nesse recorte (referência
  // p/ regerar se trocar a arte): centro (515,930), raio do recorte da roda 265px.
};

/* ---------- Elementos ---------- */
const stage        = document.getElementById('stage');
const cleanCanvas  = document.getElementById('clean');
const dirtyCanvas  = document.getElementById('dirty');
const hud          = document.getElementById('hud');
const timerEl      = document.getElementById('timer');
const barEl        = document.getElementById('progress-bar');
const labelEl      = document.getElementById('progress-label');
const startScreen  = document.getElementById('start-screen');
const winScreen    = document.getElementById('win-screen');
const loseScreen   = document.getElementById('lose-screen');
const winTimeEl    = document.getElementById('win-time');
const confettiCv   = document.getElementById('confetti');

const cctx = cleanCanvas.getContext('2d');
const dctx = dirtyCanvas.getContext('2d', { willReadFrequently: true });

const STAGE_W = 1080, STAGE_H = 1920;
const CW = 1080, CH = 1920;      // resolução interna dos canvases do pneu (retrato cheio)
cleanCanvas.width = CW; cleanCanvas.height = CH;
dirtyCanvas.width = CW; dirtyCanvas.height = CH;

/* ---------- Escala do palco para preencher a tela ---------- */
function fitStage() {
  const sw = window.innerWidth, sh = window.innerHeight;
  const scale = Math.min(sw / STAGE_W, sh / STAGE_H);
  stage.style.transform = `translate(-50%,-50%) scale(${scale})`;
}
window.addEventListener('resize', fitStage);
fitStage();

/* ============================================================
   Áudio — arquivos .wav locais (offline). Destravados no 1º toque.
   ============================================================ */
const sfx = {
  brush: new Audio('assets/sounds/brush.wav'),
  win:   new Audio('assets/sounds/win.wav'),
  lose:  new Audio('assets/sounds/lose.wav'),
  click: new Audio('assets/sounds/click.wav'),
  tick:  new Audio('assets/sounds/tick.wav'),
};
sfx.brush.loop = true;
sfx.brush.volume = 0.22;
sfx.win.volume = 0.7;
sfx.lose.volume = 0.6;
sfx.click.volume = 0.5;
sfx.tick.volume = 0.4;

let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  // Toca cada som mudo uma vez para liberar o áudio nas políticas de autoplay.
  Object.values(sfx).forEach((a) => {
    a.muted = true;
    const p = a.play();
    if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    else { a.pause(); a.currentTime = 0; a.muted = false; }
  });
}
function play(name) {
  const a = sfx[name];
  if (!a) return;
  try { a.currentTime = 0; a.play().catch(() => {}); } catch (_) {}
}
function startBrush() {
  if (sfx.brush.paused) { try { sfx.brush.play().catch(() => {}); } catch (_) {} }
}
function stopBrush() {
  if (!sfx.brush.paused) { sfx.brush.pause(); sfx.brush.currentTime = 0; }
}

/* ---------- Carrega imagens ---------- */
function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

let imgClean, imgDirty, initialOpaque = 1;

/* Canvas pequeno para amostrar progresso sem custo (mantém proporção 9:16) */
const SW = 90, SH = 160;
const sampleCv = document.createElement('canvas');
sampleCv.width = SW; sampleCv.height = SH;
const sctx = sampleCv.getContext('2d', { willReadFrequently: true });

// A camada suja já contém SÓ a borracha (miolo da roda recortado na imagem),
// então basta contar os pixels opacos restantes.
function countOpaque() {
  sctx.clearRect(0, 0, SW, SH);
  sctx.drawImage(dirtyCanvas, 0, 0, SW, SH);
  const data = sctx.getImageData(0, 0, SW, SH).data;
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 40) n++;
  return n;
}

function drawDirtyFull() {
  dctx.clearRect(0, 0, CW, CH);
  dctx.globalCompositeOperation = 'source-over';
  dctx.drawImage(imgDirty, 0, 0, CW, CH);
}

async function init() {
  [imgClean, imgDirty] = await Promise.all([
    loadImg('assets/tire-clean.png'),
    loadImg('assets/tire-dirty.png'),
  ]);
  cctx.drawImage(imgClean, 0, 0, CW, CH);
  drawDirtyFull();
  initialOpaque = countOpaque();
}
init();

/* ============================================================
   Máquina de estados:  'start' | 'playing' | 'win' | 'lose'
   ============================================================ */
let state = 'start';
let startTime = 0;
let progress = 0;
let rafId = null;
let idleTimer = null;
let autoReturnTimer = null;
let lastTickSec = -1;

function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (state !== 'win') goToStart(); }, CONFIG.IDLE_RESET * 1000);
}

function goToStart() {
  state = 'start';
  cancelAnimationFrame(rafId);
  clearTimeout(autoReturnTimer);
  stopBrush();
  stopConfetti();
  drawDirtyFull();
  progress = 0;
  barEl.style.width = '0%';
  labelEl.textContent = '0%';
  timerEl.textContent = CONFIG.TIME_LIMIT.toFixed(1) + 's';
  timerEl.classList.remove('warn');
  hud.classList.add('hidden');
  winScreen.classList.add('hidden');
  loseScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
}

function goFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  }
}

function beginPlay() {
  goFullscreen();   // o toque no botão é o "gesto" que o navegador exige
  unlockAudio();
  play('click');
  startScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  state = 'playing';
  startTime = 0;          // só dispara no 1º toque sobre o pneu
  lastTickSec = -1;
}

function loop() {
  if (state !== 'playing') return;
  if (startTime > 0) {
    const elapsed = (performance.now() - startTime) / 1000;
    const left = Math.max(0, CONFIG.TIME_LIMIT - elapsed);
    timerEl.textContent = left.toFixed(1) + 's';
    timerEl.classList.toggle('warn', left <= 5);
    const sec = Math.ceil(left);
    if (left <= 5 && left > 0 && sec !== lastTickSec) { lastTickSec = sec; play('tick'); }
    if (left <= 0 && progress < CONFIG.WIN_THRESHOLD) { lose(); return; }
  }
  rafId = requestAnimationFrame(loop);
}

function updateProgress() {
  const remaining = countOpaque();
  progress = Math.min(1, 1 - remaining / initialOpaque);
  const pct = Math.min(100, Math.round((progress / CONFIG.WIN_THRESHOLD) * 100));
  barEl.style.width = pct + '%';
  labelEl.textContent = pct + '%';
  if (progress >= CONFIG.WIN_THRESHOLD) win();
}

function win() {
  if (state !== 'playing') return;
  state = 'win';
  cancelAnimationFrame(rafId);
  stopBrush();
  play('win');
  const elapsed = startTime ? (performance.now() - startTime) / 1000 : 0;
  winTimeEl.textContent = `Seu tempo: ${elapsed.toFixed(1)}s`;
  winScreen.classList.remove('hidden');
  startConfetti();
  autoReturnTimer = setTimeout(goToStart, CONFIG.WIN_DISPLAY * 1000);
}

function lose() {
  state = 'lose';
  cancelAnimationFrame(rafId);
  stopBrush();
  play('lose');
  loseScreen.classList.remove('hidden');
  autoReturnTimer = setTimeout(goToStart, 6000);
}

/* ============================================================
   Aplicação do produto (apagar a camada suja)
   ============================================================ */
const pointers = new Map();   // id -> {x,y}

function toCanvas(e) {
  const r = dirtyCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / r.width  * CW,
    y: (e.clientY - r.top)  / r.height * CH,
  };
}

function stroke(x0, y0, x1, y1) {
  dctx.globalCompositeOperation = 'destination-out';
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.floor(dist / (CONFIG.BRUSH_RADIUS / 2)));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + (x1 - x0) * (i / steps);
    const y = y0 + (y1 - y0) * (i / steps);
    dctx.beginPath();
    dctx.arc(x, y, CONFIG.BRUSH_RADIUS, 0, Math.PI * 2);
    dctx.fill();
  }
}

let lastSample = 0;
function onDown(e) {
  resetIdle();
  if (state !== 'playing') return;
  dirtyCanvas.setPointerCapture?.(e.pointerId);
  const p = toCanvas(e);
  pointers.set(e.pointerId, p);
  if (startTime === 0) { startTime = performance.now(); loop(); }  // 1º toque = inicia timer
  startBrush();
  stroke(p.x, p.y, p.x, p.y);
}
function onMove(e) {
  if (state !== 'playing' || !pointers.has(e.pointerId)) return;
  resetIdle();
  const prev = pointers.get(e.pointerId);
  const p = toCanvas(e);
  stroke(prev.x, prev.y, p.x, p.y);
  pointers.set(e.pointerId, p);
  const now = performance.now();
  if (now - lastSample > 120) { lastSample = now; updateProgress(); }
}
function onUp(e) {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) stopBrush();   // parou de aplicar
  if (state === 'playing') updateProgress();
}

dirtyCanvas.addEventListener('pointerdown', onDown);
dirtyCanvas.addEventListener('pointermove', onMove);
dirtyCanvas.addEventListener('pointerup', onUp);
dirtyCanvas.addEventListener('pointercancel', onUp);
window.addEventListener('pointerdown', resetIdle);

/* ---------- Botões ---------- */
document.getElementById('start-btn').addEventListener('click', beginPlay);
document.getElementById('again-btn').addEventListener('click', () => { play('click'); goToStart(); });
document.getElementById('retry-btn').addEventListener('click', () => { play('click'); goToStart(); });
startScreen.addEventListener('click', (e) => { if (e.target === startScreen) beginPlay(); });

/* ============================================================
   Confete da vitória
   ============================================================ */
let confettiRAF = null, confettiParts = [];
const xctx = confettiCv.getContext('2d');

function startConfetti() {
  confettiCv.width = STAGE_W; confettiCv.height = STAGE_H;
  const colors = ['#3aa0ff', '#1ee0c6', '#ffffff', '#ff5a4d', '#ffd24d'];
  confettiParts = Array.from({ length: 160 }, () => ({
    x: Math.random() * STAGE_W,
    y: -Math.random() * STAGE_H,
    r: 8 + Math.random() * 16,
    c: colors[(Math.random() * colors.length) | 0],
    vy: 6 + Math.random() * 8,
    vx: -3 + Math.random() * 6,
    rot: Math.random() * 6.28,
    vr: -0.2 + Math.random() * 0.4,
  }));
  cancelAnimationFrame(confettiRAF);
  animConfetti();
}
function animConfetti() {
  xctx.clearRect(0, 0, STAGE_W, STAGE_H);
  for (const p of confettiParts) {
    p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    if (p.y > STAGE_H + 30) { p.y = -30; p.x = Math.random() * STAGE_W; }
    xctx.save();
    xctx.translate(p.x, p.y); xctx.rotate(p.rot);
    xctx.fillStyle = p.c;
    xctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
    xctx.restore();
  }
  confettiRAF = requestAnimationFrame(animConfetti);
}
function stopConfetti() {
  cancelAnimationFrame(confettiRAF);
  xctx && xctx.clearRect(0, 0, STAGE_W, STAGE_H);
}

/* ---------- Service worker (offline) ---------- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
