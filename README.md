# Face Liveness MVP

Projeto pessoal de **deteccao de vivacidade facial** (anti-spoofing): abre a
webcam e confirma que ha uma **pessoa viva** na frente da camera — e nao uma
foto ou video — atraves de um sistema de desafios.

Inspirado em [gpscorreia/face-liveness-python](https://github.com/gpscorreia/face-liveness-python).

## Como funciona

1. **Captura** o video da webcam com OpenCV.
2. **Detecta o rosto** com o MediaPipe Face Landmarker.
3. **Detecta piscadas** usando os blendshapes `eyeBlinkLeft` / `eyeBlinkRight`.
4. **Detecta movimento da cabeca** (esquerda/direita) pela posicao do nariz.
5. **Sistema de desafios**: sorteia uma sequencia (piscar 2x, virar a cabeca
   para os lados) e exige que o usuario cumpra cada uma dentro do tempo.
6. **Resultado**: `VIVO` se todos os desafios forem cumpridos, `FALHOU` se o
   tempo esgotar. Uma foto parada nao reage aos pedidos e portanto falha.

## Estrutura

```
face-liveness/
├── main.py                 # loop principal: camera + overlay + teclas
├── download_model.py       # baixa face_landmarker.task
├── requirements.txt
└── liveness/
    ├── landmarks.py        # wrapper do MediaPipe Face Landmarker
    ├── blink.py            # contagem de piscadas (com histerese)
    ├── head.py             # direcao da cabeca (yaw via landmarks)
    └── challenge.py        # maquina de estados dos desafios
```

## Instalacao

> Precisa de um ambiente com **webcam** e **Python 3.9–3.12** (o MediaPipe ainda
> nao publica wheels para o 3.13/3.14). Desktop Linux/Windows/macOS.

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python download_model.py       # baixa o face_landmarker.task
python main.py
```

## Teclas

| Tecla      | Acao                        |
|------------|-----------------------------|
| `r`        | reinicia os desafios        |
| `q` / `ESC`| sair                        |

## Ajustes

- Sensibilidade da piscada: `BlinkDetector(close_threshold, open_threshold)` em `liveness/blink.py`.
- Quanto virar a cabeca: `HeadMovementDetector(threshold)` em `liveness/head.py`.
- Tempo e nº de piscadas: `ChallengeManager(timeout_per_challenge, blinks_required)` em `liveness/challenge.py`.

## Limitacoes

Este e um **MVP educacional**. Nao substitui uma solucao de producao: nao
resiste a ataques de video gravado seguindo os desafios (replay), deepfakes em
tempo real, nem mascaras 3D. Para producao, combine com deteccao passiva por
textura/profundidade e um modelo anti-spoofing treinado.
