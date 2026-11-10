// hermes-sdd — pestaña «Puertas SDD» en Hermes Desktop (la misma que en el panel web, con el SDK de la app).
// Disco, sin build: ESM sin JSX. Habla con el mismo backend que el panel (dashboard/plugin_api.py → /api/plugins/hermes-sdd)
// y decide como canal dashboard (identidad: el usuario de esta máquina). No firma: lo hace el notario desde el gateway.
import { createElement as h, useCallback, useEffect, useState } from 'react'
import {
  Badge,
  Button,
  EmptyState,
  host,
  Input,
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA
} from '@hermes/plugin-sdk'

const RUTA = '/puertas-sdd'
const MODOS = [['humano', 'Humano'], ['consejo', 'Consejo'], ['piloto', 'Piloto'], ['auto', 'Auto']]

// Estilos con las variables del tema (nada de colores fijos): la pestaña se adapta a cualquier tema de la app
const S = {
  pagina: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', height: '100%' },
  tarjeta: { border: '1px solid var(--ui-stroke-secondary)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  titulo: { fontWeight: 600, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  texto: { whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.45, color: 'var(--ui-text-secondary)' },
  jev: { whiteSpace: 'pre-wrap', fontSize: 13, borderLeft: '2px solid var(--ui-accent)', paddingLeft: 8 },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  meta: { fontSize: 11, color: 'var(--ui-text-tertiary)' },
  error: { fontSize: 12, color: 'var(--ui-text-primary)', borderLeft: '2px solid var(--ui-stroke-secondary)', paddingLeft: 8 },
  galeria: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 },
  media: { width: '100%', borderRadius: 6, border: '1px solid var(--ui-stroke-secondary)' }
}

const mensaje = e => String((e && e.message) || e)

function crearPagina(ctx) {
  const post = (ruta, cuerpo) => ctx.rest(ruta, { method: 'POST', body: cuerpo || {} })

  // Las capturas llegan como data URL; un vídeo grande, solo con su ruta (se abre en el Finder)
  function Evidencia({ gid, nombre }) {
    const [ev, setEv] = useState(null)
    useEffect(() => {
      let vivo = true
      ctx.rest(`/evidencia64/${gid}/${encodeURIComponent(nombre)}`).then(r => vivo && setEv(r)).catch(() => {})
      return () => { vivo = false }
    }, [gid, nombre])
    if (!ev) return h('div', { style: S.meta }, nombre)
    if (!ev.datos)
      return h(Button, { size: 'sm', variant: 'outline', onClick: () => ctx.os.revealPath(ev.ruta) }, `🎬 ${nombre} (abrir en el Finder)`)
    return /^video\//.test(ev.mime)
      ? h('video', { src: ev.datos, controls: true, title: nombre, style: S.media })
      : h('img', { src: ev.datos, alt: nombre, title: nombre, style: S.media })
  }

  function ModoJev({ tablero, modo, alCambiar }) {
    const [ocupado, setOcupado] = useState(false)
    return h('span', { style: S.fila },
      h('span', { style: S.meta }, '🤖 Jev:'),
      MODOS.map(([m, et]) => h(Button, {
        key: m, size: 'xs', variant: modo === m ? 'default' : 'outline', disabled: ocupado || modo === m,
        title: m === 'auto' ? 'Jev decide cualquier puerta, FASEs y entrega incluidas' : undefined,
        onClick: () => {
          setOcupado(true)
          post('/jev', { tablero, modo: m })
            .then(() => { host.notify({ kind: 'info', message: `Jev en ${tablero}: ${et}` }); alCambiar() })
            .catch(e => host.notify({ kind: 'error', message: mensaje(e) }))
            .finally(() => setOcupado(false))
        }
      }, et)))
  }

  function Puerta({ p, recargar }) {
    const [motivo, setMotivo] = useState('')
    const [error, setError] = useState('')
    const [ocupado, setOcupado] = useState(false)
    const accion = useCallback((ruta, cuerpo) => {
      setOcupado(true); setError('')
      post(ruta, cuerpo).then(recargar).catch(e => setError(mensaje(e))).finally(() => setOcupado(false))
    }, [recargar])

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
        h(Badge, { variant: d.canal === 'jev' ? 'warn' : 'default' }, etiqueta),
        h('span', { style: { fontSize: 13 } }, quien),
        h('span', { style: S.meta }, `se firma a las ${hora} (lo hace el gateway)`),
        p.puedo_deshacer && h(Button, { size: 'sm', variant: 'outline', disabled: ocupado, onClick: () => accion(`/deshacer/${p.id}`) }, '↩ Deshacer')))
    } else {
      if ((p.evidencias || []).length && p.paso === 2)
        hijos.push(h('div', { key: 'g', style: S.galeria }, p.evidencias.map(n => h(Evidencia, { key: n, gid: p.id, nombre: n }))))
      if (escalonada && p.paso === 1)
        hijos.push(h('div', { key: 'v', style: S.fila },
          h(Button, { disabled: ocupado, onClick: () => accion(`/ver/${p.id}`) }, '▶ Ver demo'),
          h('span', { style: S.meta }, 'Aceptar se habilita después de ver la demo')))
      if ((p.preguntas || []).length && (!escalonada || p.paso === 2))
        p.preguntas.forEach(q => hijos.push(h('div', { key: 'q' + q.n, style: S.fila },
          h('span', { style: S.meta }, `Q${q.n} (${q.id})`),
          (q.opciones || []).map(l => h(Button, {
            key: l, size: 'xs', variant: (p.respuestas || {})[String(q.n)] === l ? 'default' : 'outline', disabled: ocupado,
            onClick: () => accion(`/respuesta/${p.id}`, { n: q.n, letra: l })
          }, `${l}${q.recomendada === l ? ' ★' : ''}`)))))
      if (opciones.length) {
        if (pideMotivo)
          hijos.push(h(Input, {
            key: 'm', value: motivo, placeholder: 'Motivo (obligatorio para cambios, observaciones o rechazo)',
            onChange: e => setMotivo(e.target.value)
          }))
        hijos.push(h('div', { key: 'b', style: S.fila }, opciones.map(o => h(Button, {
          key: o.verbo, size: 'sm', variant: o.verbo === 'rechazo' ? 'destructive' : o.texto ? 'outline' : 'default',
          disabled: ocupado || (o.texto && !motivo.trim()),
          onClick: () => accion(`/decidir/${p.id}`, { verbo: o.verbo, texto: o.texto ? motivo : '' })
        }, o.etiqueta))))
      }
    }
    if (error) hijos.push(h('div', { key: 'e', style: S.error }, `⚠️ ${error}`))
    hijos.push(h('div', { key: 'm2', style: S.meta }, `${p.id} · commit ${String(p.sha || '').slice(0, 7)} · creada ${p.creada}`))

    return h('div', { style: S.tarjeta },
      h('div', { style: S.titulo }, `🚪 ${p.titulo}`, h(Badge, { variant: 'outline' }, p.tablero || 'local'),
        decidida ? h(Badge, { variant: 'muted' }, 'decidida') : null),
      ...hijos)
  }

  return function Pagina() {
    const [datos, setDatos] = useState(null)
    const [error, setError] = useState('')
    const [proys, setProys] = useState([])
    const recargar = useCallback(() =>
      ctx.rest('/puertas').then(d => { setDatos(d); setError('') }).catch(e => setError(mensaje(e))), [])
    const cargarProys = useCallback(() =>
      ctx.rest('/proyectos').then(d => setProys(d.proyectos || [])).catch(() => {}), [])
    useEffect(() => {
      recargar(); cargarProys()
      return ctx.setInterval(recargar, 5000)   // temporizador del plugin: se limpia al desactivarlo o recargarlo
    }, [recargar, cargarProys])

    if (error)
      return h('div', { style: S.pagina },
        h(EmptyState, { title: 'No puedo leer las puertas', description: error }),
        h('div', { style: S.meta }, 'Comprueba que el plugin hermes-sdd está activo en este perfil (hermes plugins enable hermes-sdd) y reinicia el gateway.'))
    if (!datos) return h('div', { style: S.pagina }, h('span', { style: S.meta }, 'Cargando puertas…'))
    const vivo = datos.canal_vivo ? `latido del gateway ${datos.canal_vivo}` : '⚠️ sin latido del gateway: nadie firmará hasta que arranque'

    return h('div', { style: S.pagina },
      h('div', { style: S.fila }, h('strong', null, 'Puertas SDD'),
        h('span', { style: S.meta }, `Decides como ${datos.persona} (${datos.identidad}) · ${vivo}`)),
      datos.puertas.length
        ? datos.puertas.map(p => h(Puerta, { key: p.id, p, recargar }))
        : h(EmptyState, { title: 'No hay puertas abiertas', description: 'Cuando una etapa necesite tu decisión aparecerá aquí y en Telegram.' }),
      proys.length ? h('div', { style: S.tarjeta },
        h('div', { style: S.titulo }, 'Proyectos'),
        proys.map(x => h('div', { key: x.tablero, style: S.fila },
          h('strong', null, x.tablero), x.pausado ? h(Badge, { variant: 'muted' }, '⏸ en pausa') : null,
          h('span', { style: S.meta }, x.hitos.join(' · ') || 'sin hitos todavía'),
          h(ModoJev, { tablero: x.tablero, modo: x.jev, alCambiar: cargarProys })))) : null,
      datos.recientes.length ? h('div', { style: S.tarjeta },
        h('div', { style: S.titulo }, 'Últimas firmadas'),
        datos.recientes.map(r => h('div', { key: r.id, style: S.meta },
          `${r.estado === 'error' ? '⚠️' : '✅'} ${r.tablero} · ${r.titulo}: ${r.resultado}`))) : null)
  }
}

export default {
  id: 'hermes-sdd',
  name: 'Puertas SDD',
  register(ctx) {
    const Pagina = crearPagina(ctx)
    ctx.registerMany([
      { id: 'page', area: ROUTES_AREA, data: { path: RUTA }, render: () => h(Pagina, {}) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: RUTA, label: 'Puertas SDD', codicon: 'shield' } },
      {
        id: 'open', area: PALETTE_AREA,
        data: { id: 'hermes-sdd.open', label: 'Abrir Puertas SDD', keywords: ['sdd', 'puertas', 'gates', 'jev'], run: () => host.navigate(RUTA) }
      }
    ])
  }
}
