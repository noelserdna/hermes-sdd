# Guion de la demo — FASE-5

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## UC-015 — Ver lo prestado y lo que vuelve cada día

Flujo principal:
1. Encargado: abre Prestado (API-003-09).
2. System: lista cada préstamo como "{material} — {socio} — hasta {fecha}".
3. System: marca "Retrasado {n} día" en los préstamos con `fin` anterior a Hoy (RN-002, RN-009).
4. Encargado: elige un día.
5. System: muestra bajo "Vuelven hoy" el material cuyo `fin` es el día elegido, y no el resto.

Extensiones:
- 2a. Ningún préstamo → se muestra "No hay material prestado". (AC-015-04)
- 3a. Préstamo con retraso → se muestra "Retrasado {n} día" junto al material. (AC-015-03)
- 5a. Día elegido sin devoluciones → "Vuelven hoy" queda vacío. (AC-015-02)

Criterios:
- AC-015-01: Ver lo prestado y lo que vuelve cada día. En Prestado se ve «{material} — {socio} — hasta {fecha}».
  El criterio pide: the user sees "Piolet 1 — Lucía Gil — hasta 2026-12-07" and "Casco 2 — Pablo Ruiz — hasta 2026-12-08"
- AC-015-02: Ver lo prestado y lo que vuelve cada día. En Prestado se ve «Vuelven hoy».
  El criterio pide: the user sees "Piolet 1" under "Vuelven hoy" and does not see "Casco 2"
- AC-015-03: Ver lo prestado y lo que vuelve cada día. En Prestado se ve «Retrasado {n} día».
  El criterio pide: the user sees "Casco 2" marked "Retrasado 1 día"
- AC-015-04: Ver lo prestado y lo que vuelve cada día. En Prestado se ve «No hay material prestado».
  El criterio pide: the user sees "No hay material prestado"

## UC-016 — Consultar historial de un socio

Flujo principal:
1. Junta: elige un socio (API-003-10).
2. System: comprueba que el socio existe; un socio en Baja conserva su historial (RN-007).
3. System: devuelve solo los préstamos y multas de ese socio (INV-SEC-001).
4. System: muestra "Historial del socio" con cada préstamo y su estado ("Devuelto") y cada multa como "Multa {importe} € {estado}".
5. System: no ofrece ningún botón que cambie datos (INV-SEC-002).

Extensiones:
- 4a. El socio no tiene préstamos ni multas → se muestra "Sin préstamos ni multas". (AC-016-03)

Criterios:
- AC-016-01: La junta consulta el historial de un socio. En Historial del socio se ve «Multa {importe} € {estado}».
  El criterio pide: the user sees "Multa 6,00 € Pendiente" and not the loans of "Lucía Gil"
- AC-016-02: La junta consulta el historial de un socio. En Historial del socio se ve «Devuelto».
  El criterio pide: the user sees "Piolet 1" with "Devuelto"
- AC-016-03: La junta consulta el historial de un socio. En Historial del socio se ve «Sin préstamos ni multas».
  El criterio pide: the user sees "Sin préstamos ni multas"
- AC-016-04: La junta consulta el historial de un socio. En Inventario se ve «Acceso no permitido».
  El criterio pide: the user sees "Acceso no permitido" and the junta screens have no button to change data
