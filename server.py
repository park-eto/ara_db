# -*- coding: utf-8 -*-
"""
Local HTTP Server for Ara DB VER 2.0 (C:/dev/workplace/underdark_public)
Usage: python server.py [port]
"""
import http.server
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

os.chdir(ROOT)


class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


NoCacheHTTPRequestHandler.extensions_map.update({
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webp": "image/webp",
})

print(f"Starting Ara DB VER 2.0 server at http://localhost:{PORT}", flush=True)
with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), NoCacheHTTPRequestHandler) as httpd:
    httpd.serve_forever()

