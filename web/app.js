// Face Liveness MVP - versao web (roda 100% no navegador do celular).
// O MediaPipe Face Landmarker roda em WASM; nada e enviado para servidor.

import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/" +
  "face_landmarker/float16/1/face_landmarker.task";

// ---------------------------------------------------------------- Deteccao
class BlinkDetector {
  constructor(closeT = 0.5, openT = 0.3) {
    this.closeT = closeT;
    this.openT = openT;
    this.closed = false;
    this.total = 0;
  }
  update(blend) {
    const score = ((blend.eyeBlinkLeft || 0) + (blend.eyeBlinkRight || 0)) / 2;
    if (!this.closed && score >= this.closeT) this.closed = true;
    else if (this.closed && score <= this.openT) {
      this.closed = false;
      this.total += 1;
    }
  }
  reset() { this.closed = false; this.total = 0; }
}

// Indices do Face Mesh: 1 = nariz, 234/454 = bordas do rosto.
function headDirection(landmarks, threshold = 0.25) {
  if (!landmarks || !landmarks.length) return "center";
  const nose = landmarks[1].x;
  const left = landmarks[234].x;
  const right = landmarks[454].x;
  const width = Math.abs(right - left);
  if (width < 1e-6) return "center";
  const offset = (nose - left) / width - 0.5;
  if (offset > threshold / 2) return "right";
  if (offset < -threshold / 2) return "left";
  return "center";
}

// ---------------------------------------------------------------- Desafios
function buildSequence() {
  const pool = [
    { kind: "blink", prompt: "Pisque os olhos 2 vezes" },
    { kind: "turn_left", prompt: "Vire a cabeca para a ESQUERDA" },
    { kind: "turn_right", prompt: "Vire a cabeca para a DIREITA" },
  ];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

class ChallengeManager {
  constructor(timeout = 8000, blinksRequired = 2) {
    this.timeout = timeout;
    this.blinksRequired = blinksRequired;
    this.reset();
  }
  reset() {
    this.seq = buildSequence();
    this.index = 0;
    this.state = "running"; // running | passed | failed
    this.deadline = performance.now() + this.timeout;
    this.blinkStart = -1;
  }
  get current() { return this.index < this.seq.length ? this.seq[this.index] : null; }
  timeLeft() { return Math.max(0, this.deadline - performance.now()); }
  advance() {
    this.index += 1;
    this.blinkStart = -1;
    if (this.index >= this.seq.length) this.state = "passed";
    else this.deadline = performance.now() + this.timeout;
  }
  update(totalBlinks, dir) {
    if (this.state !== "running") return;
    const c = this.current;
    if (!c) { this.state = "passed"; return; }
    if (c.kind === "blink" && this.blinkStart < 0) this.blinkStart = totalBlinks;
    if (this.timeLeft() <= 0) { this.state = "failed"; return; }
    if (c.kind === "blink") {
      if (totalBlinks - this.blinkStart >= this.blinksRequired) this.advance();
    } else if (c.kind === "turn_left") {
      if (dir === "left") this.advance();
    } else if (c.kind === "turn_right") {
      if (dir === "right") this.advance();
    }
  }
}

// ---------------------------------------------------------------- App / UI
const els = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  status: document.getElementById("status"),
  face: document.getElementById("face"),
  blinks: document.getElementById("blinks"),
  head: document.getElementById("head"),
  prompt: document.getElementById("prompt"),
  start: document.getElementById("start"),
  restart: document.getElementById("restart"),
};
const ctx = els.canvas.getContext("2d");
const drawingUtils = new DrawingUtils(ctx);

// Desenha a malha de pontos do rosto sobre o canvas (ja espelhado).
function drawFaceMesh(landmarks) {
  // Malha fina conectando os pontos (o "esqueleto" do rosto).
  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_TESSELATION,
    { color: "rgba(255,255,255,0.18)", lineWidth: 1 }
  );
  // Contornos e iris em destaque.
  drawingUtils.drawConnectors(
    landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    { color: "rgba(59,130,246,0.9)", lineWidth: 2 }
  );
  drawingUtils.drawConnectors(
    landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    { color: "#22c55e", lineWidth: 2 }
  );
  drawingUtils.drawConnectors(
    landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    { color: "#22c55e", lineWidth: 2 }
  );
  // Os pontinhos (landmarks) em si.
  ctx.fillStyle = "#eab308";
  const w = els.canvas.width, h = els.canvas.height;
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

let faceLandmarker = null;
let running = false;
let lastVideoTime = -1;
const blink = new BlinkDetector();
const challenges = new ChallengeManager();

async function initModel() {
  els.status.textContent = "Carregando modelo...";
  const vision = await FilesetResolver.forVisionTasks(CDN);
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  els.video.srcObject = stream;
  await els.video.play();
  els.canvas.width = els.video.videoWidth;
  els.canvas.height = els.video.videoHeight;
}

function drawMirroredVideo() {
  ctx.save();
  ctx.translate(els.canvas.width, 0);
  ctx.scale(-1, 1); // efeito espelho
  ctx.drawImage(els.video, 0, 0, els.canvas.width, els.canvas.height);
  ctx.restore();
}

function blendToObject(categories) {
  const out = {};
  for (const c of categories) out[c.categoryName] = c.score;
  return out;
}

function loop() {
  if (!running) return;

  if (els.video.currentTime !== lastVideoTime) {
    lastVideoTime = els.video.currentTime;
    drawMirroredVideo();

    // Detecta sobre o canvas ja espelhado (mesma logica da versao desktop).
    const result = faceLandmarker.detectForVideo(els.canvas, performance.now());

    let dir = "center";
    const hasFace = result.faceLandmarks && result.faceLandmarks.length > 0;
    if (hasFace) {
      const landmarks = result.faceLandmarks[0];
      const blend = result.faceBlendshapes && result.faceBlendshapes[0]
        ? blendToObject(result.faceBlendshapes[0].categories)
        : {};
      blink.update(blend);
      dir = headDirection(landmarks);
      challenges.update(blink.total, dir);
      drawFaceMesh(landmarks);
    }
    updateHud(hasFace, dir);
  }
  requestAnimationFrame(loop);
}

function updateHud(hasFace, dir) {
  els.face.textContent = hasFace ? "sim" : "nao";
  els.blinks.textContent = blink.total;
  els.head.textContent = dir;
  els.status.style.display = "none";

  const p = els.prompt;
  p.className = "prompt";
  if (challenges.state === "passed") {
    p.classList.add("pass");
    p.textContent = "✓ VIVO — verificado!";
  } else if (challenges.state === "failed") {
    p.classList.add("fail");
    p.textContent = "✗ Falhou (tempo esgotado). Toque em Reiniciar.";
  } else {
    p.classList.add("run");
    const c = challenges.current;
    const s = (challenges.timeLeft() / 1000).toFixed(1);
    p.textContent = c ? `${c.prompt}  (${s}s)` : "...";
  }
}

els.start.addEventListener("click", async () => {
  els.start.disabled = true;
  try {
    if (!faceLandmarker) await initModel();
    await startCamera();
    blink.reset();
    challenges.reset();
    running = true;
    els.restart.disabled = false;
    loop();
  } catch (err) {
    els.status.style.display = "block";
    els.status.textContent = "Erro: " + err.message;
    els.start.disabled = false;
  }
});

els.restart.addEventListener("click", () => {
  blink.reset();
  challenges.reset();
});
