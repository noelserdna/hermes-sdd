# Adversarial round (`--adversarial`)

A test bound by name to a criterion and passing proves that *some* assertion held, not that the requirement's letter
holds in the product. The failures this round looks for live between the two: the test asserts a weakened version of
the criterion, passes against a mock the real provider does not honour, exercises a piece no user path mounts, or
misses the other route that bypasses the implementation. They are found by reading the requirement literally against
production code and tests, with the acceptance artifacts forbidden as evidence, because those artifacts are what a
green test already convinced.

The division of labour does not change: agents read and argue, the CLI records and computes the gate, a verifier of
a later round resolves a finding the new evidence answers, a person dismisses. `SDD="${SDD_PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}/scripts/sdd.mjs"`, run with `node`.

## 0. Before the round

- The ledger must describe HEAD: run `--check` first (Step 1 on a clean tree, `sdd accept --junit-sha`) and stop if
  `evaluated_sha` in `.sdd/acceptance.json` is not `git rev-parse HEAD`. Findings are anchored to HEAD and to the
  files they cite; a finding against code nobody committed describes nothing.
- Concurrency: at most `test_slots` agents (Stack Profile, default 2) run at a time, because verifiers may run tests
  and the machine is shared with other sessions and stations. Each agent runs tests one file at a time.

## 1. Mechanical coverage critic

```bash
node "$SDD" accept adversarial plan [--fase N] --json > .sdd/adversarial-plan.json
```

Per FASE it gives the requirements with their literal text, their criteria, the tests bound to each criterion and
the candidate files; and, for the whole project, `uncovered` (active requirements in no FASE's `Requisitos:`),
`fases_without_header` and `criteria_without_test`. Report them before launching anyone:

| Item | Meaning | Goes to |
|---|---|---|
| `uncovered` | a requirement no increment delivers, so no verifier would look at it | a person: a plan gap (`/sdd-plan-architect`) or a requirement to change (`/sdd-req-change`) |
| `fases_without_header` | a FASE whose requirements cannot be read, so its scope is unknown | fix the header (`node "$SDD" lint --plan`) |
| `criteria_without_test` | already MISSING in the ledger (`implement-or-test`) | the verifier still reads the code for them |

`uncovered` and `fases_without_header` count in `coverage_gaps`.

## 2. Priority (Jev, or the LLM)

With Jev on, run the `test-adequacy` screen over **every** criterion with a bound test in scope, not only the Must
VERIFIED ones (`jev-advisory.md` § Pre-pass for the adversarial round). Order each FASE's criteria by the lower of
`asserts_then` and `exercises_when`, lowest first; criteria without a test go last, since the ledger already has them
open. With Jev off (exit 3), order them yourself from the criterion text and the bound test names. The order only
decides what verifiers read first and which clean verdicts are sampled in §4; it never marks a criterion clean, and
no criterion is skipped because it scored high.

## 3. Verifiers: one per FASE

One Agent per FASE in scope (subagent type `general-purpose`: fresh context, no implementation history), in batches
of at most `test_slots`. Fill the template below with the FASE's slice of `.sdd/adversarial-plan.json`, in priority
order, and the Stack Profile's `{test_file}` command. A FASE with more than about 15 criteria is split into two
verifiers by requirement, so each keeps the letter of what it checks in view.

```
You are an independent verifier of FASE-{N} of this project. You did not build it and you owe it nothing.
Your job is to find where a requirement's letter is NOT met by the code, even though its tests pass.

Rules:
1. Never cite acceptance/, feedback/ or spec/ as evidence of compliance (nor requirements/, plan/, task/, audits/,
   changes/, .sdd/, or test/ outside the project's test paths): only production code and test code, plus captures
   under evidencias/, which you cite without a line (WRONG-CAPTURE). What those folders say is what you are checking.
2. Re-read the full letter of each requirement: `node "{SDD}" req show {REQ-ID} --json`. Work from that text, not
   from summaries in this prompt, a spec, a plan or a test name.
3. Check that the assertions of the bound tests encode the criterion for real, not a weakened version: the exact
   literal (a word dropped from a title, a font, "with screenshots" turned into written steps), the whole THEN, the
   GIVEN situation.
4. Actively look for the production path that bypasses the implementation: another route, another caller, a
   component nobody mounts, the real provider versus the mock the tests use, a replay or two concurrent requests.
5. Read the captures in {evidence_dir}/FASE-{N}/ named after each criterion (AC-NNN-NN.png or REQ-F-NNN-ACn.png)
   and check that they show the criterion's literal (the text, the state, the screen): the texts of its `Se ve:`
   line when it has one (`req show --json` → `criteria[].sees`), else the literal of its THEN. A capture of another screen,
   an error page, a loading state or the weakened text is a WRONG-CAPTURE finding. A missing capture is not your
   finding: the ledger already marks that criterion `unshown`.

Resources: run at most one test file at a time, with `{test_file}`; never the whole suite, the acceptance suite
without --grep, coverage or watch mode; never start servers or databases outside the test runner.
You are read-only: do not edit, create or delete any file, do not commit, do not run `sdd accept` commands.

Criteria to check, in this order:
{per criterion: REQ-ID, AC n, priority, scenario id, bound tests (file:line), candidate files}

Answer with one JSON object per line, one per criterion, and nothing else:
{"req": "REQ-F-012", "ac": 2, "verdict": "clean" | "finding", "category": "<one of the categories, findings only>",
 "quote": "<the literal words of the criterion that are not met>", "evidence": ["src/x.ts:41", "tests/x.test.ts:88"],
 "reasoning": "<how you know, in at most 5 lines>"}
```

Categories:

| Category | The code or test… |
|---|---|
| `WEAKENED-ASSERT` | asserts a weaker version of the criterion (a word, a value or a clause of the THEN missing). A clause comment (`REQ-X-NNN ACn cláusula: "…"`) points at the assert meant for a clause of «stays as it was» or «every case»: read that assert, not the comment — «y no cambia nada más» needs the whole state read before the action and compared after, «todos» needs the whole set |
| `MOCK-ONLY` | passes against a mock or double whose contract the real provider does not honour |
| `UNWIRED` | builds and tests the piece, but no user path mounts or calls it |
| `BYPASS-PATH` | leaves another production route, caller or entry point that skips the behaviour |
| `CROSSING` | breaks under replay, concurrency or a second path that no task owned |
| `NOT-IMPLEMENTED` | does not implement the behaviour at all |
| `SPEC-QUESTION` | cannot meet the criterion as written, or the criterion contradicts another: a question for a person |
| `WRONG-CAPTURE` | captures a screen that does not show the criterion's literal |

### 3b. The capture verifier: every capture of the FASE at once

Besides the verifiers per FASE, one more Agent per FASE (same subagent type, same rules 1-2) looks only at captures,
all of them: a capture mistake is almost always a pattern (checked by API and captured afterwards, captured in a
`test.step` of another test, one screen for many criteria), and a verifier that sees 15 criteria finds one instance
per round while the rest of the FASE keeps the same mistake (club: FASE-7 rejected twice for one rule on two
captures). Run `node "$SDD" lint --captures --fase N --json` first and hand its findings to this verifier; give it
the full table, one row per REQ-F criterion in scope, from `.sdd/adversarial-plan.json`:

| REQ / AC | Se ve (the `sees` texts and screen, or `No visible`) | Images (`shown_by`) | Not counted (`unbound_captures`) | Test that took it | Video |
|---|---|---|---|---|---|

Its prompt is the template above with rule 5 only, plus: «Open every image of the table. For each row, the texts of
`Se ve` must be readable in the image, on the screen it names, with the GIVEN's data (the actor, the date). When a
row fails, name the rule it breaks and list EVERY row of the table that breaks the same rule, each as its own
WRONG-CAPTURE line, not only the first.» A criterion without `sees` is checked against the literal of its THEN and,
when it has none, reported as `SPEC-QUESTION` («the criterion does not say what is seen»), not guessed.

A clean verdict needs evidence too (the assertion and the production line it covers), so an empty answer is never
read as clean: a criterion missing from the answer is sent again to a new verifier.

## 4. Counter-verification

Every finding, and a sample of clean verdicts, goes to a second Agent in a fresh context that never sees the first
verifier's reasoning: an argument read first anchors the second reader, and the point is an independent look.

- **Sample of clean verdicts:** per FASE, the lowest-priority-score clean criteria (§2), at least 2 and about a fifth
  of the clean ones.
- **Input:** the rules 1-5 and the resource lines of §3, the requirement's letter (`req show`), the criterion, and
  for a finding its category, quote and evidence lines; for a clean sample, the bound tests and candidate files.
- **Question:** for a finding, "Try to refute this: show, with production or test code, that the criterion's letter
  is met"; for a clean sample, "Try to find a finding in the categories above".
- **Answer:** `confirmed` (the finding stands), `refuted` (with the code that refutes it) or `inconclusive`. A
  finding the clean-sample counter-verifier raises is counter-verified once more by a fresh agent, and no further.

`inconclusive` is a question for a person, recorded so it is not lost.

## 5. LLM coverage critic

One more agent (or the main thread, when the scope is one FASE) confirms that the universe evaluated is complete:
every active requirement of `requirements/REQUIREMENTS.md` in scope reached a verifier, every criterion of each one
(counted from the requirement's text, not from the plan) got a verdict, and no requirement was left out as
deprecated when it is not. Each gap is reported, counts in `coverage_gaps`, and goes to a person like `uncovered`.

## 6. Record

Record each `confirmed` and each `inconclusive` finding; `refuted` ones are listed in the summary, not recorded:

```bash
node "$SDD" accept challenge add --req REQ-F-012 --ac 2 --category WEAKENED-ASSERT \
  --quote "su título es 'Proyectos personales'" --evidence src/cv/sections.ts:41 tests/cv/pdf.test.ts:88 \
  --verifier "verifier-FASE-2" --counter confirmed
```

The CLI writes `acceptance/challenges.jsonl` (nobody else does), stamps HEAD, the requirement's text hash and the
paths cited (a capture's sha256), and exits 2 on evidence under `acceptance/`, `feedback/`, `spec/`, `requirements/`,
`plan/`, `task/`, `audits/`, `changes/`, `.sdd/`, or `test/` outside the Stack Profile's `test_paths` (Rails keeps its
tests there), and on a cited file that is uncommitted or lacks the line: rewrite that finding with code or test lines,
or drop it. Then regenerate the
ledger (`node "$SDD" accept --junit-sha "$SHA" --report acceptance/ACCEPTANCE-REPORT.md [--fase N]`) and commit:

```bash
git add acceptance/
git diff --cached --quiet || git commit -m "docs(acceptance): adversarial round FASE-{N} at {sha7}" --trailer "Refs: FASE-{N}, <REQ ids>"
```

The verdicts do not change: a challenge sits next to the verdict (`requirements[].challenges[]`,
`summary.must_challenged` in the ledger) until the code it cites changes (`stale`), the requirement changes, a
verifier of a later round resolves it (`resolved`, §7b), or a person dismisses it. Only `open` ones count for the gate,
the loop and `must_challenged`. Dismissing is a human record, made only after that person says so in this session (the
tool guard asks): `node "$SDD" accept record challenge-dismissal --challenge CH-NNN --reason TEXT --by NAME --role ROLE`.

Resolving is the independent verifier's, never the implementer's: whoever fixed a finding does not certify the fix
(the harness denies `challenge resolve` outside the adversarial round, and stops the stage if one appears in
`challenges.jsonl` from another step). It appends a line `{"type":"resolution",…}` to `acceptance/challenges.jsonl`
with HEAD, reason, evidence and what changed; the challenge's own line is never rewritten:

```bash
node "$SDD" accept challenge resolve --challenge CH-010 \
  --reason "tests/domain/taller.test.js now asserts the whole THEN with the criterion's data" \
  --evidence tests/domain/taller.test.js:57 --verifier "verifier-FASE-1"
```

The CLI exits 2 unless something of the criterion's evidence changed since the challenge's HEAD (its bound tests or the
test files that cite `REQ-X-NNN ACn` or its scenario id, its captures, code that commits with `Refs:` to its
requirement touched, its text), and unless `--evidence` cites one of those changes. With nothing changed the finding
stands on the same evidence it was confirmed on: "nada cambió desde CH-NNN: no se puede dar por resuelta" — only a
person may dismiss it.

## 7. Into the loop

`node "$SDD" loop next` returns open, confirmed challenges as targets with route `adversarial-finding` and their
`category`, and open `inconclusive` ones with route `needs-human`, so that an `enforce` goal is never blocked without a
visible target. Per `adversarial-finding` target, write a feedback entry in `feedback/IMPL-FEEDBACK-FASE-{N}.md` citing the `CH-NNN`, category,
quote and evidence, commit it, and route:

- `SPEC-QUESTION` → a `SPEC-DEVIATION` entry and a person decides (`/sdd-req-change`); no task.
- `WEAKENED-ASSERT` → a fix task on the test, which is brought to the criterion's letter (never loosened); the code
  is right, so the task has no `Reproduce first:` and its test edit is for a person to approve
  (`skills/sdd-task-generator/references/task-template.md`, § Fix task). A failure that follows is fixed in the code.
- `WRONG-CAPTURE` → the same exception: a fix task on the journey test, so it captures the screen where the literal is
  visible. When the screen itself lacks the literal, the code is at fault and the task is an ordinary fix task.
- every other category → `/sdd-task-generator --fase N --incremental`, one fix task per finding with
  `Source: ACCEPTANCE-ADVERSARIAL-FASE-{N}`, then `/sdd-task-implementer --fase N --new-tasks-only`.

After the fixes are committed, run `--adversarial --fase N` again: the challenges whose cited code changed are
`stale`, and the new round confirms whether each finding still holds. A fix often leaves the cited code alone (a new or
stronger test elsewhere), so the challenge is still `open`: the round must close it one way or the other (§7b), or it
stays open forever and a person has to dismiss by hand what was already fixed.

## 7b. Incremental round

The first round of each FASE reads every criterion. A later round of the same FASE (the one after the fix pass, or a
re-acceptance after a rejection) may read only what moved since the previous round, whose plan JSON was kept:

```bash
node "$SDD" accept adversarial plan --fase N --since .sdd/hermes/adversarial-FASE-N.json --json
```

Each criterion gets `recheck` and `recheck_reasons`: its requirement text changed, a test block that cites it (or
shared code of its test file, or a helper that file imports) changed, code its requirement's commits own changed, the
sha256 of its capture changed, its bound tests or its verdict changed, or it has an open challenge (or one that was
open at the previous round). What cannot be pinned to a criterion (a test config, code no commit attributes to the
FASE) re-checks every criterion. Send only the `recheck: true` criteria to the verifiers of §3 and §3b and take the
clean sample of §4 among them; the others keep their previous adversarial verdict (nothing in their evidence changed
and nobody challenged them), so §5 does not report them as a gap. `incremental` in the plan counts `criteria`,
`recheck` and `carried`. With nothing to re-check there is no round to run.

Every open challenge on a re-checked criterion gets an answer from the round, in its summary and in the ledger:

- **confirmed**: the verifier (and its counter-verifier, §4) still finds the gap on the current code and tests. Nothing
  is recorded: the challenge stays `open` with its id. A new gap on the same criterion is a new `challenge add`.
- **no longer holds**: the counter-verifier agrees that the new evidence meets the letter. The main thread runs
  `challenge resolve` (§6) citing that new evidence (the test, code or capture that changed). It is `resolved`, stops
  counting for the gate and, at the next incremental round, forces no recheck unless its evidence moves again.
- **inconclusive**: it stays `open` (route `needs-human`).

A resolved challenge that a later verifier confirms again is recorded as a new challenge on the same criterion
(`challenge add`), which is `open` and counts again.

## 8. Gate

`adversarial_gate` in the Stack Profile decides what an open challenge on a Must does to `sdd gate`: `off` ignores
it, `warn` prints it and keeps the exit code, `enforce` (the default) exits **4**. At `--sign-off` and at the FASE
gate, show the open challenges to the approver whatever the setting: a warning nobody reads protects nobody.
