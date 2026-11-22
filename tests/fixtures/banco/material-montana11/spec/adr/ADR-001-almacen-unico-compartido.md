# ADR-001 — Un único almacén compartido por todos los dispositivos

| Campo | Valor |
|---|---|
| Estado | Aceptada · 2026-11-21 |
| Refs | REQ-C-003, REQ-NF-001, REQ-C-001; INV-SEC-001, INV-SEC-003 |

## Contexto
Lo que reserva un socio desde el móvil lo ve el encargado desde el ordenador del club (REQ-C-003). Los datos son personales (REQ-NF-001). El stack es web con Vite (REQ-C-001).

## Decisión
Cuentas, unidades, reservas, multas y sesiones viven en un solo almacén en el servidor; el navegador nunca guarda datos de negocio. Cada operación de los contratos se resuelve contra ese almacén y comprueba rol y dueño allí. El mecanismo concreto se decide en el diseño técnico.

## Alternativas
| Opción | Por qué no |
|---|---|
| Almacenamiento del navegador | cada dispositivo vería datos distintos |
| Servicio externo de terceros | no pedido; añade datos personales fuera del club |

## Consecuencias
- + una sola fuente de verdad y control de acceso centralizado
- − hace falta un servidor y su despliegue (se decide en el diseño técnico)
