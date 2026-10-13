"""Deteccao de piscadas usando os blendshapes do MediaPipe.

O modelo entrega os scores `eyeBlinkLeft` e `eyeBlinkRight` (0 a 1, perto
de 1 = olho fechado). Contamos uma piscada toda vez que os olhos passam
de fechados para abertos, usando histerese para evitar contagem dupla.
"""

from __future__ import annotations


class BlinkDetector:
    def __init__(self, close_threshold: float = 0.5, open_threshold: float = 0.3):
        # Histerese: fecha so acima de close_threshold, reabre so abaixo de
        # open_threshold. Isso evita "tremer" em torno de um unico valor.
        self.close_threshold = close_threshold
        self.open_threshold = open_threshold
        self._eyes_closed = False
        self.total_blinks = 0

    def update(self, blendshapes: dict) -> bool:
        """Atualiza o estado com os blendshapes do frame.

        Retorna True no exato frame em que uma piscada e concluida.
        """
        left = blendshapes.get("eyeBlinkLeft", 0.0)
        right = blendshapes.get("eyeBlinkRight", 0.0)
        score = (left + right) / 2.0

        blinked = False
        if not self._eyes_closed and score >= self.close_threshold:
            self._eyes_closed = True
        elif self._eyes_closed and score <= self.open_threshold:
            self._eyes_closed = False
            self.total_blinks += 1
            blinked = True

        return blinked

    def reset(self):
        self._eyes_closed = False
        self.total_blinks = 0
