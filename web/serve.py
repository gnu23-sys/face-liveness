"""Servidor estatico simples para a versao web (funciona no Termux).

Usa apenas a biblioteca padrao do Python - nao precisa instalar nada.

Uso (dentro da pasta web/):
    python serve.py            # porta 8000
    python serve.py 8080       # outra porta

Depois abra no NAVEGADOR DO PROPRIO CELULAR:
    http://localhost:8000

IMPORTANTE: a camera (getUserMedia) so funciona em contexto seguro.
'localhost' conta como seguro, por isso abra via http://localhost no
mesmo aparelho. Para acessar de OUTRO dispositivo seria preciso HTTPS.
"""

import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    # Evita cache para facilitar o desenvolvimento.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Servindo em: http://localhost:{PORT}")
    print("Abra esse endereco no navegador do celular. Ctrl+C para parar.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nParado.")
