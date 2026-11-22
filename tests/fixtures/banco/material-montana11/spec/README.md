# Especificaciones — material-montana11

> Desde `requirements/REQUIREMENTS.md` v1.0 (2026-11-21). Decisiones: `CLARIFICATIONS.md`. Prosa en español; ids, código y literales de pantalla como en los requisitos.

Web del club de montaña para reservar material (piolets, crampones, cascos, cuerdas, tiendas), entregarlo, devolverlo y multar los retrasos. Roles: socio, encargado, junta.

| Ruta | Contenido | Empieza aquí si… |
|---|---|---|
| `domain/` | glosario, entidades, objetos de valor y catálogo de errores, estados, invariantes | escribes o revisas cualquier cosa |
| `use-cases/UC-001..016` | un caso de uso por función | implementas una función |
| `workflows/WF-001..002` | ciclo del préstamo y sesión, con navegación por pantallas | necesitas el recorrido |
| `contracts/` | `API-acceso`, `API-reservas`, `API-prestamos`, `API-inventario`, permisos, eventos | implementas una operación |
| `tests/` | `BDD-UC-NNN`, `PROPERTY-TESTS` | escribes pruebas |
| `nfr/` | seguridad y límites | tocas seguridad o retención |
| `adr/` | ADR-001..005 | te preguntas por qué |
| `VALUE-REGISTRY.md` · `DERIVED-SPECS.md` · `TRACEABILITY-MATRIX.md` | valores, derivados, trazabilidad | buscas un valor o un REQ |
