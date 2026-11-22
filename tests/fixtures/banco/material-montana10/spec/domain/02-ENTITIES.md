# 02 — Entidades

```typescript
/** ENT-001 — Cuenta. Estado: SM-004. Invariantes: INV-ACC-001..009. */
interface Cuenta {
  id: number; nombre: string; correo: string /* único, minúsculas (INV-ACC-001) */;
  hashContrasena: string /* con sal (INV-ACC-003) */; rol: Rol /* VO-001 */;
  estado: 'Activa' | 'Baja'; fallosSeguidos: number; bloqueadaHasta: string | null /* instante */;
}
/** ENT-002 — Sesión. Caduca tras SESSION_IDLE_HOURS sin uso (INV-ACC-005). */
interface Sesion { id: string; cuentaId: number; ultimaActividad: string }
/** ENT-003 — Unidad. Estado: SM-003. Invariantes: INV-STK-001..004. */
interface Unidad { id: number; tipo: TipoMaterial /* VO-004 */; numero: number /* «Piolet 2» */; estado: 'Activa' | 'DeBaja' }
/** ENT-004 — Reserva. Estado: SM-001. Invariantes: INV-RES-001..008, INV-LOA-001..003. */
interface Reserva {
  id: number; socioId: number; tipo: TipoMaterial; desde: string /* AAAA-MM-DD */; hasta: string;
  estado: EstadoReserva /* VO-005 */; unidadId: number | null /* al entregar */;
  devueltaEl: string | null; creadaEl: string;
}
/** ENT-005 — Multa. Estado: SM-002. Invariantes: INV-LOA-004..006. */
interface Multa { id: number; socioId: number; reservaId: number; dias: number; importeEur: number; estado: 'Pendiente' | 'Pagada'; pagadaEl: string | null }
```

Relaciones: Cuenta 1 → 0..n Reserva; Reserva 0..1 → 1 Unidad (al entregar); Reserva 1 → 0..1 Multa; Cuenta 1 → 0..n Sesión; tipo 1 → 0..n Unidad.
