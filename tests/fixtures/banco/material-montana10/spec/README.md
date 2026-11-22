# Especificaciones — material-montana10

> Desde `requirements/REQUIREMENTS.md` v1.0 (2026-11-21). Decisiones: `CLARIFICATIONS.md`. Prosa en español; ids, código y keywords Gherkin en inglés.

Web para el préstamo de material del club de montaña: socios que reservan, encargado que entrega y cobra multas, junta que consulta. Refs: REQ-F-001..010, REQ-NF-001, REQ-C-001..003.

| Path | Contenido | Empieza aquí si… |
|---|---|---|
| `domain/` | glosario, entidades, objetos de valor y catálogo de errores, estados, invariantes | escribes o revisas cualquier cosa |
| `use-cases/UC-001..010` | un caso de uso por requisito funcional | implementas una función |
| `workflows/` | WF-001 ciclo de un préstamo, WF-002 sesión | quieres ver el recorrido completo |
| `contracts/` | API-acceso, API-reservas, API-prestamos, API-inventario, PERMISSIONS-MATRIX, EVENTS | implementas una operación |
| `tests/` | BDD-UC-001..010 (ids AC-NNN-NN) | escribes tests |
| `nfr/` | SECURITY, LIMITS, MAINTAINABILITY | revisas seguridad, límites o restricciones |
| `adr/` | ADR-001 reloj, ADR-002 almacén compartido | cambias una decisión |
| `VALUE-REGISTRY.md`, `DERIVED-SPECS.md`, `TRACEABILITY-MATRIX.md` | valores, derivados, trazabilidad | buscas un valor o un id |
