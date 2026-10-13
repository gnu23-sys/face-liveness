"""Baixa o modelo face_landmarker.task do MediaPipe.

Uso:
    python download_model.py
"""

from __future__ import annotations

import os
import urllib.request

URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)
DEST = "face_landmarker.task"


def main():
    if os.path.exists(DEST):
        print(f"{DEST} ja existe. Nada a fazer.")
        return
    print(f"Baixando modelo de:\n  {URL}")
    urllib.request.urlretrieve(URL, DEST)
    size = os.path.getsize(DEST) / (1024 * 1024)
    print(f"Pronto: {DEST} ({size:.1f} MB)")


if __name__ == "__main__":
    main()
