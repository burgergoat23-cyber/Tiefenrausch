"""Kleiner Ollama-Client nur mit der Python-Standardbibliothek."""

import json
import urllib.error
import urllib.request

from .config import is_local_url


class OllamaError(Exception):
    pass


class ToolsNotSupported(OllamaError):
    """Das Modell kann kein Tool-Calling – dann nehmen wir das Textformat."""


class Ollama:
    def __init__(self, url, timeout=600):
        if not is_local_url(url):
            raise OllamaError("Nur ein lokales Ollama ist erlaubt: " + url)
        self.url = url.rstrip("/")
        self.timeout = timeout
        # Kein Proxy: Anfragen bleiben garantiert auf diesem PC.
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def _open(self, path, body=None):
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(self.url + path, data=data,
                                     headers={"Content-Type": "application/json"})
        try:
            return self.opener.open(req, timeout=self.timeout)
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")
            try:
                msg = json.loads(msg).get("error", msg)
            except ValueError:
                pass
            if "does not support tools" in msg:
                raise ToolsNotSupported(msg)
            raise OllamaError(msg)
        except (urllib.error.URLError, OSError) as e:
            raise OllamaError("Ollama ist nicht erreichbar (%s)" % e)

    def ping(self):
        try:
            with self._open("/api/version") as r:
                return json.loads(r.read()).get("version", "?")
        except (OllamaError, ValueError):
            return None

    def list_models(self):
        with self._open("/api/tags") as r:
            return sorted(m["name"] for m in json.loads(r.read()).get("models", []))

    def chat_stream(self, model, messages, tools=None, options=None):
        body = {"model": model, "messages": messages, "stream": True}
        if tools:
            body["tools"] = tools
        if options:
            body["options"] = options
        with self._open("/api/chat", body) as r:
            for line in r:
                line = line.strip()
                if not line:
                    continue
                chunk = json.loads(line)
                if chunk.get("error"):
                    if "does not support tools" in chunk["error"]:
                        raise ToolsNotSupported(chunk["error"])
                    raise OllamaError(chunk["error"])
                yield chunk
                if chunk.get("done"):
                    break

    def chat(self, model, messages, options=None):
        body = {"model": model, "messages": messages, "stream": False}
        if options:
            body["options"] = options
        with self._open("/api/chat", body) as r:
            return json.loads(r.read()).get("message", {}).get("content", "")
