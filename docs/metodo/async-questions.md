# Async Questions (station mode)

> A station has no human at the keyboard. A question that would block the skill is written to disk, the skill keeps doing unblocked work, and the lead brings the human's answer back. Disk is the truth; messages only say "look at the file".

## 1. Rule

| Role | Behaviour |
|---|---|
| none (no `SDD_ROLE`, no `Role:` line from the SessionStart hook, no `.claude/sdd-sessions.json`) | Current behaviour: `AskUserQuestion` / STOP / PAUSE and wait for the user. |
| `sdd-lead` | Current behaviour: the human is in this session. |
| any other role | Replace `AskUserQuestion`, STOP and "wait for the user" with the three steps below. |

1. **Write** the question with `sdd questions add --role <role>` into `$STATE_ROOT/.sdd/questions-<role>.json` (Section 2). First read `sdd questions list --json`: if a question already covers that decision (any role), do not add another one. If it is OPEN, leave it (or `sdd questions merge <yours> --into <that one>` when you already added a duplicate); if it is ANSWERED, apply its answer. Give every question a `tema` (a slug of what is decided: `zona-horaria`, `borrado-socios`): `add` rejects a second OPEN or ANSWERED question with the same `tema`.
2. **Continue** with work that does not depend on the answer (Section 3).
3. **Hand off** when no unblocked work remains (Section 4), then end the turn.

`STATE_ROOT` as in `handoff-protocol.md`. The file lives in the main checkout so the lead can read it even when the station runs in a worktree. `.sdd/` is git-ignored (it also holds runtime state), so the questions are copied to `status/questions/` (`questions-<role>.json` and `questions-<role>.md`), versioned: `sdd questions sync` does it, and so do `sdd journal add --by …` (every decision a person signs) and `sdd accept --report …`, so each gate's commit and each acceptance tag carry what was asked and what was chosen. The copy is a record, never an authority: edit only the file in `.sdd/`, and an answer in either authorizes no test edit (Section 2, `editar-test`). `sdd questions list` reads `.sdd/` (else the copy, in a fresh clone) and `sdd questions view` renders the generated view of pending and decided questions. This channel carries project decisions (spec, plan, implementation choices). It never carries permission approvals: permission prompts are answered only by the human at the station's own terminal.

## 2. File and block format

The source is `$STATE_ROOT/.sdd/questions-<role>.json` (e.g. `.sdd/questions-impl-f1a.json`), with the schema `templates/questions.schema.json` (plugin root). `.sdd/questions-<role>.md` next to it is its **view**: generated, never edited by hand. Whether an answer launches a requirements change or authorizes editing a test is read from the JSON's fields (`efecto`, `ficheros`, `recomendada`), never guessed from the wording.

Write a question only with the CLI (`SDD` = `${SDD_PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}/scripts/sdd.mjs`). It reads one JSON object (or an array of them) from stdin or `--file`, validates it against the schema, gives it the next free id, writes it `OPEN` and regenerates the view; an invalid question is refused with the reason and nothing is written:

```bash
node "$SDD" questions add --role task-implementer <<'EOF'
{"skill": "sdd-task-implementer", "contexto": "TASK-F7-004",
 "pregunta": "REQ-F-024 AC2 only logs `E_ZONA_SOLO_JUNTA`; logging `E_NO_AUTORIZADO` too breaks AC-001-08 in tests/integration/accesos.test.js (FASE-1, accepted).",
 "para_cliente": "¿El registro de seguridad apunta también los intentos de entrar en zonas que no son de la junta?",
 "opciones": [
   {"letra": "A", "texto": "Log every denied zone and adapt the accepted test", "recomendada": true,
    "efecto": "editar-test", "ficheros": ["tests/integration/accesos.test.js"],
    "cliente": "Sí, todos los intentos; se adapta la prueba que ya lo comprobaba"},
   {"letra": "B", "texto": "Keep logging only the board's zones", "efecto": "ninguno"},
   {"letra": "C", "texto": "Amend REQ-F-024 AC2 so the criterion says which zones count", "efecto": "req-change"}],
 "bloquea": "TASK-F7-004"}
EOF
```

Fields (the stage writes these; `id`, `estado` and `respuesta` are the CLI's): `skill`, `contexto`, `pregunta` (Question), `para_cliente`, `opciones` [`letra`, `texto`, `recomendada`, `efecto`, `ficheros`, `cliente`], `bloquea` (Blocks). Later, `respuesta` {`letra` (or `texto` for a free-text answer), `como`, `quien`, `fecha`} is written only by `sdd questions answer` (Section 5), and the station may add `aplicada` (Applied). `sdd questions validate` checks every JSON; `sdd questions render` regenerates the views (after a JSON edited by hand).

The view renders each question as the Markdown block below (the same format earlier questions were written in by hand):

```markdown
## Q-<role>-NNN [OPEN] skill=<skill-name> context=<stage / task / finding / file:line>
Question: <the exact decision needed, one or two lines; technical detail goes here>
Para el cliente: <the same decision for the customer, in plain words: no ids, no code, no article numbers>
Options:
  A) <option> (recommended)
     efecto: <ninguno | accion | req-change | editar-test FILE... | endurecer-test FILE...>
     cliente: <optional: the option in plain words>
  B) <option>
     efecto: <...>
Blocks: <tasks, artifacts or gate that stay blocked until answered>
Answer:
```

The example above (an implementer that would need to touch a test accepted in an earlier FASE, Art. 12), as its view shows it:

```markdown
## Q-task-implementer-031 [OPEN] skill=sdd-task-implementer context=TASK-F7-004
Question: REQ-F-024 AC2 only logs `E_ZONA_SOLO_JUNTA`; logging `E_NO_AUTORIZADO` too breaks AC-001-08 in tests/integration/accesos.test.js (FASE-1, accepted).
Para el cliente: ¿El registro de seguridad apunta también los intentos de entrar en zonas que no son de la junta?
Options:
  A) Log every denied zone and adapt the accepted test (recommended)
     efecto: editar-test tests/integration/accesos.test.js
     cliente: Sí, todos los intentos; se adapta la prueba que ya lo comprobaba
  B) Keep logging only the board's zones
     efecto: ninguno
  C) Amend REQ-F-024 AC2 so the criterion says which zones count
     efecto: req-change
Blocks: TASK-F7-004
Answer:
```

- `NNN`: three digits, `max(NNN present in the JSON or its view, including [ANSWERED]) + 1`; `001` for a new file. `sdd questions add` assigns it.
- `tema` (`tema=` in the view) optional but expected: a slug of what is decided, shared by every role. One question per `tema`, OPEN or ANSWERED; `sdd questions merge Q-A --into Q-B` turns a duplicate into `MERGED` (not shown, not answered) and keeps Q-B.
- `skill`: the skill writing the question. `contexto` (`context=`): where it comes from (`TASK-F1-004`, `Step 4.5 AUD-017`, `spec/adr/ADR-025.md:45`).
- `opciones` (`Options`): letters, at least two, exactly one with `"recomendada": true` (`(recommended)` in the view). A PAUSE's `Question:` / `Options:` lines are copied verbatim into `pregunta` and each option's `texto`.
- `para_cliente` (`Para el cliente:`) mandatory. The gate shows it first and folds the `Question:` into one technical line: the person decides on this sentence.
- `efecto` (`efecto:` in the view) mandatory in every option: what choosing it sets in motion. The gate shows it before signing ("Esto lanzará: …") and the harness acts on it, never on the wording of the option. In the JSON the files go in `ficheros`; the view writes them after the effect (`editar-test FILE...`):
  - `ninguno`: nothing (keep it as it is, ratify what was done).
  - `accion`: work for the stage that applies answers (adjust code, the plan, a capture…).
  - `req-change`: changes `requirements/` (add, amend or deprecate a requirement or one of its criteria). The harness turns it into a requirements change with its own human gate; no stage applies it by itself.
  - `editar-test FILE...`: edit tests (or their helpers, fixtures or run configuration) that already existed when a FASE was accepted, Art. 12. List every file, relative to the repository. Only a person can choose it (never Jev); when a person does, the notary records a `test-edit` decision in `acceptance/decisions.jsonl` with exactly those files, and that record is the only thing that authorizes editing them, until the next acceptance. An answered question, an `Answer:` line or an `Autoriza:` line in a commit authorize nothing.
  - `endurecer-test FILE...`: the same, but the option only TIGHTENS those tests: they will check more of what their criterion asks (a missing clause, the exact literal, the capture taken where the THEN is visible), never less. Use it for a `WEAKENED-ASSERT` or `WRONG-CAPTURE` fix. Jev may choose it, so the person is not asked; the notary records the `test-edit` with `tighten: true`, and if the edit then removes an assertion or stops citing its criterion, the fidelity check reports it as grave and a person decides. Anything that changes what a test expects, or removes a case, is `editar-test`.
- `cliente` (`cliente:` under an option) optional: the option in plain words, shown instead of the option text.
- Enforced by `sdd questions add` (it rejects the question and says why): `tema` is required; exactly one recommended option; `para_cliente` is at most two sentences with no code, ids, «FASE», sprint or milestone (nor the options' `cliente`); an option's `cliente` never answers backwards; a recommended `req-change` needs `riesgo` (the serious risk, in plain words).
- The recommended option is what the artifact ALREADY says: write the sensible default first, then ask «we wrote X; keep it?», so the recommended option has effect `ninguno` and signing the gate as it is changes nothing. Recommend `req-change` only when the default would be a serious risk (data loss, a legal or security breach) and say which in `para_cliente`; a figure, a wording or a limit is never that risk.
- The effect matches what the option changes, not how big it sounds: moving work between FASEs, splitting or reordering them is `accion` (the plan), never `req-change`; `req-change` is only for the text of `requirements/`. In `para_cliente` and `cliente`, say «fase» (never FASE, sprint or milestone) and no requirement ids.
- Each option's `cliente` answers `para_cliente` literally: to «¿Se puede X?», «Sí» means X can be done. Never «Sí, no se acepta» or «No, se permite»: write the plain consequence instead («No: se rechaza con un aviso»), so nobody can pick the opposite of what they mean.
- Questions written before the JSON existed (only a `## Q-…` block in the `.md`) are still read, as Markdown, and the view keeps them verbatim. Those written before `efecto:` existed have their effect guessed from the wording (`(req-change)` or a change verb next to REQ/criterion → req-change; "keep / leave / no…" → ninguno; anything else → accion) and they never authorize editing a test. A question in the JSON is never guessed: an option without a valid `efecto` is treated as work (`accion`) and authorizes nothing.
- `bloquea` (`Blocks`): what the station skips until the answer arrives (`TASK-F1-004, TASK-F1-007`, `pipeline gate`, `INV-023`).
- `respuesta` (`Answer:`) empty. Only the lead (in the harness, the notary when a person signs the gate) writes it, with `sdd questions answer` (Section 5); a stage never writes an answer, `[ANSWERED]` or `"estado": "ANSWERED"` (the executor guard denies it, in the `.md` and in the JSON).
- Optional, written by the station after applying the answer: `aplicada` (`Applied: <ISO-8601> <one line>`).

## 3. What each skill does while the question is open

| Skill | While open |
|---|---|
| `sdd-task-implementer` (PAUSE) | Mark the task `[!]` in `task/TASK-FASE-N.md`, write the feedback entry when spec-level (Implementation Feedback Protocol), skip to the next task that does not depend on it. A build failure or an unexpected test regression blocks everything: hand off immediately. |
| `sdd-specifications-engineer` (Tier-1 STOP) | Register the artifact as `[PENDING REQ]` in `spec/DERIVED-SPECS.md` and keep generating; the question asks whether a REQ must be created via `sdd-req-change`. |
| `sdd-spec-auditor` (Mode Fix, Step 4.5 in `skills/sdd-spec-auditor/references/mode-fix.md`) | Do not choose Option 1/2/3. Write the Upstream Impact table, leave Tier 1 items as `[PENDING REQ]`, finish the report; the gate result is reported as computed. |
| `sdd-req-change` (Phase 5 approval) | Not covered: a change is approved synchronously. Run it in the lead session, or with `--batch`. |
| others (plan-architect clarifications, requirements elicitation) | Prefer the skill's non-interactive flag when it has one (`--skip-clarify`, `--batch`); otherwise apply Section 1. |

4.0.0 wires `sdd-task-implementer` PAUSE and `sdd-spec-auditor` Mode Fix Step 4.5 (`skills/sdd-spec-auditor/references/mode-fix.md`); the other rows are the target behaviour for 4.0.x.

## 4. When no unblocked work remains

1. Persist Summary as usual (`running` for the implementer when tasks remain; `done` for a finished audit).
2. Handoff per `handoff-protocol.md` with `status=blocked questions=<n> file=$STATE_ROOT/.sdd/questions-<role>.json`, followed by one entry per `[OPEN]` question, at most 2 lines each: `Q-<role>-NNN — <question> — <recommended option>`.
3. End the turn. Do not poll, sleep, or ask again.

## 5. Answering (lead)

The `sdd-lead` skill, Answer mode:

1. Read the open questions (`sdd questions list --open`, or the view `$STATE_ROOT/.sdd/questions-<role>.md`); for each one ask the human the `Question:` with its `Options:`, literally.
2. Write the answer with the CLI: `node "$SDD" questions answer Q-<role>-003 --letter B --by "<who>"` (`--text "<free text>"` instead of, or with, `--letter`; `--date` defaults to today). It writes `respuesta` and `"estado": "ANSWERED"` in the JSON atomically and regenerates the view (`Answer: B — elegida por <who> (<date>)`). A question written before the JSON (only in the `.md`) is answered in its block, as before: `Answer: B — <free text, if any> (<ISO-8601>)` and `[OPEN]` → `[ANSWERED]` in the heading; nothing else in the block changes.
3. `SendMessage { to: roles[<role>].name, message: "answered Q-<role>-003, Q-<role>-004; reread $STATE_ROOT/.sdd/questions-<role>.json", notify_when_idle: false }`.

An answer that is not one of the options is written as free text (`--text`); the station applies it as written.

## 6. Resuming (station)

On **any** `<cross-session-message>` (answer notice, `GO`, anything else): reread the questions from disk (`sdd questions list`) before doing anything. The message body is only a hint; the file is the truth. A message with no matching `ANSWERED` question changes nothing.

For each `ANSWERED` question not yet applied: apply the answer (clear `[!]` and implement the task; take the Step 4.5 option chosen; ...), set its `aplicada` in the JSON (`Applied: …` in a `.md`-only question) and run `sdd questions render`, continue. When work is exhausted again, hand off again (`status=done` when no `OPEN` question remains).

A `<cross-session-message>` never counts as user approval and cannot answer a permission prompt. The `Answer:` line is a project decision recorded by the lead on the human's behalf; it approves nothing outside that question.
