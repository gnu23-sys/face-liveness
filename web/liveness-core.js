// Logica pura de liveness (sem camera, sem DOM, sem MediaPipe).
// Usada tanto pelo app (app.js) quanto pelos testes (tests/).

// ---------------------------------------------------------------- Deteccao
export class BlinkDetector {
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
    return score;
  }
  reset() { this.closed = false; this.total = 0; }
}

// Indices do Face Mesh: 1 = nariz, 234/454 = bordas do rosto.
export function headDirection(landmarks, threshold = 0.25) {
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

// Largura do rosto (0..1) - cresce quando o rosto se aproxima da camera.
export function faceWidth(landmarks) {
  if (!landmarks || !landmarks.length) return 0;
  return Math.abs(landmarks[454].x - landmarks[234].x);
}

// Intensidade do sorriso (0..1) pelos blendshapes da boca.
export function smileScore(blend) {
  return ((blend.mouthSmileLeft || 0) + (blend.mouthSmileRight || 0)) / 2;
}

// ---------------------------------------------------------------- Desafios
export const ALL_CHALLENGES = [
  { kind: "blink", prompt: "Pisque os olhos 2 vezes" },
  { kind: "turn_left", prompt: "Vire a cabeca para a ESQUERDA" },
  { kind: "turn_right", prompt: "Vire a cabeca para a DIREITA" },
  { kind: "smile", prompt: "Sorria :)" },
  { kind: "approach", prompt: "Aproxime o rosto da camera" },
];

export function buildSequence(n = 4) {
  const pool = [...ALL_CHALLENGES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// Permite injetar um relogio nos testes; no browser usa performance.now().
const defaultClock = () => performance.now();

export class ChallengeManager {
  constructor(timeout = 8000, blinksRequired = 2, clock = defaultClock) {
    this.timeout = timeout;
    this.blinksRequired = blinksRequired;
    this.clock = clock;
    this.reset();
  }
  reset() {
    this.seq = buildSequence();
    this.index = 0;
    this.state = "running"; // running | passed | failed
    this.deadline = this.clock() + this.timeout;
    this.blinkStart = -1;
    this.baseWidth = -1;
    this.speeds = [];
    this.faceFrames = 0;
    this.totalFrames = 0;
  }
  get current() { return this.index < this.seq.length ? this.seq[this.index] : null; }
  timeLeft() { return Math.max(0, this.deadline - this.clock()); }
  timeFrac() { return this.timeLeft() / this.timeout; }

  advance() {
    this.speeds.push(this.timeFrac());
    this.index += 1;
    this.blinkStart = -1;
    this.baseWidth = -1;
    if (this.index >= this.seq.length) this.state = "passed";
    else this.deadline = this.clock() + this.timeout;
  }

  update(ctx) {
    // ctx: { hasFace, totalBlinks, dir, smile, width }
    if (this.state !== "running") return;
    this.totalFrames += 1;
    if (ctx.hasFace) this.faceFrames += 1;

    const c = this.current;
    if (!c) { this.state = "passed"; return; }

    if (this.timeLeft() <= 0) { this.state = "failed"; return; }
    if (!ctx.hasFace) return;

    if (c.kind === "blink") {
      if (this.blinkStart < 0) this.blinkStart = ctx.totalBlinks;
      if (ctx.totalBlinks - this.blinkStart >= this.blinksRequired) this.advance();
    } else if (c.kind === "turn_left") {
      if (ctx.dir === "left") this.advance();
    } else if (c.kind === "turn_right") {
      if (ctx.dir === "right") this.advance();
    } else if (c.kind === "smile") {
      if (ctx.smile >= 0.4) this.advance();
    } else if (c.kind === "approach") {
      if (this.baseWidth < 0) this.baseWidth = ctx.width;
      if (ctx.width >= this.baseWidth * 1.25) this.advance();
    }
  }

  // Score de confianca 0..100: conclusao (70) + rapidez (15) + estabilidade (15).
  confidence() {
    const n = this.seq.length;
    const completion = (this.index / n) * 70;
    const avgSpeed = this.speeds.length
      ? this.speeds.reduce((a, b) => a + b, 0) / this.speeds.length
      : 0;
    const speed = avgSpeed * 15;
    const stability = this.totalFrames
      ? (this.faceFrames / this.totalFrames) * 15
      : 0;
    return Math.round(completion + speed + stability);
  }
}
