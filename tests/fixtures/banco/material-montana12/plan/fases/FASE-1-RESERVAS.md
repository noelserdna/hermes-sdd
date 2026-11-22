# FASE 1: Reservar material y gestionar mis reservas

> **Estado:** Implementable
> **Incremento:** Un socio reserva material para unas fechas si hay unidades libres, ve sus reservas y cancela las que aún no han empezado
> **Requisitos:** REQ-F-003, REQ-F-004
> **Escenarios:** AC-007-01, AC-007-02, AC-007-03, AC-007-04, AC-007-05, AC-007-06, AC-007-07, AC-007-08, AC-007-09, AC-007-10, AC-007-11, AC-008-01, AC-008-02, AC-008-03, AC-008-04, AC-008-05, AC-009-01, AC-009-02, AC-009-03, AC-009-04, AC-009-05
> **Necesidades:** N-002, N-003
> **Dependencias:** Fase 0

---

## Objetivo

Permitir que un **socio** reserve, vea y cancele sus reservas con la disponibilidad calculada por día, y comprobar que los datos son compartidos entre dispositivos. Un solo bloque (serie).

## Criterios de Éxito

### UC-007 — Reservar material
- [ ] Reserva válida creada con mensaje «Reserva creada: …»; sin unidades libres algún día, error (AC-007-01, AC-007-02, REQ-F-003)
- [ ] El mismo formulario repetido no duplica la reserva (AC-007-03)
- [ ] Validación en orden: fecha pasada, fin anterior, días máximos, unidades máximas (AC-007-04, AC-007-05, AC-007-06, AC-007-07)
- [ ] Con una multa Pendiente propia no se reserva; la de otro socio no afecta (AC-007-08, AC-007-09, INV-MUL-002)
- [ ] Solo se ofrecen tipos con unidades; solo el socio reserva (AC-007-10, AC-007-11; la lista de tipos nace en FASE-0)

### UC-008 — Ver mis reservas
- [ ] Lista solo las propias con estado derivado; socio nuevo ve «Aún no tienes reservas» (AC-008-01, AC-008-03, AC-008-04)
- [ ] Una reserva que empieza hoy no muestra «Cancelar» (AC-008-02); otro rol: rechazo (AC-008-05)

### UC-009 — Cancelar reserva
- [ ] Cancelar libera unidades; repetir avisa «La reserva ya estaba cancelada» (AC-009-01, AC-009-02, REQ-F-004)
- [ ] No se cancela si empieza hoy o ya empezó; la ajena se rechaza (AC-009-03, AC-009-04, AC-009-05)

### Transversal
- [ ] Reservas en el almacén compartido del servidor, nunca en el navegador (SPEC-PERF-002); medidas de visibilidad y reinicio en FASE-2 (REQ-NF-002)
- [ ] Disponibilidad calculada, nunca contador guardado (ADR-001, ADR-002); textos en español (REQ-C-001)

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-007-reservar-material.md`, `UC-008-mis-reservas.md`, `UC-009-cancelar-reserva.md` | flujo, excepciones, paso 4 de UC-007 | orden de validación |
| `adr/ADR-001`, `ADR-002`, `ADR-005` | §Decision | disponibilidad, estados derivados, replay |
| `domain/02-ENTITIES.md`, `04-STATES.md` | ENT-003, SM-001 | reserva y sus estados |
| `domain/05-INVARIANTS.md` | INV-RES-*, INV-MUL-002 | ver Invariantes |
| `contracts/API-prestamos.md` | API-002-01..03 | firmas |
| `test/TEST-PLAN.md` | D-T-006, D-T-007; PROP-007..010, 012, 014, 015, 018 | orden y replay |
| `test/E2E-SCENARIOS.md` | E2E-WF-001-01, -02 | E2E |

## Invariantes Aplicables

> Acumulativas: hereda las de FASE-0.

| ID | Dónde se aplica (bloque · función) |
|----|------------------------------------|
| INV-RES-001, 002, 003 | A · `prestamos.reserve` |
| INV-RES-004, 005 | A · `dominio/disponibilidad` |
| INV-RES-006, 009, 010 | A · `cancelReservation`, `listMyReservations` |
| INV-MUL-002, INV-MAT-003 | A · `reserve` (sobre multas sembradas) |
| INV-SEC-001 | A · `authorize` + propiedad en el servicio |

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | reservas | `src/server/dominio/{fechas,disponibilidad,estados}.js`, `src/server/servicios/prestamos.js`, rutas de reservas en `src/server/http/rutas.js`, `src/ui/paginas/{reservar,mis-reservas}.js`, `demo/sembrar.mjs`, `tests/**` de reservas | `src/server/servicios/{cuentas,material}.js` salvo lectura | FASE-0 |

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción (≤ 80 chars) |
|----------|--------------|--------------------------|
| API-002-01 | `reserve(ctx, {materialId, cantidad, inicio, fin})` | crea reserva si hay unidades cada día |
| API-002-02 | `listMyReservations(ctx)` | reservas propias con estado |
| API-002-03 | `cancelReservation(ctx, {id})` | cancela si `hoy < inicio`; replay avisa |

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `/reservar` | `reservar.js` | UC-007 | SCR-004 | amplía la página mínima de FASE-0: cantidad, fechas, «Reservar» |
| `/mis-reservas` | `mis-reservas.js` | UC-008, UC-009 | SCR-003 | lista y «Cancelar» por fila |

## Verificación

```bash
npx vitest run tests/integration/prestamos.test.js --maxWorkers=2  # UC-007/008/009 verdes
npx vitest run tests/unit/disponibilidad.test.js --maxWorkers=2    # PROP-010 verde
npm test && npm run lint                                           # verdes
npx playwright test                                                # E2E-WF-001-01, -02 verdes
```

## Demo

> Desde un checkout limpio: `npm install` · `node demo/sembrar.mjs fase-1` (Lucía, Pablo, 3 «Casco», Lucía sin multas, Marta con una multa Pendiente) · `npx vite --host 127.0.0.1 --port 5173`.

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Entrar como Lucía y abrir «Mis reservas» | «Aún no tienes reservas» | AC-008-03 · N-003 |
| 2 | Reservar 2 × Casco mañana, 2 días | «Reserva creada: 2 × Casco…» | AC-007-01 · N-002 |
| 3 | Reservar otros 2 × Casco los mismos días | error: no hay unidades libres | AC-007-02 · N-002 |
| 4 | Reservar con fecha de ayer | error de fecha pasada | AC-007-04 · N-002 |
| 5 | En «Mis reservas» cancelar la reserva | «Reserva cancelada»; vuelve a haber 3 libres | AC-009-01 · N-003 |
| 6 | Pulsar de nuevo «Cancelar» desde una pestaña vieja | aviso «La reserva ya estaba cancelada» | AC-009-02 · N-003 |
| 7 | Entrar como Marta (multa Pendiente) y reservar | error de bloqueo por multa | AC-007-09 · N-002 |
| 8 | Reservar de nuevo como Lucía y reiniciar el servidor | tras entrar, «Mis reservas» la sigue mostrando | AC-008-01 · N-003 |

## Alcance

**Incluye:** reservar, ver, cancelar; estados derivados; reloj inyectable en todo el dominio.
**Excluye:** entregar y devolver (FASE-2), creación de multas (FASE-2); las multas Pendientes de la demo se siembran.
