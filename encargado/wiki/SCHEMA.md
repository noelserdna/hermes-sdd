# Wiki Schema — proyecto «{{PROYECTO}}»

## Domain
Memoria del encargado del proyecto {{PROYECTO}} (construido con hermes-sdd y el método SDD): el contexto del cliente
y del dominio, las decisiones y su porqué, los riesgos y las lecciones. **No** es la documentación del método: los
requisitos (`requirements/`), las especificaciones (`spec/`), el plan (`plan/`), las tareas (`task/`) y la aceptación
(`acceptance/`) viven en el repo del proyecto y aquí solo se enlazan.

## Conventions
- File names: lowercase, hyphens, no spaces (e.g., `politica-de-prestamos.md`). Pages in Spanish.
- Every wiki page starts with YAML frontmatter (see below).
- Use `[[wikilinks]]` between pages (at least 2 outbound links per page).
- **Enlazar, no copiar**: cite method artifacts by id — `REQ-F-004`, `REQ-F-004 AC2`, `FASE-1`, `INT-002`,
  `DEC-001`, a gate (`puerta g179…`), a commit or tag (`fase-1-accepted`) — never paste their text here.
- When updating a page, bump `updated`. Every new page goes into `index.md`; every action is appended to `log.md`.
- Facts about the project's state (stages, gates, cost) come from `hsdd_proyectos.py estado` and
  `.sdd/hermes/{etapas,puertas}.jsonl`: summarize and link them, do not keep a second copy of the data.

## Frontmatter
```yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | summary
tags: [from taxonomy below]
sources: [raw/…, REQ-…, puerta …, conversación YYYY-MM-DD]
confidence: high | medium | low
contested: true            # optional: unresolved contradiction
contradictions: [slug]     # optional
---
```

## Tag Taxonomy
- Gente y contexto: usuario, cliente, dominio, integración
- Producto: requisito, alcance, ux, arquitectura, datos, seguridad
- Proceso: decisión, riesgo, lección, incidente, puerta, fase
- Meta: comparación, pregunta-abierta

Rule: every tag on a page must appear here. Add a new tag here first, then use it.

## Page Thresholds
- **Create a page** for a decision with consequences, a recurring user or domain concept, a risk, an incident with a
  lesson, or a comparison the person asked for.
- **Add to an existing page** when it is already covered.
- **Don't create a page** for passing remarks or anything that only restates a requirement or the plan.
- **Archive** (`_archive/`) when superseded; never delete.

## Decisions
A decision page records: what was decided, by whom and when, the options considered (the recommended one first), why,
and what it affects (`REQ-…`, `FASE-N`). If it changes the requirements or the plan, it is a *proposal* until the
corresponding gate approves it: say so in the page and link the gate once it exists.
