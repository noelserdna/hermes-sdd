// Pestaña SDD (ui/sdd.js) renderizada con React en Node, con componentes y API falsos: cada sección pinta lo que debe.
// Lo lanza tests/ui.sh con REACT_DIR apuntando a un node_modules que tenga react y react-dom.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(path.join(process.env.REACT_DIR, 'x.js'))
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const src = readFileSync(new URL('../plugin/hermes-sdd/ui/sdd.js', import.meta.url), 'utf8')
const crearSDD = new Function(`${src}; return crearSDD`)()

let fallos = 0
const ok = (c, t) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if (!c) fallos++ }
const h = React.createElement
const sinTono = ({ tono, ...p }) => p
const Pagina = crearSDD({
  h, useState: React.useState, useEffect: React.useEffect, useCallback: React.useCallback,
  api: { get: () => new Promise(() => {}), post: () => new Promise(() => {}) },
  C: { Boton: p => h('button', sinTono(p)), Etiqueta: p => h('span', sinTono(p)), Campo: p => h('input', p) },
  tema: { borde: 'gray', acento: 'blue', peligro: 'red' }, avisar: () => {}, abrirRuta: () => {}, intervalo: () => () => {}
})
const { Decisiones, Proyectos, Nuevo, Configuracion } = Pagina.partes
const pinta = (c, props) => renderToStaticMarkup(h(c, props))

let html = pinta(Pagina, {})
ok(['Decisiones', 'Proyectos', '＋ Nuevo', 'Configuración'].every(s => html.includes(s)) && html.includes('SDD'), 'la pestaña SDD tiene sus cuatro secciones')

const opc = [{ verbo: 'conforme', etiqueta: '✅ Conforme' }, { verbo: 'cambios', etiqueta: '✏️ Cambiar', texto: true }]
html = pinta(Decisiones, { recargar: () => {}, datos: {
  persona: 'yo', identidad: 'andres', canal_vivo: '2026-11-10T10:00:00Z', recientes: [{ id: 'r1', estado: 'firmada', tablero: 'demo', titulo: 'Plan', resultado: 'conforme' }],
  puertas: [
    { id: 'g1', estado: 'abierta', tablero: 'recetas', titulo: 'Plan', texto: '3 FASEs', opciones: opc, paso: 1, respuestas: {}, jev_linea: '🤖 Jev recomienda: ✅ Conforme (p 0.91, modo consejo)' },
    { id: 'g2', estado: 'decidida', tablero: 'demo', titulo: 'Ruta', texto: 'x', opciones: [{ verbo: 'acepto', etiqueta: '✅ Aprobar ruta' }], puedo_deshacer: true, firmar_en: 1e9,
      decision: { verbo: 'acepto', canal: 'jev', persona: 'jev', prueba: { modo: 'auto', p: '0.950' } } }] } })
ok(html.includes('Jev recomienda') && html.includes('✅ Conforme') && html.includes('Motivo'), 'Decisiones: puerta abierta con el consejo de Jev y sus botones')
ok(html.includes('Ha decidido Jev (modo auto, p 0.950)') && html.includes('Deshacer'), 'Decisiones: decisión de Jev con Deshacer')
ok(html.includes('Últimas firmadas'), 'Decisiones: últimas firmadas')

html = pinta(Proyectos, { cargar: () => {}, irANuevo: () => {}, proys: [{ tablero: 'recetas', repo: '/u/recetas', hitos: ['requirements-v1.0'], jev: 'consejo', pausado: false }] })
ok(html.includes('recetas') && html.includes('requirements-v1.0') && html.includes('Consejo') && html.includes('Abrir carpeta') && html.includes('Nuevo proyecto'),
  'Proyectos: lista con hitos, modo de Jev, abrir carpeta y botón de nuevo')
ok(pinta(Proyectos, { cargar: () => {}, irANuevo: () => {}, proys: [] }).includes('Todavía no hay proyectos'), 'Proyectos: vacío, invita a crear el primero')

const cfg = {
  carpeta: '~/proyectos-sdd', carpeta_resuelta: '/Users/x/proyectos-sdd', carpeta_por_defecto: '~/proyectos-sdd', stack_defecto: 'web-astro',
  stacks: [{ id: 'web-vite', nombre: 'Web con Vite', descripcion: 'd1', stack: 'JS + Vite', test: 'npm test' },
           { id: 'web-astro', nombre: 'Web con Astro', descripcion: 'Web de contenido', stack: 'Astro + TS', test: 'npm test', server: 'npx astro dev' }],
  deshacer_s: 90, deshacer_rango: [10, 86400], deshacer_por_defecto: 180,
  perfil_modelos: 'equilibrado', modelos_cambiados: { implementar: 'haiku' },
  modelos: { requisitos: 'opus', implementar: 'haiku' }, perfiles: { calidad: { requisitos: 'opus', implementar: 'opus' }, equilibrado: { requisitos: 'opus', implementar: 'sonnet' }, rapido: { requisitos: 'sonnet', implementar: 'sonnet' } },
  nombres_perfil: { calidad: 'Calidad: Opus en todo', equilibrado: 'Equilibrado: Opus planifica, Sonnet programa', rapido: 'Rápido: Sonnet en todo' },
  etapas_modelo: [['requisitos', 'Requisitos'], ['implementar', 'Implementar']],
  modelos_disponibles: [{ id: 'opus', nombre: 'Opus', tipo: 'alias' }, { id: 'sonnet', nombre: 'Sonnet', tipo: 'alias' }, { id: 'haiku', nombre: 'Haiku (no para juicios)', tipo: 'alias' }, { id: 'anthropic/claude-opus-5.5', nombre: 'claude-opus-5.5', tipo: 'completo' }],
  jev: { defecto: 'humano', umbral: 0.9, piloto: ['ruta', 'plan'] }, tipos_puerta: ['requisitos', 'ruta', 'plan', 'fase', 'entrega', 'mantenimiento'] }
html = pinta(Nuevo, { cfg, alCrear: () => {} })
ok(html.includes('¿Qué quieres construir?') && html.includes('Web con Astro') && html.includes('Web de contenido') && html.includes('Lanzar'),
  'Nuevo: formulario con el stack por defecto y su descripción')
ok(html.includes('Por defecto (humano)') && html.includes('Vacía: ~/proyectos-sdd') && html.includes('AGENTS.md → stack: Astro + TS'),
  'Nuevo: Jev por defecto, carpeta por defecto y vista previa del AGENTS.md')

html = pinta(Configuracion, { cfg, setCfg: () => {} })
ok(html.includes('Carpeta por defecto') && html.includes('/Users/x/proyectos-sdd'), 'Configuración: carpeta por defecto')
ok(html.includes('Stacks') && html.includes('por defecto') && html.includes('Usar por defecto') && html.includes('Añadir stack'), 'Configuración: stacks editables')
ok(html.includes('Modo por defecto') && html.includes('umbral') && html.includes('mantenimiento'), 'Configuración: ajustes de Jev')
ok(html.includes('Modelos por etapa') && html.includes('Equilibrado') && html.includes('Implementar ✎') && html.includes('El perfil dice sonnet') && html.includes('Volver al perfil') && html.includes('claude-opus-5.5 (versión fija)'),
  'Configuración: perfil de modelos y modelo por etapa, con lo cambiado marcado')
ok(html.includes('Ventana para deshacer') && html.includes('value="90"') && html.includes('1 min 30 s'), 'Configuración: ventana para deshacer en segundos')
process.exit(fallos ? 1 : 0)
