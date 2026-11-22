# ADR-004 — Errores de dominio con código y mensaje literal en español

| Campo | Valor |
|---|---|
| Estado | Aceptada · 2026-11-21 |
| Refs | REQ-C-002; VO-010; INV-ACC-007 |

## Contexto
Los criterios fijan los mensajes exactos que ve la persona (REQ-C-002) y los tests los comprueban literalmente.

## Decisión
Cada rechazo es un código `E_*` del catálogo VO-010 con su mensaje literal; los contratos y casos de uso citan el código, nunca el texto ni transporte.

## Alternativas
| Opción | Por qué no |
|---|---|
| Mensajes sueltos en cada pantalla | se contradicen entre sí |

## Consecuencias
- + un solo sitio donde cambiar un texto
- − todo error nuevo exige una fila en el catálogo
