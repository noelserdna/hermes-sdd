# REQUIREMENTS.md — template

`requirements/REQUIREMENTS.md` is parsed by downstream skills and scripts (`sdd-specifications-engineer`, `sdd-jev.mjs`, `sdd lint --needs`), so keep the field labels exactly as below.

```markdown
# Requirements Document

> **Project:** {project name}
> **Version:** {X.Y}
> **Last updated:** {YYYY-MM-DD}
> **Status:** Draft | Review | Approved
> **Customer needs:** [CUSTOMER-NEEDS.md](CUSTOMER-NEEDS.md)
> **Examples reviewed by:** {name (role)}, {YYYY-MM-DD}      ← optional: covers every requirement reviewed in one batch
> **Must list confirmed by:** {name (role)}, {YYYY-MM-DD} — {N of M Must, and why when > 60 %}
> **Approved by:** {name (role)}, {YYYY-MM-DD}               ← written at approval; the tag requirements-v{Version} is the proof

## Functional Requirements

### REQ-F-001: {Title}
- **Statement:** WHEN {trigger} THE {system} SHALL {behavior}
- **Para el cliente:** {one or two plain sentences, e.g. "Puedes apuntar una tarea nueva y la ves al momento en tu lista."}
- **Category:** Functional
- **Priority:** Must have | Should have | Nice to have
- **Needs:** N-001, N-003
- **Verification:** test
- **Source:** {stakeholder or document}
- **Rationale:** {why this requirement exists}
- **Acceptance criteria:**
  - GIVEN {context with concrete data} WHEN {action with concrete input} THEN the user sees {literal text on the screen}
    - Se ve: "{exact text}" en {screen}
  - GIVEN {…} WHEN {another actor, other data} THEN the user sees "{the same message for that actor}"
    - Se ve: "{text with a {variable}}" en {screen}
  - GIVEN {…} WHEN {…} THEN {an effect with no screen of its own}
    - No visible: {why there is nothing to show, e.g. "lo comprueba el fichero descargado"}
- **Examples reviewed by:** {name (role)}, {YYYY-MM-DD}      ← omit when the header line covers it
- **Dependencies:** {REQ-F-NNN, or "None"}

## Nonfunctional Requirements

### REQ-NF-001: {Title}
- **Statement:** THE {system} SHALL {behavior} {quantified constraint}
- **Para el cliente:** {e.g. "La lista aparece en menos de un segundo aunque tengas mil tareas."}
- **Category:** Performance | Security | Scalability | Availability | Usability
- **Priority:** Must have | Should have | Nice to have
- **Needs:** N-00X
- **Verification:** measurement — {metric}, threshold {value}, measured by {tool / test / procedure}
- **Metric:** {measurable target, e.g., "p95 < 200 ms with 1,000 records"}
- **Acceptance criteria:**
  - GIVEN {load condition with numbers} WHEN {action} THEN {measurable outcome}

## Constraints

### REQ-C-001: {Title}
- **Statement:** {constraint description}
- **Para el cliente:** {e.g. "Funciona en el navegador, sin instalar nada."}
- **Type:** Technical | Business | Regulatory
- **Source:** {origin of constraint}
- **Needs:** N-00X | — (team/architecture source)
- **Verification:** test — {what the static check reads, e.g. package.json, import graph} | inspection — {what is reviewed}

## Supuestos

<!-- Lo que el encargo dejaba abierto y se escribió con un valor por defecto en vez de preguntarlo (clase S de
references/modo-arnes.md). Una línea por supuesto, en castellano llano: qué y por qué. La puerta de requisitos los
enseña juntos para que la persona diga si alguno no vale. -->
- {e.g. "Tras 5 contraseñas fallidas la cuenta se bloquea 15 minutos (lo habitual en webs de socios)."}

## Traceability

| REQ ID | Type | Priority | Source | Needs | Verification | Dependencies |
|--------|------|----------|--------|-------|--------------|--------------|
| REQ-F-001 | Functional | Must | {source} | N-001 | test | None |
| REQ-NF-001 | Nonfunctional | Must | {source} | N-004 | measurement | REQ-F-001 |
| REQ-C-001 | Constraint | — | {source} | — | test | — |
| REQ-C-002 | Constraint | — | {source} | — | inspection | — |
```

## Field rules

- **Needs:** customer need IDs from `CUSTOMER-NEEDS.md`. Every REQ-F / REQ-NF cites at least one: a requirement no customer asked for is gold plating and needs a conversation, not a silent keep. A REQ-C imposed by the team or the architecture writes `— (team/architecture source)`. A requirement the customer did not ask for in so many words but that the method proposes so that what they asked for works (an empty state, a duplicate check, a limit) still cites the need it serves and adds `- **Origin:** method`: the requirements gate shows it apart, under «Lo añade el método», so the customer can say it is not wanted. Priority says nothing about origin: a Should the customer asked for has no `Origin` line.
- **Verification:** how acceptance will be proven; the acceptance stage later asks for evidence of exactly this kind, so choose the method the customer would accept as proof.

  | Method | Use for | Evidence later |
  |---|---|---|
  | `test` | behaviour (the default for REQ-F) | an automated test per criterion, named with its scenario ID |
  | `demo` | UI/UX look and flow a test cannot judge | the observed output, shown to the customer |
  | `measurement` | NFR with a threshold — state metric, threshold and how it is measured on the same line | a recorded value compared with the threshold |
  | `test` for a constraint | a constraint code can check: dependency lists, import boundaries, runtime/engine versions, forbidden APIs | a static test per constraint, named `REQ-C-NNN AC1 …` (a constraint has one implicit criterion, AC1) |
  | `inspection` | process, legal and organisational constraints, documentation, or anything no test can observe | a recorded human review |

  **Visual evidence for REQ-F.** Whatever its method, every criterion of a functional requirement is also shown with a screenshot, and every user-facing workflow with a video (one named after the FASE when the FASE names no workflow), stored under `evidencias/FASE-{N}/`; a `demo` record attaches the recording. A criterion that passes its test without an image stays `unshown` and its requirement is not VERIFIED, because the customer accepts what they can see. When a REQ-F has no screen of its own (a scheduled job, a webhook, an email), its criterion names the screen where the effect is seen, as a `the user sees` THEN: `THEN the user sees the invoice "F-2026-014" in the admin list with status "Sent"`. If no such place exists, that is a question for the customer now, not an exemption later. REQ-NF and REQ-C keep test, measurement or inspection only; a project without any interface (pure API or CLI) turns this off with `visual_evidence: off` in the SDD Stack Profile, a person's decision.

  A constraint whose compliance a test can read should say `test`: a static check runs on every commit and never goes stale, while an inspection is a human record that expires whenever the files it names change. Keep `inspection` for what only a person can judge.

- **Acceptance criteria** carry real example data (names, amounts, IDs, exact messages, exit codes), not placeholders: "GIVEN a cart with 2 × 12.50 € WHEN …" instead of "GIVEN a cart with items". Customers can check a concrete example; they cannot check an abstraction. Cover the normal path, the main alternative and at least one error.
- **Replay criterion:** a requirement that writes state (creates, changes, deletes, sends, charges) carries one criterion for the same write run again with the same input, stating what is kept: `GIVEN task 4 "Comprar leche" was just created WHEN the same form is submitted again THEN the list still has one "Comprar leche" (id 4)`, or a second record when that is what the customer wants. A retried or double-clicked write is the outcome nobody asks about and every user meets; when the adaptive route skips the specifications (decided after this gate), the criteria are the whole contract and this is the only place it gets written, and with specifications `sdd-specifications-engineer` derives its `replay` row from it.
- **What is seen (`Se ve:` / `No visible:`), every REQ-F criterion.** Under each criterion, one or more nested lines say what its capture must show, so the test, the screenshot and the acceptance checks compare the same texts instead of guessing them from the prose:
  - `    - Se ve: "Te has apuntado a Iniciación" en Clases` — one or more quoted texts (several on one line, or several lines), then `en` and the screen. Write the exact text the user reads; the place is free text.
  - `    - No visible: lo comprueba el CSV descargado` — when nothing on screen shows the outcome, say so and why. It is a decision the customer sees at the examples review, never a silence: a REQ-F whose outcome is only visible in a file, an email or the database still names, when it can, the screen where its effect shows (a list, a status), with a `Se ve:` line.
  - **Typed texts.** A quoted text is **exact**: the test asserts it on screen verbatim. A text with `{…}` is a **template** (`"Hola, {usuario}"`): only its fixed parts are required, whoever the actor. A quoted value of the GIVEN or the WHEN (`"lucia"`, `"pista 2"`) is **data of the example**: the test uses it to build the situation, but `sdd lint --quotes` does not demand it verbatim when the criterion has a `Se ve:` / `No visible:` line, so a second example with other data proves the same criterion.
  - **A message addressed to the user needs a second example with another actor.** A text in the second person, a greeting or one that agrees with who reads it (`"Ya estás apuntada"`, `"Hola, lucia"`, `"Tu reserva"`) depends on the actor: write a second criterion where another actor with other data sees it (or the template form with two examples). In the club project «Ya estás apuntada» passed for "lucia" and was shown to "pablo" too; `sdd lint --needs` warns `one-actor`.
  - `sdd lint --needs` warns `no-sees` for a REQ-F criterion without either line; the THEN keeps its literal text too (the customer reads the criterion, the checks read the line). Criteria written before this contract keep working: without the line the checks fall back to the quoted texts of the THEN and report the capture as «sin comprobar» when there is none.
- **Visual criteria (`the user sees`):** a criterion whose outcome is something the user looks at starts its THEN with `the user sees` (in Spanish `el usuario ve`) followed by the literal text, label, title or value on the screen: `THEN the user sees the heading "Proyectos personales" and 3 rows`. The marker is decided with the customer, not guessed later from verbs like "shows" or "displays": `sdd-test-planner` turns every marked criterion into an E2E that enters through the user's route and asserts that exact text, so an unmarked visual criterion ends up tested below the screen, where a heading nobody wired still passes.
- **Para el cliente:** what the requirement means for the customer, in one or two plain sentences in their language: what they will be able to do or can count on, with no EARS keywords, ids, technical terms or implementation. The status page shows it on the requirement's card next to its evidence, so a reader who never opens this file still knows what each requirement promises; the customer reviews it with the examples (approval §3), and `sdd lint --needs` warns when it is missing. The label stays in Spanish whatever the document's language, because `sdd status build` reads it.
- **Examples reviewed by:** who on the customer side read the examples and agreed, and when. Per requirement, or once in the header when a whole batch was reviewed together.
- **Deprecated** requirements stay in place with `- **Status:** Deprecated (YYYY-MM-DD) — {reason}` (written by `sdd-req-change`); they are ignored by the coverage checks.
