// sdd lint --arch: the architecture that makes the shortest path the right one (Lauren Tan, AI Engineer Code Summit
// 11/2026: «the shortest path is the best path»; agents copy the patterns they find). One folder per use case under
// <code_path>/features/<uc-slug>/, and a feature never reaches into another one: what two features share lives in
// <code_path>/shared/ (or any folder outside features/).
//
//   A-01 error    a file of features/<a>/ imports a file of features/<b>/ (b ≠ a)
//   A-02 warning  code_paths has a features/ folder and a source file sits loose in code_paths/ next to it (not in
//                 features/, shared/ or another folder): it is neither a feature nor shared code
//
// Without a features/ folder the lint has nothing to say (exit 0): the plan and the tasks decide when to start one.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

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
export function lintArch({ root, codePaths = ["src"] } = {}) {
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
  const errors = findings.filter((f) => f.severity === "error").length;
  return { findings, summary: { files, features: features.size, errors, warnings: findings.length - errors } };
}
