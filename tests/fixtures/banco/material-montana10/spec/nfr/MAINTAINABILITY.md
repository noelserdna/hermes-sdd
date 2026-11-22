# NFR — Mantenibilidad y restricciones

> Refs: REQ-C-001, REQ-C-002, REQ-C-003.

| ID | Control | Objetivo | Punto de fallo | Comprobación | Refs |
|---|---|---|---|---|---|
| MNT-001 | Textos de la interfaz | todo en español | cadena inglesa de la lista de control | test sobre los textos de la interfaz | REQ-C-001 |
| MNT-002 | Stack | JavaScript (ES modules), Vite y Vitest | otro stack | test que lee `package.json` | REQ-C-002 |
| MNT-003 | Datos compartidos | ningún dato de negocio en `localStorage` ni `sessionStorage` | cualquier uso | test de búsqueda en el código | REQ-C-003, ADR-002 |
