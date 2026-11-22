# 02 — Entidades

```typescript
type Fecha = string; // día completo "AAAA-MM-DD" (VO-001)

/** ENT-001 — Cuenta. Estados: SM-004. Invariantes: INV-ACC-001..007. */
interface Cuenta {
  id: number; nombre: string; correo: string /* único, VO-002 */;
  rol: 'socio' | 'encargado' | 'junta';
  hashContrasena: string; /* INV-ACC-003 */
  estado: 'Activa' | 'Baja';
  fallosSeguidos: number; bloqueadaHasta: string | null; // instante
}
/** ENT-002 — Unidad. Estados: SM-003. Invariantes: INV-STK-001..005. */
interface Unidad { id: number; tipo: TipoMaterial; numero: number /* "Casco 2" */; estado: 'Alta' | 'De baja'; }
/** ENT-003 — Reserva (una unidad, un rango). Estados: SM-001. Invariantes: INV-RES-001..007, INV-LOA-001..004. */
interface Reserva {
  id: number; socioId: number; unidadId: number; inicio: Fecha; fin: Fecha;
  estado: 'Reservada' | 'Entregado' | 'Devuelto' | 'Cancelada' | 'No recogida';
  entregadaEl: Fecha | null; devueltaEl: Fecha | null; canceladaEl: Fecha | null;
}
/** ENT-004 — Multa (como mucho una por reserva). Estados: SM-002. Invariantes: INV-FIN-001..004. */
interface Multa {
  id: number; socioId: number; reservaId: number; diasRetraso: number;
  importeEur: number; estado: 'Pendiente' | 'Pagada'; creadaEl: Fecha; pagadaEl: Fecha | null;
}
/** ENT-005 — Sesión. Invariantes: INV-ACC-005. */
interface Sesion { id: string; cuentaId: number; ultimaActividad: string; }
```

Relaciones: ENT-001 tiene 0..n ENT-003 y 0..n ENT-004 (como socio); ENT-002 tiene 0..n ENT-003; ENT-003 tiene 0..1 ENT-004; ENT-001 tiene 0..n ENT-005. Todo el almacén es único y compartido por todos los dispositivos (ADR-001, REQ-C-003).
