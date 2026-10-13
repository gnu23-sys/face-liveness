"""Pacote de deteccao de vivacidade facial."""

from .landmarks import FaceLandmarks, FaceResult
from .blink import BlinkDetector
from .head import HeadMovementDetector
from .challenge import ChallengeManager, State

__all__ = [
    "FaceLandmarks",
    "FaceResult",
    "BlinkDetector",
    "HeadMovementDetector",
    "ChallengeManager",
    "State",
]
