// sdd lint --arch: the architecture that makes the shortest path the right one (Lauren Tan, AI Engineer Code Summit
// 11/2026: «the shortest path is the best path»; agents copy the patterns they find). One folder per use case under
// <code_path>/features/<uc-slug>/, and a feature never reaches into another one: what two features share lives in
// <code_path>/shared/ (or any folder outside features/).
//
//   A-01 error    a file of features/<a>/ imports a file of features/<b>/ (b ≠ a)
//   A-02 warning  code_paths has a features/ folder and a source file sits loose in code_paths/ next to it (not in
//                 features/, shared/ or another folder): it is neither a feature nor shared code
//
//   A-03 error    a test pins the CLOSED set of screens, routes, links or menu entries (toEqual / toStrictEqual with a
//                 literal list, toHaveLength / toHaveCount with a number): every later FASE that adds a screen breaks it
//                 and has to ask a person to edit an accepted test (material-montana3 and 4: one stop per FASE). Test
//                 that the entries the criterion names are there, not that nothing else is. With `since` (a git ref),
//                 only test files that did not exist at that ref: an accepted test is not edited without a person.
//
// Without a features/ folder A-01/A-02 have nothing to say (exit 0): the plan and the tasks decide when to start one.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { testFiles } from "./quotes.mjs";

const SRC = /\.(m?[jt]sx?|vue|svelte|astro)$/;
const IMPORT = /(?:\bimport\s+(?:[^'"`;]*?\s+from\s+)?|\bexport\s+[^'"`;]*?\s+from\s+|\bimport\s*\(\s*)(['"])([^'"]+)\1/g;

function walk(dir, out = []) {
  let es = [];
  try { es = readdirSync(dir).sort(); } catch { return out; }
  for (const e of es) {
    if (e.startsWith(".") || e === "node_modules") continue;
    const abs = path.join(dir, e);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) walk(abs, out);
    else if (SRC.test(e)) out.push(abs);
  }
  return out;
}

/** opts: { root, codePaths: ["src"] } → { findings: [{code, severity, file, line, message}], summary } */
const SET_WORDS = /\b(nav|menu|men[uú]s?|enlaces?|links?|rutas?|routes?|pantallas?|screens?|tabs?|pesta[nñ]as?|secciones|sections?)\b/i;
const PINS = /^\s*\.(toEqual|toStrictEqual|toHaveLength|toHaveCount)\(\s*([\[{]|\d)/;
/** A-03: the expect(...) calls of a test file that pin the closed set of screens or menu entries. */
export function closedSetPins(text) {
  const out = [];
  for (const m of text.matchAll(/\bexpect\s*\(/g)) {
    let i = m.index + m[0].length, depth = 1;
    for (; i < text.length && depth > 0; i++) { if (text[i] === "(") depth++; else if (text[i] === ")") depth--; }
    const subject = text.slice(m.index + m[0].length, i - 1);
    const pin = PINS.exec(text.slice(i, i + 80));
    if (pin && SET_WORDS.test(subject)) out.push({ line: text.slice(0, m.index).split("\n").length, matcher: pin[1], subject: subject.replace(/\s+/g, " ").slice(0, 80) });
  }
  return out;
}

export function lintArch({ root, codePaths = ["src"], since = null } = {}) {
  const findings = [];
  let files = 0, features = new Set();
  for (const cp of codePaths) {
    const base = path.join(root, cp);
    const featDir = path.join(base, "features");
    if (!existsSync(featDir)) continue;
    const featureOf = (abs) => {
      const rel = path.relative(featDir, abs);
      return rel.startsWith("..") || path.isAbsolute(rel) ? null : rel.split(path.sep)[0];
    };
    for (const abs of walk(base)) {
      files++;
      const rel = path.relative(root, abs).split(path.sep).join("/");
      const mine = featureOf(abs);
      if (mine) features.add(mine);
      else if (path.dirname(abs) === base && !/^(main|index|app|router|routes)\.[^.]+$/.test(path.basename(abs)))
        findings.push({ code: "A-02", severity: "warning", file: rel, line: 1,
          message: `${rel} sits loose next to features/: move it into its use case's folder (features/<uc>/) or, if two features share it, into shared/` });
      if (!mine) continue;
      const text = readFileSync(abs, "utf8");
      for (const m of text.matchAll(IMPORT)) {
        const spec = m[2];
        if (!spec.startsWith(".")) continue;
        const target = featureOf(path.resolve(path.dirname(abs), spec));
        if (target && target !== mine)
          findings.push({ code: "A-01", severity: "error", file: rel, line: text.slice(0, m.index).split("\n").length,
            message: `features/${mine} imports features/${target} («${spec}»): a feature never reaches into another; move what both need to shared/ (or merge them if they are one use case)` });
      }
    }
  }
  // A-03: tests that pin the closed set of screens or menu entries
  const existed = (rel) => since && spawnSync("git", ["-C", root, "cat-file", "-e", `${since}:${rel}`]).status === 0;
  for (const f of testFiles(root)) {
    if (existed(f.rel)) continue;
    let text; try { text = readFileSync(f.abs, "utf8"); } catch { continue; }
    for (const p of closedSetPins(text))
      findings.push({ code: "A-03", severity: "error", file: f.rel, line: p.line,
        message: `pins the closed set of «${p.subject}» with ${p.matcher}: the next FASE that adds a screen breaks this accepted test. Check that the entries the criterion names are present (toContain, toContainEqual, toBeVisible), never that there are no others` });
  }
  const errors = findings.filter((f) => f.severity === "error").length;
  return { findings, summary: { files, features: features.size, errors, warnings: findings.length - errors } };
}
