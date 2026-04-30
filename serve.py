#!/usr/bin/env python3
import http.server
import socketserver

PORT = 8000

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")

with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Serving on port {PORT} with no-cache headers")
    httpd.serve_forever()
