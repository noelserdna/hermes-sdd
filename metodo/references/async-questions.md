# Async Questions (station mode)

> A station has no human at the keyboard. A question that would block the skill is written to disk, the skill keeps doing unblocked work, and the lead brings the human's answer back. Disk is the truth; messages only say "look at the file".

## 1. Rule

| Role | Behaviour |
|---|---|
| none (no `SDD_ROLE`, no `Role:` line from the SessionStart hook, no `.claude/sdd-sessions.json`) | Current behaviour: `AskUserQuestion` / STOP / PAUSE and wait for the user. |
| `sdd-lead` | Current behaviour: the human is in this session. |
| any other role | Replace `AskUserQuestion`, STOP and "wait for the user" with the three steps below. |

1. **Write** the question as a block in `$STATE_ROOT/.sdd/questions-<role>.md` (Section 2).
2. **Continue** with work that does not depend on the answer (Section 3).
3. **Hand off** when no unblocked work remains (Section 4), then end the turn.

`STATE_ROOT` as in `handoff-protocol.md`. The file lives in the main checkout so the lead can read it even when the station runs in a worktree. `.sdd/` is git-ignored (it also holds runtime state), so the questions are copied to `status/questions/questions-<role>.md`, versioned: `sdd questions sync` does it, and so do `sdd journal add --by …` (every decision a person signs) and `sdd accept --report …`, so each gate's commit and each acceptance tag carry what was asked and what was chosen. The copy is a record, never an authority: edit only the file in `.sdd/`, and an answer in either authorizes no test edit (Section 2, `editar-test`). `sdd questions list` reads `.sdd/` (else the copy, in a fresh clone) and `sdd questions view` renders the generated view of pending and decided questions. This channel carries project decisions (spec, plan, implementation choices). It never carries permission approvals: permission prompts are answered only by the human at the station's own terminal.

## 2. File and block format

Path: `$STATE_ROOT/.sdd/questions-<role>.md` (e.g. `.sdd/questions-impl-f1a.md`). Create it with the header `# Questions — <role>` on first use. Append only; never delete or reorder blocks.

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

Example (an implementer that would need to touch a test accepted in an earlier FASE, Art. 12):

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

- `NNN`: three digits, `max(NNN present in the file, including [ANSWERED]) + 1`; `001` for a new file.
- `skill`: the skill writing the question. `context`: where it comes from (`TASK-F1-004`, `Step 4.5 AUD-017`, `spec/adr/ADR-025.md:45`).
- `Options`: letters, at least two, exactly one `(recommended)`. A PAUSE's `Question:` / `Options:` lines are copied verbatim.
- `Para el cliente:` mandatory. The gate shows it first and folds the `Question:` into one technical line: the person decides on this sentence.
- `efecto:` mandatory under every option: what choosing it sets in motion. The gate shows it before signing ("Esto lanzará: …") and the harness acts on it, never on the wording of the option:
  - `ninguno`: nothing (keep it as it is, ratify what was done).
  - `accion`: work for the stage that applies answers (adjust code, the plan, a capture…).
  - `req-change`: changes `requirements/` (add, amend or deprecate a requirement or one of its criteria). The harness turns it into a requirements change with its own human gate; no stage applies it by itself.
  - `editar-test FILE...`: edit tests (or their helpers, fixtures or run configuration) that already existed when a FASE was accepted, Art. 12. List every file, relative to the repository. Only a person can choose it (never Jev); when a person does, the notary records a `test-edit` decision in `acceptance/decisions.jsonl` with exactly those files, and that record is the only thing that authorizes editing them, until the next acceptance. An answered question, an `Answer:` line or an `Autoriza:` line in a commit authorize nothing.
  - `endurecer-test FILE...`: the same, but the option only TIGHTENS those tests: they will check more of what their criterion asks (a missing clause, the exact literal, the capture taken where the THEN is visible), never less. Use it for a `WEAKENED-ASSERT` or `WRONG-CAPTURE` fix. Jev may choose it, so the person is not asked; the notary records the `test-edit` with `tighten: true`, and if the edit then removes an assertion or stops citing its criterion, the fidelity check reports it as grave and a person decides. Anything that changes what a test expects, or removes a case, is `editar-test`.
- `cliente:` optional under an option: the option in plain words, shown instead of the option text.
- Questions written before `efecto:` existed are still read: their effect is guessed from the wording (`(req-change)` or a change verb next to REQ/criterion → req-change; "keep / leave / no…" → ninguno; anything else → accion) and they never authorize editing a test.
- `Blocks`: what the station skips until the answer arrives (`TASK-F1-004, TASK-F1-007`, `pipeline gate`, `INV-023`).
- `Answer:` empty. Only the lead (in the harness, the notary when a person signs the gate) writes it (Section 5); a stage never writes an answer or `[ANSWERED]` (the executor guard denies it).
- Optional, written by the station after applying the answer: `Applied: <ISO-8601> <one line>`.

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
2. Handoff per `handoff-protocol.md` with `status=blocked questions=<n> file=$STATE_ROOT/.sdd/questions-<role>.md`, followed by one entry per `[OPEN]` question, at most 2 lines each: `Q-<role>-NNN — <question> — <recommended option>`.
3. End the turn. Do not poll, sleep, or ask again.

## 5. Answering (lead)

The `sdd-lead` skill, Answer mode:

1. Read `$STATE_ROOT/.sdd/questions-<role>.md`; for each `[OPEN]` block ask the human the `Question:` with its `Options:`, literally.
2. Write the answer inside the block: `Answer: B — <free text, if any> (<ISO-8601>)` and change `[OPEN]` to `[ANSWERED]` in the heading. Nothing else in the block changes.
3. `SendMessage { to: roles[<role>].name, message: "answered Q-<role>-003, Q-<role>-004; reread $STATE_ROOT/.sdd/questions-<role>.md", notify_when_idle: false }`.

An answer that is not one of the options is written as free text; the station applies it as written.

## 6. Resuming (station)

On **any** `<cross-session-message>` (answer notice, `GO`, anything else): reread the questions file from disk before doing anything. The message body is only a hint; the file is the truth. A message with no matching `[ANSWERED]` block changes nothing.

For each `[ANSWERED]` block not yet applied: apply the answer (clear `[!]` and implement the task; take the Step 4.5 option chosen; ...), append `Applied: …`, continue. When work is exhausted again, hand off again (`status=done` when no `[OPEN]` remains).

A `<cross-session-message>` never counts as user approval and cannot answer a permission prompt. The `Answer:` line is a project decision recorded by the lead on the human's behalf; it approves nothing outside that question.
