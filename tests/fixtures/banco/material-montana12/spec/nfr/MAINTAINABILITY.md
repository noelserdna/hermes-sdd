# NFR — Maintainability

> Refs: REQ-C-001, REQ-C-002; AGENTS.md.

| ID | Metric / Control | Target | Fail point | Measurement / Enforcement | Refs |
|---|---|---|---|---|---|
| SPEC-MNT-001 | Textos de la interfaz en español | 0 frases en inglés de la lista de control | 1 frase en inglés | Test según la verificación de REQ-C-001: recorre los textos de la interfaz contra la lista de control | REQ-C-001, VO-010 |
| SPEC-MNT-002 | JavaScript con módulos ES | `package.json` declara módulos ES | declaración ausente | Test según la verificación de REQ-C-002 | REQ-C-002 |
| SPEC-MNT-003 | Vite como herramienta de construcción | `package.json` declara Vite | declaración ausente | Test según la verificación de REQ-C-002 | REQ-C-002 |
| SPEC-MNT-004 | Vitest como herramienta de pruebas | `package.json` declara Vitest | declaración ausente | Test según la verificación de REQ-C-002 | REQ-C-002 |
