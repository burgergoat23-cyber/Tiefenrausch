'use strict'
// Kleine Hilfsfunktionen, die mehrere Module brauchen.

// Text aus einer Minecraft-Chatnachricht (String, JSON oder Objekt) holen.
function chatText (r) {
  if (r == null) return ''
  if (typeof r === 'string') {
    try { return chatText(JSON.parse(r)) } catch { return r }
  }
  if (typeof r !== 'object') return String(r)
  if (typeof r.toString === 'function' && r.constructor && r.constructor.name === 'ChatMessage') return r.toString()
  if (r.type && r.value !== undefined) return chatText(r.value) // NBT
  let out = ''
  if (r.text !== undefined) out += chatText(r.text)
  if (r.translate) out += chatText(r.translate)
  if (Array.isArray(r.with)) out += ' ' + r.with.map(chatText).join(' ')
  if (Array.isArray(r.extra)) out += r.extra.map(chatText).join('')
  if (Array.isArray(r)) out += r.map(chatText).join('')
  return out
}

function fmtPos (p) {
  if (!p) return '?'
  return `${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)}`
}

function dimName (bot) {
  const d = (bot && bot.game && bot.game.dimension) || 'overworld'
  return String(d).replace('minecraft:', '')
}

module.exports = { chatText, fmtPos, dimName }
