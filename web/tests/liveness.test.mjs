// Testes da logica pura de liveness. Rodar com:  node --test
// Nao precisa de camera, DOM nem MediaPipe.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BlinkDetector,
  headDirection,
  faceWidth,
  smileScore,
  buildSequence,
  ALL_CHALLENGES,
  ChallengeManager,
} from "../liveness-core.js";

// Helper: cria uma lista de landmarks onde so importam os indices 1/234/454.
function makeLandmarks({ nose, left, right }) {
  const arr = new Array(455).fill(0).map(() => ({ x: 0, y: 0, z: 0 }));
  arr[1] = { x: nose };
  arr[234] = { x: left };
  arr[454] = { x: right };
  return arr;
}

// Relogio controlavel para os testes de tempo.
function fakeClock(start = 0) {
  const c = () => c.now;
  c.now = start;
  c.advance = (ms) => { c.now += ms; };
  return c;
}

// ------------------------------------------------------------ BlinkDetector
test("BlinkDetector conta uma piscada no ciclo fechar->abrir", () => {
  const b = new BlinkDetector();
  b.update({ eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1 }); // aberto
  assert.equal(b.total, 0);
  b.update({ eyeBlinkLeft: 0.8, eyeBlinkRight: 0.8 }); // fechou
  assert.equal(b.total, 0, "ainda nao conta enquanto esta fechado");
  b.update({ eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1 }); // abriu -> conta
  assert.equal(b.total, 1);
});

test("BlinkDetector tem histerese (nao conta duplo sem reabrir)", () => {
  const b = new BlinkDetector(0.5, 0.3);
  b.update({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 }); // fechou
  b.update({ eyeBlinkLeft: 0.4, eyeBlinkRight: 0.4 }); // caiu, mas acima de 0.3
  assert.equal(b.total, 0, "0.4 nao reabre (precisa <=0.3)");
  b.update({ eyeBlinkLeft: 0.2, eyeBlinkRight: 0.2 }); // reabriu
  assert.equal(b.total, 1);
  b.update({ eyeBlinkLeft: 0.2, eyeBlinkRight: 0.2 }); // continua aberto
  assert.equal(b.total, 1, "aberto nao incrementa");
});

test("BlinkDetector conta multiplas piscadas e reseta", () => {
  const b = new BlinkDetector();
  for (let i = 0; i < 3; i++) {
    b.update({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 });
    b.update({ eyeBlinkLeft: 0.0, eyeBlinkRight: 0.0 });
  }
  assert.equal(b.total, 3);
  b.reset();
  assert.equal(b.total, 0);
  assert.equal(b.closed, false);
});

// ------------------------------------------------------------ headDirection
test("headDirection: rosto centralizado -> center", () => {
  const lm = makeLandmarks({ nose: 0.5, left: 0.2, right: 0.8 });
  assert.equal(headDirection(lm), "center");
});

test("headDirection: nariz perto da borda direita -> right", () => {
  const lm = makeLandmarks({ nose: 0.7, left: 0.2, right: 0.8 });
  assert.equal(headDirection(lm), "right");
});

test("headDirection: nariz perto da borda esquerda -> left", () => {
  const lm = makeLandmarks({ nose: 0.3, left: 0.2, right: 0.8 });
  assert.equal(headDirection(lm), "left");
});

test("headDirection: sem landmarks ou largura zero -> center", () => {
  assert.equal(headDirection([]), "center");
  assert.equal(headDirection(null), "center");
  assert.equal(headDirection(makeLandmarks({ nose: 0.5, left: 0.5, right: 0.5 })), "center");
});

// ------------------------------------------------------------ faceWidth/smile
test("faceWidth mede a distancia entre as bordas", () => {
  const lm = makeLandmarks({ nose: 0.5, left: 0.3, right: 0.7 });
  assert.ok(Math.abs(faceWidth(lm) - 0.4) < 1e-9);
  assert.equal(faceWidth([]), 0);
});

test("smileScore faz a media dos blendshapes da boca", () => {
  assert.equal(smileScore({ mouthSmileLeft: 0.6, mouthSmileRight: 0.4 }), 0.5);
  assert.equal(smileScore({}), 0);
});

// ------------------------------------------------------------ buildSequence
test("buildSequence retorna 4 desafios validos e sem repetir", () => {
  const seq = buildSequence();
  assert.equal(seq.length, 4);
  const kinds = seq.map((c) => c.kind);
  assert.equal(new Set(kinds).size, 4, "nao deve repetir desafio");
  for (const c of seq) {
    assert.ok(ALL_CHALLENGES.some((x) => x.kind === c.kind));
    assert.ok(typeof c.prompt === "string" && c.prompt.length > 0);
  }
});

// ------------------------------------------------------------ ChallengeManager
function singleChallenge(kind, clock) {
  const cm = new ChallengeManager(8000, 2, clock);
  cm.seq = [{ kind, prompt: kind }]; // sequencia deterministica de 1 desafio
  cm.index = 0;
  cm.state = "running";
  return cm;
}

test("ChallengeManager: blink passa apos 2 piscadas (ancorado no inicio)", () => {
  const clock = fakeClock();
  const cm = singleChallenge("blink", clock);
  // 5 piscadas ja existiam antes do desafio comecar -> nao contam.
  cm.update({ hasFace: true, totalBlinks: 5 });
  assert.equal(cm.state, "running");
  cm.update({ hasFace: true, totalBlinks: 6 });
  assert.equal(cm.state, "running");
  cm.update({ hasFace: true, totalBlinks: 7 }); // +2 desde a ancora
  assert.equal(cm.state, "passed");
});

test("ChallengeManager: turn_left passa so na direcao certa", () => {
  const cm = singleChallenge("turn_left", fakeClock());
  cm.update({ hasFace: true, dir: "right" });
  assert.equal(cm.state, "running");
  cm.update({ hasFace: true, dir: "left" });
  assert.equal(cm.state, "passed");
});

test("ChallengeManager: smile passa quando score >= 0.4", () => {
  const cm = singleChallenge("smile", fakeClock());
  cm.update({ hasFace: true, smile: 0.3 });
  assert.equal(cm.state, "running");
  cm.update({ hasFace: true, smile: 0.5 });
  assert.equal(cm.state, "passed");
});

test("ChallengeManager: approach passa quando o rosto cresce 25%", () => {
  const cm = singleChallenge("approach", fakeClock());
  cm.update({ hasFace: true, width: 0.40 }); // ancora baseWidth = 0.40
  assert.equal(cm.state, "running");
  cm.update({ hasFace: true, width: 0.45 });
  assert.equal(cm.state, "running");
  cm.update({ hasFace: true, width: 0.50 }); // 0.40 * 1.25
  assert.equal(cm.state, "passed");
});

test("ChallengeManager: estoura o tempo -> failed", () => {
  const clock = fakeClock();
  const cm = singleChallenge("turn_left", clock);
  clock.advance(8001); // passou do timeout
  cm.update({ hasFace: true, dir: "left" });
  assert.equal(cm.state, "failed");
});

test("ChallengeManager: sem rosto nao avanca", () => {
  const cm = singleChallenge("turn_left", fakeClock());
  cm.update({ hasFace: false, dir: "left" });
  assert.equal(cm.state, "running");
  assert.equal(cm.faceFrames, 0);
  assert.equal(cm.totalFrames, 1);
});

test("ChallengeManager: sequencia completa termina em passed", () => {
  const clock = fakeClock();
  const cm = new ChallengeManager(8000, 2, clock);
  cm.seq = [{ kind: "turn_left", prompt: "" }, { kind: "turn_right", prompt: "" }];
  cm.index = 0; cm.state = "running"; cm.deadline = clock() + cm.timeout;
  cm.update({ hasFace: true, dir: "left" });
  assert.equal(cm.index, 1);
  assert.equal(cm.state, "running");
  cm.update({ hasFace: true, dir: "right" });
  assert.equal(cm.state, "passed");
});

test("ChallengeManager: confianca alta ao passar rapido e estavel", () => {
  const cm = singleChallenge("turn_left", fakeClock());
  cm.update({ hasFace: true, dir: "left" }); // passa de imediato (tempo cheio)
  assert.equal(cm.state, "passed");
  const score = cm.confidence();
  // 70 (completo) + ~15 (rapido) + 15 (rosto sempre presente) ~ 100
  assert.ok(score >= 95, `esperava score alto, veio ${score}`);
});

test("ChallengeManager: confianca parcial quando falha no meio", () => {
  const clock = fakeClock();
  const cm = new ChallengeManager(8000, 2, clock);
  cm.seq = [{ kind: "turn_left", prompt: "" }, { kind: "turn_right", prompt: "" }];
  cm.index = 0; cm.state = "running"; cm.deadline = clock() + cm.timeout;
  cm.update({ hasFace: true, dir: "left" });   // passa o 1o
  clock.advance(8001);
  cm.update({ hasFace: true, dir: "left" });   // 2o nao vem -> falha
  assert.equal(cm.state, "failed");
  const score = cm.confidence();
  assert.ok(score > 0 && score < 70, `esperava score parcial, veio ${score}`);
});
