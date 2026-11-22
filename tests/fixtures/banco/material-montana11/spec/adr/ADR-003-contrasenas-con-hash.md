# ADR-003 — Las contraseñas se guardan solo como hash con sal

| Campo | Valor |
|---|---|
| Estado | Aceptada · 2026-11-21 |
| Refs | REQ-NF-001, REQ-F-001, REQ-F-002; INV-ACC-003 |

## Contexto
REQ-NF-001 exige que ninguna contraseña quede legible en el almacén.

## Decisión
Se guarda un hash con sal por contraseña usando un algoritmo lento de contraseñas; el texto en claro no se guarda ni se registra, tampoco en mensajes de error.

## Alternativas
| Opción | Por qué no |
|---|---|
| Cifrado reversible | permitiría recuperar la contraseña |
| Hash rápido sin sal | débil frente a diccionarios |

## Consecuencias
- + una fuga del almacén no revela contraseñas
- − restablecer es la única vía si se olvida (UC-004)
