# Guion de la demo — FASE-5

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## UC-018 — Consultar historial de un socio

Flujo principal:
1. Junta: escribe nombre o correo en Historial del socio.
2. Sistema: comprueba el rol (API-001-08, INV-SEC-001).
3. Sistema: busca por nombre o correo, parcial y sin mayúsculas (API-001-07, RN-019).
4. Junta: si hay varios resultados, elige uno de la lista.
5. Sistema: muestra préstamos y multas del socio, solo lectura.

Extensiones:
- 4a. varios resultados → se muestra la lista para elegir. (AC-018-05)
- 5a. el socio no tiene préstamos ni multas → se indica. (AC-018-02)

Criterios:
- AC-018-01: Historial de un socio para la junta. En Historial del socio (ejemplo con datos: "Multa de 4 € — Pagada") se ve «{cantidad} × {material} del {inicio} al {fin} — devuelto el {fecha}» y «Multa de {importe} € — {estado}».
  El criterio pide: the user sees "2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09" and "Multa de 4 € — Pagada"
- AC-018-02: Historial de un socio para la junta. En Historial del socio se ve «Sin préstamos ni multas».
  El criterio pide: the user sees "Sin préstamos ni multas"
- AC-018-03: Historial de un socio para la junta. En Historial del socio se ve «Ningún socio coincide».
  El criterio pide: the user sees "Ningún socio coincide"
- AC-018-04: Historial de un socio para la junta. Se ve «Historial del socio», «Entregar», «Devolver», «Marcar pagada» y «Cancelar».
  El criterio pide: there is no "Entregar", "Devolver", "Marcar pagada" or "Cancelar"

## UC-019 — Depurar historial antiguo

Flujo principal:
1. Sistema: se activa al arrancar o al pasar un día (RN-021).
2. System: calcula el límite `hoy − RETENTION_YEARS` años (RN-022).
3. System: borra reservas y préstamos cerrados con `endDate` anterior al límite (INV-RES-011, RN-033).
4. System: borra multas Pagadas con creación anterior al límite (RN-021, RN-033).
5. System: devuelve los recuentos borrados.

Extensiones:
- 3a. `endDate` igual al límite → se conserva (anterior estricto). (AC-019-02)

Criterios:
