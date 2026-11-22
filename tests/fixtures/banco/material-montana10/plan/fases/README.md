# Fases de Implementación — material-montana10 v1.0

> **Fuente de verdad:** `spec/`. Estos ficheros son índices de navegación; `src/` es derivado.

## Diagrama de Dependencias

```
FASE-0 (entrar + inventario + reservar) --> FASE-1 (mis reservas + entregar)
   --> FASE-2 (devolver + multas + historial) --> FASE-3 (socios + datos personales)
```

## Resumen de Fases

| Fase | Documento | Incremento | Requisitos | Dependencias |
|------|-----------|------------|------------|--------------|
| **0** | [FASE-0-SKELETON.md](FASE-0-SKELETON.md) | Entrar, inventario, reservar y Mis reservas mínima | REQ-F-001, REQ-F-003, REQ-F-008 | — |
| **1** | [FASE-1-ENTREGA.md](FASE-1-ENTREGA.md) | Mis reservas y entregar | REQ-F-004, REQ-F-005, REQ-F-009 | 0 |
| **2** | [FASE-2-DEVOLUCION.md](FASE-2-DEVOLUCION.md) | Devolver, multar, historial | REQ-F-006, REQ-F-007, REQ-F-010 | 1 |
| **3** | [FASE-3-SOCIOS.md](FASE-3-SOCIOS.md) | Socios y datos personales | REQ-F-002, REQ-NF-001 | 2 |

**Requisitos Must sin fase:** ninguno (V9). REQ-C-001/002/003 son criterios transversales de cada fase.

## Cobertura por caso de uso

| UC | FASE | UC | FASE |
|----|------|----|------|
| UC-001 | 0 | UC-006 | 2 |
| UC-002 | 3 | UC-007 | 2 |
| UC-003 | 0 | UC-008 | 0 |
| UC-004 | 1 | UC-009 | 1 |
| UC-005 | 1 | UC-010 | 2 |
