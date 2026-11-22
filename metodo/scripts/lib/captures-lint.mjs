// captures-lint.mjs — `sdd lint --captures`: before the acceptance, does each capture show what its criterion promises?
// Node >= 18, no dependencies. Library only: no console output, no process.exit.
//
// The club (Hermes, 11/2026) had 27 WRONG-CAPTURE findings out of 54 adversarial ones: the test checked by API or CSV
// and the capture did not show what the criterion promised; a capture came from a test.step of a test whose title cited
// other criteria; one image backed ten criteria. Each finding below is a pattern of that run, found without a browser.
//
//   C-01 error    a capture call (`captura(`, `captureCriterion(`, `.screenshot(`) comes after an API check
//                 (`request.`, `fetch(`) with no on-screen assertion in between (`expect(<page>.getBy…|locator(…))`,
//                 or the helper's own `{ ve: [...] }`): what the capture should show was checked off-screen.
//   C-02 warning  one image backs more than 3 criteria, or an image that shows a criterion is named after another one.
//   C-03 error    the test that takes a REQ-F criterion's capture does not cite that criterion in its title: statically
//                 (the capture id names a criterion the enclosing test's title does not cite — a test.step does not
//                 count) and in the ledger (`unbound_captures`: the PNG is an attachment of such a test).
//   C-05 error    a capture of a REQ-F criterion with «Se ve» texts that does not pass { ve: [...] }
//   C-06 error    its ve list lacks one of those texts (warning when ve is not an inline list)
//   C-07 error    (narration: required; warning with warn) a visible criterion no video narrates (evidence of the run)
//   C-08 error    its narration does not say its «Se ve» texts
//   C-04 warning  an id cited in a test file (UC-NNN, REQ-X-NNN, WF-NNN, AC-NNN-NN) that exists nowhere in
//                 requirements/, spec/, plan/, design/ or ux/.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { testKeys, scenarioIndex, faseScope } from "./acceptance.mjs";
import { splitComments, testFiles } from "./quotes.mjs";
import { templateParts } from "../sdd-jev.mjs";
import { says as saysPart } from "./match.mjs";

const CAPTURE_CALL = /\b(captura|captureCriterion|capturar|captureEvidence)\s*\(|\.screenshot\s*\(/g;
const API_CALL = /\brequest\s*\.\s*(get|post|put|patch|delete|fetch|head)\s*\(|\bfetch\s*\(/g;
const LOCATOR_ASSERT = /expect(?:\.soft)?\s*\(\s*[\w$.]*?(?:getBy\w+|locator|frameLocator)\s*\(|expect(?:\.soft)?\s*\(\s*[\w$]+\s*\)\s*\.\s*(?:toHaveTitle|toHaveURL)\b|\bve\s*:\s*\[/;
const TEST_START = /^\s*(?:test|it)(?:\.(?:only|skip|fixme|fail|slow))?\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/;
const ID_RE = /(?<![A-Za-z0-9])(UC-\d{3,}|WF-\d{3,}|AC-\d{3,}-\d{2,}|REQ-[A-Z]+(?:-[A-Z0-9]+)*-\d{3,})(?![A-Za-z0-9])/g;

const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

/** The text of a call from its name to its closing parenthesis (strings and nesting respected; at most 2,000 chars). */
function callText(code, at) {
  const open = code.indexOf("(", at);
  if (open < 0) return "";
  let depth = 0, q = null;
  for (let i = open; i < Math.min(code.length, open + 2000); i++) {
    const c = code[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === "`") q = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { depth--; if (depth === 0) return code.slice(at, i + 1); }
  }
  return code.slice(at, Math.min(code.length, open + 2000));
}

/** Test blocks of a source file: [{ title, start (offset), end, line }] (a block runs to the next test at its indent or less). */
function testBlocks(code) {
  const lines = code.split("\n");
  const starts = [];
  let off = 0;
  lines.forEach((l, i) => {
    const m = l.match(TEST_START);
    if (m) starts.push({ title: m[2], start: off, line: i + 1, indent: l.length - l.trimStart().length });
    off += l.length + 1;
  });
  return starts.map((s, k) => {
    const next = starts.slice(k + 1).find((x) => x.indent <= s.indent);
    return { ...s, end: next ? next.start : code.length };
  });
}

/** The first string argument after the first two of a capture call (`captura(page, testInfo, 'AC-008-04')`). */
function captureId(code, at) {
  const m = code.slice(at, at + 300).match(/^[^(]*\(\s*[^,()]+,\s*[^,()]+,\s*(['"`])((?:\\.|(?!\1).)*)\1/);
  return m ? m[2] : null;
}

/** Ids that exist in the repo's documents. */
function knownIds(root) {
  const ids = new Set();
  const walk = (abs, depth) => {
    let st;
    try { st = statSync(abs); } catch { return; }
    if (st.isDirectory()) {
      if (depth > 6) return;
      let es = [];
      try { es = readdirSync(abs); } catch { return; }
      for (const e of es) if (!e.startsWith(".") && e !== "node_modules") walk(path.join(abs, e), depth + 1);
    } else if (/\.(md|ya?ml|json|feature)$/i.test(abs) && st.size < 4 * 1024 * 1024) {
      let t = "";
      try { t = readFileSync(abs, "utf8"); } catch { return; }
      for (const m of t.matchAll(ID_RE)) ids.add(m[1]);
    }
  };
  for (const d of ["requirements", "spec", "plan", "design", "ux"]) if (existsSync(path.join(root, d))) walk(path.join(root, d), 0);
  return ids;
}

/** The one comparator (lib/match.mjs), under the name this lint has always exported. */
export { says as saysPart } from "./match.mjs";

/**
 * Run the lint. opts: { root, reqs, scenarios, ledger (from `sdd accept`, optional), scope: Set | null, testPaths }.
 * Returns { findings: [{ code, severity: error|warning, file, line, req?, ac?, message }], summary }.
 */
export function lintCaptures({ root, reqs, scenarios = [], ledger = null, scope = null, testPaths, fase, narration = "off", evidenceDir = "evidencias" } = {}) {
  const findings = [];
  const { byScenario } = scenarioIndex(scenarios);
  const reqF = new Set(reqs.filter((r) => r.type === "F" && !r.deprecated).map((r) => r.id));
  const inScope = (id) => !scope || scope.has(id);
  const known = knownIds(root);
  const haveDocs = known.size > 0;
  const files = testFiles(root, testPaths);
  let captureCalls = 0;
  for (const f of files) {
    let text;
    try { text = readFileSync(f.abs, "utf8"); } catch { continue; }
    const { code } = splitComments(text, f.rel);
    // C-04: ids cited in the test file that the documents do not know
    if (haveDocs) {
      const seen = new Set();
      for (const m of code.matchAll(ID_RE)) {
        const id = m[1];
        if (seen.has(id) || known.has(id)) continue;
        seen.add(id);
        findings.push({ code: "C-04", severity: "warning", file: f.rel, line: lineOf(code, m.index),
          message: `${id} is cited here and exists nowhere in requirements/, spec/, plan/, design/ or ux/ (a typo, or an id renamed since)` });
      }
    }
    if (!CAPTURE_CALL.test(code)) continue;
    CAPTURE_CALL.lastIndex = 0;
    for (const b of testBlocks(code)) {
      const body = code.slice(b.start, b.end);
      const title = testKeys(b.title);
      const cites = new Set([...title.reqAcs.map((x) => `${x.req}#${x.ac}`),
        ...title.scenarios.flatMap((s) => (byScenario.get(s) || []).map((t) => `${t.req}#${t.n}`))]);
      let prev = 0;
      for (const m of body.matchAll(CAPTURE_CALL)) {
        captureCalls++;
        const at = m.index;
        const line = lineOf(code, b.start + at);
        const call = body.slice(at, body.indexOf(")", at) > 0 ? Math.min(body.length, at + 400) : at + 1);
        const id = captureId(body, at) || "";
        const keys = testKeys(id);
        const targets = [...keys.reqAcs.map((x) => ({ req: x.req, ac: x.ac })),
          ...keys.scenarios.flatMap((s) => (byScenario.get(s) || []).map((t) => ({ req: t.req, ac: t.n, sid: s })))];
        // C-01: the last API call before this capture (since the previous capture), with no on-screen assert after it
        const seg = body.slice(prev, at);
        const apis = [...seg.matchAll(API_CALL)];
        if (apis.length && !(scope && targets[0] && !inScope(targets[0].req))) {
          const last = apis[apis.length - 1];
          const after = seg.slice(last.index);
          const helperAsserts = /\bve\s*:\s*\[/.test(call.split(/\)\s*;/)[0]);
          if (!LOCATOR_ASSERT.test(after.replace(API_CALL, "")) && !helperAsserts) {
            findings.push({ code: "C-01", severity: "error", file: f.rel, line, ...(targets[0] ? { req: targets[0].req, ac: targets[0].ac } : {}),
              message: `the capture${id ? ` "${id}"` : ""} comes right after an API check (line ${lineOf(code, b.start + prev + last.index)}) with no on-screen assertion in between: assert on the page what the criterion promises (or pass { ve: [...] } to the capture helper) before capturing` });
          }
        }
        prev = at + 1;
        // C-03 (static): the capture names a criterion that this test's title does not cite
        for (const t of targets) {
          if (!reqF.has(t.req) || !inScope(t.req) || t.ac < 1) continue;
          if (!cites.has(`${t.req}#${t.ac}`))
            findings.push({ code: "C-03", severity: "error", file: f.rel, line, req: t.req, ac: t.ac,
              message: `the capture "${id}" of ${t.req} AC${t.ac} is taken inside the test "${b.title.slice(0, 80)}", whose title does not cite ${t.req} AC${t.ac}${t.sid ? ` (${t.sid})` : ""}: the ledger cannot tie the image to a test of the criterion (a test.step title does not count); move it to a test that cites the criterion` });
        }
        // C-05 / C-06: the capture asserts what its criterion's «Se ve:» line promises (before: a sentence of the
        // implementer's prompt, often forgotten; the capture then showed another screen or nothing of the criterion)
        const callTxt = callText(body, at);
        for (const t of targets) {
          if (!reqF.has(t.req) || !inScope(t.req) || t.ac < 1) continue;
          const sv = reqs.find((r) => r.id === t.req)?.sees?.[t.ac - 1];
          if (!sv || !sv.texts?.length) continue;
          const veM = callTxt.match(/\bve\s*:\s*(\[)?/);
          if (!veM) {
            findings.push({ code: "C-05", severity: "error", file: f.rel, line, req: t.req, ac: t.ac,
              message: `the capture "${id}" of ${t.req} AC${t.ac} does not pass the criterion's «Se ve» texts: call it with { ve: [${sv.texts.map((x) => JSON.stringify(x.text)).join(", ")}] } so the helper asserts them on screen before the screenshot` });
            continue;
          }
          const falta = sv.texts.filter((x) => (x.template ? templateParts(x.text) : [x.text]).some((p) => !saysPart(callTxt, p)));
          if (falta.length)
            findings.push({ code: "C-06", severity: veM[1] ? "error" : "warning", file: f.rel, line, req: t.req, ac: t.ac,
              message: `the capture "${id}" of ${t.req} AC${t.ac} does not assert ${falta.map((x) => `«${x.text}»`).join(", ")} from its «Se ve» line${veM[1] ? "" : " (ve is not an inline list: check it by hand)"}` });
        }
      }
    }
  }
  // From the ledger: captures taken by a test that does not cite the criterion; one image for many criteria
  if (ledger) {
    const byImage = new Map();
    for (const r of ledger.requirements || []) {
      if (r.type !== "F" || r.verdict === "DEPRECATED" || !inScope(r.id)) continue;
      for (const c of r.criteria || []) {
        // An extra capture that does not count is only an error when the criterion has no capture of its own: when its
        // own test already shows it (shown_by, passing), the stray image changes nothing (material-montana, FASE-0:
        // two such images made the gate «grave» and took it away from Jev)
        const ownShown = (c.shown_by || []).length > 0 && c.state === "pass";
        for (const u of c.unbound_captures || [])
          if (!findings.some((x) => x.code === "C-03" && x.req === r.id && x.ac === c.n))
            findings.push({ code: "C-03", severity: ownShown ? "warning" : "error", file: u.ref, line: 0, req: r.id, ac: c.n,
              message: `not counted for ${r.id} AC${c.n}: ${u.reason}${ownShown ? " (the criterion is already shown by its own capture)" : ""}` });
        for (const p of c.shown_by || []) {
          if (!byImage.has(p)) byImage.set(p, []);
          byImage.get(p).push(`${r.id} AC${c.n}`);
          const base = path.basename(p);
          const ids = [...(c.scenarios || []), `${r.id}-AC${c.n}`];
          const named = testKeys(base);
          const namesOther = named.scenarios.length + named.reqAcs.length > 0
            && !ids.some((id) => new RegExp(`(?:^|[^A-Za-z0-9])${id.split("-").join("[-_ ]")}(?!\\d)`, "i").test(base));
          if (namesOther)
            findings.push({ code: "C-02", severity: "warning", file: p, line: 0, req: r.id, ac: c.n,
              message: `${p} shows ${r.id} AC${c.n} but is named after another criterion: capture this criterion's own screen` });
        }
      }
    }
    for (const [p, crits] of byImage) if (crits.length > 3)
      findings.push({ code: "C-02", severity: "warning", file: p, line: 0,
        message: `${p} is the only image of ${crits.length} criteria (${crits.slice(0, 6).join(", ")}${crits.length > 6 ? ", …" : ""}): one screen rarely shows that many promises; capture each criterion where its THEN is visible` });
  }
  // C-07 / C-08: the demo says each criterion while the screen shows it (Stack Profile `narration: required|warn|off`).
  // From the evidence of the run (the harness helper writes <video>.narracion.json and each capture's `narrado`):
  // C-07 a visible REQ-F criterion that no video narrates; C-08 its narration does not say its «Se ve» texts, so what is
  // said and what is seen are not the same promise. Only once the run left captures (before it, there is nothing to read).
  if (narration === "required" || narration === "warn") {
    const sev = narration === "required" ? "error" : "warning";
    const base = path.join(root, evidenceDir);
    const dirs = fase !== undefined && fase !== null ? [path.join(base, `FASE-${fase}`)]
      : (existsSync(base) ? readdirSync(base).filter((d) => /^FASE-\d+$/.test(d)).map((d) => path.join(base, d)) : []);
    const said = new Map();
    let captures = 0;
    const add = (id, t) => { if (id && t) (said.get(id) || said.set(id, []).get(id)).push(String(t)); };
    for (const d of dirs) {
      if (!existsSync(d)) continue;
      for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) {
        let j; try { j = JSON.parse(readFileSync(path.join(d, f), "utf8")); } catch { continue; }
        if (f.endsWith(".narracion.json")) for (const n of j.narraciones || []) add(n.criterio, n.texto);
        else if (j && j.criterio && j.imagen) { captures++; add(j.criterio, j.narrado); }
      }
    }
    if (captures) {
      const { byCriterion } = scenarioIndex(scenarios);
      const rel = path.relative(root, dirs[0] || base) || evidenceDir;
      // Sin --fase, solo los criterios de las FASEs que ya tienen evidencias: los de una FASE aún sin hacer no se
      // pueden haber narrado (material-montana3 y 4: 10 avisos graves «no narrado» de FASEs que no se entregaban,
      // en la puerta de una entrega parcial; eran lo único que impedía que Jev la firmara)
      let hechas = null;
      if (fase === undefined || fase === null) {
        hechas = new Set();
        for (const d of dirs) {
          const n = path.basename(d).replace(/^FASE-/, "");
          const ids = faseScope(root, n).requirements;
          if (ids) for (const id of ids) hechas.add(id); else { hechas = null; break; }   // un plan sin Requisitos: todo
        }
      }
      for (const r of reqs) {
        if (r.type !== "F" || r.deprecated || !inScope(r.id) || (hechas && !hechas.has(r.id))) continue;
        (r.criteria || []).forEach((_, i) => {
          const sv = r.sees?.[i];
          if (!sv || !sv.texts?.length) return;
          const ids = [...(byCriterion.get(`${r.id}#${i + 1}`) || []), `${r.id}-AC${i + 1}`];
          const textos = ids.flatMap((id) => said.get(id) || []);
          if (!textos.length) {
            findings.push({ code: "C-07", severity: sev, file: rel, line: 0, req: r.id, ac: i + 1,
              message: `${r.id} AC${i + 1} (${ids[0]}) is not narrated in any video: before its capture call narrar(page, testInfo, <its sentence from .sdd/demo/GUION-FASE-N.md>, { criterio: '${ids[0]}' })` });
            return;
          }
          const falta = sv.texts.filter((x) => (x.template ? templateParts(x.text) : [x.text]).some((p) => !textos.some((t) => saysPart(t, p))));
          if (falta.length)
            findings.push({ code: "C-08", severity: sev, file: rel, line: 0, req: r.id, ac: i + 1,
              message: `${r.id} AC${i + 1} (${ids[0]}) is narrated without saying ${falta.map((x) => `«${x.text}»`).join(", ")}: what is said must be what its capture shows` });
        });
      }
    }
  }
  const order = { "C-01": 1, "C-03": 2, "C-05": 3, "C-06": 4, "C-07": 5, "C-08": 6, "C-02": 7, "C-04": 8 };
  findings.sort((a, b) => order[a.code] - order[b.code] || a.file.localeCompare(b.file) || a.line - b.line);
  const count = (s) => findings.filter((x) => x.severity === s).length;
  return { findings, summary: { test_files: files.length, capture_calls: captureCalls, errors: count("error"), warnings: count("warning") } };
}
