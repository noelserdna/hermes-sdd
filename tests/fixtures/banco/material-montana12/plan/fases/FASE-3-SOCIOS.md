# FASE 3: Alta, baja y contraseña de los socios

> **Estado:** Implementable
> **Incremento:** El encargado da de alta a un socio con contraseña provisional, que la cambia al entrar; el encargado restablece contraseñas y da de baja a quien no debe nada
> **Requisitos:** REQ-F-002
> **Escenarios:** AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-004-01, AC-004-02, AC-004-03, AC-004-04, AC-004-05, AC-004-06, AC-005-01, AC-005-02, AC-005-03, AC-005-04, AC-005-05, AC-005-06, AC-006-01, AC-006-02, AC-006-03, AC-006-04, AC-006-05, AC-006-06, AC-006-07
> **Workflows:** WF-002
> **Necesidades:** N-001
> **Dependencias:** Fase 2

---

## Objetivo

Permitir que el **encargado** gestione a los socios (alta, restablecer contraseña, baja lógica) y que el **socio** elija su contraseña en el primer acceso. Un solo bloque (serie).

## Criterios de Éxito

### UC-003 — Dar de alta socio
- [ ] Alta con nombre, correo y contraseña provisional: «Socio creado: {nombre}» (AC-003-01, REQ-F-002)
- [ ] Correo repetido (también de baja) o envío repetido: error sin duplicar; contraseña corta: error (AC-003-02, AC-003-03)
- [ ] Solo el encargado da de alta (AC-003-04)

### UC-004 — Cambiar contraseña provisional
- [ ] Primer acceso: solo se permite cambiar la contraseña; el resto da error (AC-004-01, AC-004-02, INV-SOC-006)
- [ ] Contraseña corta rechazada; cambio correcto lleva a la home del rol (AC-004-03, AC-004-04)
- [ ] Sin sesión se rechaza; repetir no cambia nada (AC-004-05, AC-004-06)

### UC-005 — Restablecer contraseña
- [ ] La provisional se guarda, el socio entra con ella, la antigua deja de valer (AC-005-01, AC-005-02, AC-005-03, INV-SOC-102)
- [ ] Contraseña corta, rol no permitido y repetición controlados (AC-005-04, AC-005-05, AC-005-06)

### UC-006 — Dar de baja socio
- [ ] Baja correcta y la cuenta ya no entra, con el mismo error que credenciales malas (AC-006-01, AC-006-02, INV-SOC-008)
- [ ] La baja cancela sus reservas futuras; se rechaza con material sin devolver o con multa Pendiente (AC-006-03, AC-006-04, AC-006-05)
- [ ] Dar de baja a quien ya está de baja avisa «ya estaba de baja», sin error (AC-006-07, D-PA-002, ADR-005)
- [ ] Solo el encargado da de baja (AC-006-06)

### Transversal
- [ ] Solo nombre, correo, hash con sal, rol e indicadores en el almacén (INV-SOC-009, INV-SOC-003, REQ-F-002 AC1)
- [ ] Un socio no abre `/socios` (E_PAGINA_PROHIBIDA) (REQ-F-002, REQ-NF-001)

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-003`, `UC-004`, `UC-005`, `UC-006` | flujo, excepciones (E4 de UC-006) | cuentas |
| `adr/ADR-003-baja-logica.md`, `ADR-005` | §Decision | baja lógica, replay |
| `domain/02-ENTITIES.md`, `04-STATES.md` | ENT-001, SM-003 | estados de cuenta |
| `domain/05-INVARIANTS.md` | INV-SOC-* | ver Invariantes |
| `contracts/API-cuentas.md` | API-001-03..06 | firmas |
| `workflows/WF-002-alta-primer-acceso.md` | pasos 1 a 3 | recorrido |
| `test/TEST-PLAN.md` | PROP-001..003, 006; GAP-002, 003, 006; D-T-009 | propiedades |
| `test/E2E-SCENARIOS.md` | E2E-WF-002-01, E2E-ACC-03, -04 | E2E |

## Invariantes Aplicables

> Acumulativas: hereda las de FASE-0..FASE-2.

| ID | Dónde se aplica (bloque · función) |
|----|------------------------------------|
| INV-SOC-001, 002, 003 | A · `registerMember`, `changePassword` |
| INV-SOC-006, 102 | A · `authorize`, `resetMemberPassword` |
| INV-SOC-007, 008, 101 | A · `removeMember` |
| INV-SOC-009 | A · modelo de cuenta |

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | cuentas | `src/server/servicios/cuentas.js`, `src/server/http/autorizar.js`, `src/ui/paginas/{socios,cambiar-contrasena}.js`, `tests/**` de cuentas | `src/server/servicios/{prestamos,material}.js` salvo llamar a `cancelReservation` | FASE-2 |

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción (≤ 80 chars) |
|----------|--------------|--------------------------|
| API-001-03 | `changePassword(ctx, {nueva})` | pasa la cuenta a Activa |
| API-001-04 | `registerMember(ctx, {nombre, correo, contrasena})` | alta con `mustChangePassword` |
| API-001-05 | `resetMemberPassword(ctx, {id, contrasena})` | provisional nueva |
| API-001-06 | `removeMember(ctx, {id})` | baja lógica; cancela reservas futuras |

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `/socios` | `socios.js` | UC-003, UC-005, UC-006 | SCR-007 | alta; «Restablecer» y «Dar de baja» por fila |
| `/cambiar-contrasena` | `cambiar-contrasena.js` | UC-004 | SCR-002 | «Contraseña nueva», «Mostrar», «Guardar» |

## Verificación

```bash
npx vitest run tests/integration/socios.test.js --maxWorkers=2  # UC-003..006 verdes
npm test && npm run lint                                        # verdes; el almacén no contiene la contraseña en claro
npx playwright test                                             # E2E-WF-002-01, E2E-ACC-03, -04 verdes
```

## Demo

> Desde un checkout limpio: `npm install` · `node demo/sembrar.mjs fase-3` (Pablo, Lucía con una reserva futura, Marta con un préstamo sin devolver) · `npx vite --host 127.0.0.1 --port 5173`.

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Pablo da de alta a Álvaro con contraseña provisional | «Socio creado: Álvaro» | AC-003-01 · N-001 |
| 2 | Repetir el alta con el mismo correo | error de correo repetido | AC-003-02 · N-001 |
| 3 | Álvaro entra con la provisional | «Elige una contraseña nueva», sin acceso a lo demás | AC-004-01, AC-004-02 · N-001 |
| 4 | Álvaro guarda su contraseña | llega a «Mis reservas» | AC-004-04 · N-001 |
| 5 | Pablo restablece la contraseña de Álvaro | Álvaro debe elegirla otra vez; la antigua no vale | AC-005-01, AC-005-03 · N-001 |
| 6 | Pablo da de baja a Lucía | «Socio dado de baja»; su reserva futura queda cancelada | AC-006-01, AC-006-03 · N-001 |
| 7 | Lucía intenta entrar | «Correo o contraseña incorrectos» | AC-006-02 · N-001 |
| 8 | Pablo da de baja a Marta (material sin devolver) | error de baja con préstamos | AC-006-04 · N-001 |
| 9 | Pablo vuelve a dar de baja a Lucía | aviso «ya estaba de baja» | AC-006-07 · N-001 |

## Alcance

**Incluye:** cuentas de socio y su ciclo; sustituye la siembra de socios de las demos anteriores.
**Excluye:** consulta de historial (FASE-5), depuración de datos personales a los 3 años de la baja (FASE-5).
