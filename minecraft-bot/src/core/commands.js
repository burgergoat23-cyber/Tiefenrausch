'use strict'
// Chat-Befehle: "!befehl argumente". Antworten gehen in den Chat (gedrosselt,
// damit der Server den Bot nicht wegen Spam rauswirft) und ins Log.

class Commands {
  constructor ({ log, config }) {
    this.log = log
    this.config = config
    this.prefix = config.commandPrefix || '!'
    this.list = new Map() // name -> { name, aliases, usage, help, handler }
    this.bot = null
    this._outbox = []
    this._sending = null
  }

  attach (bot) {
    this.bot = bot
    this._outbox = []
    bot.on('chat', (username, message) => this._onChat(username, message, false))
    bot.on('whisper', (username, message) => this._onChat(username, message, true))
  }

  // register('folge', { aliases: ['follow'], usage: '!folge [name]', help: '...', handler: async (ctx) => {} })
  register (name, def) {
    const entry = { name, aliases: [], usage: this.prefix + name, help: '', ...def }
    this.list.set(name, entry)
    for (const a of entry.aliases) this.list.set(a, entry)
  }

  unique () { return [...new Set(this.list.values())] }

  isOwner (username) {
    if (!this.config.owners.length) return true
    return this.config.owners.includes(String(username).toLowerCase())
  }

  // Nachricht in den Chat schicken (lange Texte werden geteilt).
  say (text) {
    if (!text) return
    for (const line of String(text).split('\n')) {
      let rest = line
      while (rest.length > 0) {
        this._outbox.push(rest.slice(0, 240))
        rest = rest.slice(240)
      }
    }
    this._pump()
  }

  _pump () {
    if (this._sending) return
    this._sending = setInterval(() => {
      const msg = this._outbox.shift()
      if (!msg) { clearInterval(this._sending); this._sending = null; return }
      try {
        if (this.bot && this.bot.entity) this.bot.chat(msg)
      } catch (e) { this.log.warn('Chat senden fehlgeschlagen:', e.message) }
    }, 700)
  }

  _onChat (username, message, whisper) {
    if (!this.bot || username === this.bot.username) return
    this.log.info(`${whisper ? '[Flüstern] ' : ''}<${username}> ${message}`)
    if (!message.startsWith(this.prefix)) return
    if (!this.isOwner(username)) {
      this.log.warn(`Befehl von ${username} ignoriert (nicht in "owners").`)
      return
    }
    this.run(message, { username, source: 'chat' })
  }

  // Befehl ausführen. "source" = 'chat' oder 'konsole'.
  async run (text, { username = null, source = 'konsole' } = {}) {
    const body = text.trim().replace(new RegExp('^' + escapeRe(this.prefix)), '')
    const parts = body.split(/\s+/).filter(Boolean)
    const name = (parts.shift() || '').toLowerCase()
    const reply = (msg) => {
      if (source === 'chat') this.say(msg)
      else this.log.info('[Antwort] ' + msg)
    }
    const cmd = this.list.get(name)
    if (!cmd) {
      reply(`Unbekannter Befehl "${name}". Schreib ${this.prefix}hilfe für eine Liste.`)
      return
    }
    try {
      await cmd.handler({ args: parts, username, source, reply, raw: text })
    } catch (e) {
      this.log.error(`Befehl ${name} fehlgeschlagen:`, e)
      reply(`Fehler bei ${this.prefix}${name}: ${e.message}`)
    }
  }
}

function escapeRe (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

module.exports = { Commands }
