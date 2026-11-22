# Revisión de brechas: spec frente a código

Comparados 20 operaciones de contrato, 85 escenarios BDD y los 14 requisitos. No falta nada. Quedan dos hallazgos menores, que decide una persona.

## Resumen
- Operaciones del contrato: 20. Implementadas: 20. Faltan: 0.
- Escenarios BDD: 85. Con prueba que los nombra: 85.
- Requisitos: sin brechas de código. REQ-C-001..003 y REQ-NF-001 no se pueden comprobar leyendo una sola pieza de código; se vigilan en las pruebas y la aceptación.

## Hallazgos

### G-001 — MISMATCH: nombre de ruta de API-001-05 (restablecerContrasena)
- Spec (`design/OPERATION-MAPPING.md`): `POST /api/socios/contrasena`. Código (`src/server/http.js:51`): `POST /api/socios/restablecer`.
- Es un detalle interno que no cambia lo que ve el encargado. El cliente ya decidió dejarlo como está (Q-task-implementer-004).
- Decisión: ACCEPT (decisión del cliente). Queda pendiente solo que el mapa de operaciones refleje el nombre real; eso lo haría la etapa de cierre.

### G-002 — ORPHAN: `GET /api/sesion` (`src/server/sesiones.js:23`)
- Devuelve nombre y rol de la sesión vigente, para que la interfaz sepa qué pantalla mostrar. Ningún contrato ni requisito lo nombra.
- Opciones:
  - PROMOTE: documentarlo en el mapa de operaciones. Riesgo: ninguno, solo trabajo de documentación.
  - REMOVE: quitarlo. Riesgo: la interfaz deja de saber quién ha entrado.
  - ACCEPT: dejarlo como soporte de REQ-F-001.
  - DEFER.
- Decisión: _pendiente_

### Rutas de infraestructura (no son hallazgo)
`GET /api/salud` está documentada en el mapa de operaciones como comprobación posterior al despliegue.

## Decisiones del cliente aplicadas (no se vuelven a discutir)
- Cada reserva es de una unidad (Q-task-implementer-001): no se echa en falta reservar varias a la vez.
- Historial muestra el material y el aviso dice «1 día» (Q-003, Q-002): el código ya lo hace (`src/ui/textos.js:31,38`, `historial.js:20`).
- La baja corta la sesión al instante: el código lo hace en la misma transacción (`src/domain/socios.js:47`).
