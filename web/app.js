// Face Liveness MVP - versao web (roda 100% no navegador do celular).
// O MediaPipe Face Landmarker roda em WASM; nada e enviado para servidor.
//
// Este arquivo cuida da camera, do MediaPipe e da UI. Toda a logica pura
// (detectores + desafios + score) vive em ./liveness-core.js, testada em tests/.

import {
  BlinkDetector,
  headDirection,
  faceWidth,
  smileScore,
  ChallengeManager,
} from "./liveness-core.js";

// ---------------------------------------------------- Fonte dos assets
const VER = "0.10.14";
const LOCAL = {
  bundle: "./vendor/vision_bundle.mjs",
  wasm: "./vendor/wasm",
  model: "./vendor/models/face_landmarker.task",
};
const CDN = {
  bundle: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`,
  wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`,
  model:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/" +
    "face_landmarker/float16/1/face_landmarker.task",
};

async function pickAssets() {
  // Se o modelo local existir, roda offline. Senao, usa a CDN.
  try {
    const r = await fetch(LOCAL.model, { method: "HEAD" });
    if (r.ok) return { ...LOCAL, mode: "offline (local)" };
  } catch (_) {}
  return { ...CDN, mode: "online (CDN)" };
}

// Preenchidos no initModel (import dinamico para permitir fallback offline).
let FaceLandmarker = null;
let FilesetResolver = null;
let DrawingUtils = null;

// ---------------------------------------------------------------- App / UI
const els = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  status: document.getElementById("status"),
  face: document.getElementById("face"),
  blinks: document.getElementById("blinks"),
  head: document.getElementById("head"),
  score: document.getElementById("score"),
  prompt: document.getElementById("prompt"),
  progress: document.getElementById("progress"),
  timebar: document.getElementById("timebar"),
  start: document.getElementById("start"),
  restart: document.getElementById("restart"),
  showMesh: document.getElementById("showMesh"),
};
const ctx = els.canvas.getContext("2d");

let drawingUtils = null;
let faceLandmarker = null;
let running = false;
let lastVideoTime = -1;
const blink = new BlinkDetector();
const challenges = new ChallengeManager();

function drawFaceMesh(landmarks) {
  if (!els.showMesh.checked || !drawingUtils) return;
  drawingUtils.drawConnectors(
    landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION,
    { color: "rgba(255,255,255,0.18)", lineWidth: 1 }
  );
  drawingUtils.drawConnectors(
    landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    { color: "rgba(59,130,246,0.9)", lineWidth: 2 }
  );
  drawingUtils.drawConnectors(
    landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#22c55e", lineWidth: 2 }
  );
  drawingUtils.drawConnectors(
    landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#22c55e", lineWidth: 2 }
  );
  ctx.fillStyle = "#eab308";
  const w = els.canvas.width, h = els.canvas.height;
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function initModel() {
  const assets = await pickAssets();
  els.status.textContent = `Carregando modelo... [${assets.mode}]`;
  const mod = await import(assets.bundle);
  FaceLandmarker = mod.FaceLandmarker;
  FilesetResolver = mod.FilesetResolver;
  DrawingUtils = mod.DrawingUtils;

  const vision = await FilesetResolver.forVisionTasks(assets.wasm);
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: assets.model, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  drawingUtils = new DrawingUtils(ctx);
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

function buildProgress() {
  els.progress.innerHTML = "";
  for (let i = 0; i < challenges.seq.length; i++) {
    const dot = document.createElement("div");
    dot.className = "dot";
    els.progress.appendChild(dot);
  }
}

function loop() {
  if (!running) return;

  if (els.video.currentTime !== lastVideoTime) {
    lastVideoTime = els.video.currentTime;
    drawMirroredVideo();

    const result = faceLandmarker.detectForVideo(els.canvas, performance.now());
    const hasFace = result.faceLandmarks && result.faceLandmarks.length > 0;

    let dir = "center", smile = 0, width = 0;
    if (hasFace) {
      const landmarks = result.faceLandmarks[0];
      const blend = result.faceBlendshapes && result.faceBlendshapes[0]
        ? blendToObject(result.faceBlendshapes[0].categories)
        : {};
      blink.update(blend);
      dir = headDirection(landmarks);
      smile = smileScore(blend);
      width = faceWidth(landmarks);
      drawFaceMesh(landmarks);
    }

    challenges.update({ hasFace, totalBlinks: blink.total, dir, smile, width });
    updateHud(hasFace, dir);
  }
  requestAnimationFrame(loop);
}

function updateHud(hasFace, dir) {
  els.face.textContent = hasFace ? "sim" : "nao";
  els.blinks.textContent = blink.total;
  els.head.textContent = dir;
  els.score.textContent = challenges.confidence() + "%";
  els.status.style.display = "none";

  const dots = els.progress.children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].className = "dot" +
      (i < challenges.index ? " done" : i === challenges.index && challenges.state === "running" ? " active" : "");
  }

  els.timebar.style.width =
    challenges.state === "running" ? (challenges.timeFrac() * 100).toFixed(0) + "%" : "0%";

  const p = els.prompt;
  p.className = "prompt";
  if (challenges.state === "passed") {
    p.classList.add("pass");
    p.textContent = `✓ VIVO — confianca ${challenges.confidence()}%`;
  } else if (challenges.state === "failed") {
    p.classList.add("fail");
    p.textContent = `✗ Falhou (confianca ${challenges.confidence()}%). Toque em Reiniciar.`;
  } else {
    p.classList.add("run");
    const c = challenges.current;
    p.textContent = c ? c.prompt : "...";
  }
}

els.start.addEventListener("click", async () => {
  els.start.disabled = true;
  try {
    if (!faceLandmarker) await initModel();
    await startCamera();
    blink.reset();
    challenges.reset();
    buildProgress();
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
  buildProgress();
});
