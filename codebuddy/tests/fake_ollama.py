"""Ein nachgebauter Ollama-Server für Tests: antwortet mit vorher festgelegten Antworten."""

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class FakeOllama:
    def __init__(self, script, models=("test:latest",), tools_supported=True):
        self.script = list(script)   # Liste von Antworten: {"content": str, "tool_calls": [...]}
        self.models = list(models)
        self.tools_supported = tools_supported
        self.requests = []
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _json(self, obj, code=200):
                data = json.dumps(obj).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self):
                if self.path == "/api/version":
                    return self._json({"version": "0.0-test"})
                if self.path == "/api/tags":
                    return self._json({"models": [{"name": m} for m in fake.models]})
                self._json({}, 404)

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                fake.requests.append(body)
                if body.get("tools") and not fake.tools_supported:
                    return self._json({"error": "registry/test does not support tools"}, 400)
                reply = fake.script.pop(0) if fake.script else {"content": "Fertig."}
                if not body.get("stream"):
                    return self._json({"message": {"role": "assistant", "content": reply.get("content", "")}})
                self.send_response(200)
                self.send_header("Content-Type", "application/x-ndjson")
                self.end_headers()
                text = reply.get("content", "")
                for i in range(0, len(text), 5):   # in kleinen Stücken streamen
                    self.wfile.write((json.dumps({"message": {"role": "assistant", "content": text[i:i + 5]},
                                                  "done": False}) + "\n").encode())
                if reply.get("tool_calls"):
                    self.wfile.write((json.dumps({"message": {"role": "assistant", "content": "",
                                                              "tool_calls": reply["tool_calls"]},
                                                  "done": False}) + "\n").encode())
                self.wfile.write((json.dumps({"message": {"role": "assistant", "content": ""},
                                              "done": True}) + "\n").encode())

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = "http://127.0.0.1:%d" % self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()


def call(name, **args):
    return {"function": {"name": name, "arguments": args}}
