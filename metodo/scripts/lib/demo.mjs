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
//                                            mp4 has the captions and no voice (said in the output)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
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

/** The script of FASE N (see the header). */
export function demoScript(root, fase) {
  const fs = faseScope(root, fase);
  const planText = fs.file ? read(path.join(root, fs.file)) : "";
  const reqs = parseRequirements(read(path.join(root, "requirements", "REQUIREMENTS.md")));
  const scope = new Set(fs.requirements || reqs.filter((r) => !r.deprecated).map((r) => r.id));
  const escenarios = new Set(headerIds(planText, "Escenarios|Scenarios", /AC-\d{3}-\d{2}/g));
  const { byCriterion } = scenarioIndex(loadScenarios(root));
  const ucs = useCases(root);
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
      criterios.push({ id, req: r.id, ac: n, uc: uc && ucs.has(uc) ? uc : null, frase: fr.frase, visible: fr.visible,
        ve: (r.sees?.[i]?.texts || []).map((x) => x.text), pantalla: r.sees?.[i]?.where || null });
    });
  }
  const usados = new Set(criterios.map((c) => c.uc).filter(Boolean));
  for (const m of planText.matchAll(/UC-\d{3}/g)) if (ucs.has(m[0])) usados.add(m[0]);
  const casos = [...usados].sort().map((id) => ({ ...ucs.get(id), criterios: criterios.filter((c) => c.uc === id).map((c) => c.id) }));
  const wfs = workflows(root, headerIds(planText, "Workflows", /WF-\d{3}/g));
  return { fase: String(fase), plan: fs.file, workflows: wfs, casos_de_uso: casos, criterios };
}

export function scriptMarkdown(g) {
  const L = [`# Guion de la demo — FASE-${g.fase}`, "",
    "Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).",
    "Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.", ""];
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
    for (const c of g.criterios.filter((x) => x.uc === u.id)) L.push(`- ${c.id}: ${c.frase}`);
    L.push("");
  }
  const sueltos = g.criterios.filter((c) => !c.uc);
  if (sueltos.length) { L.push("## Otros criterios de la FASE", ""); for (const c of sueltos) L.push(`- ${c.id}: ${c.frase}`); L.push(""); }
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

/** Narrate the videos of FASE N: returns [{ video, mp4, segments, voice }] (errors per video in `error`). */
export function narrate(root, fase, { tts: pref, voice } = {}) {
  const prof = stackProfile(root);
  const dir = path.join(root, prof.evidence_dir || "evidencias", `FASE-${fase}`);
  if (!existsSync(dir)) return [];
  if (!has("ffmpeg")) return [{ error: "ffmpeg is not installed: no mp4 (brew install ffmpeg / apt-get install ffmpeg)" }];
  const tts = pickTts(pref);
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".narracion.json")).sort()) {
    let n;
    try { n = JSON.parse(read(path.join(dir, f))); } catch { out.push({ video: f, error: "unreadable narration file" }); continue; }
    const video = path.join(dir, n.video || f.replace(/\.narracion\.json$/, ".webm"));
    if (!existsSync(video)) { out.push({ video: path.basename(video), error: "video not found" }); continue; }
    const mp4 = video.replace(/\.webm$/, ".mp4");
    const tmp = mkdtempSync(path.join(os.tmpdir(), "sdd-voz-"));
    const segs = [];
    if (tts.tts !== "none")
      (n.narraciones || []).forEach((x, i) => {
        const wav = path.join(tmp, `s${i}.${tts.tts === "say" ? "wav" : "wav"}`);
        if (synth(tts, voice, x.texto, wav)) segs.push({ wav, ms: Math.max(0, Math.round((x.t || 0) * 1000)) });
      });
    const args = ["-y", "-loglevel", "error", "-i", video];
    for (const s of segs) args.push("-i", s.wav);
    if (segs.length) {
      const f1 = segs.map((s, i) => `[${i + 1}:a]adelay=${s.ms}|${s.ms}[a${i}]`).join(";");
      const mix = segs.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${segs.length}:normalize=0:duration=longest[voz]`;
      args.push("-filter_complex", `${f1};${mix}`, "-map", "0:v", "-map", "[voz]", "-c:a", "aac", "-b:a", "96k");
    } else args.push("-map", "0:v", "-an");
    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "28", "-movflags", "+faststart", mp4);
    const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
    rmSync(tmp, { recursive: true, force: true });
    out.push({ video: path.basename(video), mp4: r.status === 0 ? path.basename(mp4) : null, segments: segs.length,
      voice: tts.tts === "none" ? null : `${tts.tts}${voice || tts.voice ? `:${voice || tts.voice}` : ""}`,
      ...(r.status === 0 ? {} : { error: (r.stderr || "").trim().slice(-300) }) });
  }
  return out;
}

export function runDemo(argv, { prog = "sdd" } = {}) {
  const sub = argv[0];
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const root = path.resolve(opt("repo") || ".");
  const fase = opt("fase");
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
