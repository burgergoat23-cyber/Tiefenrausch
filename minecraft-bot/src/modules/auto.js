'use strict'
// Auto-Modus an/aus. In Phase 1 wird nur der Schalter gespeichert;
// ab Phase 3/6 sucht sich der Bot damit selbst Ziele (Farmen, Roadmap).

function init (ctx) {
  const { commands, state } = ctx
  commands.register('auto', {
    usage: '!auto an|aus',
    help: 'Selbstständiges Spielen ein-/ausschalten.',
    handler: ({ args, reply }) => {
      const v = (args[0] || '').toLowerCase()
      if (['an', 'ein', 'on'].includes(v)) state.set('auto', true)
      else if (['aus', 'off'].includes(v)) state.set('auto', false)
      else return reply(`Auto ist ${state.get('auto') ? 'an' : 'aus'}. Benutze: !auto an | !auto aus`)
      reply(state.get('auto')
        ? 'Auto-Modus an. (Eigene Ziele kommen ab Phase 3 – bis dahin warte ich auf Befehle.)'
        : 'Auto-Modus aus.')
    }
  })
}

module.exports = { name: 'auto', init }
