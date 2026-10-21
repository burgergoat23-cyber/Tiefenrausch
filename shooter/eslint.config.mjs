// Prüfregeln für ESLint (optional): npx eslint src tests
export default [{
  files: ['**/*.js', '**/*.mjs'],
  languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: {
    window: 'readonly', document: 'readonly', navigator: 'readonly', performance: 'readonly', requestAnimationFrame: 'readonly',
    OffscreenCanvas: 'readonly', getComputedStyle: 'readonly', localStorage: 'readonly', AudioContext: 'readonly', console: 'readonly',
    setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', process: 'readonly', location: 'readonly', screen: 'readonly', matchMedia: 'readonly', history: 'readonly', URLSearchParams: 'readonly', fetch: 'readonly', OfflineAudioContext: 'readonly', Event: 'readonly', cancelAnimationFrame: 'readonly', Buffer: 'readonly', Image: 'readonly', Blob: 'readonly', URL: 'readonly' } },
  rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none' }], 'no-dupe-keys': 'error', 'no-unreachable': 'error', 'no-redeclare': 'error' },
}];
