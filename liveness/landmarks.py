"""Wrapper em volta do MediaPipe Face Landmarker.

Carrega o modelo `face_landmarker.task` e, para cada frame, devolve os
landmarks do rosto, os blendshapes (usados para detectar piscadas) e a
matriz de transformacao facial (usada para a pose da cabeca).
"""

from __future__ import annotations

from dataclasses import dataclass

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision


@dataclass
class FaceResult:
    """Resultado simplificado de um frame."""

    landmarks: list          # lista de NormalizedLandmark (x, y, z em 0..1)
    blendshapes: dict        # {nome: score} ex.: {"eyeBlinkLeft": 0.87, ...}
    transform_matrix: list   # matriz 4x4 (ou None) com a pose da cabeca

    @property
    def has_face(self) -> bool:
        return bool(self.landmarks)


class FaceLandmarks:
    def __init__(self, model_path: str = "face_landmarker.task"):
        base_options = mp_python.BaseOptions(model_asset_path=model_path)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            num_faces=1,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
        )
        self._landmarker = vision.FaceLandmarker.create_from_options(options)

    def process(self, rgb_frame, timestamp_ms: int) -> FaceResult:
        """Processa um frame RGB (numpy array) e devolve um FaceResult."""
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        result = self._landmarker.detect_for_video(mp_image, timestamp_ms)

        if not result.face_landmarks:
            return FaceResult(landmarks=[], blendshapes={}, transform_matrix=None)

        blendshapes = {}
        if result.face_blendshapes:
            for cat in result.face_blendshapes[0]:
                blendshapes[cat.category_name] = cat.score

        matrix = None
        if result.facial_transformation_matrixes:
            matrix = result.facial_transformation_matrixes[0].tolist()

        return FaceResult(
            landmarks=result.face_landmarks[0],
            blendshapes=blendshapes,
            transform_matrix=matrix,
        )

    def close(self):
        self._landmarker.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
