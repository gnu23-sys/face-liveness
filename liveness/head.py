"""Deteccao de movimento da cabeca (virar para esquerda/direita).

Estimamos o 'yaw' (rotacao horizontal) comparando a posicao da ponta do
nariz com as duas bordas do rosto. Quando o nariz fica muito mais perto
de uma borda, a cabeca esta virada para aquele lado.

Indices de landmark do Face Mesh usados:
  1   -> ponta do nariz
  234 -> borda esquerda do rosto (lado direito da imagem espelhada)
  454 -> borda direita do rosto
"""

from __future__ import annotations

NOSE_TIP = 1
FACE_LEFT = 234
FACE_RIGHT = 454


class HeadMovementDetector:
    def __init__(self, threshold: float = 0.25):
        # threshold entre 0 e 1: quanto maior, mais precisa virar a cabeca.
        self.threshold = threshold

    def direction(self, landmarks) -> str:
        """Retorna 'left', 'right' ou 'center' para o frame atual.

        A imagem normalmente e espelhada (efeito espelho), entao 'left'
        significa o lado esquerdo de quem olha a tela.
        """
        if not landmarks:
            return "center"

        nose = landmarks[NOSE_TIP].x
        left = landmarks[FACE_LEFT].x
        right = landmarks[FACE_RIGHT].x

        width = abs(right - left)
        if width < 1e-6:
            return "center"

        # Posicao do nariz dentro do rosto: 0 = colado na borda esquerda,
        # 1 = colado na direita, 0.5 = centralizado.
        ratio = (nose - left) / width
        offset = ratio - 0.5

        if offset > self.threshold / 2:
            return "right"
        if offset < -self.threshold / 2:
            return "left"
        return "center"
