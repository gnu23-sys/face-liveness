"""Sistema de desafios de vivacidade.

Sorteia uma sequencia de desafios (piscar, virar a cabeca) e so declara
a pessoa "viva" se ela cumprir todos dentro do tempo limite. Essa parte e
o que diferencia uma pessoa real de uma foto: a foto nao reage aos pedidos.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass
from enum import Enum


class State(Enum):
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"


@dataclass
class Challenge:
    kind: str       # "blink", "turn_left", "turn_right"
    prompt: str     # texto mostrado na tela


def _build_sequence() -> list[Challenge]:
    """Monta uma sequencia aleatoria de desafios."""
    pool = [
        Challenge("blink", "Pisque os olhos 2 vezes"),
        Challenge("turn_left", "Vire a cabeca para a ESQUERDA"),
        Challenge("turn_right", "Vire a cabeca para a DIREITA"),
    ]
    random.shuffle(pool)
    return pool


class ChallengeManager:
    def __init__(self, timeout_per_challenge: float = 8.0, blinks_required: int = 2):
        self.timeout = timeout_per_challenge
        self.blinks_required = blinks_required
        self.reset()

    def reset(self):
        self.sequence = _build_sequence()
        self.index = 0
        self.state = State.RUNNING
        self._deadline = time.monotonic() + self.timeout
        self._blink_start = -1  # piscadas acumuladas quando o desafio comecou (-1 = ainda nao ancorado)

    @property
    def current(self) -> Challenge | None:
        if self.index < len(self.sequence):
            return self.sequence[self.index]
        return None

    def time_left(self) -> float:
        return max(0.0, self._deadline - time.monotonic())

    def _advance(self):
        self.index += 1
        self._blink_start = -1
        if self.index >= len(self.sequence):
            self.state = State.PASSED
        else:
            self._deadline = time.monotonic() + self.timeout

    def update(self, total_blinks: int, head_direction: str):
        """Avalia o desafio atual com os sinais do frame.

        total_blinks: contador acumulado do BlinkDetector.
        head_direction: 'left' / 'right' / 'center'.
        """
        if self.state is not State.RUNNING:
            return

        challenge = self.current
        if challenge is None:
            self.state = State.PASSED
            return

        # Quando o desafio comeca, "ancoramos" o contador de piscadas para
        # so contar as piscadas feitas a partir de agora.
        if challenge.kind == "blink" and self._blink_start < 0:
            self._blink_start = total_blinks

        if self.time_left() <= 0:
            self.state = State.FAILED
            return

        if challenge.kind == "blink":
            if total_blinks - self._blink_start >= self.blinks_required:
                self._advance()
        elif challenge.kind == "turn_left":
            if head_direction == "left":
                self._advance()
        elif challenge.kind == "turn_right":
            if head_direction == "right":
                self._advance()
