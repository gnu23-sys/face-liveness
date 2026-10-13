# Face Liveness — versao web (celular / telemovel)

Esta versao roda **inteiramente no navegador do celular**. O MediaPipe Face
Landmarker roda em **WASM/JavaScript**, usando a camera frontal via
`getUserMedia`. Nenhuma imagem sai do aparelho e **nao precisa instalar
Python-mediapipe** — ideal para Termux/Android.

### Recursos

- **Desafios**: piscar os olhos, virar a cabeca (esq/dir), **sorrir** e
  **aproximar o rosto** da camera. A cada sessao e sorteada uma sequencia.
- **Score de confianca (0–100)**: combina conclusao dos desafios, rapidez e
  estabilidade do rosto na tela — em vez de so "passou/falhou".
- **Malha de pontos**: os ~478 landmarks desenhados sobre o rosto, com um
  botao para ligar/desligar.
- **Modo offline**: rode `python fetch_vendor.py` uma vez (com internet) e o
  app passa a usar o modelo + WASM locais, sem depender da CDN.

## Como rodar no proprio celular (Termux)

```bash
cd face-liveness/web
python fetch_vendor.py   # opcional: baixa assets p/ rodar offline depois
python serve.py          # usa so a lib padrao, funciona no Python 3.14
```

Depois abra no **navegador do celular**:

```
http://localhost:8000
```

Toque em **Iniciar**, permita o acesso a camera e siga os desafios na tela
(piscar, virar a cabeca). Se cumprir todos no tempo → **VIVO**.

> A camera so liga em "contexto seguro". `localhost` conta como seguro, por
> isso funciona abrindo no mesmo aparelho. Para abrir de outro dispositivo da
> rede voce precisaria servir via **HTTPS** (ex.: um tunel ou um certificado).

## Arquivos

| Arquivo      | Papel                                                  |
|--------------|--------------------------------------------------------|
| `index.html` | estrutura da pagina                                    |
| `style.css`  | estilo (layout vertical, amigavel pra celular)         |
| `app.js`     | camera + MediaPipe + desafios + score + malha          |
| `serve.py`   | servidor estatico (so lib padrao)                      |
| `fetch_vendor.py` | baixa modelo + WASM para `vendor/` (modo offline) |
| `liveness-core.js` | logica pura (detectores + desafios + score), sem DOM |
| `tests/`     | testes da logica (runner nativo do Node)               |

## Testes

A logica pura fica isolada em `liveness-core.js` (sem camera/DOM), entao da
para testar sem navegador, com o runner nativo do Node (>= 18):

```bash
cd face-liveness/web
node --test
```

Cobre: contagem de piscadas com histerese, direcao da cabeca, sorriso,
aproximacao, sorteio dos desafios, avanco/timeout da sequencia e o score
de confianca.

## Requisitos

- Um navegador moderno com suporte a WebAssembly e `getUserMedia`
  (Chrome/Firefox no Android servem).
- Conexao com a internet na **primeira** vez (baixa o modelo e o WASM da CDN).

## Limitacoes

MVP educacional, igual a versao desktop: nao resiste a video gravado (replay),
deepfake em tempo real ou mascara 3D. Nao use como unica camada de seguranca.
