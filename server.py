"""Simple local HTTP server with admin save API.

Usage: python server.py
Serves the underdark_web directory at http://localhost:8000
"""
from __future__ import annotations

import http.server
import json
import socketserver
from pathlib import Path

PORT = 8000
ROOT = Path(__file__).resolve().parent


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path == '/api/save-items':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body)
                json_path = ROOT / 'data' / 'items.json'
                js_path = ROOT / 'data' / 'items.js'

                json_path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
                js_path.write_text('window.UNDERDARK_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';', encoding='utf-8')

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"success": true, "message": "Saved successfully to disk."}')
                print(' [Admin] Successfully saved updated items to disk!')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                err_msg = json.dumps({'success': False, 'error': str(e)}).encode('utf-8')
                self.wfile.write(err_msg)
        else:
            self.send_response(404)
            self.end_headers()


def run():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), CustomHandler) as httpd:
        print(f'=====================================================')
        print(f' Underdark Web Server is running!')
        print(f' -> Main Web:   http://localhost:{PORT}/index.html')
        print(f' -> Admin Page: http://localhost:{PORT}/admin.html')
        print(f'=====================================================')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nServer stopped.')


if __name__ == '__main__':
    run()
