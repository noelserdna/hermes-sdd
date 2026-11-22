# FASE 1: Reservar material, ver y cancelar mis reservas

> **Estado:** Implementable
> **Incremento:** El encargado añade material; el socio reserva un tipo para unas fechas si queda una unidad libre todos esos días, ve solo sus reservas y cancela hasta el día antes.
> **Requisitos:** REQ-F-003, REQ-F-004
> **Escenarios:** AC-005-01, AC-005-02, AC-005-03, AC-005-04, AC-005-05, AC-005-06, AC-005-07, AC-005-08, AC-005-09, AC-005-10, AC-005-11, AC-005-12, AC-005-13, AC-005-14, AC-006-01, AC-006-02, AC-006-03, AC-006-04, AC-007-01, AC-007-02, AC-007-03, AC-007-04, AC-007-05, AC-007-06, AC-013-01, AC-013-02, AC-013-03, AC-013-04, AC-013-05, AC-013-06, AC-013-07, AC-013-08
> **Workflows:** Ninguno
> **Necesidades:** N-003, N-004, N-006, N-008
> **Dependencias:** Fase 0

---

## Objetivo

Que el **encargado** añada unidades de piolets, crampones, cascos, cuerdas y tiendas, y que un **socio** reserve un tipo entre dos fechas (máx. 14 días, sin fechas pasadas, sin multas pendientes), vea solo sus reservas y cancele las que empiezan después de hoy. Un solo viaje del socio sobre las mismas pantallas; un bloque en serie. Introduce `aplicarNoRecogidas`, que `listarMisReservas` aplica al leer (RN-004).

---

## Criterios de Éxito

### UC-013 — Añadir material
- [ ] "Crampones: 2 unidades" tras añadir 2 (AC-013-01, REQ-F-008 AC1)
- [ ] Cantidad 0: "La cantidad debe ser al menos 1" (AC-013-03, REQ-F-008 AC6)
- [ ] Socio o junta en Inventario ven "Acceso no permitido" (AC-013-06, REQ-F-008 AC7)
- [ ] Tipo no válido, datos ausentes, tipo sin unidades, almacén caído y envío repetido (AC-013-02, AC-013-04, AC-013-05, AC-013-07, AC-013-08)

### UC-005 — Reservar material
- [ ] Con 3 piolets libres, reservar deja "2 libres" y "Reserva creada: …" (AC-005-01, REQ-F-003 AC1)
- [ ] Sin unidad libre algún día: "No hay unidades libres esas fechas"; días contiguos no solapan (AC-005-04, AC-005-02, REQ-F-003 AC2, REQ-F-003 AC3)
- [ ] Fecha pasada, fechas invertidas y más de 14 días se rechazan con su mensaje (AC-005-05, AC-005-06, AC-005-07, REQ-F-003 AC4, REQ-F-003 AC5, REQ-F-003 AC6)
- [ ] Con multa pendiente no se reserva; sin multas sí (AC-005-08, AC-005-03, REQ-F-003 AC7, REQ-F-003 AC8)
- [ ] Enviar dos veces lo mismo deja una sola reserva (AC-005-14, REQ-F-003 AC9)
- [ ] La última unidad pedida a la vez solo la gana uno (AC-005-12); tipo inválido, datos vacíos, rol, almacén caído (AC-005-09, AC-005-10, AC-005-11, AC-005-13)

### UC-006 — Ver mis reservas
- [ ] Lucía ve su "Piolet" y no el "Casco" de Pablo (AC-006-01, REQ-F-004 AC1, REQ-NF-001)
- [ ] Sin reservas: "No tienes reservas" (AC-006-02, REQ-F-004 AC4); sin sesión y almacén caído (AC-006-03, AC-006-04)

### UC-007 — Cancelar reserva
- [ ] A tiempo: "Reserva cancelada", estado "Cancelada", unidad libre (AC-007-01, REQ-F-004 AC2)
- [ ] El día de inicio: "Solo se puede cancelar hasta el día antes" (AC-007-02, REQ-F-004 AC3)
- [ ] Repetir la cancelación no cambia nada (AC-007-03, REQ-F-004 AC5); ajena, estado no cancelable, almacén caído (AC-007-04, AC-007-05, AC-007-06)

### Transversal
- [ ] Se asigna la unidad libre de menor número (INV-RES-009, REQ-F-003)
- [ ] Una reserva con `inicio` < hoy se lista "No recogida" y no ocupa unidad (INV-LOA-002, RN-004, REQ-F-004)
- [ ] Otra sesión con otra cuenta ve las unidades libres que dejó la primera reserva (REQ-C-003)

---

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-005`, `UC-006`, `UC-007`, `UC-013` | flujos, extensiones, errores | pantallas y reglas |
| `adr/ADR-002`, `adr/ADR-005` | §Decision | días completos, concurrencia |
| `domain/02-ENTITIES.md` | ENT-002, ENT-003 | unidad, reserva |
| `domain/03-VALUE-OBJECTS.md` | VO-001, VO-004, VO-006, VO-009 | fecha, tipo, estado, cantidad |
| `domain/04-STATES.md` | SM-001, SM-003 | reserva, unidad |
| `domain/05-INVARIANTS.md` | INV-RES-001..009; INV-STK-001, 002; INV-LOA-002; INV-SEC-001 | ver Invariantes |
| `contracts/API-reservas.md` | API-002-01..04 | firmas |
| `contracts/API-inventario.md` | API-004-01, API-004-02 | firmas |
| `contracts/API-prestamos.md` | API-003-03 | `aplicarNoRecogidas` |
| `CLARIFICATIONS.md` | RN-001, RN-004, RN-005, RN-011, RN-016 | asignación, no recogida, dueño, replay |
| `tests/BDD-UC-005/006/007/013.md`, `PROPERTY-TESTS.md` | AC-*, PROP-001..003, 006, 009 | unit, integración |
| `test/TEST-PLAN.md` | D-T-008, D-T-009, INT-T-001, SEC-T-001, GAP-003 | replay, carrera, lectura cruzada |

---

## Invariantes Aplicables

> Acumulativas: hereda las de FASE-0.

| ID | Dónde se aplica |
|----|-----------------|
| INV-RES-001, 009 | A · `reservarMaterial` dentro de la transacción |
| INV-RES-002, 003, 004 | A · `validacion.js`, `reservarMaterial` |
| INV-RES-005, 008 | A · `reservarMaterial` (multa pendiente, replay) |
| INV-RES-006, 007 | A · `cancelarReserva` |
| INV-LOA-002 | A · `aplicarNoRecogidas` al inicio de cada lectura o escritura de reservas |
| INV-SEC-001 | A · `listarMisReservas` filtra por dueño |
| INV-STK-001, 002 | A · `anadirMaterial` |

---

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | reservas e inventario (serie) | `src/domain/{reservas,inventario,prestamos}.js`, `src/domain/permisos.js`, `src/server/plugin.js`, `src/ui/pantallas/{reservar,inventario,mis-reservas,inicio}.js`, `src/ui/textos.js`, `tests/unit/{reservas,inventario,prestamos}.test.js`, `tests/api/**`, `tests/e2e/fase-1-*.spec.js` | `src/domain/cuentas.js` | FASE-0 |

---

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción |
|----------|--------------|-------------|
| API-002-01 | `GET /api/consultarDisponibilidad` | unidades libres en el rango |
| API-002-02 | `POST /api/reservarMaterial` | crea la reserva Reservada |
| API-002-03 | `GET /api/listarMisReservas` | solo las del socio; aplica No recogida |
| API-002-04 | `POST /api/cancelarReserva` | Cancelada si `inicio` > hoy; idempotente |
| API-003-03 | `aplicarNoRecogidas(tx, hoy)` (interna, sin ruta; solo el sistema, D-PA-003) | Reservada con `inicio` < hoy → No recogida |
| API-004-01 | `GET /api/listarInventario` | recuento por tipo y De baja |
| API-004-02 | `POST /api/anadirMaterial` | crea unidades en Alta |

---

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `#/inicio` (socio) y `#/reservar` | `pantallas/reservar.js` | UC-005 | SCR-002 | material disponible y formulario |
| `#/reservas` | `pantallas/mis-reservas.js` | UC-006, UC-007 | SCR-003 | completa la ruta mínima de FASE-0: lista y "Cancelar reserva" con confirmación en línea |
| `#/inventario` | `pantallas/inventario.js` | UC-013 | SCR-009 | recuento y alta (sin baja aún) |

| Componente | Usado en | Descripción |
|------------|----------|-------------|
| `formulario-fechas` | reservar | inicio y fin (VO-001) con error junto al campo |
| `confirmar-en-linea` | mis-reservas (luego bajas, multas) | Sí/No, foco al primero |

---

## Verificación

```bash
npx vitest run tests/unit/reservas.test.js --maxWorkers=2   # AC-005-*, AC-006-*, AC-007-*, PROP verdes
npx vitest run tests/unit/inventario.test.js --maxWorkers=2 # AC-013-* verdes
npx vitest run tests/api --maxWorkers=2                     # carrera AC-005-12; SEC-T-001
SDD_FASE=1 npx playwright test                              # reservar y cancelar con capturas
```

---

## Demo

> Desde un checkout limpio: `npm ci` · `npm run seed` · `CLOCK_FIXED=2026-11-21 npx vite --host 127.0.0.1 --port 5173`; el encargado crea a Lucía (`lucia@club.test`) y a Pablo como en FASE-0.

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Encargado: Inventario, añadir 3 Piolet y 1 Tienda; luego cantidad 0 | "Piolet: 3 unidades"; "La cantidad debe ser al menos 1" | AC-013-01, AC-013-03 · N-008 |
| 2 | Lucía: reservar Piolet 2026-12-05 a 2026-12-07 | "Reserva creada: Piolet, 2026-12-05 a 2026-12-07" y "2 libres" | AC-005-01 · N-003 |
| 3 | Pablo: Tienda 12-06 a 12-08, luego Tienda 12-07 a 12-09 | la segunda: "No hay unidades libres esas fechas" | AC-005-04 · N-003 |
| 4 | Lucía: fecha pasada; fin antes que inicio; 15 días | los tres mensajes de rechazo | AC-005-05, AC-005-06, AC-005-07 · N-003 |
| 5 | Lucía: enviar el mismo formulario otra vez | una sola reserva | AC-005-14 · N-003 |
| 6 | Lucía abre "Mis reservas" | su "Piolet" y no la Tienda de Pablo | AC-006-01 · N-004 |
| 7 | Lucía cancela su Piolet; repite | "Reserva cancelada", sigue "Cancelada"; "3 libres" | AC-007-01, AC-007-03 · N-004 |
| 8 | Con `CLOCK_FIXED=2026-12-06`, Pablo cancela la que empieza hoy | "Solo se puede cancelar hasta el día antes" | AC-007-02 · N-004 |
| 9 | Socio sin reservas abre "Mis reservas" | "No tienes reservas" | AC-006-02 · N-004 |

---

## Alcance

| Incluye | Excluye |
|---------|---------|
| UC-005, UC-006, UC-007, UC-013; listado de inventario; `aplicarNoRecogidas` | Entrega y devolución → FASE-2; la multa que bloquea nace en FASE-2 (aquí se prueba con una multa sembrada); baja de unidades → FASE-4; pantalla del encargado con No recogida → FASE-2 |

## Notas

- Cuatro UC (límite orientativo 3): UC-013 es un alta sencilla que el socio necesita para reservar y UC-006/007 comparten pantallas con UC-005; separarlos costaría una ronda de aceptación más.
- UC-005 tiene 14 escenarios; R5 gana a R3 para cerrar REQ-F-003 y REQ-F-004 en esta FASE.
- Datos de prueba por semilla del almacén en tests, no por la interfaz (TEST-PLAN R-5).
