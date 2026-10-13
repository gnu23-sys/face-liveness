# Face Liveness — versao web (celular / telemovel)

Esta versao roda **inteiramente no navegador do celular**. O MediaPipe Face
Landmarker roda em **WASM/JavaScript**, usando a camera frontal via
`getUserMedia`. Nenhuma imagem sai do aparelho e **nao precisa instalar
Python-mediapipe** — ideal para Termux/Android.

## Como rodar no proprio celular (Termux)

```bash
cd face-liveness/web
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
| `app.js`     | camera + MediaPipe + piscada + cabeca + desafios       |
| `serve.py`   | servidor estatico (so lib padrao)                      |

## Requisitos

- Um navegador moderno com suporte a WebAssembly e `getUserMedia`
  (Chrome/Firefox no Android servem).
- Conexao com a internet na **primeira** vez (baixa o modelo e o WASM da CDN).

## Limitacoes

MVP educacional, igual a versao desktop: nao resiste a video gravado (replay),
deepfake em tempo real ou mascara 3D. Nao use como unica camada de seguranca.
