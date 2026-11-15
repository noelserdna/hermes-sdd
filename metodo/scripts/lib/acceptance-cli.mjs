// acceptance-cli.mjs — `sdd lint --needs`, `sdd lint --quotes`, `sdd accept`, `sdd accept record`, `sdd accept measure`, `sdd accept pack`,
// `sdd accept challenge add|resolve|list`, `sdd accept adversarial plan`, `sdd gate`, `sdd loop next`.
// Node >= 18, no dependencies. Called from scripts/sdd.mjs; returns an exit code (never calls process.exit).
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { git, isRepo, stackProfile, readCommits, effectiveCommits } from "./git-log.mjs";
import { readJUnit } from "./junit.mjs";
import {
  SCHEMA, RECORD_TYPES, DECISIONS_FILE, ROUTES, evaluate, gitContext, loadScenarios, readDecisions,
  validateRecord, reqHash, faseScope, renderReport, renderPrBlock, routeHint, criterionHint, unchangedSince, acNumber,
  compareMeasurement, dirtyUnder, evidenceSettings, describeFile, CHALLENGES_FILE, CHALLENGE_CATEGORIES, readChallenges,
  validateChallenge, challengeStates, nextChallengeId, adversarialGate, effectivePriority, testKeys, validateEvidenceRefs,
} from "./acceptance.mjs";
import { parseRequirements, parseNeeds, checkNeedCoverage } from "../sdd-jev.mjs";
import { lintQuotes, testPathsOf } from "./quotes.mjs";
import { lintCaptures } from "./captures-lint.mjs";

class Exit extends Error { constructor(code) { super(`exit ${code}`); this.code = code; } }
let PROG = "sdd";
const out = (s) => console.log(s);
const usage = (msg) => { console.error(`${PROG}: ${msg} (see --help)`); throw new Exit(2); };
const die = (msg) => { console.error(`${PROG}: ${msg}`); throw new Exit(2); };

// Options that take a value; those in MULTI also swallow the following non-option words (`--junit a.xml b.xml`).
const VALUED = new Set(["repo", "junit", "junit-sha", "fase", "out", "report", "mode", "ledger", "state", "max-cycles",
  "req", "ac", "by", "role", "reason", "follow-up", "observed", "pass", "metric", "op", "threshold", "paths", "note",
  "result", "channel", "demo", "requirements", "decisions", "command", "extract", "attach",
  "category", "quote", "evidence", "verifier", "counter", "challenge", "challenges", "literal", "code", "file", "line", "base", "question", "gate",
  "since"]);
const MULTI = new Set(["junit", "paths", "attach", "evidence"]);
const FLAGS = new Set(["json", "md", "needs", "quotes", "captures", "reset", "no-out", "help", "remeasure", "allow-dirty", "open", "tighten"]);

function parse(argv) {
  const o = { _: [], junit: [], paths: [], attach: [], evidence: [] };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i], v;
    if (a === "-h") a = "--help";
    if (!a.startsWith("--") || a === "--") { o._.push(a); continue; }
    const eq = a.match(/^--([a-z-]+)=(.*)$/s);
    const k = eq ? eq[1] : a.slice(2);
    if (FLAGS.has(k)) { o[k] = true; continue; }
    if (!VALUED.has(k)) usage(`unknown option --${k}`);
    if (eq) v = eq[2];
    else { if (i + 1 >= argv.length) usage(`--${k} needs a value`); v = argv[++i]; }
    if (MULTI.has(k)) {
      o[k].push(...v.split(",").filter(Boolean));
      while (!eq && i + 1 < argv.length && !argv[i + 1].startsWith("-")) o[k].push(...argv[++i].split(",").filter(Boolean));
    } else o[k] = v;
  }
  if (o.fase !== undefined) {
    o.fase = Number(String(o.fase).replace(/^FASE-/i, ""));
    if (!Number.isInteger(o.fase)) usage("--fase needs a number");
  }
  return o;
}

function rootOf(o) { return path.resolve(o.repo || "."); }
function readReqs(root, o) {
  const f = path.resolve(root, o.requirements || "requirements/REQUIREMENTS.md");
  if (!existsSync(f)) die(`${path.relative(process.cwd(), f) || f} not found`);
  const reqs = parseRequirements(readFileSync(f, "utf8"));
  if (!reqs.length) die(`no "### REQ-…" blocks in ${f}`);
  return reqs;
}

// ------------------------------------------------------------------ lint --needs
function cmdLintNeeds(o) {
  const root = rootOf(o);
  const needsFile = path.resolve(root, o._[0] || "requirements/CUSTOMER-NEEDS.md");
  const reqFile = path.resolve(root, o._[1] || "requirements/REQUIREMENTS.md");
  for (const f of [needsFile, reqFile]) if (!existsSync(f)) die(`${f} not found`);
  const reqText = readFileSync(reqFile, "utf8");
  const needs = parseNeeds(readFileSync(needsFile, "utf8"));
  const reqs = parseRequirements(reqText);
  if (!needs.length) die(`no "### N-…" blocks in ${needsFile}`);
  if (!reqs.length) die(`no "### REQ-…" blocks in ${reqFile}`);
  const r = checkNeedCoverage(needs, reqs, reqText, { plain: true });
  if (o.json) out(JSON.stringify({ source: { needs: needsFile, requirements: reqFile }, ...r }, null, 2));
  else {
    for (const e of r.errors) out(`error  ${e.code}  ${e.msg}`);
    for (const w of r.warnings) out(`warning  ${w.code}  ${w.msg}`);
    out(`lint --needs: ${r.needs} needs (${r.outOfScope} out-of-scope), ${r.requirements} requirements, ${r.errors.length} error(s), ${r.warnings.length} warning(s), Must ${Math.round(r.mustRatio * 100)} %`);
  }
  return r.errors.length ? 1 : 0;
}

// ------------------------------------------------------------------ lint --quotes
// The literal lint (scripts/lib/quotes.mjs): per (criterion, test file that names it) Q-01 no quote comment (warn),
// Q-02 quote not the criterion's current text (error), Q-03 a literal of the criterion missing from the code (error;
// a person's literal-exception record turns it into `excepted`). Exit 1 on any error.
function cmdLintQuotes(o) {
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  const root = rootOf(o);
  const reqs = readReqs(root, o);
  const scope = scopeFor(root, reqs, o.fase);
  const testPaths = testPathsOf(root);
  const r = lintQuotes({ root, reqs, scenarios: loadScenarios(root), records: readDecisions(decisionsPath(root, o)).records,
    scope: scope ? scope.set : null, testPaths });
  const summary = { ...r.summary, test_paths: testPaths, ...(scope ? { fase: o.fase } : {}) };
  if (o.json) {
    out(JSON.stringify({ findings: r.findings.map(({ message, ...f }) => ({ ...f, message })), summary }, null, 2));
    return summary.errors ? 1 : 0;
  }
  for (const f of r.findings) out(`${f.file}:${f.line} ${f.code} ${f.req} AC${f.ac} ${f.severity === "excepted" ? "(excepted) " : ""}${f.message}`);
  if (!r.summary.test_files) out(`note: no test source files under ${testPaths.join(", ")} (Stack Profile test_paths)`);
  out(`lint --quotes: ${summary.pairs} criterion-file pair(s) in ${summary.files} test file(s), ${summary.criteria} criteria · ${summary.errors} error(s) · ${summary.warnings} warning(s) · ${summary.excepted} excepted${scope ? ` · FASE ${o.fase}` : ""}`);
  return summary.errors ? 1 : 0;
}

// ------------------------------------------------------------------ lint --captures
// Before the acceptance (scripts/lib/captures-lint.mjs): C-01 a capture right after an API check with no on-screen
// assertion (error) · C-02 one image for more than 3 criteria, or named after another criterion (warning) · C-03 the
// capture of a REQ-F criterion taken by a test whose title does not cite it (error) · C-04 an id cited in a test that
// exists in no document (warning). Exit 1 on any error.
function cmdLintCaptures(o) {
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  const root = rootOf(o);
  const reqs = readReqs(root, o);
  const scope = scopeFor(root, reqs, o.fase);
  let ledger = null;
  try { ledger = buildLedger({ ...o, "no-out": true }).ledger; } catch (e) { if (!(e instanceof Exit)) throw e; }
  const r = lintCaptures({ root, reqs, scenarios: loadScenarios(root), ledger, scope: scope ? scope.set : null, testPaths: testPathsOf(root) });
  const summary = { ...r.summary, ...(scope ? { fase: o.fase } : {}) };
  if (o.json) { out(JSON.stringify({ findings: r.findings, summary }, null, 2)); return summary.errors ? 1 : 0; }
  for (const f of r.findings) out(`${f.file}${f.line ? `:${f.line}` : ""} ${f.code} ${f.severity}${f.req ? ` ${f.req} AC${f.ac}` : ""} ${f.message}`);
  out(`lint --captures: ${summary.capture_calls} capture call(s) in ${summary.test_files} test file(s) · ${summary.errors} error(s) · ${summary.warnings} warning(s)${scope ? ` · FASE ${o.fase}` : ""}`);
  return summary.errors ? 1 : 0;
}

// ------------------------------------------------------------------ ledger
function scopeFor(root, reqs, fase) {
  if (fase === undefined) return null;
  const fs = faseScope(root, fase);
  const ids = fs.requirements || reqs.filter((r) => !r.deprecated).map((r) => r.id);
  return { set: new Set(ids), file: fs.file, fromHeader: Boolean(fs.requirements) };
}

function junitSpecs(root, o) {
  if (o.junit.length) return o.junit;
  const prof = stackProfile(root);
  if (prof.test_report_path) return prof.test_report_path.split(",").map((s) => s.trim()).filter(Boolean);
  return existsSync(path.join(root, ".sdd", "junit")) ? [".sdd/junit"] : [];
}

export function buildLedger(o) {
  const root = rootOf(o);
  const reqs = readReqs(root, o);
  const specs = junitSpecs(root, o);
  let junit = null;
  try { junit = specs.length ? readJUnit(root, specs) : null; } catch (e) { die(e.message); }
  const exclude = [...(junit?.files || []).map((f) => path.relative(root, f.path)), o.out, o.report].filter(Boolean);
  const g = gitContext(root, { exclude });
  // A report asserted to come from a commit cannot come from a worktree that differs from it on the code paths.
  if (o["junit-sha"] && g.repo && g.codeDirty)
    die(`--junit-sha: uncommitted changes under the code paths (${g.codeDirtyPaths.slice(0, 3).join(", ")}): commit first, then run the tests and capture again`);
  const junitSha = o["junit-sha"] ? (g.repo ? resolveSha(root, o["junit-sha"]) : o["junit-sha"]) : null;
  const decisions = readDecisions(path.resolve(root, o.decisions || DECISIONS_FILE));
  const challenges = readChallenges(challengesPath(root, o));
  const scope = scopeFor(root, reqs, o.fase);
  const ledger = evaluate({ root, reqs, scenarios: loadScenarios(root), junit, junitSha, decisions, challenges, git: g,
    scope: scope ? scope.set : null, fase: o.fase ?? null });
  if (scope) { ledger.scope.file = scope.file; ledger.scope.from_header = scope.fromHeader; }
  ledger.junit_searched = specs;
  return { root, ledger, git: g };
}
/** stderr warning: evidence read from a dirty tree without --junit-sha (the JUnit then counts as stale). */
function warnDirty(o, g) {
  if (o["junit-sha"] || !g?.repo || !g.codeDirty) return;
  const list = `${g.codeDirtyPaths.slice(0, 3).join(", ")}${g.codeDirtyPaths.length > 3 ? ", …" : ""}`;
  console.error(`warning: uncommitted changes under the code paths (${list}): test evidence counts as stale. Commit first, run the tests, then capture with --junit-sha <HEAD>`);
}
function resolveSha(root, rev) {
  const r = git(root, ["rev-parse", "-q", "--verify", `${rev}^{commit}`]);
  if (r.status !== 0) die(`unknown commit ${rev}`);
  return r.stdout.trim();
}

function writeJson(root, file, data) {
  const f = path.resolve(root, file);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(data, null, 2) + "\n");
}
function writeText(root, file, text) {
  const f = path.resolve(root, file);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, text);
}

function printLedger(ledger) {
  for (const r of ledger.requirements.filter((x) => x.in_scope)) {
    const tail = r.verdict === "DEPRECATED" ? "" : `${r.criteria_passing}/${r.criteria_total}${r.stale_evidence ? "  stale evidence" : ""}${r.verdict === "WAIVED" ? `  waiver ${DECISIONS_FILE}:${r.waiver.line}` : ""}`;
    out(`${r.id.padEnd(12)} ${String(r.priority || "-").padEnd(7)} ${String(r.verification || r.verification_raw || "-").padEnd(12)} ${r.verdict.padEnd(10)} ${tail}`.trimEnd());
  }
  for (const d of ledger.stale_decisions) out(`stale decision ${DECISIONS_FILE}:${d.line} ${d.type} ${d.req || `FASE ${d.fase}`}: ${d.reason}`);
  for (const e of ledger.decision_errors) out(`${DECISIONS_FILE}:${e.line}: ${e.msg}`);
  for (const j of ledger.junit.filter((x) => !x.fresh)) out(`stale junit ${j.path}: ${j.stale_reason}`);
  if (ledger.visual_evidence !== "off") {
    for (const r of ledger.requirements.filter((x) => x.in_scope && !["WAIVED", "DEPRECATED"].includes(x.verdict)))
      for (const c of (r.criteria || []).filter((x) => x.visual === "missing" && (x.state === "pass" || x.state === "unshown")))
        out(`${ledger.visual_evidence === "required" ? "unshown" : "warning: no screenshot"} ${r.id} AC${c.n}: passes without a screenshot in ${ledger.evidence_dir}/ (${ROUTES.capture})`
          + [...(c.unbound_captures || []), ...(c.images_not_counted || [])].slice(0, 2).map((u) => `; ${u.ref} not counted: ${u.reason}`).join(""));
    const noVideo = ledger.requirements.filter((x) => x.in_scope && !["WAIVED", "DEPRECATED"].includes(x.verdict))
      .flatMap((r) => (r.criteria || []).filter((x) => x.video === "missing" && (x.state === "pass" || x.state === "unshown")).map((c) => `${r.id} AC${c.n}`));
    if (ledger.criterion_video === "required") for (const k of noVideo) out(`unshown ${k}: its browser test records no video (criterion_video: required)`);
    else if (noVideo.length) out(`warning: no video for ${noVideo.length} criteria whose browser test records none (${noVideo.slice(0, 5).join(", ")}${noVideo.length > 5 ? ", …" : ""}; criterion_video: ${ledger.criterion_video})`);
    for (const id of ledger.videos?.missing || []) out(`missing video ${id}: no video named with ${id} (${ROUTES.capture})`);
  }
  if (ledger.literal_gate && ledger.literal_gate !== "off") {
    for (const r of ledger.requirements.filter((x) => x.in_scope && !["WAIVED", "DEPRECATED"].includes(x.verdict)))
      for (const c of (r.criteria || []).filter((x) => (x.literal_gaps || []).length))
        for (const g of c.literal_gaps)
          out(`${c.state === "weakened" ? "weakened" : "warning: literal gap"} ${r.id} AC${c.n}: ${g.code === "Q-02" ? "the quote is not the criterion's current text" : g.code === "Q-04" ? `clause "${g.clause}" not asserted on its own` : g.code === "Q-05" ? `alternative "${g.literal}" not exercised` : `literal "${g.literal}" not in the test`} (${g.file}:${g.line}, ${ROUTES.weakened})`);
  }
  for (const r of ledger.requirements.filter((x) => x.in_scope && x.verdict !== "WAIVED"))
    for (const c of (r.criteria || []).filter((x) => x.skipped))
      out(`skipped ${r.id} AC${c.n}: every fresh test bound to it is skipped (${ROUTES.weakened})`);
  for (const r of ledger.requirements.filter((x) => x.in_scope))
    for (const c of (r.challenges || []).filter((x) => x.state === "open"))
      out(`challenge ${c.id} open ${r.id} AC${c.ac} ${c.category} (${c.counter}): "${c.quote}" (${ROUTES.adversarial})`);
  for (const e of ledger.challenge_errors || []) out(`${CHALLENGES_FILE}:${e.line}: ${e.msg}`);
  if (!ledger.junit.length) out(`note: no JUnit report read (${ledger.junit_searched.length ? ledger.junit_searched.join(", ") : "pass --junit PATH or write reports to .sdd/junit/"})`);
  const s = ledger.summary;
  const v = s.by_verdict;
  out(`accept: ${s.active} active requirement(s) · ${v.VERIFIED} verified · ${v.FAILING} failing · ${v.MISSING} missing · ${v.WAIVED} waived · ${s.deprecated} deprecated · Must ${s.must_verified}/${s.must_total} verified${s.must_waived ? `, ${s.must_waived} waived` : ""} · goal ${s.goal ? "met" : "not met"} (evaluated ${ledger.evaluated_sha ? ledger.evaluated_sha.slice(0, 7) : "no git"}${ledger.dirty ? ", dirty" : ""})`);
}

function cmdAccept(o) {
  if (o._[0] === "record") { o._.shift(); return cmdRecord(o); }
  if (o._[0] === "measure") { o._.shift(); return cmdMeasure(o); }
  if (o._[0] === "pack") { o._.shift(); return cmdPack(o); }
  if (o._[0] === "challenge") { o._.shift(); return cmdChallenge(o); }
  if (o._[0] === "adversarial") { o._.shift(); return cmdAdversarial(o); }
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  const failed = o.remeasure ? remeasure(o) : 0;
  const { root, ledger, git: g } = buildLedger(o);
  warnDirty(o, g);
  const outFile = o["no-out"] ? null : (o.out || ".sdd/acceptance.json");
  if (outFile && outFile !== "-") writeJson(root, outFile, ledger);
  if (o.report) writeText(root, o.report, renderReport(ledger));
  if (o.json || outFile === "-") out(JSON.stringify(ledger, null, 2));
  else printLedger(ledger);
  return failed ? 1 : 0;
}

// ------------------------------------------------------------------ record
function cmdRecord(o) {
  const type = o._.shift();
  if (!RECORD_TYPES.includes(type)) usage(`accept record needs a type: ${RECORD_TYPES.join(" | ")}`);
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  const root = rootOf(o);
  // A floor exception names no requirement: it works in a project without requirements/REQUIREMENTS.md.
  const reqs = (type === "floor-exception" || type === "test-edit") && !existsSync(path.resolve(root, o.requirements || "requirements/REQUIREMENTS.md")) ? [] : readReqs(root, o);
  const g = gitContext(root);
  const rec = { type, at: new Date().toISOString(), by: o.by, role: o.role, head: g.head };
  const bool = (v, name) => {
    if (v === undefined) return undefined;
    if (/^(true|yes|pass|1)$/i.test(v)) return true;
    if (/^(false|no|fail|0)$/i.test(v)) return false;
    usage(`${name} must be true or false`);
  };
  if (type === "fase-acceptance") {
    Object.assign(rec, { fase: o.fase, result: o.result, channel: o.channel });
    if (o.demo) rec.demo = o.demo;
    const scope = scopeFor(root, reqs, o.fase ?? -1);
    const ids = o.fase === undefined ? [] : [...scope.set];
    rec.reqHashes = Object.fromEntries(reqs.filter((r) => ids.includes(r.id)).map((r) => [r.id, reqHash(r)]));
  } else if (type === "challenge-dismissal") {
    // A person decides that a finding of the adversarial round does not hold. The challenge keeps its line; the
    // ledger shows it as dismissed with who, role and reason.
    const ch = readChallenges(challengesPath(root, o)).challenges.find((c) => c.id === String(o.challenge || "").toUpperCase());
    Object.assign(rec, { challenge: o.challenge ? String(o.challenge).toUpperCase() : undefined, reason: o.reason, ...(ch ? { req: ch.req, ac: ch.ac } : {}) });
  } else if (type === "test-edit") {
    if (o.req !== undefined) usage("a test-edit names files, not a requirement: drop --req");
    const files = [...new Set(o.paths.map((f) => String(f).replace(/\\/g, "/").replace(/^\.\//, "")))];
    // --tighten: the option only authorizes TIGHTENING those tests (efecto endurecer-test); Jev may choose it, and a
    // later edit that loosens them is grave for hsdd_fidelidad
    Object.assign(rec, { files, question: o.question, gate: o.gate, reason: o.reason, ...(o.tighten ? { tighten: true } : {}) });
  } else if (type === "floor-exception") {
    // A person accepts one finding of `sdd lint --floor` (code, file, exact line text) against one base commit; the
    // finding comes back when the line changes or the base moves.
    if (o.req !== undefined) usage("a floor-exception names no requirement: drop --req");
    const file = o.file === undefined ? undefined : String(o.file).replace(/\\/g, "/").replace(/^\.\//, "");
    const base = o.base === undefined ? undefined : (isRepo(root) ? resolveSha(root, o.base) : o.base);
    Object.assign(rec, { code: o.code === undefined ? undefined : String(o.code).toUpperCase(), file, text: o.line, base, reason: o.reason });
  } else {
    rec.req = o.req;
    if (type === "literal-exception") Object.assign(rec, { literal: o.literal, reason: o.reason });
    const req = reqs.find((r) => r.id === o.req);
    if (req) rec.reqHash = reqHash(req);
    if (o.ac !== undefined) { const n = acNumber(o.ac); rec.ac = Number.isNaN(n) ? o.ac : n; }
    if (o.paths.length) rec.paths = o.paths;
    if (type === "waiver") Object.assign(rec, { reason: o.reason, followUp: o["follow-up"] });
    if (type === "demo") Object.assign(rec, { observed: o.observed, pass: bool(o.pass, "--pass") });
    if (type === "measurement") Object.assign(rec, { metric: o.metric, observed: o.observed === undefined ? "" : Number(o.observed), op: o.op, threshold: o.threshold === undefined ? "" : Number(o.threshold) });
    if (type === "inspection") { rec.note = o.note; const p = bool(o.pass ?? (o.result ? String(o.result === "pass") : undefined), "--pass"); if (p === false) rec.pass = false; }
  }
  for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
  const errors = validateRecord(rec, reqs, { challenges: readChallenges(challengesPath(root, o)).challenges, records: readDecisions(decisionsPath(root, o)).records });
  if (o.attach.length) {
    if (["waiver", "challenge-dismissal", "literal-exception", "floor-exception", "test-edit"].includes(type)) errors.push(`a ${type} records no observation: --attach is for demo, inspection, measurement and fase-acceptance`);
    else {
      const att = attachFiles(root, o.attach);
      errors.push(...att.errors);
      rec.attachments = att.files;
    }
  }
  if (errors.length) { for (const e of errors) console.error(`${PROG}: accept record ${type}: ${e}`); return 2; }
  // An observation is anchored to HEAD: made on uncommitted code it would be stale from birth (a waiver, a dismissal or
  // a literal exception observes nothing: the last one is bound to the requirement's text by reqHash).
  if (!["waiver", "challenge-dismissal", "literal-exception", "floor-exception", "test-edit"].includes(type)) {
    const d = uncommitted(root, g, rec.paths);
    if (d) {
      if (!o["allow-dirty"]) { console.error(`${PROG}: accept record ${type}: ${d}: commit first, or pass --allow-dirty to record it with dirty: true`); return 2; }
      rec.dirty = true;
    }
  }
  const { file, n } = appendRecord(root, o, rec);
  if (o.json) out(JSON.stringify({ file, line: n, record: rec }, null, 2));
  else if (type === "test-edit") out(`recorded test-edit ${rec.files.join(", ")} (${rec.question}) at ${file}:${n}`);
  else if (type === "floor-exception") out(`recorded floor-exception ${rec.code} ${rec.file} "${String(rec.text).trim()}" (base ${rec.base.slice(0, 7)}) at ${file}:${n}`);
  else out(`recorded ${type} ${rec.challenge ? `${rec.challenge} (${rec.req} AC${rec.ac})` : rec.literal !== undefined ? `${rec.req} AC${rec.ac} "${rec.literal}"` : rec.req || `FASE ${rec.fase}`} at ${file}:${n}`);
  return 0;
}

/** `--attach P…`: files under the Stack Profile's evidence_dir, stored as { path, sha256, bytes, kind } so that a file
 *  replaced or deleted later no longer counts (the ledger compares the hash). */
function attachFiles(root, list) {
  const { dir } = evidenceSettings(root);
  const base = path.resolve(root, dir);
  const errors = [], files = [];
  for (const a of list) {
    const abs = path.resolve(root, a);
    const inside = path.relative(base, abs);
    if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) { errors.push(`--attach ${a}: not under ${dir}/ (the Stack Profile's evidence_dir)`); continue; }
    const d = describeFile(root, abs);
    if (!d.present) { errors.push(`--attach ${a}: no such file`); continue; }
    files.push({ path: d.path, sha256: d.sha256, bytes: d.bytes, kind: d.kind });
  }
  return { errors, files };
}

/** null, or a message naming the uncommitted paths under `paths` (default: the code paths) a record would describe. */
function uncommitted(root, g, paths) {
  if (!g.repo) return null;
  const d = dirtyUnder(root, paths?.length ? paths : g.codePaths);
  return d.length ? `uncommitted changes in ${d.slice(0, 3).join(", ")}${d.length > 3 ? ", …" : ""}` : null;
}

function decisionsPath(root, o) { return path.resolve(root, o.decisions || DECISIONS_FILE); }
function challengesPath(root, o) { return path.resolve(root, o.challenges || CHALLENGES_FILE); }
function appendRecord(root, o, rec) {
  const file = decisionsPath(root, o);
  mkdirSync(path.dirname(file), { recursive: true });
  const prev = existsSync(file) ? readFileSync(file, "utf8") : "";
  appendFileSync(file, (prev && !prev.endsWith("\n") ? "\n" : "") + JSON.stringify(rec) + "\n");
  return { file: path.relative(root, file), n: (prev ? prev.replace(/\n$/, "").split("\n").length : 0) + 1 };
}

// ------------------------------------------------------------------ measure (machine measurement)
// A measurement produced by a deterministic command (coverage, a latency benchmark): the command runs from the repo
// root through the shell, the first match of --extract (one capture group) in stdout + stderr is the observed number.
// The record says by "command", role "automated" and keeps command + extract, so `sdd accept --remeasure` can re-run
// it when the code paths change. A measurement a person must confirm stays `accept record measurement`.
const MEASURE_OUTPUT_MAX = 64 * 1024 * 1024;

/** Run spec.command, extract the number, build and validate the record. Returns { rec, note } or { error, code }.
 *  Uncommitted changes under the record's paths (default: the code paths) refuse it unless allowDirty (dirty: true). */
function machineMeasurement(root, reqs, spec, { allowDirty = false } = {}) {
  let re;
  try { re = new RegExp(spec.extract, "m"); } catch (e) { return { error: `--extract is not a valid regular expression: ${e.message}`, code: 2 }; }
  if (new RegExp(`${spec.extract}|`).exec("").length !== 2) return { error: "--extract needs exactly one capture group, e.g. 'All files[^|]*\\|\\s*([0-9.]+)'", code: 2 };
  const g = gitContext(root);
  const dirt = uncommitted(root, g, spec.paths);
  if (dirt && !allowDirty) return { error: `${dirt}: commit first, or pass --allow-dirty to record it with dirty: true`, code: 2 };
  const r = spawnSync(spec.command, { cwd: root, shell: true, encoding: "utf8", maxBuffer: MEASURE_OUTPUT_MAX });
  if (r.error) return { error: `could not run the command: ${r.error.message}`, code: 1 };
  const text = `${r.stdout || ""}\n${r.stderr || ""}`;
  const m = re.exec(text);
  const observed = m ? Number(String(m[1]).trim()) : NaN;
  if (!Number.isFinite(observed)) {
    const tail = text.trim().split("\n").slice(-8).join("\n");
    return { error: `no number matched --extract in the output of \`${spec.command}\` (exit ${r.status})${tail ? `; last lines:\n${tail}` : ""}`, code: 1 };
  }
  const rec = { type: "measurement", at: new Date().toISOString(), by: "command", role: "automated", head: g.head, req: spec.req };
  const req = reqs.find((x) => x.id === spec.req);
  if (req) rec.reqHash = reqHash(req);
  if (spec.ac !== undefined && spec.ac !== null) { const n = acNumber(spec.ac); rec.ac = Number.isNaN(n) ? spec.ac : n; }
  if (spec.paths?.length) rec.paths = spec.paths;
  Object.assign(rec, { metric: spec.metric, observed, op: spec.op, threshold: spec.threshold === undefined ? "" : Number(spec.threshold),
    command: spec.command, extract: spec.extract });
  if (r.status !== 0) rec.exitCode = r.status;
  if (dirt) rec.dirty = true;
  for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
  const errors = validateRecord(rec, reqs);
  if (errors.length) return { error: errors.join("; "), code: 2 };
  const note = dirt ? `note: ${dirt}: recorded with dirty: true; the value reflects the worktree and goes stale once they are committed` : null;
  return { rec, note };
}

function cmdMeasure(o) {
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  if (o.by || o.role) usage("accept measure records by \"command\", role \"automated\"; a measurement a person confirms is `accept record measurement --by NAME --role ROLE`");
  for (const k of ["req", "metric", "command", "extract", "op", "threshold"]) if (o[k] === undefined || o[k] === "") usage(`accept measure needs --${k}`);
  const root = rootOf(o);
  const reqs = readReqs(root, o);
  const res = machineMeasurement(root, reqs, { req: o.req, ac: o.ac, paths: o.paths, metric: o.metric, op: o.op, threshold: o.threshold, command: o.command, extract: o.extract }, { allowDirty: Boolean(o["allow-dirty"]) });
  if (res.error) { console.error(`${PROG}: accept measure: ${res.error}`); return res.code; }
  const { file, n } = appendRecord(root, o, res.rec);
  const r = res.rec;
  if (o.json) out(JSON.stringify({ file, line: n, record: r }, null, 2));
  else {
    out(`measured ${r.req}${r.ac ? ` AC${r.ac}` : ""} ${r.metric} = ${r.observed} (${r.op} ${r.threshold}: ${compareMeasurement(r) ? "pass" : "fail"}) at ${file}:${n}`);
    if (r.exitCode !== undefined) out(`note: the command exited ${r.exitCode}; the value was recorded anyway`);
    if (res.note) out(res.note);
  }
  return 0;
}

/** `sdd accept --remeasure`: re-run each stale in-scope measurement whose latest record has a command. Returns failures. */
function remeasure(o) {
  const { root, ledger } = buildLedger({ ...o, "no-out": true });
  const reqs = readReqs(root, o);
  const { records } = readDecisions(decisionsPath(root, o));
  const lines = new Set();
  for (const r of ledger.requirements.filter((x) => x.in_scope && x.verification === "measurement" && x.verdict !== "WAIVED"))
    for (const c of r.criteria) if (c.state === "stale") for (const l of c.records) lines.add(l);
  let failed = 0;
  for (const l of [...lines].sort((a, b) => a - b)) {
    const prev = records.find((x) => x.line === l);
    if (!prev || !prev.command || !prev.extract) continue;
    const res = machineMeasurement(root, reqs, prev, { allowDirty: Boolean(o["allow-dirty"]) });
    if (res.error) { failed++; console.error(`${PROG}: remeasure ${prev.req} (${DECISIONS_FILE}:${l}): ${res.error}`); continue; }
    const { file, n } = appendRecord(root, o, res.rec);
    if (!o.json) out(`remeasured ${prev.req}${res.rec.ac ? ` AC${res.rec.ac}` : ""} ${res.rec.metric} = ${res.rec.observed} (was ${prev.observed}) at ${file}:${n}`);
  }
  return failed;
}

// ------------------------------------------------------------------ pack (evidence bundle for the customer)
// `sdd accept pack --fase N`: {evidence_dir}/FASE-N/ is not versioned, so after the sign-off it is bundled with a
// manifest of hashes: .sdd/entregas/FASE-N-evidencias.tar.gz holding manifest.json + {evidence_dir}/FASE-N/…
const ID_IN_NAME = /(?:^|[^A-Za-z0-9])(AC[-_]\d{3,}[-_]\d{2,}|REQ[-_][A-Z]+[-_]\d+[-_]AC\d+|WF[-_]\d{3,}|FASE[-_]\d+)(?!\d)/i;
function filesUnder(dir) {
  const acc = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) acc.push(...filesUnder(p)); else if (e.isFile()) acc.push(p);
  }
  return acc.sort();
}
function cmdPack(o) {
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  if (o.fase === undefined) usage("accept pack needs --fase N");
  const root = rootOf(o);
  const { dir } = evidenceSettings(root);
  const rel = `${dir}/FASE-${o.fase}`;
  const abs = path.join(root, rel);
  const list = existsSync(abs) && statSync(abs).isDirectory() ? filesUnder(abs) : [];
  if (!list.length) { console.error(`${PROG}: accept pack: no evidence under ${rel}/ — run the FASE journey with capture first`); return 1; }
  // Criteria each file shows, from the ledger when the requirements are there (attachments and name-bound captures).
  const hasReqs = existsSync(path.resolve(root, o.requirements || "requirements/REQUIREMENTS.md"));
  const ledger = hasReqs ? buildLedger({ ...o, out: undefined }).ledger : null;
  const shows = new Map();
  for (const r of ledger?.requirements || []) for (const c of r.criteria || []) for (const e of c.evidence || [])
    for (const a of e.attachments || []) { if (!shows.has(a.path)) shows.set(a.path, new Set()); shows.get(a.path).add(`${r.id} AC${c.n}`); }
  const files = list.map((p) => {
    const d = describeFile(root, p);
    const m = path.basename(p).match(ID_IN_NAME);
    return { path: d.path, sha256: d.sha256, bytes: d.bytes, kind: d.kind, criterion: m ? m[1].replace(/_/g, "-").toUpperCase() : null,
      criteria: [...(shows.get(d.path) || [])].sort() };
  });
  const g = gitContext(root);
  const manifest = { $schema: "sdd-evidence-pack-v1", fase: o.fase, evaluated_sha: ledger?.evaluated_sha ?? g.head, dirty: ledger?.dirty ?? g.dirty,
    generatedAt: new Date().toISOString(), evidence_dir: dir, files };
  const archive = path.resolve(root, o.out || `.sdd/entregas/FASE-${o.fase}-evidencias.tar.gz`);
  mkdirSync(path.dirname(archive), { recursive: true });
  const tmp = mkdtempSync(path.join(os.tmpdir(), "sdd-pack-"));
  try {
    writeFileSync(path.join(tmp, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    const t = spawnSync("tar", ["-czf", archive, "-C", tmp, "manifest.json", "-C", root, rel],
      { encoding: "utf8", env: { ...process.env, COPYFILE_DISABLE: "1" } }); // no macOS ._ resource files
    if (t.error || t.status !== 0) die(`accept pack: tar failed: ${t.error ? t.error.message : (t.stderr || "").trim()}`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  const shown = path.relative(root, archive) || archive;
  if (o.json) out(JSON.stringify({ archive: shown, files: files.length, manifest }, null, 2));
  else out(`packed ${files.length} file(s) of ${rel}/ into ${shown} (manifest.json with sha256; evaluated at ${String(manifest.evaluated_sha || "no git").slice(0, 7)})`);
  return 0;
}

// ------------------------------------------------------------------ challenge (adversarial round)
// acceptance/challenges.jsonl is written only here: a confirmed or inconclusive finding of an independent verifier,
// anchored to HEAD, to the requirement's text hash and to the files it cites. The verdicts never change because of it.
const listOf = (v, dflt) => { const l = String(v || "").split(",").map((s) => s.trim().replace(/^\.\//, "").replace(/\/+$/, "")).filter(Boolean); return l.length ? l : dflt; };
function headOf(root) {
  if (!isRepo(root)) return null;
  const h = git(root, ["rev-parse", "-q", "--verify", "HEAD"]);
  return h.status === 0 ? h.stdout.trim() : null;
}

function cmdChallenge(o) {
  const sub = o._.shift();
  if (sub === "add") return challengeAdd(o);
  if (sub === "resolve") return challengeResolve(o);
  if (sub === "list") return challengeList(o);
  usage("accept challenge needs `add`, `resolve` or `list`");
}

function challengeAdd(o) {
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  const root = rootOf(o);
  const reqs = readReqs(root, o);
  const file = challengesPath(root, o);
  const { challenges, errors: bad } = readChallenges(file);
  const n = acNumber(o.ac);
  const ch = { id: nextChallengeId(challenges), req: o.req ? String(o.req).toUpperCase() : undefined, ac: Number.isNaN(n) ? o.ac : n,
    category: o.category ? String(o.category).toUpperCase() : undefined, quote: o.quote === undefined ? undefined : String(o.quote).trim(),
    evidence: o.evidence, verifier: o.verifier, counter: o.counter ? String(o.counter).toLowerCase() : undefined, head: headOf(root) };
  const prof = stackProfile(root);
  const v = validateChallenge(ch, reqs, { root, testPaths: listOf(prof.test_paths, ["tests"]), evidenceDir: evidenceSettings(root).dir });
  if (bad.length) v.errors.push(`${CHALLENGES_FILE} has unreadable lines (${bad.map((e) => e.line).join(", ")}); it is written only by this command`);
  if (v.errors.length) { for (const e of v.errors) console.error(`${PROG}: accept challenge add: ${e}`); return 2; }
  const req = reqs.find((r) => r.id === ch.req);
  const rec = { id: ch.id, req: ch.req, ac: ch.ac, category: ch.category, quote: ch.quote, evidence: v.evidence, verifier: ch.verifier,
    counter: ch.counter, head: ch.head, reqHash: reqHash(req), paths: [...new Set(v.evidence.map((e) => e.path))], at: new Date().toISOString() };
  mkdirSync(path.dirname(file), { recursive: true });
  const prev = existsSync(file) ? readFileSync(file, "utf8") : "";
  appendFileSync(file, (prev && !prev.endsWith("\n") ? "\n" : "") + JSON.stringify(rec) + "\n");
  const line = (prev ? prev.replace(/\n$/, "").split("\n").length : 0) + 1;
  const shown = path.relative(root, file);
  for (const w of v.warnings) console.error(`warning: ${w}`);
  if (o.json) out(JSON.stringify({ file: shown, line, challenge: rec }, null, 2));
  else out(`recorded challenge ${rec.id} ${rec.req} AC${rec.ac} ${rec.category} (${rec.counter}) at ${shown}:${line}`);
  return 0;
}

// A later adversarial round re-verifies the criteria whose evidence moved; when an open challenge no longer holds, its
// independent verifier records a resolution (a line `{"type":"resolution",…}` appended to challenges.jsonl, never
// rewriting the challenge). Only when something of the criterion's evidence changed since the challenge's HEAD: its
// bound tests (JUnit binding, or test files that cite `REQ-X-NNN ACn` or one of its scenario ids), its captures, the
// code that commits since then attribute to its requirement (Refs), or the requirement text. With nothing changed
// the finding still stands on the same evidence: only a person may dismiss it. The implementer never resolves (the
// harness denies it outside the adversarial round). A verifier that confirms it again later records a new challenge.
const TEST_FILE = /\.(m?[jt]sx?|cjs|py|rb|go|java|kt|cs|php|rs|swift|feature)$/i;
function testFilesUnder(root, dirs) {
  const found = [];
  const walk = (rel) => {
    let entries;
    try { entries = readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.isFile() && TEST_FILE.test(e.name)) found.push(r);
    }
  };
  for (const d of dirs) {
    let st = null;
    try { st = statSync(path.join(root, d)); } catch { /* absent */ }
    if (st?.isFile()) found.push(d); else if (st?.isDirectory()) walk(d);
  }
  return [...new Set(found)];
}

/** What of the criterion's evidence changed since `ch.head`: [{ kind: requirement|test|capture|code, path }]. */
export function criterionChanges(root, ch, { req, criterion, testPaths, codePaths }) {
  const changes = [];
  const cache = new Map();
  const within = (p, dirs) => dirs.some((d) => p === d || p.startsWith(d + "/"));
  if (req && ch.reqHash && ch.reqHash !== reqHash(req)) changes.push({ kind: "requirement", path: "requirements/REQUIREMENTS.md" });
  // tests: the files of the bound JUnit cases and the test files that cite the criterion (REQ-X-NNN ACn, scenario id)
  const files = new Set();
  for (const t of criterion?.tests || []) {
    const f = t.file || (looksLikeFile(t.classname) ? t.classname : null);
    if (f && existsSync(path.join(root, f))) files.add(String(f).replace(/^\.\//, ""));
  }
  const scen = new Set(criterion?.scenarios || []);
  for (const f of testFilesUnder(root, testPaths)) {
    let text = "";
    try { if (statSync(path.join(root, f)).size < 2e6) text = readFileSync(path.join(root, f), "utf8"); } catch { continue; }
    const k = testKeys(text);
    if (k.reqAcs.some((x) => x.req === ch.req && x.ac === Number(ch.ac)) || k.scenarios.some((x) => scen.has(x))) files.add(f);
  }
  for (const f of [...files].sort()) if (!unchangedSince(root, ch.head, [f], cache)) changes.push({ kind: "test", path: f });
  // captures bound to the criterion: a versioned one against the challenge's HEAD, the others by their mtime
  const t0 = (Number(git(root, ["show", "-s", "--format=%ct", ch.head]).stdout.trim()) * 1000) || Infinity;
  const caps = new Set([...(criterion?.evidence || []), ...(criterion?.tests || [])].flatMap((e) => e.attachments || [])
    .filter((a) => a.kind === "image" && a.present).map((a) => a.path));
  for (const c of [...caps].sort()) {
    let moved;
    if (git(root, ["ls-files", "--error-unmatch", "--", c]).status === 0) moved = !unchangedSince(root, ch.head, [c], cache);
    else { try { moved = statSync(path.join(root, c)).mtimeMs > t0; } catch { moved = false; } }
    if (moved) changes.push({ kind: "capture", path: c });
  }
  // code of the requirement: files under code_paths touched by the commits since the challenge whose Refs name it
  let commits = [];
  try { commits = readCommits(root, { rev: `${ch.head}..HEAD`, files: true }); } catch { commits = []; }
  const code = new Set(commits.filter((c) => c.ids.includes(ch.req)).flatMap((c) => c.files).filter((p) => within(p, codePaths)));
  for (const p of [...code].sort()) if (!unchangedSince(root, ch.head, [p], cache)) changes.push({ kind: "code", path: p });
  const seen = new Set();
  return changes.filter((c) => !seen.has(c.path) && seen.add(c.path));
}

function challengeResolve(o) {
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  const root = rootOf(o);
  const reqs = readReqs(root, o);
  const file = challengesPath(root, o);
  const { challenges, resolutions, errors: bad } = readChallenges(file);
  const id = String(o.challenge || "").toUpperCase();
  const fail = (msgs) => { for (const e of msgs) console.error(`${PROG}: accept challenge resolve: ${e}`); return 2; };
  const errors = [];
  if (!id) errors.push("--challenge CH-NNN is required");
  if (!String(o.reason || "").trim()) errors.push("--reason is required (why the finding no longer holds, on the new evidence)");
  if (!String(o.verifier || "").trim()) errors.push("--verifier is required (the independent verifier of this round)");
  if (!o.evidence.length) errors.push("--evidence path:line is required (the new evidence: the test, code or capture that changed)");
  if (bad.length) errors.push(`${CHALLENGES_FILE} has unreadable lines (${bad.map((e) => e.line).join(", ")}); it is written only by the CLI`);
  const head = headOf(root);
  if (!head) errors.push("no HEAD commit: resolve challenges in a git repository with at least one commit");
  if (errors.length) return fail(errors);
  const ch = challenges.find((c) => c.id === id);
  if (!ch) return fail([`${id} is not in ${CHALLENGES_FILE}`]);
  const records = readDecisions(decisionsPath(root, o)).records;
  const { dir: evidenceDir } = evidenceSettings(root);
  const [state] = challengeStates(root, [ch], reqs, records, { repo: true, evidenceDir, resolutions });
  if (state.state !== "open") return fail([`${id} is ${state.state}, not open: only an open challenge is resolved`]);
  const prof = stackProfile(root);
  const testPaths = listOf(prof.test_paths, ["tests"]), codePaths = listOf(prof.code_paths, ["src"]);
  const ev = validateEvidenceRefs(o.evidence, { root, testPaths, evidenceDir });
  if (ev.errors.length) return fail(ev.errors);
  const { ledger } = buildLedger({ ...o, fase: undefined });
  const req = reqs.find((r) => r.id === ch.req);
  const criterion = ledger.requirements.find((r) => r.id === ch.req)?.criteria?.find((c) => c.n === Number(ch.ac));
  const changed = criterionChanges(root, ch, { req, criterion, testPaths, codePaths });
  if (!changed.length)
    return fail([`nada cambió desde ${id} (${String(ch.head).slice(0, 7)}) en la evidencia de ${ch.req} AC${ch.ac} (tests ligados, capturas, código del requisito, texto): no se puede dar por resuelta; descártala una persona (accept record challenge-dismissal)`]);
  const moved = new Set(changed.map((c) => c.path));
  if (!ev.evidence.some((e) => moved.has(e.path)))
    return fail([`--evidence must cite what changed since ${id}: ${changed.map((c) => `${c.path} (${c.kind})`).join(", ")}`]);
  const rec = { type: "resolution", challenge: id, req: ch.req, ac: ch.ac, reason: String(o.reason).trim(), evidence: ev.evidence,
    verifier: String(o.verifier).trim(), head, since: ch.head, changed, at: new Date().toISOString() };
  const prev = existsSync(file) ? readFileSync(file, "utf8") : "";
  appendFileSync(file, (prev && !prev.endsWith("\n") ? "\n" : "") + JSON.stringify(rec) + "\n");
  const line = (prev ? prev.replace(/\n$/, "").split("\n").length : 0) + 1;
  const shown = path.relative(root, file);
  if (o.json) out(JSON.stringify({ file: shown, line, resolution: rec }, null, 2));
  else out(`resolved challenge ${id} ${ch.req} AC${ch.ac} at ${shown}:${line} (changed since ${String(ch.head).slice(0, 7)}: ${changed.map((c) => c.path).join(", ")})`);
  return 0;
}

function challengeList(o) {
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  const root = rootOf(o);
  const reqs = readReqs(root, o);
  const file = challengesPath(root, o);
  const { challenges, resolutions, errors } = readChallenges(file);
  const records = readDecisions(decisionsPath(root, o)).records;
  const prio = new Map(reqs.map((r) => [r.id, effectivePriority(r)]));
  const scope = scopeFor(root, reqs, o.fase);
  let all = challengeStates(root, challenges, reqs, records, { repo: isRepo(root), evidenceDir: evidenceSettings(root).dir, resolutions })
    .map((c) => ({ id: c.id, req: c.req, ac: c.ac, priority: prio.get(c.req) ?? null, category: c.category, counter: c.counter, state: c.state,
      ...(c.stale_reason ? { stale_reason: c.stale_reason } : {}), ...(c.dismissal ? { dismissal: c.dismissal } : {}),
      ...(c.resolution ? { resolution: c.resolution } : {}),
      quote: c.quote, evidence: c.evidence, verifier: c.verifier, head: c.head, at: c.at || null, line: c.line }));
  if (scope) all = all.filter((c) => scope.set.has(c.req));
  const count = (st) => all.filter((c) => c.state === st).length;
  const mustOpen = [...new Set(all.filter((c) => c.state === "open" && c.priority === "Must").map((c) => c.req))];
  const list = o.open ? all.filter((c) => c.state === "open") : all;
  const shown = path.relative(root, file);
  if (o.json) {
    out(JSON.stringify({ file: shown, total: all.length, open: count("open"), stale: count("stale"), resolved: count("resolved"), dismissed: count("dismissed"),
      must_open: mustOpen, ...(scope ? { fase: o.fase } : {}), challenges: list, errors }, null, 2));
    return 0;
  }
  for (const c of list) {
    const why = c.state === "stale" ? ` — ${c.stale_reason}` : c.state === "dismissed" ? ` — by ${c.dismissal.by} (${c.dismissal.role}): ${c.dismissal.reason}`
      : c.state === "resolved" ? ` — by ${c.resolution.verifier} at ${String(c.resolution.head || "?").slice(0, 7)}: ${c.resolution.reason}` : "";
    out(`${c.id}  ${c.state.padEnd(9)} ${c.req} AC${c.ac}  ${c.category} (${c.counter})  "${c.quote}"  ${(c.evidence || []).map((e) => e.line ? `${e.path}:${e.line}` : e.path).join(", ")}${why}`);
  }
  for (const e of errors) out(`${shown}:${e.line}: ${e.msg}`);
  out(`challenges: ${all.length} · open ${count("open")} · stale ${count("stale")} · resolved ${count("resolved")} · dismissed ${count("dismissed")} · Musts with an open challenge: ${mustOpen.join(", ") || "none"}`);
  return 0;
}

// ------------------------------------------------------------------ adversarial plan (mechanical coverage critic)
// Per FASE: requirements with their literal text and criteria, the tests bound to each criterion (with their file),
// the captures bound to it and the candidate files (files under code_paths touched by the commits whose `Task:` is a
// TASK-F{N}-…). Project-wide: `uncovered` (active requirements in no FASE's `Requisitos:`; Won't have ones are not
// planned by design), `fases_without_header`, and the criteria of test-verified requirements without a bound test.
function listFases(root) {
  const dir = path.join(root, "plan", "fases");
  if (!existsSync(dir)) return [];
  const nums = [...new Set(readdirSync(dir).map((f) => f.match(/^FASE-0*(\d+)(?:[-_.].*)?\.md$/i)).filter(Boolean).map((m) => Number(m[1])))];
  return nums.sort((a, b) => a - b).map((n) => ({ n, ...faseScope(root, n) }));
}
const looksLikeFile = (s) => /[\\/]/.test(String(s || "")) || /\.[a-z]{1,5}$/i.test(String(s || ""));

// ------------------------------------------------------------------ adversarial plan --since (incremental round)
// A later round (after the fix pass, or a re-acceptance after a rejection) only needs to re-read the criteria whose
// evidence moved since the previous round: `--since` takes that round's plan JSON (or a commit) and marks each
// criterion `recheck: true|false` with its `recheck_reasons`. The rule is conservative: whatever cannot be pinned to
// a criterion (a helper, a config, code no commit attributes to the FASE) re-checks every criterion of the FASE.
// Folders that are not evidence of the product (the method's documents, acceptance/, .sdd/) and *.md never count;
// requirements/ counts through each requirement's text hash, and captures through their sha256.
const NOT_EVIDENCE = /^(acceptance|status|task|plan|feedback|spec|changes|intent|audits|design|ux|requirements|docs|\.sdd|\.claude|\.github)\//;
const TEST_TITLE = /^\s*(?:test|it)(?:\.(?:only|skip|fixme|fail|slow))?\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/;
const SHARED_START = /^\s*(?:test\.)?(?:describe(?:\.\w+)*|beforeAll|beforeEach|afterAll|afterEach)\s*\(/;
/** Line regions of a test file: [{ from, to, title }] — each test runs to the next test, hook or describe; hooks,
 *  describe headers and everything before the first test are shared (title null). null when no test is recognised. */
function testRegions(code) {
  const lines = code.split("\n");
  const marks = [];
  lines.forEach((l, i) => {
    const t = l.match(TEST_TITLE);
    if (t) marks.push({ line: i + 1, title: t[2] });
    else if (SHARED_START.test(l)) marks.push({ line: i + 1, title: null });
  });
  if (!marks.some((m) => m.title !== null)) return null;
  return [{ from: 1, to: marks[0].line - 1, title: null },
    ...marks.map((m, k) => ({ from: m.line, to: (k + 1 < marks.length ? marks[k + 1].line : lines.length + 1) - 1, title: m.title }))];
}
/** New-side line ranges changed in `file` since `sha` (worktree included); null when git cannot tell. */
function changedRanges(root, sha, file) {
  const r = git(root, ["diff", "-U0", "--no-color", "--no-ext-diff", sha, "--", file]);
  if (r.status !== 0) return null;
  return [...r.stdout.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)].map((m) => {
    const c = Number(m[1]), d = m[2] === undefined ? 1 : Number(m[2]);
    return d === 0 ? [c, c + 1] : [c, c + d - 1]; // a pure deletion touches the lines on both sides
  });
}
function readBaseline(root, since) {
  const f = path.resolve(root, since);
  if (existsSync(f) && statSync(f).isFile()) {
    let p;
    try { p = JSON.parse(readFileSync(f, "utf8")); } catch { die(`--since ${since}: not JSON`); }
    if (p.$schema !== "sdd-adversarial-plan-v1" || !p.evaluated_sha) die(`--since ${since}: not an adversarial plan with evaluated_sha`);
    return { sha: resolveSha(root, p.evaluated_sha), plan: p, file: path.relative(root, f) };
  }
  return { sha: resolveSha(root, since), plan: null, file: null };
}

function markRecheck(root, o, shownFases, { commits, codePaths, byId }) {
  if (!isRepo(root)) die("accept adversarial plan --since needs a git repository");
  const base = readBaseline(root, o.since);
  const testPaths = listOf(stackProfile(root).test_paths, ["tests"]);
  const under = (p, dirs) => dirs.some((d) => p === d || p.startsWith(d + "/"));
  const { dir: evDir } = evidenceSettings(root);
  // What changed since the baseline: tracked files (committed or not) and untracked ones
  const changed = new Map();
  for (const l of git(root, ["diff", "--name-status", "--no-renames", base.sha]).stdout.split("\n")) {
    const m = l.match(/^([A-Z])\d*\t(.+)$/);
    if (m) changed.set(m[2], m[1]);
  }
  for (const p of git(root, ["ls-files", "--others", "--exclude-standard"]).stdout.split("\n").filter(Boolean)) changed.set(p, "A");
  const relevant = [...changed.keys()].filter((p) => !NOT_EVIDENCE.test(p) && !/\.md$/i.test(p) && !under(p, [evDir])).sort();
  const codeChanged = relevant.filter((p) => under(p, codePaths));
  // Test files (they hold recognisable tests) with the regions their changes hit; the rest is support (helpers,
  // fixtures, configs, package.json)
  const read = (p) => { try { return readFileSync(path.join(root, p), "utf8"); } catch { return null; } };
  const testChanges = [], support = [];
  for (const p of relevant.filter((x) => !under(x, codePaths))) {
    const text = changed.get(p) === "D" ? git(root, ["show", `${base.sha}:${p}`]).stdout : read(p);
    const regions = text !== null && under(p, testPaths) ? testRegions(text) : null;
    if (!regions) { support.push(p); continue; }
    const whole = changed.get(p) !== "M";
    const ranges = whole ? null : changedRanges(root, base.sha, p);
    const hit = whole || !ranges ? regions : regions.filter((g) => ranges.some(([a, b]) => a <= g.to && b >= g.from));
    testChanges.push({ path: p, shared: hit.some((g) => g.title === null), titles: hit.filter((g) => g.title !== null).map((g) => g.title) });
  }
  // Commits since the baseline: which requirements they name (Refs) per code file
  const sinceShas = new Set(git(root, ["rev-list", `${base.sha}..HEAD`]).stdout.split("\n").filter(Boolean));
  const refsOf = new Map();
  for (const c of commits.filter((x) => sinceShas.has(x.sha))) for (const f of c.files) {
    if (!refsOf.has(f)) refsOf.set(f, new Set());
    for (const id of c.ids) refsOf.get(f).add(id);
  }
  // Requirement texts at the baseline, when it is a commit and not a plan
  let oldHash = null;
  if (!base.plan) {
    const rf = o.requirements || "requirements/REQUIREMENTS.md";
    const t = git(root, ["show", `${base.sha}:${rf}`]);
    oldHash = new Map(t.status === 0 ? parseRequirements(t.stdout).map((r) => [r.id, reqHash(r)]) : []);
  }
  const prevReq = new Map((base.plan?.fases || []).flatMap((f) => f.requirements || []).map((r) => [r.id, r]));
  const cites = (title, reqId, c) => {
    const k = testKeys(title);
    return k.reqAcs.some((x) => x.req === reqId && x.ac === c.n) || k.scenarios.some((s) => (c.scenarios || []).includes(s))
      || (c.tests || []).some((t) => t.name && (t.name === title || t.name.endsWith(` ${title}`)));
  };
  const baseName = (p) => path.basename(p).replace(/\.[^.]+$/, "");
  let total = 0, recheck = 0;
  for (const f of shownFases) {
    // code files: the FASE's requirements they belong to (older commits of the FASE, or the commits since)
    const codeOwners = codeChanged.map((p) => ({ path: p, reqs: f.requirements.filter((r) => r.candidate_files.includes(p) || refsOf.get(p)?.has(r.id)).map((r) => r.id) }));
    const unowned = codeOwners.filter((x) => !x.reqs.length).map((x) => x.path);
    const boundFiles = new Set(f.requirements.flatMap((r) => r.criteria.flatMap((c) => c.tests.map((t) => t.file).filter(Boolean))));
    const boundText = new Map([...boundFiles].map((p) => [p, read(p) || ""]));
    const supportUsed = support.map((p) => ({ path: p, by: [...boundFiles].filter((b) => boundText.get(b).includes(baseName(p))) }));
    const supportAll = supportUsed.filter((s) => !s.by.length).map((s) => s.path);
    let fTotal = 0, fRecheck = 0;
    for (const r of f.requirements) {
      const prev = prevReq.get(r.id);
      const ledgerReq = byId.get(r.id);
      for (const c of r.criteria) {
        const why = [];
        const prevC = prev?.criteria?.find((x) => x.n === c.n);
        if (base.plan ? !prevC : !oldHash.has(r.id)) why.push("new");
        else if (base.plan ? prev.reqHash !== r.reqHash : oldHash.get(r.id) !== r.reqHash) why.push("requirement text changed");
        if (prevC && prev.verdict !== r.verdict) why.push(`verdict ${prev.verdict} → ${r.verdict}`);
        // open now, or open at the baseline and gone stale since (what the fix pass answered): an older stale one
        // was already looked at by the round after it
        // (recorded at the baseline's HEAD or later, or listed open in the baseline plan)
        const openAtBase = (x) => x.head === base.sha || sinceShas.has(x.head) || (prev?.challenges_open || []).includes(x.id);
        const ch = (ledgerReq?.challenges || []).filter((x) => Number(x.ac) === c.n && (x.state === "open" || (x.state === "stale" && openAtBase(x))));
        if (ch.length) why.push(`challenge ${ch.map((x) => `${x.id} ${x.state}`).join(", ")}`);
        const files = new Set(c.tests.map((t) => t.file).filter(Boolean));
        for (const t of testChanges) {
          if (t.titles.some((ti) => cites(ti, r.id, c))) why.push(`test changed: ${t.path}`);
          else if (files.has(t.path) && t.shared) why.push(`shared test code changed: ${t.path}`);
        }
        if (prevC && JSON.stringify(prevC.tests.map((t) => t.name).sort()) !== JSON.stringify(c.tests.map((t) => t.name).sort())) why.push("bound tests changed");
        for (const s of supportUsed) if (s.by.some((b) => files.has(b))) why.push(`test support changed: ${s.path}`);
        if (supportAll.length) why.push(`support changed: ${supportAll.join(", ")}`);
        const code = codeOwners.filter((x) => x.reqs.includes(r.id)).map((x) => x.path);
        if (code.length) why.push(`code changed: ${code.join(", ")}`);
        if (unowned.length) why.push(`code no commit attributes to the FASE changed: ${unowned.join(", ")}`);
        const caps = Object.entries(c.capture_sha256 || {});
        if (!base.plan) { if (caps.length) why.push("captures (no baseline plan to compare)"); }
        else {
          const old = prevC?.capture_sha256 || {};
          const moved = [...caps.filter(([p, h]) => old[p] !== h).map(([p]) => p), ...Object.keys(old).filter((p) => !(c.capture_sha256 || {})[p])];
          if (moved.length) why.push(`capture changed: ${[...new Set(moved)].join(", ")}`);
        }
        c.recheck = why.length > 0;
        c.recheck_reasons = [...new Set(why)];
        fTotal++; if (c.recheck) fRecheck++;
      }
    }
    f.incremental = { criteria: fTotal, recheck: fRecheck };
    total += fTotal; recheck += fRecheck;
  }
  return { since: base.sha, baseline: base.file, changed_files: relevant, criteria: total, recheck, carried: total - recheck };
}

function cmdAdversarial(o) {
  const sub = o._.shift();
  if (sub !== "plan") usage("accept adversarial needs `plan`");
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  const root = rootOf(o);
  const reqs = readReqs(root, o);
  const { ledger } = buildLedger({ ...o, fase: undefined });
  const byId = new Map(ledger.requirements.map((r) => [r.id, r]));
  const textOf = new Map(reqs.map((r) => [r.id, r]));
  const fases = listFases(root);
  if (o.fase !== undefined && !fases.some((f) => f.n === o.fase)) die(`accept adversarial plan: no plan/fases/FASE-${o.fase}-*.md`);
  const planned = new Set(fases.flatMap((f) => f.requirements || []));
  const active = reqs.filter((r) => !r.deprecated && effectivePriority(r) !== "Won't");
  const uncovered = active.filter((r) => !planned.has(r.id)).map((r) => ({ id: r.id, title: r.title, priority: effectivePriority(r) }));
  const withoutHeader = fases.filter((f) => !f.requirements).map((f) => ({ fase: f.n, file: f.file }));

  const codePaths = listOf(stackProfile(root).code_paths, ["src"]);
  let commits = [];
  if (isRepo(root)) { try { commits = effectiveCommits(readCommits(root, { files: true })).filter((c) => c.effective); } catch { commits = []; } }
  const alive = (p) => existsSync(path.join(root, p));
  const candidates = (n, reqId) => [...new Set(commits
    .filter((c) => c.tasks.some((t) => t.startsWith(`TASK-F${n}-`)) && (!reqId || c.ids.includes(reqId)))
    .flatMap((c) => c.files).filter((p) => codePaths.some((d) => p === d || p.startsWith(d + "/")) && alive(p)))].sort();

  const criterionView = (c) => ({
    n: c.n, text: c.text, scenarios: c.scenarios,
    tests: (c.tests || []).map((t) => ({ name: t.name, file: t.file || (looksLikeFile(t.classname) ? t.classname : null), status: t.status, fresh: t.fresh })),
    captures: [...new Set((c.evidence || []).flatMap((e) => (e.attachments || []).filter((a) => a.kind === "image" && a.present).map((a) => a.path)))],
    // sha256 of every image bound to it: the baseline an incremental round (--since) compares against
    capture_sha256: Object.fromEntries([...(c.evidence || []).flatMap((e) => e.attachments || []), ...(c.tests || []).flatMap((t) => t.attachments || [])]
      .filter((a) => a.kind === "image" && a.present && a.sha256).map((a) => [a.path, a.sha256]).sort(([a], [b]) => (a < b ? -1 : 1))),
    // what the capture must show (the «Se ve» contract), the images that do show it, and those that do not count
    ...(c.sees ? { sees: c.sees } : {}),
    ...(c.shown_by ? { shown_by: c.shown_by } : {}),
    ...(c.unbound_captures ? { unbound_captures: c.unbound_captures } : {}),
    ...(c.videos?.length ? { videos: c.videos } : {}),
  });
  const reqView = (id, n) => {
    const r = byId.get(id), t = textOf.get(id);
    return { id, title: t.title, priority: r.priority, verification: r.verification, verdict: r.verdict, statement: t.statement, reqHash: r.reqHash,
      criteria: r.criteria.map(criterionView), candidate_files: n === null ? [] : candidates(n, id),
      challenges_open: (r.challenges || []).filter((c) => c.state === "open").map((c) => c.id) };
  };
  const faseView = (f) => {
    const ids = (f.requirements || []).filter((id) => byId.has(id) && byId.get(id).verdict !== "DEPRECATED");
    return { fase: f.n, file: f.file, header: Boolean(f.requirements), requirements: ids.map((id) => reqView(id, f.n)),
      unknown_requirements: (f.requirements || []).filter((id) => !byId.has(id)),
      tasks: [...new Set(commits.flatMap((c) => c.tasks).filter((t) => t.startsWith(`TASK-F${f.n}-`)))].sort(),
      candidate_files: candidates(f.n, null) };
  };
  const shownFases = fases.filter((f) => o.fase === undefined || f.n === o.fase).map(faseView);
  const incremental = o.since ? markRecheck(root, o, shownFases, { commits, codePaths, byId }) : null;
  // Criteria without a bound test, over the requirements in scope (a FASE, or every active requirement).
  const inScope = o.fase !== undefined ? shownFases.flatMap((f) => f.requirements.map((r) => ({ ...r, fase: f.fase })))
    : active.map((r) => ({ ...reqView(r.id, null), fase: fases.find((f) => (f.requirements || []).includes(r.id))?.n ?? null }));
  const seen = new Set();
  const withoutTest = inScope.filter((r) => r.verification === "test" && !seen.has(r.id) && seen.add(r.id))
    .flatMap((r) => r.criteria.filter((c) => !c.tests.length).map((c) => ({ req: r.id, ac: c.n, fase: r.fase, priority: r.priority })));
  const plan = { $schema: "sdd-adversarial-plan-v1", evaluated_sha: ledger.evaluated_sha, dirty: ledger.dirty, generatedAt: ledger.generatedAt,
    scope: o.fase !== undefined ? { fase: o.fase } : null, code_paths: codePaths, adversarial_gate: ledger.adversarial_gate,
    ...(incremental ? { incremental } : {}), fases: shownFases, uncovered, fases_without_header: withoutHeader, criteria_without_test: withoutTest,
    coverage_gaps: uncovered.length + withoutHeader.length };
  if (o.json) { out(JSON.stringify(plan, null, 2)); return 0; }
  for (const f of shownFases) {
    const crit = f.requirements.reduce((k, r) => k + r.criteria.length, 0);
    out(`FASE ${f.fase} (${f.file})${f.header ? "" : " — no Requisitos: header"}: ${f.requirements.length} requirement(s) · ${crit} criteria · ${f.tasks.length} task(s) · ${f.candidate_files.length} candidate file(s)`);
    for (const r of f.requirements) out(`  ${r.id} ${r.priority || "-"} ${r.verdict}: ${r.criteria.map((c) => `AC${c.n} ${c.tests.length} test(s)`).join(", ")}`);
    if (f.unknown_requirements.length) out(`  not in REQUIREMENTS.md: ${f.unknown_requirements.join(", ")}`);
  }
  for (const r of uncovered) out(`uncovered ${r.id} (${r.priority || "-"}): in no FASE's Requisitos: line`);
  for (const f of withoutHeader) out(`fase without header FASE-${f.fase} (${f.file})`);
  for (const c of withoutTest) out(`criterion without test ${c.req} AC${c.ac}${c.fase !== null ? ` (FASE ${c.fase})` : ""}`);
  if (incremental) out(`incremental since ${incremental.since.slice(0, 7)}: ${incremental.recheck} of ${incremental.criteria} criteria to re-check${incremental.recheck ? ` (${shownFases.flatMap((f) => f.requirements.flatMap((r) => r.criteria.filter((c) => c.recheck).map((c) => `${r.id} AC${c.n}`))).join(", ")})` : ""}`);
  out(`adversarial plan: ${shownFases.length} FASE(s) · ${uncovered.length} uncovered · ${withoutHeader.length} without header · ${withoutTest.length} criteria without test · coverage gaps ${plan.coverage_gaps} (evaluated ${ledger.evaluated_sha ? ledger.evaluated_sha.slice(0, 7) : "no git"})`);
  return 0;
}

// ------------------------------------------------------------------ gate
const GATE_MODES = ["off", "warn", "enforce"];
/** 0 goal met · 1 not met · 2 stale evidence · 3 goal met with waived Musts · 4 goal met but an open adversarial
 *  challenge on a Must under `adversarial_gate: enforce`. Precedence 2 > 1 > 4 > 3 > 0: the challenge never hides a
 *  missing or stale verdict, and outranks the waivers because it questions a verdict that counts as met. */
export function gateCode(ledger, adversarial = ledger.adversarial_gate) {
  const s = ledger.summary;
  if (!s.goal) return s.stale_evidence ? 2 : 1;
  if (adversarial === "enforce" && (s.must_challenged || 0) > 0) return 4;
  return s.must_waived ? 3 : 0;
}
function cmdGate(o) {
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  const root = rootOf(o);
  const mode = o.mode || stackProfile(root).acceptance_gate || "enforce";
  if (!GATE_MODES.includes(mode)) usage(`--mode must be ${GATE_MODES.join(" | ")}`);
  if (mode === "off") return 0;
  let ledger, code;
  if (o.ledger) {
    const f = path.resolve(root, o.ledger);
    if (!existsSync(f)) die(`${o.ledger} not found`);
    try { ledger = JSON.parse(readFileSync(f, "utf8")); } catch { die(`${o.ledger} is not JSON`); }
    if (ledger.$schema !== SCHEMA) die(`${o.ledger} is not ${SCHEMA}`);
    const g = gitContext(root);
    const fresh = !g.repo || (ledger.evaluated_sha && !g.dirty && unchangedSince(root, ledger.evaluated_sha));
    if (!fresh) {
      const msg = `gate: ${o.ledger} was evaluated at ${String(ledger.evaluated_sha || "?").slice(0, 7)}, code changed since — run sdd accept again`;
      if (mode === "warn") { out(msg); out("gate: would exit 2 (mode warn)"); return 0; }
      console.error(msg); return 2;
    }
    if (o.fase !== undefined && (!ledger.scope || ledger.scope.fase !== o.fase)) die(`${o.ledger} was not evaluated for FASE ${o.fase}; run sdd gate --fase ${o.fase} without --ledger`);
  } else {
    let g;
    ({ ledger, git: g } = buildLedger(o));
    warnDirty(o, g);
    if (o.out) writeJson(root, o.out, ledger);
  }
  const adversarial = adversarialGate(root);
  code = gateCode(ledger, adversarial);
  const s = ledger.summary;
  const labels = { 0: "goal met", 1: "goal not met", 2: "stale evidence — re-run the tests on this commit", 3: "goal met with waived Musts",
    4: "open adversarial challenge on a Must (adversarial_gate: enforce)" };
  const openCh = ledger.requirements.filter((r) => r.in_scope).flatMap((r) => (r.challenges || []).filter((c) => c.state === "open")
    .map((c) => ({ id: c.id, req: r.id, ac: c.ac, priority: r.priority, category: c.category, counter: c.counter })));
  const mustCh = s.must_challenged || 0;
  const missingVideos = s.missing_videos || [];
  if (o.json) out(JSON.stringify({ code, mode, label: labels[code], evaluated_sha: ledger.evaluated_sha, scope: ledger.scope, summary: s,
    visual_evidence: ledger.visual_evidence ?? null, unshown: s.unshown ?? 0, missing_videos: missingVideos,
    literal_gate: ledger.literal_gate ?? null, literal_gaps: s.literal_gaps ?? 0, weakened: s.weakened ?? 0,
    adversarial_gate: adversarial, must_challenged: mustCh, challenged_musts: s.challenged_musts || [], open_challenges: openCh,
    requirements: ledger.requirements.filter((r) => r.in_scope && r.verdict !== "DEPRECATED").map((r) => ({ id: r.id, priority: r.priority, verdict: r.verdict, ...(r.reason ? { reason: r.reason } : {}), criteria: `${r.criteria_passing}/${r.criteria_total}`, stale_evidence: r.stale_evidence })) }, null, 2));
  else if (o.md) process.stdout.write(renderPrBlock(ledger, code));
  else {
    for (const r of ledger.requirements.filter((x) => x.in_scope && x.priority === "Must" && !["VERIFIED", "DEPRECATED"].includes(x.verdict)))
      out(`${r.id}  ${r.verdict}${r.reason ? ` (${r.reason})` : ""}${r.stale_evidence ? " (stale evidence)" : ""}  ${r.criteria_passing}/${r.criteria_total}`);
    for (const id of missingVideos) out(`missing video ${id}  (${ROUTES.capture})`);
    if (s.literal_gaps && ledger.literal_gate === "warn") out(`gate: ${s.literal_gaps} criteria whose test lacks the criterion's literal — literal_gate warn keeps the verdicts (enforce would hold the Musts back)  (${ROUTES.weakened})`);
    if (adversarial !== "off") {
      for (const c of openCh) out(`challenge ${c.id} open on ${c.req} AC${c.ac} (${c.priority || "-"}) ${c.category} (${c.counter})  (${ROUTES.adversarial})`);
      if (mustCh && adversarial === "warn") out(`gate: ${mustCh} Must requirement(s) with an open challenge — adversarial_gate warn keeps the exit code (enforce would exit 4)`);
    }
    out(`gate: ${labels[code]} — Must ${s.must_verified}/${s.must_total} verified${s.must_waived ? `, ${s.must_waived} waived (${s.waived_musts.join(", ")})` : ""}${ledger.scope ? ` · FASE ${ledger.scope.fase}` : ""} · exit ${code}`);
  }
  if (mode === "warn") { if (!o.json && !o.md) out(`gate: would exit ${code} (mode warn)`); return 0; }
  return code;
}

// ------------------------------------------------------------------ loop next
const HARD_CAP = 5;
function cmdLoop(o) {
  const sub = o._.shift();
  if (sub !== "next") usage("loop needs `next`");
  if (o._.length) usage(`unexpected argument ${o._[0]}`);
  const root = rootOf(o);
  let max = o["max-cycles"] === undefined ? 3 : Number(o["max-cycles"]);
  if (!Number.isInteger(max) || max < 1) usage("--max-cycles needs a positive integer");
  const capped = max > HARD_CAP;
  if (capped) max = HARD_CAP;
  const stateFile = path.resolve(root, o.state || ".sdd/acceptance-loop.json");
  let state = { $schema: "sdd-acceptance-loop-v1", cycles: [] };
  if (!o.reset && existsSync(stateFile)) {
    try { state = JSON.parse(readFileSync(stateFile, "utf8")); } catch { die(`${o.state || ".sdd/acceptance-loop.json"} is not JSON (use --reset)`); }
    if (!Array.isArray(state.cycles)) state.cycles = [];
  }
  const { ledger, git: g } = buildLedger(o);
  warnDirty(o, g);
  if (!o["no-out"]) writeJson(root, o.out || ".sdd/acceptance.json", ledger);
  const goalSet = ledger.requirements.filter((r) => r.in_scope && r.priority === "Must" && r.verdict !== "DEPRECATED");
  const count = (v) => goalSet.filter((r) => r.verdict === v).length;
  const adversarial = ledger.adversarial_gate || "enforce";
  const progress = { verified: count("VERIFIED"), waived: count("WAIVED"), failing: count("FAILING"), missing: count("MISSING"),
    challenged: ledger.summary.must_challenged || 0, videos_missing: (ledger.summary.missing_videos || []).length };
  const verdicts = Object.fromEntries(goalSet.map((r) => [r.id, r.verdict]));
  const prev = state.cycles[state.cycles.length - 1] || null;
  const cycle = state.cycles.length + 1;
  const target = (r) => ({ req: r.id, priority: r.priority, verdict: r.verdict, verification: r.verification,
    criteria: r.criteria.filter((c) => c.state !== "pass").map((c) => ({ n: c.n, state: c.state, scenarios: c.scenarios, route_hint: criterionHint(r, c),
      ...(c.state === "weakened" ? { literal_gaps: c.literal_gaps } : {}), ...(c.skipped ? { skipped: true } : {}) })),
    route_hint: routeHint(r) });
  const open = (r) => ["FAILING", "MISSING"].includes(r.verdict);
  // Open challenges of the adversarial round, one target each whatever the verdict: confirmed ones route to
  // adversarial-finding (a fix task per finding; SPEC-QUESTION and WRONG-CAPTURE as the protocol says), inconclusive
  // ones to a person. A waived requirement's challenges are not work for the loop.
  const challengeTargets = (r) => r.verdict === "WAIVED" || r.verdict === "DEPRECATED" ? [] : (r.challenges || []).filter((c) => c.state === "open").map((c) => ({
    req: r.id, priority: r.priority, verdict: r.verdict, challenge: c.id, ac: c.ac, category: c.category, counter: c.counter, quote: c.quote,
    evidence: (c.evidence || []).map((e) => e.line ? `${e.path}:${e.line}` : e.path),
    route_hint: c.counter === "confirmed" ? ROUTES.adversarial : ROUTES.human }));
  // A missing FASE video (WF-NNN or FASE-N) is one capture target: run the journey again with video, no code task.
  // Under visual_evidence required it blocks the goal, so it is loop work; under warn it is listed with the others.
  const videoTargets = (ledger.summary.missing_videos || []).map((id) => ({ video: id, fase: ledger.scope?.fase ?? null, route_hint: ROUTES.capture }));
  const videosBlock = ledger.visual_evidence === "required";
  const targets = [...goalSet.filter(open).map(target), ...(adversarial === "off" ? [] : goalSet.flatMap(challengeTargets)),
    ...(videosBlock ? videoTargets : [])];
  const others = [...ledger.requirements.filter((r) => r.in_scope && r.priority !== "Must" && open(r)).map(target),
    ...(adversarial === "off" ? [] : ledger.requirements.filter((r) => r.in_scope && r.priority !== "Must").flatMap(challengeTargets)),
    ...(videosBlock ? [] : videoTargets)];

  const everVerified = new Set(state.cycles.flatMap((c) => Object.entries(c.verdicts || {}).filter(([, v]) => v === "VERIFIED").map(([k]) => k)));
  const regressed = goalSet.filter((r) => everVerified.has(r.id) && open(r)).map((r) => r.id);
  let stop = null;
  // Under adversarial_gate enforce the goal also needs no open challenge on a Must (the gate would exit 4).
  if (ledger.summary.goal && !(adversarial === "enforce" && progress.challenged)) stop = "goal";
  else if (regressed.length) stop = "regression";
  else if (targets.length && targets.every((t) => t.route_hint === ROUTES.human || t.route_hint === ROUTES.specGap)) stop = "needs-human";
  else if (prev && !(progress.verified > prev.progress.verified || progress.failing + progress.missing < prev.progress.failing + prev.progress.missing
    || progress.challenged < (prev.progress.challenged ?? 0) || progress.videos_missing < (prev.progress.videos_missing ?? 0))) stop = "no-progress";
  else if (cycle > max) stop = "max-cycles";
  const result = { cycle, max_cycles: max, stop, evaluated_sha: ledger.evaluated_sha, progress,
    previous: prev ? { cycle: prev.cycle, progress: prev.progress } : null, regressed, targets, others,
    stale_evidence: ledger.summary.stale_evidence, unshown: ledger.summary.unshown ?? 0, literal_gaps: ledger.summary.literal_gaps ?? 0,
    adversarial_gate: adversarial, must_challenged: progress.challenged,
    missing_videos: (ledger.summary.missing_videos || []).map((id) => ({ video: id, route_hint: ROUTES.capture })) };
  if (capped) result.note = `--max-cycles capped at ${HARD_CAP}`;
  state.max_cycles = max;
  state.cycles.push({ cycle, at: ledger.generatedAt, evaluated_sha: ledger.evaluated_sha, progress, verdicts, stop });
  mkdirSync(path.dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
  out(JSON.stringify(result, null, 2));
  return 0;
}

// ------------------------------------------------------------------ entry
export function runAcceptance(cmd, argv, { prog = "sdd" } = {}) {
  PROG = prog;
  try {
    const o = parse(argv);
    if (cmd === "lint") return o.quotes ? cmdLintQuotes(o) : o.captures ? cmdLintCaptures(o) : cmdLintNeeds(o);
    if (cmd === "accept") return cmdAccept(o);
    if (cmd === "gate") return cmdGate(o);
    if (cmd === "loop") return cmdLoop(o);
    usage(`unknown command ${cmd}`);
  } catch (e) {
    if (e instanceof Exit) return e.code;
    throw e;
  }
}

