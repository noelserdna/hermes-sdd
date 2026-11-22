// quotes.mjs — the literal lint (sdd-pipeline 5.1, `sdd lint --quotes`): does the test that verifies a criterion carry
// the criterion's letter? Node >= 18, no dependencies. Library only: no console output, no process.exit.
//
// Pairs. A test file is a source file under the Stack Profile's test_paths (default tests). It names a criterion when its
// code (comments removed) carries `REQ-X-NNN ACn`, or a scenario id AC-NNN-NN that a BDD tag of spec/tests/BDD-*.md
// binds to `[REQ-X-NNN ACn]` (the same index as the acceptance ledger). Each (criterion, file) is one pair.
//
// Findings per pair:
//   Q-01 warn   the file has no quote comment `REQ-X-NNN ACn: "…"` (tdd-workflow.md, "The criterion's letter sits
//               above its assert").
//   Q-02 error  a quote comment for the criterion is not the criterion's current text: normalized (whitespace
//               collapsed, the quote marks ' " « » “ ” ‘ ’ ` made equal, case kept), each fragment between `…` must be
//               a substring of the criterion, in order. A forged quote, or one left behind by a MODIFY.
//   Q-03 error  a literal of the criterion does not appear in the file's code outside comments (same normalization).
//               A literal in a comment (the quote itself) does not count.
//
// What counts as a literal of the criterion:
//   - the text between "…", '…', «…», “…” or ‘…’ anywhere in the criterion (a single quote opens and closes only
//     next to a non-letter, so an apostrophe — user's — is not a quote);
//   - the text between backticks only in the THEN part (from the first THEN / ENTONCES): an expected output or message
//     such as `No tasks`. A backtick span before THEN is the command or route the test drives (`todo add "Buy milk"`,
//     `/projects`); a helper builds it, so it is not required verbatim, and quotes inside it are not literals either;
//   - empty literals ("") are ignored.
// With the «Se ve» contract (a `- Se ve:` / `- No visible:` line under the criterion, sdd-jev.mjs parseSees) the
// literals are typed (requiredLiterals): the `Se ve:` texts and the THEN's own literals are exact text; a text with a
// {variable} is a template, only its fixed parts are required; a literal the GIVEN/WHEN already quotes is data of the
// example («lucia») and is not required verbatim. Criteria without the contract keep the rule above.
// Clauses (sdd-pipeline 5.2, from the taller: 8 of 16 adversarial findings were WEAKENED-ASSERT, mostly a clause the test
// never asserted). Two more findings per pair:
//   Q-04 error  a clause of the THEN that says something stays as it was («las plazas siguen siendo 2», «y no cambia nada
//               más», «nada cambia») or speaks of every case («todos los textos», «ningún otro», «otras formas») has no
//               clause comment `REQ-X-NNN ACn cláusula: "…"` (or `clause:`) quoting it — with its key word — followed by
//               an assertion within the next 10 lines. Such a clause has no literal for Q-03 to find, and a test that
//               checks the message alone passes. «Nada más» is checked against the whole state read before the action.
//   Q-05 error  an alternative of a list the GIVEN/WHEN joins with «o»/«or» ("0" o "dos") is not in the test's code:
//               the criterion asks for every case, not one of them. A person may except it as a literal (below).
// A literal a helper builds (never verbatim in the file) is a false positive: a person records
// `sdd accept record literal-exception --req ID --ac N --literal TEXT --reason …`, which holds while the
// requirement's text keeps its reqHash.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { stackProfile } from "./git-log.mjs";
import { testKeys, reqHash, acNumber, scenarioIndex } from "./acceptance.mjs";
import { templateParts } from "../sdd-jev.mjs";
import { says } from "./match.mjs";

export const LITERAL_MODES = ["off", "warn", "enforce"];
export const QUOTE_CODES = { missingQuote: "Q-01", staleQuote: "Q-02", missingLiteral: "Q-03", uncheckedClause: "Q-04", missingAlternative: "Q-05" };

/** Stack Profile `literal_gate`: off | warn | enforce; default and any other value: enforce. */
export function literalGate(root) {
  const v = String(stackProfile(root).literal_gate || "").trim().toLowerCase();
  return LITERAL_MODES.includes(v) ? v : "enforce";
}

// ------------------------------------------------------------------ normalization
const QUOTE_CHARS = /["'«»“”‘’„‚`´]/g;
/** Whitespace collapsed, every quote mark made `"`, escaped quotes unescaped; case kept. */
export function normLiteral(s) {
  return String(s ?? "").normalize("NFC").replace(/\\(["'`])/g, "$1").replace(QUOTE_CHARS, '"').replace(/\s+/g, " ").trim();
}

// ------------------------------------------------------------------ literals of a criterion
const mask = (s, from, len) => s.slice(0, from) + " ".repeat(len) + s.slice(from + len);

/** Literals of one criterion: [{ literal, kind: "quote" | "code" }], unique by normalized text. */
export function criterionLiterals(text) {
  const s = String(text || "");
  let thenAt = s.search(/\b(?:THEN|ENTONCES)\b/);
  if (thenAt < 0) thenAt = s.search(/\b(?:then|entonces)\b/i);
  if (thenAt < 0) thenAt = 0;
  const found = [];
  let rest = s;
  for (const m of s.matchAll(/`([^`]*)`/g)) {
    if (m.index >= thenAt) found.push({ at: m.index, literal: m[1], kind: "code" });
    rest = mask(rest, m.index, m[0].length);
  }
  // Outer pairs first: an inner quote (“the title 'X'”) is part of the outer literal, which is the stronger check.
  for (const re of [/«([^»]*)»/g, /“([^”]*)”/g, /"([^"]*)"/g, /‘([^’]*)’/g, /(?<![\p{L}\p{N}])'([^'\n]*?)'(?![\p{L}\p{N}])/gu]) {
    for (const m of [...rest.matchAll(re)]) {
      found.push({ at: m.index, literal: m[1], kind: "quote" });
      rest = mask(rest, m.index, m[0].length);
    }
  }
  const seen = new Set(), out = [];
  for (const f of found.sort((a, b) => a.at - b.at)) {
    const k = normLiteral(f.literal);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ literal: f.literal.trim(), kind: f.kind });
  }
  return out;
}

/**
 * What Q-03 asks the test to carry, typed: [{ literal, kind: "exact" | "template" | "code" | "quote", parts }]; every
 * part must be in the test's code. Without a «Se ve» contract (`sees` undefined: a criterion written before it), every
 * literal of the criterion, verbatim (the original rule). With it:
 *   - exact text: each `Se ve:` text, and each literal of the THEN that is not data of the example;
 *   - template: a text with a {variable} («Hola, {usuario}»): only its fixed parts («Hola,»), whoever the actor is;
 *   - data of the example: a literal that the GIVEN or the WHEN already quotes («lucia», «pista 2») — the test may use
 *     other data (a second actor) and still prove the criterion, so it is not required verbatim.
 */
export function requiredLiterals(text, sees) {
  const lits = criterionLiterals(text);
  if (!sees) return lits.map((l) => ({ ...l, parts: [l.literal] }));
  const s = String(text || "");
  let thenAt = s.search(/\b(?:THEN|ENTONCES)\b/);
  if (thenAt < 0) thenAt = s.length;
  const data = new Set(criterionLiterals(s.slice(0, thenAt)).map((l) => normLiteral(l.literal)));
  const out = [], seen = new Set();
  const add = (literal, kind) => {
    const k = normLiteral(literal);
    if (!k || seen.has(k)) return;
    seen.add(k);
    const template = /\{[^{}]+\}/.test(literal);
    const parts = template ? templateParts(literal) : [literal];
    if (parts.length) out.push({ literal, kind: template ? "template" : kind, parts });
  };
  for (const t of sees.texts || []) add(t.text, "exact");
  // «Hola, lucia» in the THEN is one instance of the template «Hola, {usuario}»: data of the example too
  const instance = (sees.texts || []).filter((t) => t.template).map((t) => new RegExp(`^${normLiteral(t.text)
    .split(/\{[^{}]+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+")}$`, "u"));
  for (const l of lits) {
    const k = normLiteral(l.literal);
    if (!data.has(k) && !instance.some((re) => re.test(k))) add(l.literal, l.kind === "code" ? "code" : "exact");
  }
  return out;
}

// ------------------------------------------------------------------ clauses (Q-04, Q-05)
const W = "(?<![\\p{L}\\p{N}])", WE = "(?![\\p{L}\\p{N}])";
const INVARIANT = new RegExp(`${W}(?:sigue|siguen|seguirá|seguirán|no cambian?|nada (?:más )?cambia|sin cambiar|sin cambios|no se (?:modifica|modifican|altera|alteran|borra|borran|crea|crean|añade|añaden|mueve|mueven)|permanece|permanecen|se mantiene|se mantienen|(?:se )?queda(?:n)? (?:igual|como estaba|como estaban)|remains?|unchanged|stays?|nothing (?:else )?changes|does not change|do not change)${WE}`, "iu");
const UNIVERSAL = new RegExp(`${W}(?:todos|todas|toda la|todo el|ningún|ninguna|ninguno|cualquier|cualquiera|otras formas|otros|otras|all|every|any|none|no other)${WE}`, "iu");
const QUOTED = [/«[^»]*»/g, /“[^”]*”/g, /"[^"]*"/g, /‘[^’]*’/g, /`[^`]*`/g, /(?<![\p{L}\p{N}])'[^'\n]*?'(?![\p{L}\p{N}])/gu];
/** The criterion with every quoted span blanked (same length), and the spans: [{ at, end, literal }] by position. */
function maskQuoted(text) {
  let m = String(text || "");
  const spans = [];
  for (const re of QUOTED) for (const x of [...m.matchAll(re)]) {
    spans.push({ at: x.index, end: x.index + x[0].length, literal: x[0].slice(1, -1).trim() });
    m = mask(m, x.index, x[0].length);
  }
  return { masked: m, spans: spans.sort((a, b) => a.at - b.at) };
}
const thenIndex = (s) => {
  let at = s.search(/\b(?:THEN|ENTONCES)\b/);
  if (at < 0) at = s.search(/\b(?:then|entonces)\b/i);
  return at;
};

/** Clauses of a criterion a test must assert on their own: [{ kind: "invariant" | "universal", clause, key }]. The THEN
 *  (the whole text when there is none, as in a constraint) is split into its conjuncts — at «,», «;», « y », « e »,
 *  « and », outside quotes — and a conjunct with a word of «stays as it was» or «every case» is one clause. */
export function criterionClauses(text) {
  const s = String(text || "");
  const at = Math.max(0, thenIndex(s));
  let { masked } = maskQuoted(s);
  // a separator inside parentheses («(inscripción, espera)») does not split the clause
  for (let d = 0, open = -1, i = 0; i < masked.length; i++) {
    if (masked[i] === "(") { if (!d++) open = i; }
    else if (masked[i] === ")" && d && !--d) masked = mask(masked, open, i - open + 1);
  }
  const out = [];
  const sep = /\s*(?:[,;]|\s(?:y|e|and)\s)\s*/giu;
  let from = at;
  const pieces = [];
  for (const m of masked.slice(at).matchAll(sep)) {
    const i = at + m.index, j = i + m[0].length;
    // «tasks 1 and 3», «"Lucía" y "Pablo"»: a pair of values, not two clauses
    if (/[\p{N}"'»”’`]$/u.test(s.slice(0, i)) && /^[\p{N}"'«“‘`]/u.test(s.slice(j)) && !/[,;]/.test(m[0])) continue;
    pieces.push([from, i]); from = j;
  }
  pieces.push([from, s.length]);
  for (const [a, b] of pieces) {
    const plain = masked.slice(a, b);
    for (const [kind, re] of [["invariant", INVARIANT], ["universal", UNIVERSAL]]) {
      const k = plain.match(re);
      if (!k) continue;
      const clause = s.slice(a, b).replace(/^\s*(?:THEN|ENTONCES|then|entonces)\s+/, "")
        .replace(/^(?:the user sees|el usuario ve|la persona ve|se ve)\s+/i, "").replace(/[.:;,\s]+$/, "").trim();
      out.push({ kind, clause, key: k[0] });
      break;
    }
  }
  return out;
}

/** Alternatives of the GIVEN/WHEN: each list of quoted literals joined by «,» and a final «o»/«u»/«or» ("0" o "dos")
 *  → [[ "0", "dos" ], …]. A list in the THEN is not one: «sees "A" or "B"» accepts either. */
export function criterionAlternatives(text) {
  const s = String(text || "");
  let end = thenIndex(s);
  if (end < 0) return [];
  const { spans } = maskQuoted(s);
  const before = spans.filter((x) => x.end <= end);
  const out = [];
  let chain = [], joined = false;
  const flush = () => { if (chain.length > 1 && joined) out.push(chain.map((x) => x.literal).filter(Boolean)); chain = []; joined = false; };
  for (const x of before) {
    if (!chain.length) { chain = [x]; continue; }
    const gap = s.slice(chain[chain.length - 1].end, x.at);
    if (/^\s*,\s*$/.test(gap)) chain.push(x);
    else if (/^\s*,?\s*(?:o|u|ó|or)\s*$/iu.test(gap)) { chain.push(x); joined = true; }
    else { flush(); chain = [x]; }
  }
  flush();
  return out.filter((a) => a.length > 1);
}

/** Clause comments of a file: [{ req, ac, quote, line }] — `REQ-X-NNN ACn cláusula: "…"` (or `clause:`). */
export function findClauseQuotes(comments) {
  const CLOSE = { '"': '"', "'": "'", "«": "»", "“": "”", "‘": "’" };
  const out = [];
  for (const c of comments)
    for (const m of c.text.matchAll(/(?<![A-Za-z0-9])(REQ-[A-Z]+(?:-[A-Z0-9]+)*-\d+)[\s_-]+AC0*(\d+)(?!\d)\s+(?:cl[áa]usula|clause)\s*:\s*(["'«“‘])/giu)) {
      const body = c.text.slice(m.index + m[0].length);
      const end = body.lastIndexOf(CLOSE[m[3]]);
      out.push({ req: m[1], ac: Number(m[2]), quote: (end < 0 ? body : body.slice(0, end)).trim(), line: c.line });
    }
  return out;
}
const ASSERT = /\bexpect\s*[.(]|\bassert\w*\b|\.should\b|\bt\.(?:is|not|deepEqual|true|false|ok|equal|like|throws)\w*\s*\(|\bXCTAssert|\brequire\.\w+\s*\(|\bcheck\w*\s*\(/;
/** Whether a clause comment at `line` has an assertion on its own line or within the next 10 lines of code. */
function assertsBelow(codeLines, line) {
  for (let k = line - 1; k < Math.min(codeLines.length, line + 10); k++) if (ASSERT.test(codeLines[k] || "")) return true;
  return false;
}
/** A clause comment answers a clause when its quote is part of the clause (or the clause part of it) and carries the
 *  clause's key word. */
function answers(quote, c) {
  const q = normLiteral(quote).toLowerCase();
  return q.includes(normLiteral(c.key).toLowerCase()) && (quoteMatches(quote, c.clause) || quoteMatches(c.clause, quote));
}

/** True when `quote` (a test's quote comment) is the criterion's text: each fragment between ellipses is a substring
 *  of the criterion, in order. */
export function quoteMatches(quote, criterion) {
  const c = normLiteral(criterion);
  const parts = normLiteral(quote).split(/…|\.\.\./).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return false;
  let from = 0;
  for (const p of parts) {
    const i = c.indexOf(p, from);
    if (i < 0) return false;
    from = i + p.length;
  }
  return true;
}

// ------------------------------------------------------------------ source files
const HASH_COMMENTS = new Set([".rb", ".py", ".sh", ".bash", ".feature", ".ex", ".exs", ".r", ".pl", ".yml", ".yaml", ".toml", ".cr", ".nim"]);
export const SOURCE_EXT = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx", ".vue", ".svelte", ".rb", ".py", ".go", ".java",
  ".kt", ".kts", ".scala", ".groovy", ".cs", ".fs", ".php", ".rs", ".swift", ".dart", ".ex", ".exs", ".feature", ".sh", ".bash",
  ".c", ".cc", ".cpp", ".h", ".hpp", ".m", ".clj", ".cr", ".nim", ".r", ".pl"]);
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Split a source file into code and comments. Returns { code, comments: [{ line, text }] }: `code` keeps every
 * character outside comments (comments become spaces, newlines stay, so line numbers hold); each comment line is one
 * entry (a block comment gives one per line, leading `*` removed). Strings are skipped so that `//` or `#` inside
 * them is not a comment; a '…' or "…" string ends at the end of its line (Rust lifetimes, stray apostrophes).
 * Comment syntax by extension: `#` for Ruby, Python, shell, Gherkin, Elixir…; `//` and `/* … *\/` otherwise.
 */
export function splitComments(text, file = "") {
  const ext = path.extname(file).toLowerCase();
  const hash = HASH_COMMENTS.has(ext);
  const py = ext === ".py";
  const src = String(text);
  let code = "";
  const comments = [];
  let line = 1, i = 0;
  const n = src.length;
  const addComment = (from, to, startLine) => {
    const body = src.slice(from, to);
    body.split("\n").forEach((l, k) => {
      const t = l.replace(/^\s*(?:\/\/+|#+|\/\*+|\*+(?!\/))\s?/, "").replace(/\s*\*+\/\s*$/, "").trim();
      if (t) comments.push({ line: startLine + k, text: t });
    });
    code += body.replace(/[^\n]/g, " ");
  };
  while (i < n) {
    const ch = src[i];
    if (ch === "\n") { code += ch; line++; i++; continue; }
    // Comments.
    if (hash ? ch === "#" : (ch === "/" && src[i + 1] === "/")) {
      let j = src.indexOf("\n", i); if (j < 0) j = n;
      addComment(i, j, line); i = j; continue;
    }
    if (!hash && ch === "/" && src[i + 1] === "*") {
      let j = src.indexOf("*/", i + 2); j = j < 0 ? n : j + 2;
      const start = line;
      addComment(i, j, start);
      line += (src.slice(i, j).match(/\n/g) || []).length;
      i = j; continue;
    }
    // Strings.
    if (py && (src.startsWith('"""', i) || src.startsWith("'''", i))) {
      const q = src.slice(i, i + 3);
      let j = src.indexOf(q, i + 3); j = j < 0 ? n : j + 3;
      const s = src.slice(i, j); code += s; line += (s.match(/\n/g) || []).length; i = j; continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n && src[j] !== ch) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "\n" && ch !== "`") break;
        j++;
      }
      j = Math.min(n, src[j] === ch ? j + 1 : j);
      const s = src.slice(i, j); code += s; line += (s.match(/\n/g) || []).length; i = j; continue;
    }
    code += ch; i++;
  }
  return { code, comments };
}

/** Quote comments of a file: [{ req, ac, quote, line }]. A quote opens with ' " « “ ‘ right after `REQ-X-NNN ACn:` and
 *  closes at the last matching mark of its comment line, or of a following comment line (a quote wrapped over
 *  several comment lines); unclosed, it runs to the end of the line. */
export function findQuotes(comments) {
  const CLOSE = { '"': '"', "'": "'", "«": "»", "“": "”", "‘": "’" };
  const out = [];
  comments.forEach((c, k) => {
    for (const m of c.text.matchAll(/(?<![A-Za-z0-9])(REQ-[A-Z]+(?:-[A-Z0-9]+)*-\d+)[\s_-]+AC0*(\d+)(?!\d)\s*:\s*(["'«“‘])/g)) {
      const close = CLOSE[m[3]];
      let body = c.text.slice(m.index + m[0].length);
      let end = body.lastIndexOf(close);
      for (let j = k + 1; end < 0 && j < comments.length && j <= k + 10 && comments[j].line === comments[j - 1].line + 1; j++) {
        body += " " + comments[j].text;
        end = body.lastIndexOf(close);
      }
      out.push({ req: m[1], ac: Number(m[2]), quote: (end < 0 ? body : body.slice(0, end)).trim(), line: c.line });
    }
  });
  return out;
}

const profileList = (v) => String(v || "").split(",").map((s) => s.trim().replace(/^\.\//, "").replace(/\/+$/, "")).filter(Boolean);
/** The Stack Profile's test_paths (default tests). */
export function testPathsOf(root) {
  const t = profileList(stackProfile(root).test_paths);
  return t.length ? t : ["tests"];
}

/** Source files under the test paths: [{ abs, rel }] (posix rel), skipping dot directories and node_modules. */
export function testFiles(root, testPaths = testPathsOf(root)) {
  const out = [], seen = new Set();
  const walk = (abs) => {
    let st;
    try { st = statSync(abs); } catch { return; }
    if (st.isDirectory()) {
      let entries = [];
      try { entries = readdirSync(abs); } catch { return; }
      for (const e of entries.sort()) if (!e.startsWith(".") && e !== "node_modules" && e !== "__snapshots__") walk(path.join(abs, e));
    } else if (st.isFile() && SOURCE_EXT.has(path.extname(abs).toLowerCase()) && st.size <= MAX_BYTES && !seen.has(abs)) {
      seen.add(abs);
      out.push({ abs, rel: path.relative(root, abs).split(path.sep).join("/") });
    }
  };
  for (const p of testPaths) walk(path.resolve(root, p));
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

// ------------------------------------------------------------------ lint
/** Literal exceptions of decisions.jsonl that still hold: same reqHash as the requirement's current text. */
export function literalExceptions(records, reqs) {
  const byId = new Map(reqs.map((r) => [r.id, r]));
  return (records || []).filter((r) => r.type === "literal-exception").map((r) => {
    const req = byId.get(r.req);
    return { ...r, current: Boolean(req) && !req.deprecated && r.reqHash === reqHash(req) };
  });
}

/**
 * Run the lint. opts: { root, reqs, scenarios, records (decisions), scope: Set of REQ ids | null, testPaths }.
 * Returns { findings: [{ code, severity: warn|error|excepted, req, ac, file, line, message, literal?, quote?, exception? }],
 *           summary: { files, test_files, pairs, criteria, errors, warnings, excepted }, pairs: [{ req, ac, file }] }.
 */
export function lintQuotes({ root, reqs, scenarios = [], records = [], scope = null, testPaths } = {}) {
  const byId = new Map(reqs.map((r) => [r.id, r]));
  const { byScenario } = scenarioIndex(scenarios);
  const exceptions = literalExceptions(records, reqs).filter((e) => e.current);
  const files = testFiles(root, testPaths || testPathsOf(root));
  const findings = [], pairs = [];
  let filesWithPairs = 0;
  for (const f of files) {
    let text;
    try { text = readFileSync(f.abs, "utf8"); } catch { continue; }
    if (!/AC[-_ ]?\d/i.test(text)) continue;
    const { code, comments } = splitComments(text, f.rel);
    // Criteria this file names in its code, with the first line that names each.
    const named = new Map();
    code.split("\n").forEach((l, k) => {
      const keys = testKeys(l);
      const hits = [...keys.reqAcs];
      for (const sid of keys.scenarios) for (const t of byScenario.get(sid) || []) if (t.n > 0) hits.push({ req: t.req, ac: t.n });
      for (const h of hits) {
        const req = byId.get(h.req);
        if (!req || req.deprecated || h.ac < 1 || h.ac > req.criteria.length) continue;
        if (scope && !scope.has(h.req)) continue;
        const key = `${h.req}#${h.ac}`;
        if (!named.has(key)) named.set(key, { req, ac: h.ac, line: k + 1 });
      }
    });
    if (!named.size) continue;
    filesWithPairs++;
    const quotes = findQuotes(comments);
    const clauseQuotes = findClauseQuotes(comments);
    const codeNorm = normLiteral(code);
    const codeLines = code.split("\n");
    for (const { req, ac, line } of [...named.values()].sort((a, b) => a.line - b.line)) {
      pairs.push({ req: req.id, ac, file: f.rel });
      const text = req.criteria[ac - 1];
      const mine = quotes.filter((q) => q.req === req.id && q.ac === ac);
      const base = { req: req.id, ac, file: f.rel };
      if (!mine.length)
        findings.push({ code: "Q-01", severity: "warn", ...base, line, message: `no quote comment \`${req.id} AC${ac}: "…"\` above the assert (sdd req show ${req.id} --ac ${ac})` });
      for (const q of mine.filter((x) => !quoteMatches(x.quote, text)))
        findings.push({ code: "Q-02", severity: "error", ...base, line: q.line, quote: q.quote, message: `the quote is not the current text of ${req.id} AC${ac} (forged, or left behind by a MODIFY): quote it again with sdd req show ${req.id} --ac ${ac}` });
      const at = mine.length ? mine[0].line : line;
      const clauses = clauseQuotes.filter((q) => q.req === req.id && q.ac === ac);
      for (const c of criterionClauses(text)) {
        const ok = clauses.filter((q) => answers(q.quote, c));
        if (ok.some((q) => assertsBelow(codeLines, q.line))) continue;
        const why = ok.length ? `its clause comment (line ${ok[0].line}) has no assertion in the next 10 lines`
          : `no clause comment \`${req.id} AC${ac} cláusula: "${c.clause}"\` above the assert that checks it`;
        findings.push({ code: "Q-04", severity: "error", ...base, line: ok.length ? ok[0].line : at, clause: c.clause, kind: c.kind,
          message: `the clause "${c.clause}" of ${req.id} AC${ac} (${c.kind === "invariant" ? "something that stays as it was: read it before the action and assert it after" : "every case: assert all of them, not a sample"}) is not asserted on its own — ${why}` });
      }
      for (const alts of criterionAlternatives(text)) for (const alt of alts) {
        const a = normLiteral(alt);
        // a short alternative («x», «0») must be a whole string of the code, not a letter of `expect`
        if (a.length >= 3 ? codeNorm.includes(a) : codeNorm.includes(`"${a}"`)) continue;
        const ex = exceptions.find((e) => e.req === req.id && acNumber(e.ac) === ac && normLiteral(e.literal) === normLiteral(alt));
        findings.push({ code: "Q-05", severity: ex ? "excepted" : "error", ...base, line: at, literal: alt,
          message: `the alternative "${alt}" of ${req.id} AC${ac} (${alts.map((a) => `"${a}"`).join(" o ")}) is not in the test's code: the criterion asks for every case${ex ? ` — excepted by ${ex.by} (${ex.role}), acceptance/decisions.jsonl:${ex.line}` : ""}`,
          ...(ex ? { exception: { line: ex.line, by: ex.by, role: ex.role, reason: ex.reason } } : {}) });
      }
      for (const lit of requiredLiterals(text, (req.sees || [])[ac - 1])) {
        if (lit.parts.every((p) => says(codeNorm, normLiteral(p)))) continue;
        const ex = exceptions.find((e) => e.req === req.id && acNumber(e.ac) === ac && normLiteral(e.literal) === normLiteral(lit.literal));
        const what = lit.kind === "template" ? `the form of the template "${lit.literal}" (${lit.parts.map((p) => `"${p}"`).join(", ")})` : `the literal "${lit.literal}"`;
        findings.push({ code: "Q-03", severity: ex ? "excepted" : "error", ...base, line: at, literal: lit.literal,
          message: `${what} of ${req.id} AC${ac} is not in the test's code (a comment does not count)${ex ? ` — excepted by ${ex.by} (${ex.role}), acceptance/decisions.jsonl:${ex.line}` : ""}`,
          ...(ex ? { exception: { line: ex.line, by: ex.by, role: ex.role, reason: ex.reason } } : {}) });
      }
    }
  }
  // Q-03 per criterion, not per file: when another test of the same criterion carries the literal, the one that cites
  // the criterion without it is a warning (material-montana11, FASE-3: a unit test of REQ-F-006 AC2 lacked «Sin
  // multas», which its e2e checks on screen; the error kept the criterion from passing and the gate's recommended
  // answer «leave it as is» could not fix it)
  const q3 = findings.filter((x) => x.code === "Q-03" && x.severity === "error");
  for (const x of q3) {
    const sin = new Set(q3.filter((y) => y.req === x.req && y.ac === x.ac && y.literal === x.literal).map((y) => y.file));
    const con = [...new Set(pairs.filter((p) => p.req === x.req && p.ac === x.ac && !sin.has(p.file)).map((p) => p.file))];
    if (con.length) {
      x.severity = "warn";
      x.message += ` — another test of this criterion carries it (${con.slice(0, 2).join(", ")}): a warning, not an error`;
    }
  }
  const order = { "Q-01": 1, "Q-02": 2, "Q-03": 3, "Q-04": 4, "Q-05": 5 };
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || order[a.code] - order[b.code]);
  const count = (s) => findings.filter((x) => x.severity === s).length;
  return {
    findings, pairs,
    summary: { test_files: files.length, files: filesWithPairs, pairs: pairs.length, criteria: new Set(pairs.map((p) => `${p.req}#${p.ac}`)).size,
      errors: count("error"), warnings: count("warn"), excepted: count("excepted") },
  };
}

/** Per criterion `REQ#n` → the gaps a ledger counts: Q-02 and Q-03 errors not excepted. */
export function literalGapsByCriterion(result) {
  const m = new Map();
  for (const f of result.findings) {
    if (f.severity !== "error") continue;
    const k = `${f.req}#${f.ac}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push({ code: f.code, file: f.file, line: f.line, ...(f.literal !== undefined ? { literal: f.literal } : {}), ...(f.quote !== undefined ? { quote: f.quote } : {}), ...(f.clause !== undefined ? { clause: f.clause } : {}) });
  }
  return m;
}

/** Whether `literal` is a literal of the criterion (for `accept record literal-exception`). */
export function isCriterionLiteral(text, literal) {
  const want = normLiteral(literal);
  return criterionLiterals(text).some((l) => normLiteral(l.literal) === want) || criterionAlternatives(text).flat().some((a) => normLiteral(a) === want);
}
