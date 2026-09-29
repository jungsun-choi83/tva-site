"""Local static server with ES-module MIME types enabled."""

import mimetypes
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


mimetypes.add_type("text/javascript", ".mjs")


class ModuleRequestHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), ModuleRequestHandler)
    print(f"Serving homepage on http://127.0.0.1:{port}")
    server.serve_forever()
