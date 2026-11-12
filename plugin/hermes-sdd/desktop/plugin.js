// hermes-sdd — pestaña «SDD» en Hermes Desktop. GENERADO por plugin/hermes-sdd/ui/construir.py desde ui/sdd.js: no lo edites a mano.
// Disco, sin build: ESM sin JSX. Mismo backend que el panel (dashboard/plugin_api.py → /api/plugins/hermes-sdd); decide
// como canal dashboard con la identidad del usuario de esta máquina. No firma: lo hace el notario desde el gateway.
import { createElement as h, useCallback, useEffect, useState } from 'react'
import { Badge, Button, host, Input, PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk'

const RUTA = '/sdd'
const BOTON = { principal: 'default', borde: 'outline', peligro: 'destructive', suave: 'ghost' }
const ETIQUETA = { normal: 'default', suave: 'muted', aviso: 'warn', borde: 'outline' }

// Pestaña SDD, común al panel web y a Hermes Desktop: Decisiones · Proyectos · Nuevo · Configuración.
// Este fichero no se carga tal cual: ui/construir.py lo envuelve con el adaptador de cada sitio (dashboard/dist/index.js
// y desktop/plugin.js). Recibe en E lo que cambia entre ellos: React, la API del plugin, los componentes y el tema.
// La pestaña presenta y pide; no firma nada (lo hace el notario desde el gateway).
function crearSDD(E) {
  const { h, useState, useEffect, useCallback, api, C, tema } = E
  const MODOS = [['humano', 'Humano'], ['consejo', 'Consejo'], ['piloto', 'Piloto'], ['auto', 'Auto']]
  const AYUDA_MODO = {
    humano: 'Jev no interviene: decides tú.',
    consejo: 'Jev recomienda en cada puerta; decides tú.',
    piloto: 'Jev decide las puertas de piloto (ruta y plan por defecto); el resto, tú.',
    auto: 'Jev decide cualquier puerta, FASEs y entrega incluidas. Rechazar o pedir cambios sigue siendo tuyo.'
  }
  const mensaje = e => String((e && e.message) || e)
  const duracion = s => {   // 180 → «3 min», 90 → «1 min 30 s»
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60
    return [hh && `${hh} h`, mm && `${mm} min`, ss && `${ss} s`].filter(Boolean).join(' ') || '0 s'
  }

  const S = {
    pagina: { padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: 12 },
    pestanas: { display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: `1px solid ${tema.borde}`, paddingBottom: 8 },
    tarjeta: { border: `1px solid ${tema.borde}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
    titulo: { fontWeight: 600, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    texto: { whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.45 },
    jev: { whiteSpace: 'pre-wrap', fontSize: 13, borderLeft: `2px solid ${tema.acento}`, paddingLeft: 8 },
    fila: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    meta: { fontSize: 11, opacity: 0.7 },
    error: { fontSize: 12, borderLeft: `2px solid ${tema.peligro}`, paddingLeft: 8 },
    galeria: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 },
    media: { width: '100%', borderRadius: 6, border: `1px solid ${tema.borde}` },
    etiqueta: { fontSize: 12, fontWeight: 500, display: 'flex', flexDirection: 'column', gap: 4 },
    nativo: { font: 'inherit', fontSize: 13, color: 'inherit', background: 'transparent', border: `1px solid ${tema.borde}`,
      borderRadius: 6, padding: '6px 8px', width: '100%', boxSizing: 'border-box' },
    rejilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }
  }

  // ── piezas pequeñas ──────────────────────────────────────────────────────────────────────────────────────────────
  const Error = ({ texto }) => (texto ? h('div', { style: S.error }, `⚠️ ${texto}`) : null)
  const Tarjeta = ({ titulo, children }) => h('div', { style: S.tarjeta }, titulo ? h('div', { style: S.titulo }, titulo) : null, children)
  const Campo = ({ etiqueta, ayuda, children }) =>
    h('label', { style: S.etiqueta }, etiqueta, children, ayuda ? h('span', { style: S.meta }, ayuda) : null)
  const AreaTexto = props => h('textarea', { rows: 5, ...props, style: { ...S.nativo, resize: 'vertical', ...(props.style || {}) } })
  const Selector = ({ valor, opciones, alCambiar }) =>
    h('select', { value: valor, onChange: e => alCambiar(e.target.value), style: S.nativo },
      opciones.map(([v, t]) => h('option', { key: v, value: v }, t)))

  // Una acción con su estado de ocupado y su error, para no repetirlo en cada botón
  function useAccion() {
    const [ocupado, setOcupado] = useState(false)
    const [error, setError] = useState('')
    const ejecutar = useCallback((fn, alAcabar) => {
      setOcupado(true); setError('')
      return Promise.resolve().then(fn).then(r => { if (alAcabar) alAcabar(r); return r })
        .catch(e => { setError(mensaje(e)); return null }).finally(() => setOcupado(false))
    }, [])
    return { ocupado, error, ejecutar, setError }
  }

  function ModoJev({ tablero, modo, alCambiar }) {
    const a = useAccion()
    return h('span', { style: S.fila },
      h('span', { style: S.meta }, '🤖 Jev:'),
      MODOS.map(([m, et]) => h(C.Boton, {
        key: m, tono: modo === m ? 'principal' : 'borde', disabled: a.ocupado || modo === m, title: AYUDA_MODO[m],
        onClick: () => a.ejecutar(() => api.post('/jev', { tablero, modo: m }), () => { E.avisar(`Jev en ${tablero}: ${et}`); alCambiar() })
      }, et)),
      h(Error, { texto: a.error }))
  }

  // ── Decisiones ───────────────────────────────────────────────────────────────────────────────────────────────────
  function Evidencia({ gid, nombre }) {
    const [ev, setEv] = useState(null)
    useEffect(() => {
      let vivo = true
      api.get(`/evidencia64/${gid}/${encodeURIComponent(nombre)}`).then(r => vivo && setEv(r)).catch(() => {})
      return () => { vivo = false }
    }, [gid, nombre])
    if (!ev) return h('div', { style: S.meta }, nombre)
    if (!ev.datos)
      return E.abrirRuta
        ? h(C.Boton, { tono: 'borde', onClick: () => E.abrirRuta(ev.ruta) }, `🎬 ${nombre} (abrir en el Finder)`)
        : h('div', { style: S.meta }, `🎬 ${nombre}: ${ev.ruta}`)
    return /^video\//.test(ev.mime)
      ? h('video', { src: ev.datos, controls: true, title: nombre, style: S.media })
      : h('a', { href: ev.datos, target: '_blank', rel: 'noreferrer' }, h('img', { src: ev.datos, alt: nombre, title: nombre, style: S.media }))
  }

  function Puerta({ p, recargar }) {
    const [motivo, setMotivo] = useState('')
    const a = useAccion()
    const accion = (ruta, cuerpo) => a.ejecutar(() => api.post(ruta, cuerpo), recargar)
    const escalonada = (p.opciones || []).some(o => o.paso)
    const opciones = (p.opciones || []).filter(o => o.verbo !== 'ver' && (!escalonada || (o.paso || 1) === p.paso))
    const pideMotivo = opciones.some(o => o.texto)
    const decidida = p.estado === 'decidida'
    const hijos = [h('div', { key: 't', style: S.texto }, p.texto)]

    if (p.jev_linea && !decidida) hijos.push(h('div', { key: 'j', style: S.jev }, p.jev_linea))
    if (decidida) {
      const d = p.decision || {}
      const pr = d.prueba || {}
      const etiqueta = ((p.opciones || []).find(o => o.verbo === d.verbo) || {}).etiqueta || d.verbo
      const hora = p.firmar_en ? new Date(p.firmar_en * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?'
      const quien = d.canal === 'jev'
        ? `🤖 Ha decidido Jev (modo ${pr.modo || '?'}, p ${pr.p || '?'}). Si no estás de acuerdo, deshazlo y la puerta vuelve a ti`
        : `${d.persona} desde ${d.canal}${d.texto ? ': ' + d.texto : ''}`
      hijos.push(h('div', { key: 'd', style: S.fila },
        h(C.Etiqueta, { tono: d.canal === 'jev' ? 'aviso' : 'normal' }, etiqueta),
        h('span', { style: { fontSize: 13 } }, quien),
        h('span', { style: S.meta }, `se firma a las ${hora} (lo hace el gateway)`),
        p.puedo_deshacer && h(C.Boton, { tono: 'borde', disabled: a.ocupado, onClick: () => accion(`/deshacer/${p.id}`) }, '↩ Deshacer')))
    } else {
      if ((p.evidencias || []).length && p.paso === 2)
        hijos.push(h('div', { key: 'g', style: S.galeria }, p.evidencias.map(n => h(Evidencia, { key: n, gid: p.id, nombre: n }))))
      if (escalonada && p.paso === 1)
        hijos.push(h('div', { key: 'v', style: S.fila },
          h(C.Boton, { tono: 'principal', disabled: a.ocupado, onClick: () => accion(`/ver/${p.id}`) }, '▶ Ver demo'),
          h('span', { style: S.meta }, 'Aceptar se habilita después de ver la demo')))
      if ((p.preguntas || []).length && (!escalonada || p.paso === 2))
        p.preguntas.forEach(q => hijos.push(h('div', { key: 'q' + q.n, style: S.fila },
          h('span', { style: S.meta }, `Q${q.n} (${q.id})`),
          (q.opciones || []).map(l => h(C.Boton, {
            key: l, tono: (p.respuestas || {})[String(q.n)] === l ? 'principal' : 'borde', disabled: a.ocupado,
            onClick: () => accion(`/respuesta/${p.id}`, { n: q.n, letra: l })
          }, `${l}${q.recomendada === l ? ' ★' : ''}`)))))
      if (opciones.length) {
        if (pideMotivo)
          hijos.push(h(C.Campo, {
            key: 'm', value: motivo, placeholder: 'Motivo (obligatorio para cambios, observaciones, rechazo o aceptar sin lo que falta)',
            onChange: e => setMotivo(e.target.value)
          }))
        hijos.push(h('div', { key: 'b', style: S.fila }, opciones.map(o => h(C.Boton, {
          key: o.verbo, tono: o.verbo === 'rechazo' ? 'peligro' : o.texto ? 'borde' : 'principal',
          disabled: a.ocupado || (o.texto && !motivo.trim()),
          onClick: () => accion(`/decidir/${p.id}`, { verbo: o.verbo, texto: o.texto ? motivo : '' })
        }, o.etiqueta))))
      }
    }
    hijos.push(h(Error, { key: 'e', texto: a.error }))
    hijos.push(h('div', { key: 'm2', style: S.meta }, `${p.id} · commit ${String(p.sha || '').slice(0, 7)} · creada ${p.creada}`))
    return h(Tarjeta, {
      titulo: [`🚪 ${p.titulo}`, h(C.Etiqueta, { key: 'b', tono: 'borde' }, p.tablero || 'local'),
        decidida ? h(C.Etiqueta, { key: 'd', tono: 'suave' }, 'decidida') : null]
    }, hijos)
  }

  function Decisiones({ datos, recargar }) {
    const vivo = datos.canal_vivo ? `latido del gateway ${datos.canal_vivo}` : '⚠️ sin latido del gateway: nadie firmará hasta que arranque'
    return h('div', { style: S.pagina },
      h('div', { style: S.meta }, `Decides como ${datos.persona} (${datos.identidad}) · ${vivo}`),
      datos.puertas.length
        ? datos.puertas.map(p => h(Puerta, { key: p.id, p, recargar }))
        : h(Tarjeta, null, h('div', { style: S.texto }, 'No hay puertas abiertas. Cuando una etapa necesite tu decisión aparecerá aquí y en Telegram.')),
      datos.recientes.length ? h(Tarjeta, { titulo: 'Últimas firmadas' },
        datos.recientes.map(r => h('div', { key: r.id, style: S.meta },
          `${r.estado === 'error' ? '⚠️' : '✅'} ${r.tablero} · ${r.titulo}: ${r.resultado}`))) : null)
  }

  // ── Proyectos ────────────────────────────────────────────────────────────────────────────────────────────────────
  // El encargado del proyecto (perfil sdd-p-<proyecto>): se conversa con él en el chat de Hermes; no decide puertas
  function Encargado({ x, cargar }) {
    const a = useAccion()
    if (!x.encargado)
      return h('div', { style: S.fila },
        h(C.Boton, { tono: 'borde', disabled: a.ocupado,
          onClick: () => a.ejecutar(() => api.post('/encargado', { tablero: x.tablero }), () => { E.avisar(`Encargado de ${x.tablero} listo`); cargar() }) },
          a.ocupado ? 'Creando…' : '🧭 Crear encargado'),
        h('span', { style: S.meta }, 'Un agente con quien hablar del proyecto: sabe en qué punto está, recuerda en su wiki y te aconseja. No decide puertas.'),
        h(Error, { texto: a.error }))
    return h('div', { style: S.fila },
      E.abrirChat ? h(C.Boton, { tono: 'principal', onClick: () => E.abrirChat(x.encargado) }, '💬 Hablar con el encargado') : null,
      h('span', { style: S.meta }, E.abrirChat ? `Perfil ${x.encargado} · wiki en ${x.repo}/wiki`
        : `Elige el perfil ${x.encargado} en el selector de perfiles, o en la terminal: hermes -p ${x.encargado} chat`))
  }

  function Proyectos({ proys, cargar, irANuevo }) {
    if (proys === null) return h('div', { style: S.meta }, 'Cargando proyectos…')
    return h('div', { style: S.pagina },
      h('div', { style: S.fila }, h(C.Boton, { tono: 'principal', onClick: irANuevo }, '＋ Nuevo proyecto'),
        h('span', { style: S.meta }, 'Cada proyecto tiene su tablero en el kanban y su modo de Jev.')),
      proys.length ? proys.map(x => h(Tarjeta, {
        key: x.tablero,
        titulo: [x.tablero, x.pausado ? h(C.Etiqueta, { key: 'p', tono: 'suave' }, '⏸ en pausa') : null]
      },
        h('div', { style: S.meta }, x.repo),
        h('div', { style: S.meta }, `Hitos: ${x.hitos.join(' · ') || 'sin hitos todavía'}`),
        h('div', { style: S.fila }, h(ModoJev, { tablero: x.tablero, modo: x.jev, alCambiar: cargar }),
          E.abrirRuta ? h(C.Boton, { tono: 'suave', onClick: () => E.abrirRuta(x.repo) }, '📂 Abrir carpeta') : null),
        h(Encargado, { x, cargar })))
        : h(Tarjeta, null, h('div', { style: S.texto }, 'Todavía no hay proyectos. Crea el primero con «Nuevo proyecto».')))
  }

  // ── Nuevo ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const aSlug = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  function Nuevo({ cfg, alCrear }) {
    const [nombre, setNombre] = useState('')
    const [que, setQue] = useState('')
    const [stack, setStack] = useState(cfg.stack_defecto)
    const [carpeta, setCarpeta] = useState('')
    const [jev, setJev] = useState('')
    const [ruta, setRuta] = useState('')
    const [hecho, setHecho] = useState(null)
    const a = useAccion()
    const st = cfg.stacks.find(s => s.id === stack) || cfg.stacks[0]
    const tablero = aSlug(nombre)
    const base = carpeta.trim() || cfg.carpeta
    const listo = tablero.length >= 2 && que.trim().length >= 20

    if (hecho && hecho.preparando)
      return h('div', { style: S.pagina }, h(Tarjeta, { titulo: `🧭 Proyecto ${hecho.tablero} preparado (sin lanzar)` },
        h('div', { style: S.texto }, `Carpeta: ${hecho.repo}\nStack: ${hecho.stack} · Encargado: ${hecho.encargado}`),
        h('div', { style: S.texto }, 'Habla con su encargado: pásale lo que tengas (documentos, requisitos casi listos, capturas, enlaces), te preguntará lo que falte con opciones y la que recomienda primero, y cuando le digas «lanza» arrancará con todo eso. También desde Telegram: /encargado ' + hecho.tablero),
        h('div', { style: S.fila },
          E.abrirChat ? h(C.Boton, { tono: 'principal', onClick: () => E.abrirChat(hecho.encargado) }, '💬 Hablar con el encargado') : null,
          h(C.Boton, { tono: 'borde', onClick: () => { setHecho(null); setNombre(''); setQue('') } }, 'Crear otro'))))

    if (hecho)
      return h('div', { style: S.pagina }, h(Tarjeta, { titulo: `✅ Proyecto ${hecho.tablero} en marcha` },
        h('div', { style: S.texto }, `Carpeta: ${hecho.repo}\nStack: ${hecho.stack} · Jev: ${hecho.jev} · Ruta recomendada: ${nombreRuta(cfg, hecho.ruta)}\n${hecho.salida || ''}`),
        h('div', { style: S.texto }, 'El ejecutor está escribiendo los requisitos a partir de lo que pediste. Cuando acabe te llegará la primera puerta (Requisitos) aquí, en Decisiones, y por Telegram.'),
        h('div', { style: S.fila },
          h(C.Boton, { tono: 'principal', onClick: () => { setHecho(null); setNombre(''); setQue('') } }, 'Crear otro'),
          E.abrirRuta ? h(C.Boton, { tono: 'borde', onClick: () => E.abrirRuta(hecho.repo) }, '📂 Abrir carpeta') : null)))

    return h('div', { style: S.pagina }, h(Tarjeta, { titulo: '＋ Nuevo proyecto' },
      h(Campo, { etiqueta: 'Nombre', ayuda: tablero ? `Tablero «${tablero}» · carpeta ${base.replace(/\/+$/, '')}/${tablero}` : 'Por ejemplo: bogota, recetas, tienda' },
        h(C.Campo, { value: nombre, placeholder: 'bogota', onChange: e => setNombre(e.target.value) })),
      h(Campo, { etiqueta: '¿Qué quieres construir?', ayuda: 'Con tus palabras. Se guarda tal cual en intent/INT-001.md y de ahí salen los requisitos que aprobarás.' },
        h(AreaTexto, { value: que, placeholder: 'Una web para turistas que visitan Bogotá: barrios, qué ver en cada uno, cómo moverse…', onChange: e => setQue(e.target.value) })),
      h('div', { style: S.rejilla },
        h(Campo, { etiqueta: 'Stack', ayuda: st ? st.descripcion : '' },
          h(Selector, { valor: stack, opciones: cfg.stacks.map(s => [s.id, s.nombre]), alCambiar: setStack })),
        h(Campo, { etiqueta: 'Jev en este proyecto', ayuda: jev ? AYUDA_MODO[jev] : `El de por defecto (${cfg.jev.defecto}).` },
          h(Selector, { valor: jev, opciones: [['', `Por defecto (${cfg.jev.defecto})`], ...MODOS], alCambiar: setJev })),
        h(Campo, {
          etiqueta: 'Ruta', ayuda: ruta ? ((cfg.rutas || []).find(r => r.id === ruta) || {}).descripcion
            : 'Se elige en la puerta de ruta (tú o Jev), tras aprobar los requisitos. Si fijas una, será la recomendada.'
        }, h(Selector, { valor: ruta, opciones: [['', `La decide la puerta (recomendada: ${nombreRuta(cfg, cfg.ruta_defecto)})`], ...(cfg.rutas || []).map(r => [r.id, r.nombre])], alCambiar: setRuta })),
        h(Campo, { etiqueta: 'Carpeta (opcional)', ayuda: `Vacía: ${cfg.carpeta}` },
          h(C.Campo, { value: carpeta, placeholder: cfg.carpeta, onChange: e => setCarpeta(e.target.value) }))),
      st ? h('div', { style: S.meta }, `AGENTS.md → stack: ${st.stack} · test: ${st.test}${st.server ? ' · server: ' + st.server : ''}`) : null,
      h('div', { style: S.fila },
        h(C.Boton, {
          tono: 'principal', disabled: !listo || a.ocupado,
          onClick: () => a.ejecutar(() => api.post('/nuevo', { nombre, que, stack, carpeta: carpeta.trim(), jev, ruta }), r => { setHecho(r); alCrear() })
        }, a.ocupado ? 'Creando…' : '🚀 Lanzar'),
        h(C.Boton, {
          tono: 'borde', disabled: !listo || a.ocupado,
          onClick: () => a.ejecutar(() => api.post('/nuevo', { nombre, que, stack, carpeta: carpeta.trim(), jev, ruta, preparar: true }), r => { setHecho(r); alCrear() })
        }, '🧭 Preparar con el encargado'),
        h('span', { style: S.meta }, listo ? 'Lanzar: arranca ya con esta frase. Preparar: antes le pasas a su encargado documentos o requisitos casi listos y te pregunta lo que falte.' : 'Pon un nombre y una frase de lo que quieres.')),
      h(Error, { texto: a.error })))
  }

  // ── Configuración ────────────────────────────────────────────────────────────────────────────────────────────────
  const STACK_VACIO = { id: '', nombre: '', descripcion: '', stack: '', test: '', test_file: '', code_paths: 'src/', test_paths: 'tests/', server: '', port: '' }
  const CAMPOS = [['id', 'Id (minúsculas y guiones)'], ['nombre', 'Nombre'], ['descripcion', 'Descripción'], ['stack', 'Stack (lenguaje y framework)'],
    ['test', 'Comando de los tests'], ['test_file', 'Tests de un fichero (con {file})'], ['code_paths', 'Carpeta del código'],
    ['test_paths', 'Carpeta de los tests'], ['server', 'Servidor para la demo (opcional)'], ['port', 'Puerto (opcional)']]

  function EditorStack({ inicial, esNuevo, alGuardar, alBorrar, alCancelar, ocupado }) {
    const [s, setS] = useState(inicial)
    return h('div', { style: { ...S.tarjeta, borderStyle: 'dashed' } },
      h('div', { style: S.rejilla }, CAMPOS.map(([k, et]) => h(Campo, { key: k, etiqueta: et },
        h(C.Campo, { value: s[k] || '', disabled: k === 'id' && !esNuevo, onChange: e => setS({ ...s, [k]: e.target.value }) })))),
      h('div', { style: S.fila },
        h(C.Boton, { tono: 'principal', disabled: ocupado, onClick: () => alGuardar(s) }, 'Guardar stack'),
        h(C.Boton, { tono: 'suave', disabled: ocupado, onClick: alCancelar }, 'Cancelar'),
        !esNuevo ? h(C.Boton, { tono: 'peligro', disabled: ocupado, onClick: () => alBorrar(s.id) }, 'Borrar') : null))
  }

  // Rutas: qué etapas extra del método se hacen. «auto» = las que proponga el método para cada proyecto
  const nombreRuta = (cfg, id) => ((cfg.rutas || []).find(r => r.id === id) || {}).nombre || id || '—'
  const RUTA_VACIA = { id: '', nombre: '', descripcion: '', etapas: [], granularidad: 'auto' }
  const GRANULARIDADES = cfg => cfg.granularidades || [['auto', 'Según el tamaño del proyecto'], ['compacta', 'Compacta'], ['normal', 'Normal'], ['fina', 'Fina']]
  const nombreGran = (cfg, g) => (Object.fromEntries(GRANULARIDADES(cfg))[g || 'auto'] || g).split(':')[0]

  function EditorRuta({ cfg, inicial, esNuevo, etapas, alGuardar, alBorrar, alCancelar, ocupado, puedeBorrar }) {
    const [r, setR] = useState(inicial)
    const auto = r.etapas === 'auto'
    const lista = auto ? [] : r.etapas
    const alternar = k => setR({ ...r, etapas: lista.includes(k) ? lista.filter(x => x !== k) : [...lista, k] })
    return h('div', { style: { ...S.tarjeta, borderStyle: 'dashed' } },
      h('div', { style: S.rejilla },
        h(Campo, { etiqueta: 'Id (minúsculas y guiones)' }, h(C.Campo, { value: r.id, disabled: !esNuevo, onChange: e => setR({ ...r, id: e.target.value }) })),
        h(Campo, { etiqueta: 'Nombre' }, h(C.Campo, { value: r.nombre, onChange: e => setR({ ...r, nombre: e.target.value }) })),
        h(Campo, { etiqueta: 'Para qué sirve (lo lee Jev para elegir)' }, h(C.Campo, { value: r.descripcion, onChange: e => setR({ ...r, descripcion: e.target.value }) }))),
      h(Campo, { etiqueta: 'Fases y tareas', ayuda: 'Compacta: una fase, pocas tareas y una sola puerta de aceptación (proyectos pequeños). Según el tamaño: compacta si el proyecto es pequeño, normal si no.' },
        h(Selector, { valor: r.granularidad || 'auto', opciones: GRANULARIDADES(cfg), alCambiar: g => setR({ ...r, granularidad: g }) })),
      h(Campo, { etiqueta: 'Pasos extra, además de requisitos → plan → programación → aceptación' },
        h('span', { style: S.fila },
          h(C.Boton, { tono: auto ? 'principal' : 'borde', disabled: ocupado, onClick: () => setR({ ...r, etapas: auto ? [] : 'auto' }) }, '✨ Los que proponga el método'),
          etapas.map(([k, nombre]) => h(C.Boton, { key: k, tono: lista.includes(k) ? 'principal' : 'borde', disabled: ocupado || auto, onClick: () => alternar(k) }, nombre)))),
      h('div', { style: S.fila },
        h(C.Boton, { tono: 'principal', disabled: ocupado || !r.id || !r.nombre, onClick: () => alGuardar(r) }, 'Guardar ruta'),
        h(C.Boton, { tono: 'suave', disabled: ocupado, onClick: alCancelar }, 'Cancelar'),
        !esNuevo && puedeBorrar ? h(C.Boton, { tono: 'peligro', disabled: ocupado, onClick: () => alBorrar(r.id) }, 'Borrar') : null))
  }

  function Rutas({ cfg, guardar, ocupado }) {
    const [editando, setEditando] = useState(null)   // id de la ruta, o '+' para una nueva
    const rutas = cfg.rutas || []
    const etapas = cfg.etapas_ruta || []
    const nombres = Object.fromEntries(etapas)
    const g = (cuerpo, aviso) => { guardar(cuerpo, aviso); setEditando(null) }
    const sin = id => rutas.filter(r => r.id !== id)
    return h(Tarjeta, { titulo: '🧭 Rutas' },
      h('div', { style: S.meta }, 'Qué pasos extra del método se hacen en un proyecto. En la puerta de ruta salen todas como botones y la decide quien decida esa puerta (tú o Jev); la recomendada es la que fijes al crear el proyecto o, si no, la de por defecto.'),
      rutas.map(r => editando === r.id
        ? h(EditorRuta, {
          key: r.id, cfg, inicial: r, esNuevo: false, etapas, ocupado, puedeBorrar: rutas.length > 1, alCancelar: () => setEditando(null),
          alGuardar: n => g({ rutas: rutas.map(x => (x.id === r.id ? n : x)) }, `Ruta ${n.nombre} guardada`),
          alBorrar: id => g({ rutas: sin(id) }, `Ruta ${r.nombre} borrada`)
        })
        : h('div', { key: r.id, style: S.fila },
          h('strong', { style: { fontSize: 13 } }, r.nombre),
          r.id === cfg.ruta_defecto ? h(C.Etiqueta, { tono: 'normal' }, 'por defecto') : null,
          h('span', { style: S.meta }, `${r.descripcion} → ${r.etapas === 'auto' ? 'los pasos que proponga el método' : (r.etapas.map(k => nombres[k] || k).join(', ') || 'sin pasos extra')} · fases: ${nombreGran(cfg, r.granularidad).toLowerCase()}`),
          h(C.Boton, { tono: 'suave', disabled: ocupado, onClick: () => setEditando(r.id) }, 'Editar'),
          r.id !== cfg.ruta_defecto ? h(C.Boton, { tono: 'suave', disabled: ocupado, onClick: () => guardar({ ruta_defecto: r.id }, `${r.nombre}: ruta por defecto`) }, 'Usar por defecto') : null)),
      editando === '+'
        ? h(EditorRuta, { cfg, inicial: RUTA_VACIA, esNuevo: true, etapas, ocupado, alCancelar: () => setEditando(null), alGuardar: n => g({ rutas: [...rutas, n] }, `Ruta ${n.nombre} añadida`) })
        : h('div', { style: S.fila },
          h(C.Boton, { tono: 'borde', disabled: ocupado, onClick: () => setEditando('+') }, '＋ Añadir ruta'),
          h(C.Boton, { tono: 'suave', disabled: ocupado, onClick: () => g({ rutas: cfg.rutas_por_defecto }, 'Rutas como venían') }, 'Restaurar las de serie')))
  }

  // Modelos por etapa: un perfil (Calidad, Equilibrado, Rápido) y, encima, lo que cambies etapa a etapa
  function Modelos({ cfg, guardar, ocupado }) {
    const cambiados = cfg.modelos_cambiados || {}
    const opciones = m => {
      const ops = (cfg.modelos_disponibles || []).map(o => [o.id, o.tipo === 'alias' ? o.nombre : `${o.nombre} (versión fija)`])
      return ops.some(([id]) => id === m) ? ops : [[m, m], ...ops]
    }
    return h(Tarjeta, { titulo: '🧠 Modelos por etapa' },
      h('div', { style: S.meta }, 'Qué modelo hace cada etapa en los proyectos que no fijan uno propio. Fable, Opus, Sonnet y Haiku son siempre el último de cada familia; una «versión fija» no cambia aunque salga otra.'),
      h('div', { style: S.fila }, Object.keys(cfg.perfiles || {}).map(p => h(C.Boton, {
        key: p, tono: cfg.perfil_modelos === p && !Object.keys(cambiados).length ? 'principal' : 'borde', disabled: ocupado,
        title: (cfg.nombres_perfil || {})[p], onClick: () => guardar({ perfil_modelos: p }, `Modelos: ${(cfg.nombres_perfil || {})[p]}`)
      }, ((cfg.nombres_perfil || {})[p] || p).split(':')[0]))),
      h('div', { style: S.meta }, `${(cfg.nombres_perfil || {})[cfg.perfil_modelos] || cfg.perfil_modelos}${Object.keys(cambiados).length ? ` · con ${Object.keys(cambiados).length} etapa(s) cambiada(s)` : ''}`),
      h('div', { style: S.rejilla }, (cfg.etapas_modelo || []).map(([e, nombre]) => h(Campo, {
        key: e, etiqueta: `${nombre}${cambiados[e] ? ' ✎' : ''}`,
        ayuda: cambiados[e] ? `El perfil dice ${cfg.perfiles[cfg.perfil_modelos][e]}` : null
      }, h(Selector, {
        valor: cfg.modelos[e], opciones: opciones(cfg.modelos[e]),
        alCambiar: m => guardar({ modelos: { ...cambiados, [e]: m === cfg.perfiles[cfg.perfil_modelos][e] ? '' : m } }, `${nombre}: ${m}`)
      })))),
      Object.keys(cambiados).length
        ? h('div', { style: S.fila }, h(C.Boton, { tono: 'borde', disabled: ocupado, onClick: () => guardar({ modelos: {} }, 'Modelos: como dice el perfil') }, 'Volver al perfil'))
        : null,
      h('div', { style: S.meta }, 'Un proyecto puede fijar el suyo en .sdd/hermes/hermes-sdd.json → modelos; ese manda sobre esto.'))
  }

  function Ventana({ etiqueta, clave, valor, defecto, minS, maxS, guardar, ocupado }) {
    const [texto, setTexto] = useState(String(valor))
    const s = Number(texto)
    const valido = Number.isInteger(s) && s >= minS && s <= maxS
    return h(Campo, {
      etiqueta,
      ayuda: valido ? `${duracion(s)}. Por defecto, ${defecto} s.` : `Un número entero de segundos, entre ${minS} y ${maxS}.`
    },
      h('span', { style: S.fila },
        h(C.Campo, { value: texto, onChange: e => setTexto(e.target.value.trim()), style: { maxWidth: 120 } }),
        h(C.Boton, {
          tono: 'principal', disabled: ocupado || !valido || s === valor,
          onClick: () => guardar({ [clave]: s }, `${etiqueta}: ${duracion(s)} para deshacer`)
        }, 'Guardar')))
  }

  function Configuracion({ cfg, setCfg }) {
    const [carpeta, setCarpeta] = useState(cfg.carpeta)
    const [editando, setEditando] = useState(null)   // id del stack, o '+' para uno nuevo
    const [umbral, setUmbral] = useState(String(cfg.jev.umbral))
    const [umbralAuto, setUmbralAuto] = useState(String(cfg.jev.umbral_auto ?? cfg.jev.umbral))
    const [minS, maxS] = cfg.deshacer_rango || [10, 86400]
    const a = useAccion()
    const guardar = (cuerpo, aviso) => a.ejecutar(() => api.post('/config', cuerpo), r => { setCfg(r); setEditando(null); E.avisar(aviso) })
    const jev = (cuerpo, aviso) => a.ejecutar(() => api.post('/jev/ajustes', cuerpo), j => { setCfg({ ...cfg, jev: j }); E.avisar(aviso) })
    const stacksSin = id => cfg.stacks.filter(s => s.id !== id)

    return h('div', { style: S.pagina },
      h(Error, { texto: a.error }),
      h(Tarjeta, { titulo: '📁 Dónde se crean los proyectos' },
        h(Campo, { etiqueta: 'Carpeta por defecto', ayuda: `Cada proyecto nuevo va a <carpeta>/<nombre> si no eliges otra al crearlo. Ahora: ${cfg.carpeta_resuelta}` },
          h(C.Campo, { value: carpeta, placeholder: cfg.carpeta_por_defecto, onChange: e => setCarpeta(e.target.value) })),
        h('div', { style: S.fila }, h(C.Boton, {
          tono: 'principal', disabled: a.ocupado || carpeta === cfg.carpeta,
          onClick: () => guardar({ carpeta }, 'Carpeta por defecto guardada')
        }, 'Guardar carpeta'))),
      h(Tarjeta, { titulo: '⏱ Ventana para deshacer' },
        h('div', { style: S.meta }, 'Segundos desde que se decide hasta que el notario firma. Durante ese tiempo la decisión se puede deshacer; después se firma y ya no. Se aplica a las decisiones nuevas.'),
        h('div', { style: S.rejilla },
          h(Ventana, { etiqueta: 'Tus decisiones', clave: 'deshacer_s', valor: cfg.deshacer_s, defecto: cfg.deshacer_por_defecto, minS, maxS, guardar, ocupado: a.ocupado }),
          h(Ventana, { etiqueta: 'Las de Jev (piloto y auto)', clave: 'deshacer_jev_s', valor: cfg.deshacer_jev_s, defecto: cfg.deshacer_jev_por_defecto, minS, maxS, guardar, ocupado: a.ocupado }))),
      h(Rutas, { cfg, guardar, ocupado: a.ocupado }),
      h(Modelos, { cfg, guardar, ocupado: a.ocupado }),
      h(Tarjeta, { titulo: '🧱 Stacks' },
        h('div', { style: S.meta }, 'Lo que elijas al crear un proyecto se escribe en su AGENTS.md (SDD Stack Profile): el ejecutor construye con ese stack y ejecuta esos tests.'),
        cfg.stacks.map(s => editando === s.id
          ? h(EditorStack, {
            key: s.id, inicial: { ...STACK_VACIO, ...s }, esNuevo: false, ocupado: a.ocupado, alCancelar: () => setEditando(null),
            alGuardar: n => guardar({ stacks: cfg.stacks.map(x => (x.id === s.id ? n : x)) }, `Stack ${n.id} guardado`),
            alBorrar: id => guardar({ stacks: stacksSin(id), stack_defecto: cfg.stack_defecto === id ? stacksSin(id)[0]?.id : cfg.stack_defecto }, `Stack ${id} borrado`)
          })
          : h('div', { key: s.id, style: S.fila },
            h('strong', { style: { fontSize: 13 } }, s.nombre),
            s.id === cfg.stack_defecto ? h(C.Etiqueta, { tono: 'normal' }, 'por defecto') : null,
            h('span', { style: S.meta }, `${s.stack} · ${s.test}`),
            h(C.Boton, { tono: 'suave', disabled: a.ocupado, onClick: () => setEditando(s.id) }, 'Editar'),
            s.id !== cfg.stack_defecto ? h(C.Boton, { tono: 'suave', disabled: a.ocupado, onClick: () => guardar({ stack_defecto: s.id }, `${s.nombre}: stack por defecto`) }, 'Usar por defecto') : null)),
        editando === '+'
          ? h(EditorStack, {
            inicial: STACK_VACIO, esNuevo: true, ocupado: a.ocupado, alCancelar: () => setEditando(null),
            alGuardar: n => guardar({ stacks: [...cfg.stacks, n] }, `Stack ${n.id} añadido`)
          })
          : h('div', { style: S.fila }, h(C.Boton, { tono: 'borde', disabled: a.ocupado, onClick: () => setEditando('+') }, '＋ Añadir stack'))),
      h(Tarjeta, { titulo: '🤖 Jev' },
        h('div', { style: S.meta }, 'El modo de cada proyecto se cambia en Proyectos. Aquí, lo que vale para todos.'),
        h(Campo, { etiqueta: 'Modo por defecto', ayuda: AYUDA_MODO[cfg.jev.defecto] },
          h('span', { style: S.fila }, MODOS.map(([m, et]) => h(C.Boton, {
            key: m, tono: cfg.jev.defecto === m ? 'principal' : 'borde', disabled: a.ocupado || cfg.jev.defecto === m,
            onClick: () => jev({ defecto: m }, `Jev por defecto: ${et}`)
          }, et)))),
        h(Campo, { etiqueta: 'Seguridad mínima para que Jev decida (umbral)', ayuda: 'Entre 0.5 y 1. Por debajo, la puerta queda para una persona.' },
          h('span', { style: S.fila },
            h(C.Campo, { value: umbral, onChange: e => setUmbral(e.target.value), style: { maxWidth: 100 } }),
            h(C.Boton, { tono: 'borde', disabled: a.ocupado || umbral === String(cfg.jev.umbral), onClick: () => jev({ umbral: Number(umbral) }, `Umbral: ${umbral}`) }, 'Guardar'))),
        h(Campo, { etiqueta: 'Umbral en modo auto', ayuda: 'En auto delegaste la decisión: Jev puede decidir con algo menos de seguridad. Entre 0.5 y 1.' },
          h('span', { style: S.fila },
            h(C.Campo, { value: umbralAuto, onChange: e => setUmbralAuto(e.target.value), style: { maxWidth: 100 } }),
            h(C.Boton, { tono: 'borde', disabled: a.ocupado || umbralAuto === String(cfg.jev.umbral_auto ?? cfg.jev.umbral), onClick: () => jev({ umbral_auto: Number(umbralAuto) }, `Umbral en auto: ${umbralAuto}`) }, 'Guardar'))),
        h(Campo, { etiqueta: 'En modo piloto, Jev decide las puertas de…' },
          h('span', { style: S.fila }, cfg.tipos_puerta.map(t => {
            const on = cfg.jev.piloto.includes(t)
            return h(C.Boton, {
              key: t, tono: on ? 'principal' : 'borde', disabled: a.ocupado,
              onClick: () => jev({ piloto: on ? cfg.jev.piloto.filter(x => x !== t) : [...cfg.jev.piloto, t] }, `Piloto: ${t} ${on ? 'para ti' : 'para Jev'}`)
            }, t)
          })))))
  }

  // ── la página ────────────────────────────────────────────────────────────────────────────────────────────────────
  const SECCIONES = [['decisiones', 'Decisiones'], ['proyectos', 'Proyectos'], ['nuevo', '＋ Nuevo'], ['config', 'Configuración']]

  function Pagina() {
    const [seccion, setSeccion] = useState('decisiones')
    const [datos, setDatos] = useState(null)
    const [proys, setProys] = useState(null)
    const [cfg, setCfg] = useState(null)
    const [error, setError] = useState('')
    const recargar = useCallback(() =>
      api.get('/puertas').then(d => { setDatos(d); setError('') }).catch(e => setError(mensaje(e))), [])
    const cargarProys = useCallback(() => api.get('/proyectos').then(d => setProys(d.proyectos || [])).catch(() => setProys([])), [])
    const cargarCfg = useCallback(() => api.get('/config').then(setCfg).catch(e => setError(mensaje(e))), [])
    useEffect(() => { recargar(); cargarProys(); cargarCfg(); return E.intervalo(recargar, 5000) }, [recargar, cargarProys, cargarCfg])

    const abiertas = datos ? datos.puertas.filter(p => p.estado === 'abierta').length : 0
    const cabecera = h('div', { style: S.pestanas }, SECCIONES.map(([id, et]) => h(C.Boton, {
      key: id, tono: seccion === id ? 'principal' : 'suave', onClick: () => setSeccion(id)
    }, id === 'decisiones' && abiertas ? `${et} (${abiertas})` : et)))

    let cuerpo
    if (error && !datos)
      cuerpo = h(Tarjeta, { titulo: 'No puedo hablar con el plugin hermes-sdd' }, h(Error, { texto: error }),
        h('div', { style: S.meta }, 'Comprueba que está activo (hermes plugins enable hermes-sdd) y reinicia el gateway y el panel.'))
    else if (seccion === 'decisiones') cuerpo = datos ? h(Decisiones, { datos, recargar }) : h('div', { style: S.meta }, 'Cargando puertas…')
    else if (seccion === 'proyectos') cuerpo = h(Proyectos, { proys, cargar: cargarProys, irANuevo: () => setSeccion('nuevo') })
    else if (!cfg) cuerpo = h('div', { style: S.meta }, 'Cargando configuración…')
    else if (seccion === 'nuevo') cuerpo = h(Nuevo, { cfg, alCrear: cargarProys })
    else cuerpo = h(Configuracion, { cfg, setCfg })

    return h('div', { style: { ...S.pagina, padding: E.relleno || 0 } }, h('div', { style: S.titulo }, '🛡 SDD'), cabecera, cuerpo)
  }
  Pagina.partes = { Decisiones, Proyectos, Nuevo, Configuracion }   // para tests/ui.sh
  return Pagina
}

export default {
  id: 'hermes-sdd',
  name: 'SDD',
  register(ctx) {
    const Pagina = crearSDD({
      h, useState, useEffect, useCallback,
      api: {
        get: ruta => ctx.rest(ruta),
        post: (ruta, cuerpo) => ctx.rest(ruta, { method: 'POST', body: cuerpo || {}, timeoutMs: 330000 })
      },
      C: {
        Boton: ({ tono, ...p }) => h(Button, { size: 'sm', variant: BOTON[tono] || 'default', ...p }),
        Etiqueta: ({ tono, ...p }) => h(Badge, { variant: ETIQUETA[tono] || 'default', ...p }),
        Campo: p => h(Input, p)
      },
      tema: { borde: 'var(--ui-stroke-secondary)', acento: 'var(--ui-accent)', peligro: 'var(--ui-text-primary)' },
      avisar: m => host.notify({ kind: 'info', message: m }),
      abrirRuta: ruta => ctx.os.revealPath(ruta),
      abrirChat: null,   // Desktop: el chat de otro perfil se abre desde su selector de perfiles
      intervalo: (fn, ms) => ctx.setInterval(fn, ms),   // se limpia solo al desactivar o recargar el plugin
      relleno: '16px 20px'
    })
    ctx.registerMany([
      { id: 'page', area: ROUTES_AREA, data: { path: RUTA }, render: () => h(Pagina, {}) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: RUTA, label: 'SDD', codicon: 'shield' } },
      { id: 'open', area: PALETTE_AREA,
        data: { id: 'hermes-sdd.open', label: 'Abrir SDD (puertas, proyectos, nuevo proyecto)', keywords: ['sdd', 'puertas', 'nuevo', 'proyecto', 'jev'], run: () => host.navigate(RUTA) } }
    ])
  }
}
