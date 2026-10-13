"""Baixa os assets do MediaPipe para rodar OFFLINE (sem CDN em runtime).

Roda uma vez, com internet. Depois a versao web funciona sem rede.
Os arquivos vao para web/vendor/ (ignorado pelo git por serem binarios).

Uso (dentro da pasta web/):
    python fetch_vendor.py
"""

from __future__ import annotations

import os
import urllib.request

VER = "0.10.14"
CDN = f"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@{VER}"
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)

FILES = {
    "vendor/vision_bundle.mjs": f"{CDN}/vision_bundle.mjs",
    "vendor/wasm/vision_wasm_internal.js": f"{CDN}/wasm/vision_wasm_internal.js",
    "vendor/wasm/vision_wasm_internal.wasm": f"{CDN}/wasm/vision_wasm_internal.wasm",
    "vendor/wasm/vision_wasm_nosimd_internal.js": f"{CDN}/wasm/vision_wasm_nosimd_internal.js",
    "vendor/wasm/vision_wasm_nosimd_internal.wasm": f"{CDN}/wasm/vision_wasm_nosimd_internal.wasm",
    "vendor/models/face_landmarker.task": MODEL_URL,
}


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    for dest, url in FILES.items():
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            print(f"ja existe: {dest}")
            continue
        print(f"baixando {dest} ...")
        urllib.request.urlretrieve(url, dest)
        size = os.path.getsize(dest) / 1024
        print(f"  ok ({size:.0f} KB)")
    print("\nPronto. A versao web agora roda offline (apos carregar 1x).")


if __name__ == "__main__":
    main()
