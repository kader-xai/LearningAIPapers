#!/usr/bin/env python3
"""Tiny static server for the Learning Papers site.

Usage:
    python3 serve.py            # serves on http://localhost:8765
    python3 serve.py 9000       # custom port
"""
import http.server
import socketserver
import sys
import os
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

with socketserver.TCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
    url = f"http://localhost:{PORT}/"
    print(f"Learning Papers site → {url}")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")
