# Especificaciones — material-montana12

> Desde `requirements/REQUIREMENTS.md` v1.0 (2026-11-22). Decisiones: `CLARIFICATIONS.md`. Prosa en español; ids, código y literales en inglés o tal como los muestra la web.

Web del club de montaña para prestar material (piolets, crampones, cascos, cuerdas, tiendas): los socios reservan por fechas, el encargado entrega, recibe y cobra multas, y la junta consulta.

| Path | Content | Start here if… |
|---|---|---|
| `domain/` | glosario, entidades, objetos de valor + catálogo de errores, estados, invariantes | escribes o revisas cualquier cosa |
| `use-cases/UC-001..019` | un caso de uso por función | implementas una función |
| `workflows/WF-001..002` | ciclo del préstamo; alta y primer acceso | quieres el recorrido y las pantallas |
| `contracts/` | API-cuentas, prestamos, material, multas; EVENTS; PERMISSIONS-MATRIX | implementas una operación |
| `tests/` | BDD-UC-NNN, PROPERTY-TESTS | escribes tests |
| `nfr/` | rendimiento, límites, seguridad, mantenibilidad | miras requisitos no funcionales |
| `adr/` | ADR-001..005 | te preguntas por qué es así |
| `VALUE-REGISTRY.md`, `DERIVED-SPECS.md`, `TRACEABILITY-MATRIX.md` | valores, derivados, trazabilidad | auditas |

Notas para `sdd-spec-auditor`: 9 filas Tier 1 `[PENDING REQ]` en `DERIVED-SPECS.md` son supuestos del arnés, no contradicciones; los ejemplos con «Pablo» mezclan encargado y socio (RN-008).
