// questions.mjs — `sdd questions add|answer|validate|render|sync|list|view`: the async questions of the stations
// (references/async-questions.md). Node >= 18, no dependencies. Called from scripts/sdd.mjs (and from `sdd journal add`
// and `sdd accept --report`); returns an exit code.
//
// The JSON is the source (11/2026). Each `.sdd/questions-<role>.md` may have a `.sdd/questions-<role>.json` next to it
// (templates/questions.schema.json): then the JSON is the truth and the .md a view this module regenerates. Why:
// whether an answer launches a requirements change or authorizes editing a test depended on regexes over Markdown in
// several places (three option syntaxes, the recommended one by ★ or «(recomendada…)», effects guessed from verbs when
// `efecto:` was missing), and the answer was written by rewriting that Markdown in place, not atomically. With the JSON,
// `efecto`, `ficheros` and `recomendada` are fields; `add` and `answer` validate against the schema before writing; each
// write is atomic (temporary file + rename). This module is the only writer of the JSON: `add` (a stage: OPEN questions,
// never an answer), `answer` (the notary when a person signs a gate, or the lead), `render` (the views). Questions
// written before the JSON (only in a .md) are still read as Markdown, as before, and are kept verbatim in the view.
//
// Why `.sdd/` and a versioned copy: `.sdd/` is git-ignored (it also holds runtime state: locks, junit, the ledger), but
// commits, requirements and the journal cite `Q-…` ids, and a tag must say what the customer was asked and what they
// chose (club, 11/2026: 79 questions lived only in .sdd/questions-*.md, outside git). `sync` mirrors each
// `.sdd/questions-*` into `status/questions/` (versioned, next to the journal). The mirror is a record, not an
// authority: an answer there authorizes nothing (Art. 12 is a signed `test-edit` record in acceptance/decisions.jsonl).
//
// When sync runs, so the copy lands in a commit that already happens:
//   - `sdd journal add --by …` (a person's decision: every gate of the notary journals it and then commits status/);
//   - `sdd accept --report …` (the FASE or delivery acceptance commits acceptance/ and status/);
//   - by hand: `sdd questions sync`.
// A copy is written only when its content changed, never deleted, so a run without questions leaves status/ untouched.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SOURCE_DIR = ".sdd";
export const MIRROR_DIR = "status/questions";
const ANY_RE = /^questions-[A-Za-z0-9._-]+\.(md|json)$/;
const FILE_RE = /^questions-[A-Za-z0-9._-]+\.md$/;
const JSON_RE = /^questions-([A-Za-z0-9._-]+)\.json$/;
const ROLE_RE = /^[A-Za-z0-9._-]+$/;
const HEAD_RE = /^(?:##\s+)?(Q-[A-Za-z][\w-]*-\d{3})\s+\[(OPEN|ANSWERED)\](.*)$/;
export const SCHEMA_PATH = fileURLToPath(new URL("../../templates/questions.schema.json", import.meta.url));

class QError extends Error {}

/** Question files of a directory: [{ name, abs }] sorted by name (the Markdown files, or those matching `re`). */
export function questionFiles(dir, re = FILE_RE) {
  let names = [];
  try { names = readdirSync(dir).filter((n) => re.test(n)).sort(); } catch { return []; }
  return names.map((name) => ({ name, abs: path.join(dir, name) }));
}

/** Copies .sdd/questions-*.md (and their .json) into status/questions/ when the content differs. Returns the relative paths written. */
export function syncQuestions(root) {
  const written = [];
  for (const f of questionFiles(path.join(root, SOURCE_DIR), ANY_RE)) {
    let text;
    try { text = readFileSync(f.abs, "utf8"); } catch { continue; }
    const rel = `${MIRROR_DIR}/${f.name}`;
    const dest = path.join(root, rel);
    let prev = null;
    try { prev = readFileSync(dest, "utf8"); } catch { /* new */ }
    if (prev === text) continue;
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, text);
    written.push(rel);
  }
  return written;
}

// ------------------------------------------------------------------ schema (the subset of JSON Schema it uses)
let SCHEMA = null;
export function loadSchema() {
  if (!SCHEMA) SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  return SCHEMA;
}
const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v);
const isType = (v, t) => typeOf(v) === t || (t === "number" && typeof v === "number");

/** Errors of `value` against `schema` ([] when valid). The keywords templates/questions.schema.json uses: type, enum,
 *  const, pattern, minLength, required, properties, additionalProperties false, items, minItems,
 *  contains/minContains/maxContains, $ref (#/$defs/…), oneOf, anyOf, if/then/else. No dependency: the CLI has none. */
export function schemaErrors(schema, value, at = "", top = schema) {
  if (schema.$ref) {
    const ref = schema.$ref.replace(/^#\//, "").split("/").reduce((o, k) => (o ? o[k] : undefined), top);
    if (!ref) return [`${at || "/"}: unknown $ref ${schema.$ref}`];
    return schemaErrors(ref, value, at, top);
  }
  const errs = [];
  const where = at || "/";
  const ok = (s, v) => schemaErrors(s, v, at, top).length === 0;
  if (schema.type) {
    const ts = [].concat(schema.type);
    if (!ts.some((t) => isType(value, t))) return [`${where}: must be ${ts.join(" or ")}`];
  }
  if ("const" in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) errs.push(`${where}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) errs.push(`${where}: must be one of ${schema.enum.join(", ")} (got ${JSON.stringify(value)})`);
  if (typeof value === "string") {
    if (schema.minLength != null && value.trim().length < schema.minLength) errs.push(`${where}: must not be empty`);
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) errs.push(`${where}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
  }
  if (typeOf(value) === "object") {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${where}: missing «${k}»`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties && k in schema.properties) errs.push(...schemaErrors(schema.properties[k], v, `${at}/${k}`, top));
      else if (schema.additionalProperties === false) errs.push(`${where}: unknown field «${k}»`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errs.push(`${where}: needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((v, i) => errs.push(...schemaErrors(schema.items, v, `${at}/${i}`, top)));
    if (schema.contains) {
      const n = value.filter((v) => ok(schema.contains, v)).length;
      const min = schema.minContains ?? 1, max = schema.maxContains ?? Infinity;
      const what = Object.keys(schema.contains.properties || {}).join(", ") || "the condition";
      if (n < min || n > max) errs.push(`${where}: ${n} item(s) with ${what}; must be ${min === max ? `exactly ${min}` : `${min} or more`}`);
    }
  }
  if (schema.oneOf && schema.oneOf.filter((s) => ok(s, value)).length !== 1) {
    const sub = schema.oneOf.map((s) => schemaErrors(s, value, at, top)).sort((a, b) => a.length - b.length)[0];
    errs.push(...(sub && sub.length ? sub : [`${where}: must match exactly one alternative`]));
  }
  if (schema.anyOf && !schema.anyOf.some((s) => ok(s, value))) errs.push(`${where}: needs ${schema.anyOf.map((s) => (s.required || []).join("+") || "?").join(" or ")}`);
  if (schema.if) {
    if (ok(schema.if, value)) { if (schema.then) errs.push(...schemaErrors(schema.then, value, at, top)); }
    else if (schema.else) errs.push(...schemaErrors(schema.else, value, at, top));
  }
  return errs;
}

/** Errors of a questions document: the schema, and what a schema cannot say (unique ids and letters, the id's role,
 *  the answer's letter being one of the options). */
export function validateDoc(doc) {
  const errs = schemaErrors(loadSchema(), doc);
  if (errs.length) return errs;
  const ids = new Set();
  for (const [i, q] of doc.preguntas.entries()) {
    const at = `/preguntas/${i} (${q.id})`;
    if (ids.has(q.id)) errs.push(`${at}: duplicated id`);
    ids.add(q.id);
    if (!q.id.startsWith(`Q-${doc.rol}-`)) errs.push(`${at}: the id must be Q-${doc.rol}-NNN (the file's role)`);
    const letters = q.opciones.map((o) => o.letra);
    if (new Set(letters).size !== letters.length) errs.push(`${at}: repeated option letter`);
    const l = q.respuesta && q.respuesta.letra;
    if (l && !letters.includes(l)) errs.push(`${at}: answer ${l} is not one of its options (${letters.join(", ")})`);
  }
  return errs;
}

// ------------------------------------------------------------------ the Markdown view
const viewNote = (role) => `<!-- Vista generada desde questions-${role}.json por \`sdd questions\`: no se edita a mano (se regenera). Pregunta nueva: \`sdd questions add --role ${role}\`. -->`;

/** Raw `## Q-…` blocks of a Markdown questions file, up to the next `## ` heading: [{ id, text }]. */
export function markdownBlocks(md) {
  return [...String(md || "").matchAll(/^## Q-[\s\S]*?(?=^## |(?![\s\S]))/gm)]
    .map((m) => ({ id: m[0].split(/\s+/)[1], text: m[0].replace(/\s+$/, "") }));
}

const effectText = (o) => `${o.efecto}${(o.ficheros || []).length ? " " + o.ficheros.join(" ") : ""}`;

/** The «Answer:» line of an answer object (the same words the notary wrote in the .md before the JSON). */
export function answerLine(r) {
  if (!r) return "Answer:";
  return `Answer: ${r.letra ? `${r.letra} — ` : ""}${r.como} ${r.quien} (${r.fecha})${r.texto ? `: ${r.texto}` : ""}`;
}

/** One JSON question as the Markdown block of references/async-questions.md §2. */
export function renderBlock(q) {
  const o = [`## ${q.id} [${q.estado}] skill=${q.skill}${q.contexto ? ` context=${q.contexto}` : ""}${q.tema ? ` tema=${q.tema}` : ""}${q.fusionada ? ` merged-into=${q.fusionada}` : ""}`,
    `Question: ${q.pregunta}`, `Para el cliente: ${q.para_cliente}`, "Options:"];
  for (const op of q.opciones) {
    o.push(`  ${op.letra}) ${op.texto}${op.recomendada ? " (recommended)" : ""}`, `     efecto: ${effectText(op)}`);
    if (op.cliente) o.push(`     cliente: ${op.cliente}`);
  }
  if (q.bloquea) o.push(`Blocks: ${q.bloquea}`);
  o.push(answerLine(q.respuesta));
  if (q.aplicada) o.push(`Applied: ${q.aplicada}`);
  return o.join("\n");
}

/** The view of a role: header, the questions only the .md had (written before the JSON, kept verbatim and first) and
 *  the JSON ones in order. Same order the gates number them (Q1, Q2…). */
export function renderMarkdown(doc, prevMd = "") {
  const ids = new Set(doc.preguntas.map((q) => q.id));
  const legacy = markdownBlocks(prevMd).filter((b) => !ids.has(b.id)).map((b) => b.text);
  return [`# Questions — ${doc.rol}`, viewNote(doc.rol), ...legacy, ...doc.preguntas.map(renderBlock)].join("\n\n") + "\n";
}

/** Writes through a temporary file in the same directory and a rename: a reader never sees half a file, and a failure
 *  leaves the previous one whole. */
export function writeAtomic(abs, text) {
  mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
  try { writeFileSync(tmp, text); renameSync(tmp, abs); }
  catch (e) { try { unlinkSync(tmp); } catch { /* gone */ } throw e; }
}

const filesOf = (root, role) => ({ json: path.join(root, SOURCE_DIR, `questions-${role}.json`), md: path.join(root, SOURCE_DIR, `questions-${role}.md`) });
const readText = (abs) => { try { return readFileSync(abs, "utf8"); } catch { return ""; } };

/** The JSON of a role ({rol, preguntas: []} when it does not exist yet). Throws on a file that is not JSON. */
export function readDoc(root, role) {
  const { json } = filesOf(root, role);
  if (!existsSync(json)) return { version: 1, rol: role, preguntas: [] };
  try { return JSON.parse(readFileSync(json, "utf8")); }
  catch (e) { throw new QError(`${SOURCE_DIR}/questions-${role}.json is not valid JSON (${e.message})`); }
}

/** Validates and writes the JSON and then its view, each atomically: the JSON first, it is the truth. */
export function saveDoc(root, doc) {
  const errs = validateDoc(doc);
  if (errs.length) throw new QError(`questions-${doc.rol}.json would not be valid: ${errs.join("; ")}`);
  const { json, md } = filesOf(root, doc.rol);
  writeAtomic(json, JSON.stringify(doc, null, 2) + "\n");
  const prev = readText(md), view = renderMarkdown(doc, prev);
  if (view !== prev) writeAtomic(md, view);
}

/** Regenerates every view from its JSON (after a JSON written by hand, or a view edited by hand): [{file, error?}]. */
export function renderAll(root) {
  const out = [];
  for (const f of questionFiles(path.join(root, SOURCE_DIR), JSON_RE)) {
    const role = f.name.match(JSON_RE)[1];
    try {
      const doc = readDoc(root, role);
      const errs = validateDoc(doc);
      if (errs.length) throw new QError(errs.join("; "));
      const md = filesOf(root, role).md;
      const prev = readText(md), view = renderMarkdown(doc, prev);
      if (view !== prev) { writeAtomic(md, view); out.push({ file: `${SOURCE_DIR}/questions-${role}.md` }); }
    } catch (e) { out.push({ file: `${SOURCE_DIR}/${f.name}`, error: e.message }); }
  }
  return out;
}

/** Every JSON's errors: [{file, errors[]}] (only the files with errors). */
export function validateAll(root) {
  const out = [];
  for (const f of questionFiles(path.join(root, SOURCE_DIR), JSON_RE)) {
    const role = f.name.match(JSON_RE)[1];
    let errs;
    try { errs = validateDoc(readDoc(root, role)); } catch (e) { errs = [e.message]; }
    if (!errs.length && readDoc(root, role).rol !== role) errs = [`«rol» is ${readDoc(root, role).rol}, the file says ${role}`];
    if (errs.length) out.push({ file: `${SOURCE_DIR}/${f.name}`, errors: errs });
  }
  return out;
}

const STAGE_FIELDS = ["skill", "contexto", "tema", "pregunta", "para_cliente", "opciones", "bloquea"];

/** A stage's new question: always OPEN and without an answer (a stage never answers; the guard denies it too).
 *  Its id is the next free Q-<role>-NNN, counting the questions only the .md has. Returns the id. */
export function addQuestion(root, role, input) {
  if (!ROLE_RE.test(role || "")) throw new QError(`invalid role «${role}»`);
  if (typeOf(input) !== "object") throw new QError("the question must be a JSON object");
  if (input.respuesta != null || (input.estado && input.estado !== "OPEN") || input.aplicada)
    throw new QError("a new question is OPEN and has no answer: only the notary or the lead answers (sdd questions answer)");
  const extra = Object.keys(input).filter((k) => !STAGE_FIELDS.includes(k) && !["id", "estado", "respuesta", "aplicada"].includes(k));
  if (extra.length) throw new QError(`unknown field(s) ${extra.join(", ")} (a question has ${STAGE_FIELDS.join(", ")})`);
  // Lo que lee el cliente va en castellano (taller3: «Keep the mandated texts; the scan skips…» como opción B)
  const textoCliente = [input.para_cliente, ...(Array.isArray(input.opciones) ? input.opciones.map((o) => typeOf(o) === "object" ? (o.cliente || o.texto) : o) : [])]
    .filter((t) => typeof t === "string");
  const ingles = textoCliente.filter((t) => (t.match(/\b(the|and|keep|both|without|with|should|skip|skips|reword|because|is|are|which|their)\b/gi) || []).length >= 2);
  if (ingles.length) throw new QError(`the customer reads «Para el cliente» and the options: write them in Spanish («${ingles[0].slice(0, 60)}…»); technical detail goes in «pregunta»`);
  // Una sola pregunta abierta por criterio (taller3: REQ-NF-001 AC1 se preguntó desde aceptación y desde el
  // implementador, y además era una impugnación: tres cosas para una sola duda)
  const citas = new Set(`${input.contexto || ""} ${input.pregunta || ""}`.match(/REQ-[A-Z]+-\d+\s+AC\d+/g) || []);
  if (citas.size) {
    for (const f of questionFiles(path.join(root, SOURCE_DIR), JSON_RE)) {
      let otro;
      try { otro = readDoc(root, f.name.match(JSON_RE)[1]); } catch { continue; }
      for (const q of otro.preguntas || []) {
        if (q.estado !== "OPEN") continue;
        const suyas = `${q.contexto || ""} ${q.pregunta || ""}`.match(/REQ-[A-Z]+-\d+\s+AC\d+/g) || [];
        const comun = suyas.find((c) => citas.has(c));
        if (comun) throw new QError(`${q.id} is already OPEN about ${comun}: do not open a second question on the same criterion (extend that one, or wait for its answer)`);
      }
    }
  }
  // Una sola pregunta por tema, de cualquier rol (material-montana: la zona horaria se preguntó tres veces, con
  // recomendadas distintas, y lo ya contestado se volvía a abrir en la etapa siguiente)
  if (input.tema != null) {
    if (typeof input.tema !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(input.tema)) throw new QError(`tema is a slug (lowercase, digits and dashes): «${input.tema}»`);
    for (const f of questionFiles(path.join(root, SOURCE_DIR), JSON_RE)) {
      let otro;
      try { otro = readDoc(root, f.name.match(JSON_RE)[1]); } catch { continue; }
      for (const q of otro.preguntas || []) {
        if (q.tema !== input.tema) continue;
        if (q.estado === "OPEN") throw new QError(`${q.id} is already OPEN about «${input.tema}»: do not open a second question on the same topic (extend that one with sdd questions merge, or wait for its answer)`);
        if (q.estado === "ANSWERED") throw new QError(`${q.id} already decided «${input.tema}» (${answerLine(q.respuesta)}): apply that decision, do not ask it again`);
      }
    }
  }
  const doc = readDoc(root, role);
  const prefix = `Q-${role}-`;
  const nums = [...doc.preguntas.map((q) => q.id), ...markdownBlocks(readText(filesOf(root, role).md)).map((b) => b.id)]
    .filter((id) => id.startsWith(prefix)).map((id) => Number(id.slice(prefix.length))).filter(Number.isFinite);
  const id = `${prefix}${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
  const q = { id, skill: input.skill, ...(input.contexto ? { contexto: input.contexto } : {}), ...(input.tema ? { tema: input.tema } : {}), estado: "OPEN",
    pregunta: input.pregunta, para_cliente: input.para_cliente,
    opciones: Array.isArray(input.opciones) ? input.opciones.map((o) => (typeOf(o) === "object" ? { ...o, ficheros: o.ficheros || [] } : o)) : input.opciones,
    ...(input.bloquea ? { bloquea: input.bloquea } : {}), respuesta: null };
  for (const k of Object.keys(q)) if (q[k] === undefined) delete q[k];
  saveDoc(root, { ...doc, version: 1, rol: role, preguntas: [...doc.preguntas, q] });
  return id;
}

/** Which role's JSON holds a question id (null when no JSON has it: a question only in a .md). */
export function roleOf(root, id) {
  for (const f of questionFiles(path.join(root, SOURCE_DIR), JSON_RE)) {
    const role = f.name.match(JSON_RE)[1];
    let doc;
    try { doc = readDoc(root, role); } catch { continue; }
    if ((doc.preguntas || []).some((q) => q.id === id)) return role;
  }
  return null;
}

/** Writes the answer of an OPEN question ({letra | texto, como, quien, fecha}) in its JSON and regenerates the view.
 *  The same answer again is a no-op (a notary that resumes after a failure); a different one is an error. */
export function answerQuestion(root, id, ans) {
  const role = roleOf(root, id);
  if (!role) throw new QError(`${id} is not in any ${SOURCE_DIR}/questions-*.json (a question only in a .md is answered in the .md, references/async-questions.md §5)`);
  const doc = readDoc(root, role);
  const q = doc.preguntas.find((x) => x.id === id);
  const r = { ...(ans.letra ? { letra: ans.letra } : {}), ...(ans.texto ? { texto: ans.texto } : {}),
    como: ans.como || (ans.letra ? "elegida por" : "respondida por"), quien: ans.quien, fecha: ans.fecha || new Date().toISOString().slice(0, 10) };
  if (q.estado === "ANSWERED") {
    if (q.respuesta && (q.respuesta.letra || "") === (r.letra || "") && (q.respuesta.texto || "") === (r.texto || "")) return { id, role, changed: false };
    throw new QError(`${id} is already answered (${answerLine(q.respuesta)})`);
  }
  q.estado = "ANSWERED";
  q.respuesta = r;
  saveDoc(root, doc);
  return { id, role, changed: true };
}

/** Two OPEN questions about the same thing: `from` becomes MERGED (not shown, not answered) pointing to `into`, which
 *  keeps its options and takes the other's context and topic. The gate then asks once. */
export function mergeQuestion(root, from, into) {
  if (from === into) throw new QError("a question cannot be merged into itself");
  const rf = roleOf(root, from), ri = roleOf(root, into);
  if (!rf) throw new QError(`${from} is not in any ${SOURCE_DIR}/questions-*.json`);
  if (!ri) throw new QError(`${into} is not in any ${SOURCE_DIR}/questions-*.json`);
  const df = readDoc(root, rf), di = rf === ri ? df : readDoc(root, ri);
  const qf = df.preguntas.find((x) => x.id === from), qi = di.preguntas.find((x) => x.id === into);
  if (qf.estado === "MERGED" && qf.fusionada === into) return { id: from, into, changed: false };
  if (qf.estado !== "OPEN") throw new QError(`${from} is ${qf.estado}: only an OPEN question can be merged`);
  if (qi.estado !== "OPEN") throw new QError(`${into} is ${qi.estado}: merge into an OPEN question`);
  qf.estado = "MERGED"; qf.fusionada = into;
  const ctx = [qi.contexto, qf.contexto ? `${from}: ${qf.contexto}` : from].filter(Boolean).join("; ");
  qi.contexto = ctx;
  if (!qi.tema && qf.tema) { qi.tema = qf.tema; delete qf.tema; }
  saveDoc(root, df);
  if (di !== df) saveDoc(root, di);
  return { id: from, into, changed: true };
}

// ------------------------------------------------------------------ reading (list, view)
/** Blocks of one Markdown questions file: [{ id, state, skill, context, question, client, options[{letter, text, effect}], blocks, answer, applied }]. */
export function parseQuestions(text, file = "") {
  const out = [];
  let cur = null, opt = null;
  for (const raw of String(text || "").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const h = line.match(HEAD_RE);
    if (h) {
      const attrs = Object.fromEntries([...h[3].matchAll(/(\w+)=(\S+)/g)].map((m) => [m[1], m[2]]));
      cur = { id: h[1], state: h[2], skill: attrs.skill || null, context: attrs.context || null, file, question: "", client: "",
        options: [], blocks: "", answer: "", applied: "" };
      opt = null;
      out.push(cur); continue;
    }
    if (!cur) continue;
    if (/^#{1,2}\s/.test(line)) { cur = null; continue; }
    let m;
    if ((m = line.match(/^Question:\s*(.*)$/))) cur.question = m[1];
    else if ((m = line.match(/^Para el cliente:\s*(.*)$/i))) cur.client = m[1];
    else if ((m = line.match(/^\s*([A-Z])\)\s*(.*)$/))) { opt = { letter: m[1], text: m[2], effect: null }; cur.options.push(opt); }
    else if ((m = line.match(/^\s+efecto:\s*(.*)$/i)) && opt) opt.effect = m[1];
    else if ((m = line.match(/^Blocks:\s*(.*)$/))) cur.blocks = m[1];
    else if ((m = line.match(/^Answer:\s*(.*)$/))) cur.answer = m[1];
    else if ((m = line.match(/^Applied:\s*(.*)$/))) cur.applied = m[1];
  }
  return out;
}

/** A JSON question in the shape of parseQuestions (what list and view print). */
function fromJson(q, file) {
  return { id: q.id, state: q.estado, skill: q.skill || null, context: q.contexto || null, ...(q.tema ? { topic: q.tema } : {}),
    ...(q.fusionada ? { merged_into: q.fusionada } : {}), file, question: q.pregunta || "",
    client: q.para_cliente || "",
    options: (q.opciones || []).map((o) => ({ letter: o.letra, text: o.texto, ...(o.cliente ? { client: o.cliente } : {}), effect: effectText(o), recommended: !!o.recomendada })),
    blocks: q.bloquea || "", answer: q.respuesta ? answerLine(q.respuesta).replace(/^Answer:\s*/, "") : "", applied: q.aplicada || "" };
}

/** The questions of one directory, in view order: each .md's blocks (the JSON's version of those it has) and then the
 *  JSON's questions the view does not show yet (a JSON written by hand). A JSON without .md is read too. */
function loadDir(dir, from) {
  const list = [];
  const roles = new Set([...questionFiles(dir, FILE_RE).map((f) => f.name.slice(10, -3)), ...questionFiles(dir, JSON_RE).map((f) => f.name.slice(10, -5))]);
  for (const role of [...roles].sort()) {
    const md = path.join(dir, `questions-${role}.md`), js = path.join(dir, `questions-${role}.json`);
    let doc = null;
    if (existsSync(js)) { try { doc = JSON.parse(readFileSync(js, "utf8")); } catch { doc = null; } }
    const byId = new Map(((doc && doc.preguntas) || []).map((q) => [q.id, q]));
    const seen = new Set();
    for (const q of parseQuestions(readText(md), `${from}/questions-${role}.md`)) {
      seen.add(q.id);
      list.push(byId.has(q.id) ? fromJson(byId.get(q.id), `${from}/questions-${role}.json`) : q);
    }
    for (const q of byId.values()) if (!seen.has(q.id)) list.push(fromJson(q, `${from}/questions-${role}.json`));
  }
  return list;
}

/** Every question of the project: the live files of .sdd/, else the versioned mirror (a fresh clone has no .sdd/). */
export function loadQuestions(root) {
  const live = path.join(root, SOURCE_DIR);
  if (questionFiles(live, ANY_RE).length) return { from: SOURCE_DIR, questions: loadDir(live, SOURCE_DIR) };
  return { from: MIRROR_DIR, questions: loadDir(path.join(root, MIRROR_DIR), MIRROR_DIR) };
}

const oneLine = (s) => String(s || "").replace(/\|/g, "/").replace(/\s+/g, " ").trim() || "—";

/** `[NEEDS CLARIFICATION …]` markers still in spec/ (the pending part of spec/CLARIFICATIONS-PENDING.md): [{ file, line, text }]. */
export function specMarkers(root) {
  const out = [];
  const walk = (abs, depth) => {
    let es = [];
    try { es = readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of es.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(abs, e.name);
      if (e.isDirectory() && depth < 6) walk(p, depth + 1);
      else if (e.isFile() && /\.md$/i.test(e.name) && !/^CLARIFICATIONS/i.test(e.name)) {
        let t = "";
        try { t = readFileSync(p, "utf8"); } catch { continue; }
        t.split("\n").forEach((l, i) => { if (/\[NEEDS CLARIFICATION/i.test(l)) out.push({ file: path.relative(root, p).split(path.sep).join("/"), line: i + 1, text: l.trim() }); });
      }
    }
  };
  walk(path.join(root, "spec"), 0);
  return out;
}

/** The generated view: open questions first (what is pending), then the decisions taken (answered). Markdown. */
export function renderView({ from, questions, markers = [] }) {
  const open = questions.filter((q) => q.state === "OPEN");
  const done = questions.filter((q) => q.state === "ANSWERED");
  const o = ["# Preguntas y decisiones", "",
    `> Vista generada por \`sdd questions view\` desde \`${from}/questions-*\`. No se edita a mano: se regenera.`, "",
    `## Pendientes (${open.length})`, ""];
  if (open.length) {
    o.push("| Id | Para el cliente | Pregunta | Bloquea |", "|---|---|---|---|");
    for (const q of open) o.push(`| ${q.id} | ${oneLine(q.client)} | ${oneLine(q.question)} | ${oneLine(q.blocks)} |`);
  } else o.push("Ninguna.");
  if (markers.length) {
    o.push("", `## Marcadores [NEEDS CLARIFICATION] en spec/ (${markers.length})`, "");
    for (const m of markers) o.push(`- \`${m.file}:${m.line}\` ${oneLine(m.text)}`);
  }
  o.push("", `## Decididas (${done.length})`, "");
  if (done.length) {
    o.push("| Id | Para el cliente | Respuesta | Aplicada |", "|---|---|---|---|");
    for (const q of done) o.push(`| ${q.id} | ${oneLine(q.client || q.question)} | ${oneLine(q.answer)} | ${oneLine(q.applied)} |`);
  } else o.push("Ninguna.");
  return o.join("\n") + "\n";
}

// ------------------------------------------------------------------ CLI
let PROG = "sdd";
class Exit extends Error { constructor(code) { super(`exit ${code}`); this.code = code; } }
const USAGE = "questions add --role R [--file F|-] [--json] | answer Q-ID (--letter L | --text T) --by WHO [--how H] [--date D] | merge Q-ID --into Q-ID | validate [--json] | render | sync | list [--open] [--json] | view [--out FILE]";
function usage(msg) { console.error(`${PROG}: ${msg}`); console.error(`usage: ${PROG} ${USAGE}`); throw new Exit(2); }

export function runQuestions(argv, { prog = "sdd" } = {}) {
  PROG = prog;
  try {
    const o = { _: [], json: false, open: false, out: null, root: ".", role: null, file: null, letter: null, text: null, by: null, how: null, date: null, into: null };
    const VAL = { "--out": "out", "--repo": "root", "--dir": "root", "--role": "role", "--file": "file", "--letter": "letter", "--text": "text", "--by": "by", "--how": "how", "--date": "date", "--into": "into" };
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--json") o.json = true;
      else if (a === "--open") o.open = true;
      else if (a in VAL) { if (i + 1 >= argv.length) usage(`${a} needs a value`); o[VAL[a]] = argv[++i]; }
      else if (a.startsWith("-") && a !== "-") usage(`unknown option ${a}`);
      else o._.push(a);
    }
    const sub = o._.shift();
    const root = path.resolve(o.root);
    if (sub === "add") {
      if (!o.role) usage("add needs --role (the file .sdd/questions-<role>.json)");
      const src = o.file && o.file !== "-" ? path.resolve(root, o.file) : 0;   // 0: stdin (a heredoc)
      let input;
      try { input = JSON.parse(readFileSync(src, "utf8")); }
      catch (e) { throw new QError(`the question is not valid JSON (${e.message})`); }
      const ids = (Array.isArray(input) ? input : [input]).map((q) => addQuestion(root, o.role, q));
      if (o.json) console.log(JSON.stringify({ added: ids, file: `${SOURCE_DIR}/questions-${o.role}.json` }));
      else console.log(`questions: ${ids.join(", ")} added to ${SOURCE_DIR}/questions-${o.role}.json (view: ${SOURCE_DIR}/questions-${o.role}.md)`);
      return 0;
    }
    if (sub === "answer") {
      const id = o._[0];
      if (!id) usage("answer needs the question id");
      if (!o.letter && !o.text) usage("answer needs --letter or --text");
      if (o.letter && !/^[A-Z]$/.test(o.letter)) usage("--letter is one capital letter");
      if (!o.by) usage("answer needs --by (who answers)");
      const r = answerQuestion(root, id, { letra: o.letter, texto: o.text, como: o.how, quien: o.by, fecha: o.date });
      if (o.json) console.log(JSON.stringify(r));
      else console.log(r.changed ? `questions: ${id} answered in ${SOURCE_DIR}/questions-${r.role}.json` : `questions: ${id} already had that answer`);
      return 0;
    }
    if (sub === "merge") {
      const id = o._[0];
      if (!id || !o.into) usage("merge needs the question id and --into Q-ID");
      const r = mergeQuestion(root, id, o.into);
      if (o.json) console.log(JSON.stringify(r));
      else console.log(r.changed ? `questions: ${id} merged into ${o.into}` : `questions: ${id} was already merged into ${o.into}`);
      return 0;
    }
    if (sub === "validate") {
      const bad = validateAll(root);
      if (o.json) console.log(JSON.stringify({ ok: !bad.length, files: bad }, null, 2));
      else { for (const b of bad) for (const e of b.errors) console.error(`${b.file}: ${e}`); if (!bad.length) console.log("questions: every .sdd/questions-*.json is valid"); }
      return bad.length ? 1 : 0;
    }
    if (sub === "render") {
      const r = renderAll(root);
      for (const x of r) if (x.error) console.error(`${PROG}: questions: ${x.file}: ${x.error}`);
      if (o.json) console.log(JSON.stringify({ rendered: r }));
      else console.log(`questions: ${r.filter((x) => !x.error).length} view(s) regenerated`);
      return r.some((x) => x.error) ? 1 : 0;
    }
    if (sub === "sync") {
      const w = syncQuestions(root);
      if (o.json) console.log(JSON.stringify({ written: w }, null, 2));
      else console.log(w.length ? `questions: ${w.length} file(s) copied to ${MIRROR_DIR}/ (${w.join(", ")})` : `questions: ${MIRROR_DIR}/ already up to date`);
      return 0;
    }
    if (sub === "list") {
      const r = loadQuestions(root);
      const qs = o.open ? r.questions.filter((q) => q.state === "OPEN") : r.questions;
      if (o.json) console.log(JSON.stringify({ from: r.from, questions: qs }, null, 2));
      else {
        for (const q of qs) console.log(`${q.id} [${q.state}] ${q.client || q.question}${q.answer ? ` → ${q.answer}` : ""}`);
        console.log(`questions: ${qs.length} (${r.questions.filter((q) => q.state === "OPEN").length} open) from ${r.from}/`);
      }
      return 0;
    }
    if (sub === "view") {
      const md = renderView({ ...loadQuestions(root), markers: specMarkers(root) });
      if (o.out) { const abs = path.resolve(root, o.out); mkdirSync(path.dirname(abs), { recursive: true }); writeFileSync(abs, md); console.log(`questions: view written to ${o.out}`); }
      else process.stdout.write(md);
      return 0;
    }
    usage(`unknown questions command ${sub ?? "(none)"}: use add, answer, merge, validate, render, sync, list or view`);
  } catch (e) {
    if (e instanceof Exit) return e.code;
    if (e instanceof QError) { console.error(`${PROG}: questions: ${e.message}`); return 1; }
    throw e;
  }
  return 0;
}
