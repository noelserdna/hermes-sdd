// hermes-sdd — pestaña «Puertas SDD» del panel de Hermes (canal dashboard). Sin build: IIFE con el SDK del panel.
// Presenta las puertas y manda la decisión al backend del plugin; no firma (lo hace el notario desde el gateway).
(function () {
  "use strict";
  const SDK = window.__HERMES_PLUGIN_SDK__;
  const { React } = SDK;
  const { useState, useEffect, useCallback } = SDK.hooks;
  const { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input } = SDK.components;
  const h = React.createElement;
  const API = "/api/plugins/hermes-sdd";

  const post = (ruta, cuerpo) =>
    SDK.fetchJSON(API + ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo || {}) });

  // Las evidencias se piden con la cabecera de sesión (un <img src> no la lleva) y se muestran como blob.
  function Evidencia({ gid, nombre }) {
    const [url, setUrl] = useState(null);
    useEffect(() => {
      let vivo = true, u = null;
      const cab = {};
      if (window.__HERMES_SESSION_TOKEN__) cab["X-Hermes-Session-Token"] = window.__HERMES_SESSION_TOKEN__;
      fetch(`${API}/evidencia/${gid}/${encodeURIComponent(nombre)}`, { headers: cab, credentials: "same-origin" })
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => { if (b && vivo) { u = URL.createObjectURL(b); setUrl(u); } });
      return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
    }, [gid, nombre]);
    if (!url) return h("div", { className: "hsdd-meta" }, nombre);
    return /\.(mp4|webm|mov)$/i.test(nombre)
      ? h("video", { src: url, controls: true, title: nombre })
      : h("a", { href: url, target: "_blank", rel: "noreferrer" }, h("img", { src: url, alt: nombre, title: nombre }));
  }

  function Puerta({ p, recargar }) {
    const [motivo, setMotivo] = useState("");
    const [error, setError] = useState("");
    const [ocupado, setOcupado] = useState(false);
    const accion = useCallback((ruta, cuerpo) => {
      setOcupado(true); setError("");
      post(ruta, cuerpo).then(recargar).catch((e) => setError(String(e.message || e))).finally(() => setOcupado(false));
    }, [recargar]);

    const escalonada = (p.opciones || []).some((o) => o.paso);
    const opciones = (p.opciones || []).filter((o) => o.verbo !== "ver" && (!escalonada || (o.paso || 1) === p.paso));
    const pideMotivo = opciones.some((o) => o.texto);
    const decidida = p.estado === "decidida";
    const cuerpo = [];

    cuerpo.push(h("div", { className: "hsdd-texto", key: "t" }, p.texto));
    if (decidida) {
      const d = p.decision || {};
      const etiqueta = ((p.opciones || []).find((o) => o.verbo === d.verbo) || {}).etiqueta || d.verbo;
      const hora = p.firmar_en ? new Date(p.firmar_en * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "?";
      cuerpo.push(h("div", { className: "hsdd-fila", key: "d" },
        h(Badge, null, etiqueta), h("span", null, `${d.persona} desde ${d.canal}${d.texto ? ": " + d.texto : ""}`),
        h("span", { className: "hsdd-meta" }, `se firma a las ${hora} (lo hace el gateway)`),
        p.puedo_deshacer && h(Button, { size: "sm", variant: "outline", disabled: ocupado, onClick: () => accion(`/deshacer/${p.id}`) }, "↩ Deshacer")));
    } else {
      if (p.evidencias && p.evidencias.length && p.paso === 2)
        cuerpo.push(h("div", { className: "hsdd-galeria", key: "g" }, p.evidencias.map((n) => h(Evidencia, { key: n, gid: p.id, nombre: n }))));
      if (escalonada && p.paso === 1)
        cuerpo.push(h("div", { className: "hsdd-fila", key: "v" },
          h(Button, { disabled: ocupado, onClick: () => accion(`/ver/${p.id}`) }, "▶ Ver demo"),
          h("span", { className: "hsdd-meta" }, "Aceptar se habilita después de ver la demo")));
      if ((p.preguntas || []).length && (!escalonada || p.paso === 2))
        p.preguntas.forEach((q) => cuerpo.push(h("div", { className: "hsdd-fila", key: "q" + q.n },
          h("span", { className: "hsdd-meta" }, `Q${q.n} (${q.id})`),
          (q.opciones || []).map((l) => h("button", {
            key: l, className: "hsdd-q", "data-on": p.respuestas[String(q.n)] === l ? "1" : "0", disabled: ocupado,
            onClick: () => accion(`/respuesta/${p.id}`, { n: q.n, letra: l }),
          }, `${l}${q.recomendada === l ? " ★" : ""}`)))));
      if (opciones.length) {
        if (pideMotivo)
          cuerpo.push(h("div", { className: "hsdd-fila", key: "m" }, h(Input, {
            className: "hsdd-motivo", value: motivo, placeholder: "Motivo (obligatorio para cambios, observaciones o rechazo)",
            onChange: (e) => setMotivo(e.target.value),
          })));
        cuerpo.push(h("div", { className: "hsdd-fila", key: "b" }, opciones.map((o) => h(Button, {
          key: o.verbo, size: "sm", variant: o.verbo === "rechazo" ? "destructive" : o.texto ? "outline" : "default",
          disabled: ocupado || (o.texto && !motivo.trim()),
          onClick: () => accion(`/decidir/${p.id}`, { verbo: o.verbo, texto: o.texto ? motivo : "" }),
        }, o.etiqueta))));
      }
    }
    if (error) cuerpo.push(h("div", { className: "hsdd-error", key: "e" }, error));
    cuerpo.push(h("div", { className: "hsdd-meta", key: "m2" }, `${p.id} · commit ${String(p.sha || "").slice(0, 7)} · creada ${p.creada}`));

    return h(Card, { className: "mb-4" },
      h(CardHeader, null, h(CardTitle, null, `🚪 ${p.titulo}`, " ", h(Badge, { variant: "outline" }, p.tablero || "local"),
        decidida ? h(Badge, { variant: "secondary", className: "ml-2" }, "decidida") : null)),
      h(CardContent, null, cuerpo));
  }

  function Pagina() {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState("");
    const [proys, setProys] = useState([]);
    const recargar = useCallback(() =>
      SDK.fetchJSON(`${API}/puertas`).then((d) => { setDatos(d); setError(""); }).catch((e) => setError(String(e.message || e))), []);
    useEffect(() => {
      recargar();
      SDK.fetchJSON(`${API}/proyectos`).then((d) => setProys(d.proyectos || [])).catch(() => {});
      const t = setInterval(recargar, 5000);
      return () => clearInterval(t);
    }, [recargar]);

    if (error) return h(Card, null, h(CardContent, { className: "py-4" }, h("div", { className: "hsdd-error" }, error)));
    if (!datos) return h("div", { className: "hsdd-meta" }, "Cargando puertas…");
    const vivo = datos.canal_vivo ? `latido del gateway ${datos.canal_vivo}` : "⚠️ sin latido del gateway: nadie firmará hasta que arranque";
    return h("div", null,
      h("div", { className: "hsdd-fila" }, h("strong", null, "Puertas SDD"),
        h("span", { className: "hsdd-meta" }, `Decides como ${datos.persona} (canal dashboard: ${datos.identidad}) · ${vivo}`)),
      datos.puertas.length ? datos.puertas.map((p) => h(Puerta, { key: p.id, p, recargar }))
        : h(Card, { className: "mb-4" }, h(CardContent, { className: "py-4 text-sm" }, "No hay puertas abiertas.")),
      proys.length ? h(Card, { className: "mb-4" }, h(CardHeader, null, h(CardTitle, null, "Proyectos")),
        h(CardContent, null, proys.map((x) => h("div", { className: "hsdd-fila", key: x.tablero },
          h("strong", null, x.tablero), x.pausado ? h(Badge, { variant: "secondary" }, "⏸ en pausa") : null,
          h("span", { className: "hsdd-meta" }, x.hitos.join(" · ") || "sin hitos todavía"))))) : null,
      datos.recientes.length ? h(Card, null, h(CardHeader, null, h(CardTitle, null, "Últimas firmadas")),
        h(CardContent, null, datos.recientes.map((r) => h("div", { className: "hsdd-meta", key: r.id },
          `${r.estado === "error" ? "⚠️" : "✅"} ${r.tablero} · ${r.titulo}: ${r.resultado}`)))) : null);
  }

  window.__HERMES_PLUGINS__.register("hermes-sdd", Pagina);
})();
