"""Face Liveness MVP - ponto de entrada.

Abre a webcam, detecta o rosto com MediaPipe e roda um sistema de desafios
(piscar / virar a cabeca) para confirmar que ha uma pessoa viva na frente
da camera, e nao uma foto ou video.

Uso:
    python main.py                 # usa a camera 0 e o modelo padrao
    python main.py --camera 1      # escolhe outra camera
    python main.py --model x.task  # outro arquivo de modelo

Teclas:
    r  -> reinicia os desafios
    q / ESC -> sai
"""

from __future__ import annotations

import argparse
import sys
import time

import cv2

from liveness import (
    FaceLandmarks,
    BlinkDetector,
    HeadMovementDetector,
    ChallengeManager,
    State,
)

GREEN = (0, 200, 0)
RED = (0, 0, 220)
WHITE = (255, 255, 255)
YELLOW = (0, 215, 255)


def draw_text(frame, text, pos, color=WHITE, scale=0.8, thick=2):
    cv2.putText(frame, text, pos, cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thick + 2, cv2.LINE_AA)
    cv2.putText(frame, text, pos, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thick, cv2.LINE_AA)


def main():
    parser = argparse.ArgumentParser(description="Face Liveness MVP")
    parser.add_argument("--camera", type=int, default=0, help="indice da webcam")
    parser.add_argument("--model", default="face_landmarker.task", help="caminho do modelo .task")
    args = parser.parse_args()

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"Nao consegui abrir a camera {args.camera}.", file=sys.stderr)
        return 1

    blink = BlinkDetector()
    head = HeadMovementDetector()
    challenges = ChallengeManager()
    start = time.monotonic()

    try:
        with FaceLandmarks(args.model) as face:
            while True:
                ok, frame = cap.read()
                if not ok:
                    print("Falha ao ler frame da camera.", file=sys.stderr)
                    break

                # Efeito espelho: mais natural para o usuario.
                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                timestamp_ms = int((time.monotonic() - start) * 1000)

                result = face.process(rgb, timestamp_ms)

                direction = "center"
                if result.has_face:
                    blink.update(result.blendshapes)
                    direction = head.direction(result.landmarks)
                    challenges.update(blink.total_blinks, direction)

                render(frame, result, blink, direction, challenges)

                cv2.imshow("Face Liveness MVP", frame)
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), 27):
                    break
                if key == ord("r"):
                    blink.reset()
                    challenges.reset()
    finally:
        cap.release()
        cv2.destroyAllWindows()

    return 0


def render(frame, result, blink, direction, challenges):
    h = frame.shape[0]

    if not result.has_face:
        draw_text(frame, "Nenhum rosto detectado", (20, 40), YELLOW)
        return

    draw_text(frame, f"Piscadas: {blink.total_blinks}", (20, 40))
    draw_text(frame, f"Cabeca: {direction}", (20, 75))

    if challenges.state is State.PASSED:
        draw_text(frame, "VIVO - verificado :)", (20, h - 30), GREEN, scale=1.0)
    elif challenges.state is State.FAILED:
        draw_text(frame, "FALHOU - tempo esgotado. Tecle 'r'", (20, h - 30), RED, scale=0.8)
    else:
        current = challenges.current
        if current is not None:
            draw_text(frame, current.prompt, (20, h - 60), YELLOW, scale=0.9)
            draw_text(frame, f"Tempo: {challenges.time_left():.1f}s", (20, h - 25), WHITE, scale=0.7)


if __name__ == "__main__":
    raise SystemExit(main())
