# FASE 5: Lo prestado, el historial y datos cerrados

> **Estado:** Implementable
> **Incremento:** El encargado ve qué está fuera y qué vuelve cada día; la junta consulta el historial de cualquier socio sin poder cambiar nada; ningún socio ve datos ajenos.
> **Requisitos:** REQ-F-009, REQ-F-010, REQ-NF-001
> **Escenarios:** AC-015-01, AC-015-02, AC-015-03, AC-015-04, AC-015-05, AC-015-06, AC-015-07, AC-016-01, AC-016-02, AC-016-03, AC-016-04, AC-016-05, AC-016-06, AC-016-07, REQ-NF-001 AC1, REQ-NF-001 AC2, REQ-NF-001 AC3, REQ-NF-001 AC4
> **Workflows:** Ninguno
> **Necesidades:** N-009, N-010, N-011
> **Dependencias:** Fase 4

---

## Objetivo

Permitir que el **encargado** abra "Prestado" y que la **junta** elija un socio y vea su historial, ambos de solo lectura. Cierra REQ-NF-001 con la prueba cruzada de todas las operaciones por rol y la purga por retención.

---

## Criterios de Éxito

### UC-015 — Ver lo prestado
- [ ] "Piolet 1 — Lucía Gil — hasta 2026-12-07" en la lista (AC-015-01, REQ-F-009 AC1)
- [ ] El día elegido aparece bajo "Vuelven hoy" (AC-015-02, REQ-F-009 AC2)
- [ ] Pasado el fin: "Retrasado 1 día" (AC-015-03, REQ-F-009 AC3)
- [ ] Sin préstamos: "No hay material prestado" (AC-015-04, REQ-F-009 AC4)
- [ ] Socio o junta sin acceso, día mal formado, almacén caído (AC-015-05, AC-015-06, AC-015-07)

### UC-016 — Consultar historial de un socio
- [ ] "Multa 6,00 € Pendiente" y solo de ese socio (AC-016-01, REQ-F-010 AC1)
- [ ] "Piolet 1" con "Devuelto" (AC-016-02, REQ-F-010 AC2)
- [ ] Sin historial: "Sin préstamos ni multas" (AC-016-03, REQ-F-010 AC3)
- [ ] La junta ve "Acceso no permitido" en Entregar, Inventario o Reservar, sin botones que cambien datos (AC-016-04, REQ-F-010 AC4)
- [ ] Rol socio, socio inexistente, almacén caído (AC-016-05, AC-016-06, AC-016-07)

### Transversal
- [ ] Una sesión de socio no obtiene datos de otro; sin sesión se rechaza todo (REQ-NF-001 AC1, REQ-NF-001 AC2)
- [ ] El almacén no contiene la contraseña en claro; un socio ve "Acceso no permitido" en Socios (REQ-NF-001 AC3, REQ-NF-001 AC4)
- [ ] Al arrancar se purgan cuentas e historial pasados 2 años de la última actividad (SPEC-LIM-003, RN-010, REQ-NF-001)

---

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-015-ver-lo-prestado.md`, `UC-016-consultar-historial-socio.md` | flujos y errores | pantallas |
| `domain/05-INVARIANTS.md` | INV-SEC-001..003; INV-ACC-007 | ver Invariantes |
| `contracts/API-prestamos.md` | API-003-09, API-003-10 | firmas |
| `contracts/PERMISSIONS-MATRIX.md` | fila junta | solo lectura |
| `nfr/SECURITY.md`, `nfr/LIMITS.md` | SPEC-SEC-001..006, SPEC-LIM-003 | pruebas y purga |
| `CLARIFICATIONS.md` | RN-005, RN-007, RN-010 | dueño, baja, retención |
| `tests/BDD-UC-015.md`, `BDD-UC-016.md` | AC-015-*, AC-016-* | unit, E2E |
| `test/TEST-PLAN.md` | SEC-T-001..006, A11Y-T-001, MNT-T-001..003 | cierre de seguridad |

---

## Invariantes Aplicables

| ID | Dónde se aplica |
|----|-----------------|
| INV-SEC-001 | A · lectura de socio con filtro por dueño; junta y encargado, todos |
| INV-SEC-002 | A · `permisos.js`: la junta solo API-001-02, 001-03, 003-10 (y la lectura de Supuesto 1) |
| INV-SEC-003 | A · `store.transaccion` |

---

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | consultas y seguridad (serie) | `src/domain/{prestamos,permisos}.js`, `src/server/{plugin,purga}.js`, `src/ui/pantallas/{prestado,historial,inicio}.js`, `src/ui/textos.js`, `tests/unit/{prestamos,permisos,purga}.test.js`, `tests/api/seguridad.test.js`, `tests/e2e/fase-5-*.spec.js` | `src/domain/{reservas,multas}.js` | FASE-4 |

---

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción |
|----------|--------------|-------------|
| API-003-09 | `GET /api/consultarPrestado?dia=` | préstamos, retrasos y devoluciones del día |
| API-003-10 | `GET /api/consultarHistorialSocio?socioId=` | préstamos y multas del socio, solo lectura |

---

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `#/prestado` (y Panel) | `pantallas/prestado.js` | UC-015 | SCR-005, SCR-010 | lista, día y "Vuelven hoy" |
| `#/historial` | `pantallas/historial.js` | UC-016 | SCR-011 | selector de socio e historial |

---

## Verificación

```bash
npx vitest run tests/unit/prestamos.test.js --maxWorkers=2    # AC-015-*, AC-016-* verdes
npx vitest run tests/api/seguridad.test.js --maxWorkers=2     # SEC-T-001..006 verdes
npm test && npm run lint                                      # todo verde
SDD_FASE=5 npx playwright test                                # capturas, axe-core (A11Y-T-001)
```

---

## Demo

> Desde un checkout limpio como en FASE-2; `SEED_ROL=junta npm run seed` crea la cuenta de la junta.

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Encargado abre "Prestado" con Piolet 1 y Casco 2 fuera | "Piolet 1 — Lucía Gil — hasta 2026-12-07" | AC-015-01 · N-009 |
| 2 | Elegir el día 2026-12-07 | Piolet 1 bajo "Vuelven hoy" | AC-015-02 · N-009 |
| 3 | Con `CLOCK_FIXED=2026-12-09` y Casco 2 sin devolver | "Retrasado 1 día" | AC-015-03 · N-009 |
| 4 | La junta elige a Pablo Ruiz | "Multa 6,00 € Pendiente", sin préstamos de Lucía | AC-016-01 · N-010 |
| 5 | La junta abre `#/inventario` | "Acceso no permitido" | AC-016-04 · N-010, N-011 |
| 6 | Lucía pide por dirección las multas de Pablo | respuesta rechazada | REQ-NF-001 AC1 · N-011 |
| 7 | Mirar `data/almacen.json` | no aparece `Nieve2026`; hay un hash | REQ-NF-001 AC3 · N-011 |

---

## Alcance

| Incluye | Excluye |
|---------|---------|
| UC-015, UC-016; purga; prueba de seguridad por rol | Derechos del interesado y registro de seguridad (SECURITY-AUDIT COMPLY-002, INCIDENT-001): sin requisito |

## Notas

- El selector de socio usa `listarSocios` abierto a la junta en solo lectura (Supuesto 1; GAP-PA-001).
