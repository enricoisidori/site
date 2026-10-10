#!/usr/bin/env python3
"""Local static server + restricted Internet Archive relay. No dependencies."""
import argparse
import re
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parent


class ArchiveRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        host = urlsplit(newurl).hostname or ''
        if urlsplit(newurl).scheme != 'https' or not (host == 'archive.org' or host.endswith('.archive.org')):
            raise URLError('Redirect outside Internet Archive')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


OPENER = build_opener(ArchiveRedirects())


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if not parsed.path.startswith('/archive/'):
            return super().do_GET()
        params = parse_qs(parsed.query)
        value = lambda name: params.get(name, [''])[0]
        route = parsed.path.removeprefix('/archive/')
        try:
            if route == 'search':
                query = value('q')[:800]
                rows = min(20, max(1, int(value('rows') or 20)))
                page = min(500000, max(1, int(value('page') or 1)))
                search_params = {
                    'q': query, 'output': 'json', 'rows': rows, 'page': page,
                    'fl[]': 'identifier',
                }
                if value('sort') != 'relevance':
                    search_params['sort[]'] = 'identifier asc'
                url = 'https://archive.org/advancedsearch.php?' + urlencode(search_params)
            elif route in ('metadata', 'media'):
                identifier = value('id')
                if not re.fullmatch(r'[A-Za-z0-9_.-]{1,200}', identifier):
                    return self.send_error(400, 'Invalid identifier')
                if route == 'metadata':
                    url = 'https://archive.org/metadata/' + quote(identifier, safe='')
                else:
                    filename = value('file')
                    if not filename.lower().endswith('.mp4') or len(filename) > 1000 or '..' in filename.split('/'):
                        return self.send_error(400, 'Invalid MP4 filename')
                    url = f'https://archive.org/download/{quote(identifier, safe="")}/{quote(filename, safe="/")}'
            else:
                return self.send_error(404)
            headers = {'User-Agent': 'Spiral/1.0 (local experimental archive player)'}
            if route == 'media' and self.headers.get('Range'):
                byte_range = self.headers['Range']
                if not re.fullmatch(r'bytes=\d*-\d*', byte_range):
                    return self.send_error(400, 'Invalid byte range')
                headers['Range'] = byte_range
            with OPENER.open(Request(url, headers=headers), timeout=25) as upstream:
                self.send_response(upstream.status)
                for key in ('Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Last-Modified'):
                    if upstream.headers.get(key):
                        self.send_header(key, upstream.headers[key])
                self.send_header('Cache-Control', 'public, max-age=300' if route != 'media' else 'public, max-age=3600')
                self.end_headers()
                while chunk := upstream.read(64 * 1024):
                    self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # Switching videos cancels pending byte requests.
        except (ValueError, HTTPError, URLError, TimeoutError, OSError) as error:
            # Upstream may fail after headers have already been sent. Close the
            # connection instead of appending an HTML error to a video stream.
            if 'upstream' in locals():
                self.close_connection = True
            else:
                self.send_error(502, f'Archive unavailable: {type(error).__name__}')

    def log_message(self, fmt, *args):
        if '/archive/media?' not in str(args):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--open', action='store_true', help='Open Spiral in your browser')
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    except OSError:
        if args.open:
            try:
                with OPENER.open(f'http://127.0.0.1:{args.port}/', timeout=2) as existing:
                    if b'<title>Spiral</title>' in existing.read(8192):
                        webbrowser.open(f'http://127.0.0.1:{args.port}')
                        raise SystemExit(0)
            except (OSError, URLError):
                pass
        print(f'Porta {args.port} occupata. Se Spiral è già avviato, apri http://127.0.0.1:{args.port}; altrimenti usa --port 8090.', flush=True)
        raise SystemExit(1)
    print(f'Spiral → http://127.0.0.1:{args.port}', flush=True)
    if args.open:
        threading.Timer(.5, lambda: webbrowser.open(f'http://127.0.0.1:{args.port}')).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
