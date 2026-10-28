"""Phase 5: einfache Web-Oberfläche, nur auf diesem PC erreichbar (127.0.0.1)."""

import json
import secrets
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .agent import Agent
from .ollama_client import OllamaError
from .tools import Workspace


class WebUI:
    """Sammelt alles, was die KI ausgibt, und wartet auf Antworten aus dem Browser."""

    def __init__(self):
        self.lock = threading.Lock()
        self.log = []          # [{"type": "user"|"bot"|"status"|"info"|"result", "text": ...}]
        self.pending = None    # offene Frage an den Nutzer
        self.answer = None
        self.answered = threading.Event()
        self.busy = False

    def _add(self, typ, text):
        with self.lock:
            self.log.append({"type": typ, "text": text})

    def text(self, chunk):
        with self.lock:
            if self.log and self.log[-1]["type"] == "bot" and not self.log[-1].get("done"):
                self.log[-1]["text"] += chunk
            else:
                self.log.append({"type": "bot", "text": chunk})

    def text_end(self):
        with self.lock:
            if self.log and self.log[-1]["type"] == "bot":
                self.log[-1]["done"] = True

    def status(self, msg):
        self._add("status", msg)

    def info(self, msg):
        self._add("info", msg)

    def tool_result(self, name, result):
        if name == "run_command" or result.startswith("FEHLER"):
            self._add("result", result[:3000])

    def _ask(self, question, details, kind, needs_text):
        self.answered.clear()
        with self.lock:
            self.pending = {"question": question, "details": details, "kind": kind, "text": needs_text}
        self.answered.wait()
        with self.lock:
            self.pending = None
            return self.answer

    def confirm(self, question, details, kind):
        ok, _ = self._ask(question, details, kind, False)
        return ok

    def ask_text(self, question):
        _, text = self._ask(question, "", "danger", True)
        return text

    def give_answer(self, ok, text):
        with self.lock:
            if self.pending is None:
                return
            self.answer = (ok, text)
        self.answered.set()

    def snapshot(self):
        with self.lock:
            return {"log": list(self.log), "pending": self.pending, "busy": self.busy}


def serve(cfg, client, root, t, open_browser=True):
    ui = WebUI()
    ws = Workspace(root, ui.confirm, ui.ask_text, t)
    agent = Agent(cfg, client, ws, ui, t)
    token = secrets.token_hex(16)
    port = cfg["web_port"]
    page = PAGE.replace("__TOKEN__", token).replace("__MODEL__", cfg["modell"]) \
               .replace("__ROOT__", str(root).replace("<", "&lt;"))

    def run(text):
        try:
            agent.ask(text)
        except OllamaError as e:
            ui.info(t("error", msg=e))
        finally:
            with ui.lock:
                ui.busy = False

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _allowed(self):
            # Schutz vor fremden Webseiten: nur unsere eigene Seite darf die API benutzen.
            host = (self.headers.get("Host") or "").split(":")[0]
            return host in ("127.0.0.1", "localhost") and self.headers.get("X-Token") == token

        def _send(self, code, body, ctype="application/json"):
            data = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype + "; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/":
                return self._send(200, page, "text/html")
            if self.path == "/api/state" and self._allowed():
                return self._send(200, json.dumps(ui.snapshot()))
            self._send(404, "{}")

        def do_POST(self):
            if not self._allowed():
                return self._send(403, "{}")
            length = int(self.headers.get("Content-Length") or 0)
            try:
                data = json.loads(self.rfile.read(length) or b"{}")
            except ValueError:
                data = {}
            if self.path == "/api/send":
                text = str(data.get("text", "")).strip()
                with ui.lock:
                    if ui.busy or not text:
                        return self._send(409, "{}")
                    ui.busy = True
                    ui.log.append({"type": "user", "text": text})
                threading.Thread(target=run, args=(text,), daemon=True).start()
            elif self.path == "/api/answer":
                ui.give_answer(bool(data.get("ok")), str(data.get("text", "")))
            elif self.path == "/api/clear":
                with ui.lock:
                    if ui.busy:
                        return self._send(409, "{}")
                    ui.log.clear()
                agent.reset()
            self._send(200, "{}")

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = "http://127.0.0.1:%d/" % port
    print(t("web_start", url=url))
    if open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


PAGE = r"""<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CodeBuddy</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--text:#1d2330;--muted:#6b7385;--accent:#2f6fde;--code:#0f1420;--codetext:#e6e9ef;
--add:#1f8a4c;--del:#c23b3b;--warn:#b7791f;--border:#dfe3ea}
@media (prefers-color-scheme:dark){:root{--bg:#12151c;--card:#1b2029;--text:#e6e9ef;--muted:#98a1b3;--accent:#6c9dff;
--code:#0b0e14;--border:#2b3240;--add:#4cc38a;--del:#ff7b7b;--warn:#f0b35a}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--text)}
header{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header b{font-size:18px}header span{color:var(--muted);font-size:13px;overflow-wrap:anywhere}
header button{margin-left:auto}
#log{max-width:900px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:10px;padding-bottom:180px}
.m{padding:10px 14px;border-radius:10px;background:var(--card);border:1px solid var(--border);white-space:pre-wrap;overflow-wrap:anywhere}
.user{align-self:flex-end;background:var(--accent);color:#fff;border:none;max-width:85%}
.status{color:var(--accent);font-size:13px;background:none;border:none;padding:0 4px}
.info{color:var(--warn);font-size:13px;background:none;border:none;padding:0 4px}
.result,pre{background:var(--code);color:var(--codetext);font:13px/1.45 ui-monospace,Consolas,monospace;padding:10px;border-radius:8px;overflow-x:auto;white-space:pre}
.m pre{margin:8px 0}
.kw{color:#7aa2ff;font-weight:600}.st{color:#8bd49c}.cm{color:#7f8799}.nu{color:#e0a1ff}
.add{color:var(--add)}.del{color:var(--del)}.hunk{color:#57c7e0}
#bar{position:fixed;left:0;right:0;bottom:0;background:var(--bg);border-top:1px solid var(--border);padding:12px 16px}
#bar>div{max-width:900px;margin:0 auto;display:flex;gap:8px}
textarea{flex:1;min-width:0;font:inherit;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);resize:vertical;min-height:46px}
button{font:inherit;padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer}
button.main{background:var(--accent);color:#fff;border:none}button:disabled{opacity:.5}
#ask{display:none;max-width:900px;margin:0 auto 10px;padding:12px;border:2px solid var(--warn);border-radius:10px;background:var(--card)}
#ask pre{max-height:40vh;overflow:auto}#ask .row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
#ask input{flex:1;min-width:0;font:inherit;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text)}
</style></head><body>
<header><b>CodeBuddy</b><span>Modell: __MODEL__ · Ordner: __ROOT__</span><button id="clear">Verlauf löschen</button></header>
<div id="log"></div>
<div id="bar"><div id="ask"><div id="q"></div><pre id="d"></pre><div class="row">
<input id="atext" placeholder="Hier eintippen"><button class="main" id="yes">Ja</button><button id="no">Nein</button></div></div>
<div><textarea id="in" placeholder="Was soll ich tun? (Enter = senden, Umschalt+Enter = neue Zeile)"></textarea>
<button class="main" id="send">Senden</button></div></div>
<script>
const TOKEN="__TOKEN__", H={"Content-Type":"application/json","X-Token":TOKEN};
const $=id=>document.getElementById(id);
const esc=s=>s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const KW=new Set("and as async await break case catch class const continue def del elif else except export false False finally for from function if import in is lambda let new None not null or pass raise return self switch this throw true True try var while with yield".split(" "));
function hl(code){return esc(code).replace(/(#.*$|\/\/.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/gm,
 (m,cm,st,nu,w)=>cm?'<span class="cm">'+m+'</span>':st?'<span class="st">'+m+'</span>':nu?'<span class="nu">'+m+'</span>':KW.has(w)?'<span class="kw">'+m+'</span>':m);}
function md(t){return t.split(/```[^\n]*\n?/).map((p,i)=>i%2?'<pre>'+hl(p.replace(/\n$/,''))+'</pre>':esc(p)).join('');}
function diff(t){return t.split('\n').map(l=>{const e=esc(l);
 if(l.startsWith('+++')||l.startsWith('---'))return '<b>'+e+'</b>';if(l[0]=='+')return '<span class="add">'+e+'</span>';
 if(l[0]=='-')return '<span class="del">'+e+'</span>';if(l.startsWith('@@'))return '<span class="hunk">'+e+'</span>';return e;}).join('\n');}
let last="";
async function poll(){
 try{const r=await fetch("/api/state",{headers:H});const s=await r.json();const key=JSON.stringify(s);
  if(key!==last){last=key;const atBottom=innerHeight+scrollY>=document.body.scrollHeight-40;
   $("log").innerHTML=s.log.map(e=>'<div class="m '+(e.type=='result'?'result':e.type)+'">'+
    (e.type=='bot'?md(e.text):esc(e.text))+'</div>').join('');
   const p=s.pending;$("ask").style.display=p?'block':'none';
   if(p){$("q").textContent=p.question;$("d").style.display=p.details?'block':'none';$("d").innerHTML=diff(p.details||'');
    $("atext").style.display=p.text?'block':'none';}
   $("send").disabled=s.busy;if(atBottom)scrollTo(0,document.body.scrollHeight);}
 }catch(e){}
 setTimeout(poll,400);}
async function post(path,body){await fetch(path,{method:"POST",headers:H,body:JSON.stringify(body||{})});last="";}
$("send").onclick=()=>{const v=$("in").value.trim();if(!v)return;$("in").value="";post("/api/send",{text:v});};
$("in").onkeydown=e=>{if(e.key=="Enter"&&!e.shiftKey){e.preventDefault();$("send").click();}};
$("yes").onclick=()=>{post("/api/answer",{ok:true,text:$("atext").value});$("atext").value="";};
$("no").onclick=()=>post("/api/answer",{ok:false,text:""});
$("clear").onclick=()=>post("/api/clear");
poll();
</script></body></html>"""
