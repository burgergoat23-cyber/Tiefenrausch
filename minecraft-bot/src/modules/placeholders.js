'use strict'
// Befehle, die in späteren Phasen kommen. Werden nach und nach ersetzt.
const LATER = [
  ['farm', '!farm <item> <anzahl>', 'Ressourcen sammeln', 3],
  ['lager', '!lager', 'Inventar ins Lager sortieren', 4],
  ['bau', '!bau <blueprint>', 'Gebäude aus Blueprint bauen', 5],
  ['ziel', '!ziel <advancement>', 'Fortschritt anpeilen', 6]
]

function init (ctx) {
  for (const [name, usage, help, phase] of LATER) {
    if (ctx.commands.list.has(name)) continue
    ctx.commands.register(name, {
      usage,
      help: `${help} (ab Phase ${phase})`,
      handler: ({ reply }) => reply(`${usage} kommt in Phase ${phase}. Noch nicht eingebaut.`)
    })
  }
}

module.exports = { name: 'platzhalter', init }
