// sdd demo: the FASE demo as a narrated film, where every criterion is shown in two ways at once — what is SAID (an
// on-screen caption and a voice-over, from the use cases and the criteria) and what is SEEN (its «Se ve:» texts,
// asserted in the app by the capture helper). The use cases are the script: their main flow is what the user does and
// what the system answers, and each extension or exception points at the criterion (AC) it proves.
//
//   sdd demo script --fase N [--json]      → .sdd/demo/GUION-FASE-N.json and .md: workflows, use cases (main flow,
//                                            extensions with their AC) and, per criterion of the FASE, the sentence to
//                                            narrate before its capture (deterministic, no model)
//   sdd demo narrate --fase N [--tts say|espeak-ng|none] [--voice V]
//                                          → for each <video>.narracion.json of evidencias/FASE-N (written by the
//                                            harness helper `narrar`), a voice-over placed at its times and an
//                                            <video>.mp4 (H.264 + AAC; Telegram plays only mp4). Without a TTS, the
//                                            mp4 has the captions and no voice (said in the output). The tests do not
//                                            wait for a sentence: where its voice (or the time to read its caption)
//                                            does not fit before the next one, the film freezes that frame
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, mkdtempSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { parseRequirements } from "../sdd-jev.mjs";
import { loadScenarios, scenarioIndex, faseScope } from "./acceptance.mjs";
import { stackProfile } from "./git-log.mjs";

const read = (f) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
const headerIds = (text, label, re) => {
  const l = text.split(/\r?\n/).slice(0, 40).find((x) => new RegExp(`\\b${label}\\b[*\\s]*:`, "i").test(x));
  return l ? [...new Set(l.match(re) || [])] : [];
};

function useCases(root) {
  const dir = path.join(root, "spec", "use-cases");
  if (!existsSync(dir)) return new Map();
  const out = new Map();
  for (const f of readdirSync(dir).filter((x) => /^UC-\d+.*\.md$/i.test(x)).sort()) {
    const t = read(path.join(dir, f));
    const id = f.match(/^(UC-\d+)/i)[1].toUpperCase();
    const title = (t.match(/^#\s+UC-\d+\s*[—–:-]\s*(.+)$/m) || [])[1]?.trim() || id;
    const sec = (name) => { const m = t.match(new RegExp(`^##\\s+(?:${name})[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "mi")); return m ? m[1] : ""; };
    const flujo = sec("Main flow|Flujo principal").split("\n").map((l) => l.match(/^\s*\d+\.\s+(.+)$/)?.[1]?.trim()).filter(Boolean);
    const extensiones = sec("Extensions|Extensiones").split("\n").map((l) => l.match(/^\s*-\s+(.+)$/)?.[1]?.trim()).filter(Boolean)
      .map((x) => ({ texto: x.replace(/\s*\((AC-[\d-]+(?:,\s*AC-[\d-]+)*)\)\s*$/, ""), criterios: x.match(/AC-\d{3}-\d{2}/g) || [] }));
    out.set(id, { id, titulo: title, fichero: `spec/use-cases/${f}`, flujo, extensiones });
  }
  return out;
}

function workflows(root, ids) {
  const dir = path.join(root, "spec", "workflows");
  if (!existsSync(dir)) return [];
  return ids.map((id) => {
    const f = readdirSync(dir).find((x) => x.toUpperCase().startsWith(id));
    if (!f) return { id, titulo: id, pasos: [], navegacion: [] };
    const t = read(path.join(dir, f));
    const tabla = (name) => {
      const m = t.match(new RegExp(`^##\\s+(?:${name})[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "mi"));
      return m ? m[1].split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l)).map((l) => l.split("|").slice(1, -1).map((c) => c.trim())) : [];
    };
    return { id, titulo: (t.match(/^#\s+WF-\d+\s*[—–:-]\s*(.+)$/m) || [])[1]?.trim() || id, fichero: `spec/workflows/${f}`,
      pasos: tabla("Steps|Pasos").map((c) => ({ n: Number(c[0]), nombre: c[1], uc: (c.join(" ").match(/UC-\d{3}/) || [])[0] || null })),
      navegacion: tabla("Navigation|Navegación").map((c) => ({ n: Number(c[0]), celdas: c.slice(1) })) };
  });
}

/** The sentence narrated before a criterion's capture: plain Spanish built from its own «Se ve:» line, so what is
 *  said and what the capture asserts are the same texts (a {template} keeps its fixed parts; the test fills it). */
export function fraseCriterio(req, sees) {
  if (!sees) return null;
  if (sees.none) return { frase: `${req.title}. ${sees.none}`, visible: false };
  if (!sees.texts?.length) return null;
  const textos = sees.texts.map((x) => `«${x.text}»`);
  const lista = textos.length > 1 ? `${textos.slice(0, -1).join(", ")} y ${textos.at(-1)}` : textos[0];
  return { frase: `${req.title}. ${sees.where ? `En ${sees.where} se` : "Se"} ve ${lista}.`, visible: true };
}

// ------------------------------------------------------------------ the criterion, presented before it is shown
const PASO = { given: "Dado", dado: "Dado", dada: "Dado", when: "Cuando", cuando: "Cuando", then: "Entonces", entonces: "Entonces",
  and: "Y", y: "Y", e: "Y", but: "Pero", pero: "Pero" };
/** The steps of each BDD scenario of spec/tests, in Spanish keywords: id → [{ k: Dado|Cuando|Entonces|Y|Pero, texto }]. */
export function scenarioSteps(root) {
  const dir = path.join(root, "spec", "tests");
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => /^BDD-.*\.md$/i.test(x)).sort()) {
    let ids = null;
    for (const l of read(path.join(dir, f)).split(/\r?\n/)) {
      if (/^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:Scenario(?: Outline)?|Escenario|Esquema del escenario)\b/i.test(l)) {
        ids = [...new Set(l.match(/AC-\d{3}-\d{2}/g) || [])];
        for (const id of ids) if (!out.has(id)) out.set(id, []);
        continue;
      }
      const m = l.match(/^\s*(?:[-*]\s+)?(?:\*\*)?(Given|When|Then|And|But|Dado|Dada|Cuando|Entonces|Y|E|Pero)(?:\*\*)?\s+(.+?)\s*$/i);
      if (m && ids) for (const id of ids) out.get(id).push({ k: PASO[m[1].toLowerCase()], texto: m[2] });
      else if (/^\s*(?:#{1,6}\s|Feature:|Background:|Antecedentes:|Característica:)/i.test(l)) ids = null;
    }
  }
  return out;
}
const hablado = (t) => String(t).replace(/["«»“”`]/g, "").replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
const tipoReq = (id) => (/^REQ-NF-/.test(id) ? "no funcional" : /^REQ-F-/.test(id) ? "funcional" : "");
/**
 * How a criterion's video opens (Andrés, material-montana11: «que diga: este es el requisito tal, que pide esto, sus
 * criterios de aceptación son estos, y a partir de ahí lo demuestre»): what is written on screen (requisito, titulo,
 * para_el_cliente, criterios [{ n, titulo, actual }], pasos of this criterion) and what the voice says (voz). Built by
 * the method from the requirements and the BDD scenarios; the test helper shows it, no agent writes it.
 */
export function presentacion(req, n, { titulos = [], pasos = [], frase = null, noVisible = null } = {}) {
  const total = req.criteria.length;
  const criterios = req.criteria.map((_, i) => ({ n: i + 1, titulo: titulos[i] || `Criterio ${i + 1}`, actual: i + 1 === n }));
  const num = Number((req.id.match(/(\d+)$/) || [])[1]);
  const voz = [`Requisito ${tipoReq(req.id)} ${num || req.id}: ${hablado(req.title)}.`.replace(/\s+/g, " ")];
  if (req.plain) voz.push(`${hablado(req.plain)}.`);
  voz.push(total > 1 ? `Tiene ${total} criterios de aceptación. Este vídeo demuestra el criterio ${n}${titulos[n - 1] ? `: ${hablado(titulos[n - 1])}` : ""}.`
    : `Tiene un criterio de aceptación${titulos[0] ? `: ${hablado(titulos[0])}` : ""}, y este vídeo lo demuestra.`);
  if (pasos.length) {
    const une = { Dado: "Dado que", Cuando: "cuando", Entonces: "entonces", Y: "y", Pero: "pero" };
    voz.push(pasos.map((p, i) => `${i && p.k !== "Y" && p.k !== "Pero" ? ", " : i ? " " : ""}${i ? une[p.k].toLowerCase() : une[p.k]} ${hablado(p.texto)}`).join("") + ".");
  } else if (frase) voz.push(hablado(frase) + ".");
  // what no screen shows is said as such, so the demonstration never seems to promise it (material-montana11)
  if (noVisible) voz.push(`Esto no se ve en pantalla: ${hablado(noVisible)}.`);
  voz.push("Ahora, la demostración.");
  return { requisito: req.id, titulo: req.title, para_el_cliente: req.plain || null, n, total, criterios, pasos,
    no_visible: noVisible || null, voz: voz.join(" ") };
}

/** The script of FASE N (see the header). */
export function demoScript(root, fase) {
  const fs = faseScope(root, fase);
  const planText = fs.file ? read(path.join(root, fs.file)) : "";
  const reqs = parseRequirements(read(path.join(root, "requirements", "REQUIREMENTS.md")));
  const scope = new Set(fs.requirements || reqs.filter((r) => !r.deprecated).map((r) => r.id));
  const escenarios = new Set(headerIds(planText, "Escenarios|Scenarios", /AC-\d{3}-\d{2}/g));
  const { byCriterion } = scenarioIndex(loadScenarios(root));
  const ucs = useCases(root);
  const escenas = loadScenarios(root), pasosDe = scenarioSteps(root);
  const tituloDe = (rid, k) => { const ids = [...(byCriterion.get(`${rid}#${k}`) || [])].sort(); return escenas.find((e) => ids.includes(e.id) && e.title)?.title || null; };
  const criterios = [];
  for (const r of reqs) {
    if (r.type !== "F" || r.deprecated || !scope.has(r.id)) continue;
    r.criteria.forEach((c, i) => {
      const n = i + 1;
      const sc = [...(byCriterion.get(`${r.id}#${n}`) || [])].sort();
      const id = sc.find((s) => escenarios.has(s)) || sc[0] || `${r.id}-AC${n}`;
      const fr = fraseCriterio(r, r.sees?.[i]);
      if (!fr) return;
      const uc = (id.match(/^AC-(\d{3})-/) || [])[1] ? `UC-${id.match(/^AC-(\d{3})-/)[1]}` : null;
      // The whole THEN too: the voice-over must also say what is not a «Se ve» text (nothing changes, only one is
      // left, it is still there after a reload); Jev compares the voice-over with the criterion (gastos-cena2)
      const then = (String(c).match(/\bTHEN\s+([\s\S]*)$/) || [])[1]?.trim() || null;
      criterios.push({ id, req: r.id, ac: n, uc: uc && ucs.has(uc) ? uc : null, frase: fr.frase, visible: fr.visible, then,
        ve: (r.sees?.[i]?.texts || []).map((x) => x.text), pantalla: r.sees?.[i]?.where || null,
        presentacion: presentacion(r, n, { titulos: r.criteria.map((_, k) => tituloDe(r.id, k + 1)), pasos: pasosDe.get(id) || [], frase: fr.frase,
          noVisible: fr.visible ? r.sees?.[i]?.none || null : null }) });
    });
  }
  const usados = new Set(criterios.map((c) => c.uc).filter(Boolean));
  for (const m of planText.matchAll(/UC-\d{3}/g)) if (ucs.has(m[0])) usados.add(m[0]);
  const casos = [...usados].sort().map((id) => ({ ...ucs.get(id), criterios: criterios.filter((c) => c.uc === id).map((c) => c.id) }));
  const wfs = workflows(root, headerIds(planText, "Workflows", /WF-\d{3}/g));
  return { fase: String(fase), plan: fs.file, workflows: wfs, casos_de_uso: casos, criterios };
}

const lineasCriterio = (c) => [`- ${c.id}: ${c.frase}`, ...(c.then ? [`  El criterio pide: ${c.then}`] : [])];

export function scriptMarkdown(g) {
  const L = [`# Guion de la demo — FASE-${g.fase}`, "",
    "Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).",
    "Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.",
    "Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras",
    "recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.", ""];
  for (const w of g.workflows) {
    L.push(`## ${w.id} — ${w.titulo}`, "");
    for (const p of w.pasos) L.push(`${p.n}. ${p.nombre}${p.uc ? ` (${p.uc})` : ""}`);
    if (w.navegacion.length) { L.push("", "Navegación:"); for (const n of w.navegacion) L.push(`- ${n.n}: ${n.celdas.join(" · ")}`); }
    L.push("");
  }
  for (const u of g.casos_de_uso) {
    L.push(`## ${u.id} — ${u.titulo}`, "", "Flujo principal:");
    u.flujo.forEach((x, i) => L.push(`${i + 1}. ${x}`));
    if (u.extensiones.length) { L.push("", "Extensiones:"); for (const e of u.extensiones) L.push(`- ${e.texto}${e.criterios.length ? ` (${e.criterios.join(", ")})` : ""}`); }
    L.push("", "Criterios:");
    for (const c of g.criterios.filter((x) => x.uc === u.id)) L.push(...lineasCriterio(c));
    L.push("");
  }
  const sueltos = g.criterios.filter((c) => !c.uc);
  if (sueltos.length) { L.push("## Otros criterios de la FASE", ""); for (const c of sueltos) L.push(...lineasCriterio(c)); L.push(""); }
  return L.join("\n");
}

// ------------------------------------------------------------------ narrate
const has = (cmd) => spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" }).status === 0;
export function pickTts(pref) {
  if (pref === "none") return { tts: "none" };
  if ((!pref || pref === "say") && process.platform === "darwin" && has("say")) {
    const voces = spawnSync("say", ["-v", "?"], { encoding: "utf8" }).stdout || "";
    const voz = ["Mónica", "Monica", "Paulina", "Jorge"].find((v) => new RegExp(`^${v}\\s`, "m").test(voces));
    return { tts: "say", voice: voz || null };
  }
  if ((!pref || pref === "espeak-ng") && has("espeak-ng")) return { tts: "espeak-ng", voice: "es" };
  return { tts: "none" };
}

function synth(tts, voice, text, out) {
  if (tts.tts === "say") return spawnSync("say", [...(voice || tts.voice ? ["-v", voice || tts.voice] : []), "-o", out, "--file-format=WAVE", "--data-format=LEI16@22050", text]).status === 0;
  if (tts.tts === "espeak-ng") return spawnSync("espeak-ng", ["-v", voice || tts.voice || "es", "-w", out, text]).status === 0;
  return false;
}

/** Seconds of audio in a WAV file (its byte rate and data chunk), 0 when unreadable. */
export function wavSeconds(file) {
  try {
    const b = readFileSync(file);
    let i = 12, rate = 0;
    while (i + 8 <= b.length) {
      const id = b.toString("ascii", i, i + 4), n = b.readUInt32LE(i + 4);
      if (id === "fmt ") rate = b.readUInt32LE(i + 16);
      if (id === "data") return rate ? Math.min(n, b.length - i - 8) / rate : 0;
      i += 8 + n + (n & 1);
    }
  } catch { /* unreadable */ }
  return 0;
}
/** What a person needs to read a caption (seconds): the pause the tests used to make, now made in the film. */
export const readingSeconds = (text) => Math.min(8, Math.max(1.5, String(text || "").length * 0.065));
function videoSize(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf8" });
  const [w, h] = (r.stdout || "").trim().split(",").map(Number);
  return w > 0 && h > 0 ? [w, h] : null;
}
function videoSeconds(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  const d = parseFloat((r.stdout || "").trim());
  return Number.isFinite(d) && d > 0 ? d : null;
}
/** How long after its caption appears the frame of a sentence is taken (the helper `narrar` waits 0.2 s for it to paint). */
export const LEAD = 0.2;
/** The action between two sentences lasts at least this long in the film (slowed down, at most MAX_SLOW times). */
export const MIN_ACTION = 1.2, MAX_SLOW = 4;
const r2 = (x) => Math.round(x * 100) / 100;
/**
 * The film's timeline: the test runs at full speed (the helper `narrar` does not wait), so each sentence is said over
 * the frame where its caption has just appeared — before the action it announces — frozen as long as its voice needs;
 * then the action plays, slowed down when it is too fast to follow (material-montana12 G-9: the frame frozen was the
 * last one before the next sentence, so «Lucía pulsa Cancelar» was said over «Reserva cancelada» and the click lasted
 * 0.1 s). items: [{t, d, hold?, image?, until?}] sorted by t (start in the test video, seconds needed). An item with
 * `image` (the card that presents the criterion) is shown as that still image for its voice, and the video goes on
 * from `until` (when the test left the card): the card does not depend on the recording (G-8: a webm without it).
 * Returns pieces [{from, to|null, freeze, slow?} | {image, still}] and, per item, its offset in the film.
 */
export function filmTimeline(items, duration = null, pad = 0.4) {
  const pieces = [], offsets = [];
  let at = 0;
  if (items.length && items[0].t > 0.05 && !items[0].image) { pieces.push({ from: 0, to: items[0].t, freeze: 0 }); at = items[0].t; }
  items.forEach((x, j) => {
    const last = j + 1 >= items.length;
    const end = last ? duration : items[j + 1].t;
    offsets.push(r2(at));
    let f;
    if (x.image) {
      const still = r2(x.d + pad);
      pieces.push({ image: x.image, still }); at += still;
      f = Math.max(x.t, Math.min(x.until ?? x.t + (x.hold || LEAD), end ?? Infinity));
    } else {
      f = Math.min(x.t + (x.hold > 0 ? x.hold : LEAD), end ?? Infinity);
      const freeze = Math.max(0, r2(x.d + pad - (f - x.t)));
      pieces.push({ from: x.t, to: f, freeze }); at += (f - x.t) + freeze;
    }
    if (end === null || end > f) {
      const len = end === null ? null : end - f;
      const slow = !last && !x.image && len > 0 && len < MIN_ACTION ? r2(Math.min(MAX_SLOW, MIN_ACTION / len)) : 1;
      pieces.push({ from: f, to: last ? null : end, freeze: 0, ...(slow > 1 ? { slow } : {}) });
      at += len === null ? 0 : len * slow;
    }
  });
  return { pieces, offsets };
}

/** Narrate the videos of FASE N: returns [{ video, mp4, segments, voice, frozen }] (errors per video in `error`). */
export function narrate(root, fase, { tts: pref, voice } = {}) {
  const prof = stackProfile(root);
  const dir = path.join(root, prof.evidence_dir || "evidencias", `FASE-${fase}`);
  if (!existsSync(dir)) return [];
  if (!has("ffmpeg")) return [{ error: "ffmpeg is not installed: no mp4 (brew install ffmpeg / apt-get install ffmpeg)" }];
  const tts = pickTts(pref);
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".narracion.json") && !MONTAJE.test(x)).sort()) {
    let n;
    try { n = JSON.parse(read(path.join(dir, f))); } catch { out.push({ video: f, error: "unreadable narration file" }); continue; }
    const video = path.join(dir, n.video || f.replace(/\.narracion\.json$/, ".webm"));
    if (!existsSync(video)) { out.push({ video: path.basename(video), error: "video not found" }); continue; }
    const mp4 = video.replace(/\.webm$/, ".mp4");
    const tmp = mkdtempSync(path.join(os.tmpdir(), "sdd-voz-"));
    // Each sentence: its start in the test video and the time it needs (its voice, or the time to read its caption)
    // `voz`: what is said when it is more than the caption (the presentation of the criterion that opens the video)
    // `imagen`: the card that presents the criterion, saved by the fixture apart from the video (G-8)
    const items = (n.narraciones || []).map((x) => ({ t: Math.max(0, Number(x.t) || 0), texto: x.voz || x.texto, hold: x.presentacion ? 0.3 : 0,
      ...(x.presentacion && x.imagen && existsSync(path.join(dir, x.imagen)) ? { image: path.join(dir, x.imagen), until: Number(x.hasta) || undefined } : {}) }))
      .sort((a, b) => a.t - b.t)
      .map((x, i) => {
        const wav = path.join(tmp, `s${i}.wav`);
        const ok = tts.tts !== "none" && synth(tts, voice, x.texto, wav);
        return { ...x, wav: ok ? wav : null, d: (ok && wavSeconds(wav)) || readingSeconds(x.texto) };
      });
    const { pieces, offsets } = filmTimeline(items, items.length ? videoSeconds(video) : null);
    const segs = items.map((x, i) => ({ wav: x.wav, ms: Math.round(offsets[i] * 1000) })).filter((s) => s.wav);
    const frozen = Math.round(pieces.reduce((a, p) => a + (p.freeze || p.still || 0), 0) * 10) / 10;
    const args = ["-y", "-loglevel", "error", "-i", video];
    for (const s of segs) args.push("-i", s.wav);
    const graph = [];
    let vout = "0:v";
    if (pieces.length) {
      // every piece to the video's size and 25 fps (the card is a still image; a slowed piece changes its timestamps)
      const [w, h] = videoSize(video) || [1280, 720];
      const norm = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,format=yuv420p`;
      let extra = segs.length + 1;
      pieces.forEach((p, k) => {
        if (p.image) { args.push("-loop", "1", "-t", String(p.still), "-i", p.image); graph.push(`[${extra++}:v]${norm},trim=duration=${p.still}[v${k}]`); return; }
        graph.push(`[0:v]trim=start=${p.from}${p.to !== null ? `:end=${p.to}` : ""},setpts=${p.slow ? `(PTS-STARTPTS)*${p.slow}` : "PTS-STARTPTS"},${norm}` +
          `${p.freeze > 0 ? `,tpad=stop_mode=clone:stop_duration=${p.freeze}` : ""}[v${k}]`);
      });
      graph.push(`${pieces.map((_, k) => `[v${k}]`).join("")}concat=n=${pieces.length}:v=1:a=0[film]`);
      vout = "[film]";
    }
    if (segs.length) {
      graph.push(...segs.map((s, i) => `[${i + 1}:a]adelay=${s.ms}|${s.ms}[a${i}]`));
      graph.push(segs.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${segs.length}:normalize=0:duration=longest[voz]`);
    }
    if (graph.length) args.push("-filter_complex", graph.join(";"));
    args.push("-map", vout);
    if (segs.length) args.push("-map", "[voz]", "-c:a", "aac", "-b:a", "96k"); else args.push("-an");
    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "28", "-movflags", "+faststart", mp4);
    const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
    rmSync(tmp, { recursive: true, force: true });
    out.push({ video: path.basename(video), mp4: r.status === 0 ? path.basename(mp4) : null, segments: segs.length, frozen,
      voice: tts.tts === "none" ? null : `${tts.tts}${voice || tts.voice ? `:${voice || tts.voice}` : ""}`,
      ...(r.status === 0 ? {} : { error: (r.stderr || "").trim().slice(-300) }) });
  }
  return out;
}

// ------------------------------------------------------------------ montage
const MONTAJE = /^MONTAJE-/;
/** Concatenate mp4 clips into `out` (H.264 + AAC; a clip without audio gets silence, so every clip keeps its place). */
function concatMp4(clips, out) {
  const conAudio = (f) => /audio/.test(spawnSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout || "");
  const args = ["-y", "-loglevel", "error"];
  const graph = [];
  clips.forEach((c, i) => {
    args.push("-i", c);
    // every clip to the same size and frame rate, and silence where a clip has no voice
    graph.push(`[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=25,setsar=1[v${i}]`);
    graph.push(conAudio(c) ? `[${i}:a]aresample=44100,aformat=channel_layouts=mono[a${i}]` : `anullsrc=r=44100:cl=mono,atrim=0:${videoSeconds(c) || 1}[a${i}]`);
  });
  graph.push(`${clips.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${clips.length}:v=1:a=1[v][a]`);
  args.push("-filter_complex", graph.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
    "-crf", "28", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out);
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  return r.status === 0 ? null : (r.stderr || "").trim().slice(-300);
}
/**
 * The FASE montage (evidencias/FASE-N/MONTAJE-FASE-N.mp4): the narrated video of each criterion, in the order of the
 * script (requirement, then criterion), so whoever reviews the gate watches every criterion one after another
 * (material-montana11: the gate showed 1 video of 7 to 16). With `entrega`, evidencias/ENTREGA/MONTAJE-ENTREGA.mp4
 * joins the montages of every FASE. Returns { out, clips } or { error }.
 */
export function montage(root, { fase = null, entrega = false, tts = undefined } = {}) {
  if (!has("ffmpeg")) return { error: "ffmpeg is not installed: no montage" };
  const prof = stackProfile(root);
  const ev = path.join(root, prof.evidence_dir || "evidencias");
  let clips = [], out;
  if (entrega) {
    const fases = existsSync(ev) ? readdirSync(ev).filter((d) => /^FASE-\d+$/.test(d)).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5))) : [];
    // A FASE whose videos are newer than its montage (the closing run records them again) is narrated and montaged
    // again: the delivery shows the final code (material-montana12 G-21: it showed screens fixed hours before)
    const mtime = (f) => { try { return statSync(f).mtimeMs; } catch { return 0; } };
    for (const d of fases) {
      const webm = Math.max(0, ...readdirSync(path.join(ev, d)).filter((x) => x.endsWith(".webm")).map((x) => mtime(path.join(ev, d, x))));
      if (webm && webm > mtime(path.join(ev, d, `MONTAJE-${d}.mp4`))) { narrate(root, d.slice(5), { tts }); montage(root, { fase: d.slice(5) }); }
    }
    clips = fases.map((d) => path.join(ev, d, `MONTAJE-${d}.mp4`)).filter((f) => existsSync(f));
    mkdirSync(path.join(ev, "ENTREGA"), { recursive: true });
    out = path.join(ev, "ENTREGA", "MONTAJE-ENTREGA.mp4");
  } else {
    const dir = path.join(ev, `FASE-${fase}`);
    if (!existsSync(dir)) return { error: `no evidence for FASE-${fase}` };
    let guion = [];
    try { guion = JSON.parse(read(path.join(root, ".sdd", "demo", `GUION-FASE-${fase}.json`))).criterios || []; } catch { /* no script */ }
    const orden = (id) => { const k = guion.findIndex((c) => c.id === id || `${c.req}-AC${c.ac}` === id); return k < 0 ? 1e6 : k; };
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".narracion.json") && !MONTAJE.test(x))) {
      let n; try { n = JSON.parse(read(path.join(dir, f))); } catch { continue; }
      const mp4 = path.join(dir, (n.video || f.replace(/\.narracion\.json$/, ".webm")).replace(/\.webm$/, ".mp4"));
      if (!existsSync(mp4)) continue;
      const ids = (n.narraciones || []).map((x) => x.presentacion || x.criterio).filter(Boolean);
      clips.push({ mp4, k: ids.length ? Math.min(...ids.map(orden)) : 1e6 });
    }
    clips = clips.sort((a, b) => a.k - b.k || a.mp4.localeCompare(b.mp4)).map((c) => c.mp4);
    out = path.join(dir, `MONTAJE-FASE-${fase}.mp4`);
  }
  if (!clips.length) return { error: "no narrated mp4 to join", clips: [] };
  const error = concatMp4(clips, out);
  return error ? { error, clips: clips.map((c) => path.basename(c)) } : { out: path.relative(root, out), clips: clips.map((c) => path.basename(c)) };
}

export function runDemo(argv, { prog = "sdd" } = {}) {
  const sub = argv[0];
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const root = path.resolve(opt("repo") || ".");
  const fase = opt("fase");
  if (sub === "montaje") {
    if (fase === undefined && !argv.includes("--entrega")) { console.error(`usage: ${prog} demo montaje --fase N | --entrega [--json]`); return 2; }
    const r = montage(root, { fase, entrega: argv.includes("--entrega") });
    if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
    else console.log(r.error ? `${prog}: demo montaje: ${r.error}` : `${r.out} (${r.clips.length} vídeo(s))`);
    return r.error ? 1 : 0;
  }
  if (!["script", "narrate"].includes(sub) || fase === undefined) {
    console.error(`usage: ${prog} demo script --fase N [--json] | ${prog} demo narrate --fase N [--tts say|espeak-ng|none] [--voice V]`);
    return 2;
  }
  if (sub === "script") {
    const g = demoScript(root, fase);
    const d = path.join(root, ".sdd", "demo"); mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, `GUION-FASE-${fase}.json`), JSON.stringify(g, null, 1));
    writeFileSync(path.join(d, `GUION-FASE-${fase}.md`), scriptMarkdown(g));
    if (argv.includes("--json")) console.log(JSON.stringify(g, null, 2));
    else console.log(`${prog}: demo script: FASE-${fase}, ${g.workflows.length} workflow(s), ${g.casos_de_uso.length} use case(s), ${g.criterios.length} criteria → .sdd/demo/GUION-FASE-${fase}.md`);
    return 0;
  }
  const r = narrate(root, fase, { tts: opt("tts"), voice: opt("voice") });
  if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    for (const x of r) console.log(x.error ? `${x.video || "-"}: ${x.error}` : `${x.video} → ${x.mp4} (${x.segments} frase(s)${x.voice ? `, voz ${x.voice}` : ", sin voz: no hay TTS"})`);
    if (!r.length) console.log(`${prog}: demo narrate: no narrated videos in FASE-${fase}`);
  }
  return r.some((x) => x.error) ? 1 : 0;
}
