// Plantilla del arnés (stack web-vite): reglas duras para el código que escriben los agentes. `npm run lint` (el
// `lint` del Stack Profile) la pasa y una etapa que la deja en rojo no se da por hecha. Se pueden añadir reglas;
// quitar una es una decisión de la persona.
const navegador = ['window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'console', 'URL', 'URLSearchParams',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'crypto', 'navigator', 'location', 'history',
  'HTMLElement', 'Event', 'CustomEvent', 'FormData', 'Intl', 'structuredClone', 'requestAnimationFrame', 'alert', 'confirm'];
const node = ['process', 'Buffer', '__dirname', 'globalThis'];
const globales = (xs) => Object.fromEntries(xs.map((x) => [x, 'readonly']));

export default [
  { ignores: ['dist/**', 'evidencias/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', '.sdd/**'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globales([...navegador, ...node]) },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': ['error',
        { selector: "AssignmentExpression[left.property.name='innerHTML']", message: 'innerHTML con datos abre un XSS: usa textContent o createElement' },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'insertAdjacentHTML abre un XSS: usa createElement' }],
      'no-restricted-properties': ['error', { object: 'document', property: 'write', message: 'document.write no' }],
    },
  },
  { files: ['tests/**/*.js', '*.config.js'], rules: { 'no-console': 'off' } },
];
