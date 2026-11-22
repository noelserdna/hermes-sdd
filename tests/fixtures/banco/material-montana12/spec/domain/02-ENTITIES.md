# 02 — Entities

```typescript
/** ENT-001 — Socio/Cuenta. Lifecycle: SM-003. Invariants: INV-SOC-001..009. Roles: ROLE (VO-004). */
interface Account { id: AccountId; name: string; email: Email; passwordHash: string; role: Role;
  mustChangePassword: boolean; active: boolean; failedLogins: number; lockedUntil: string | null }
/** ENT-002 — Material (tipo). Invariants: INV-MAT-001..004. */
interface ItemType { id: ItemId; name: string /* único, INV-MAT-004 */; totalUnits: number /* ≥ 0, INV-MAT-001 */ }
/** ENT-003 — Reserva; entregada = préstamo. Lifecycle: SM-001. Invariants: INV-RES-001..011. */
interface Reservation { id: ReservationId; accountId: AccountId; itemId: ItemId; quantity: number;
  startDate: Day; endDate: Day; status: ReservationStatus; deliveredOn: Day | null; returnedOn: Day | null }
/** ENT-004 — Multa. Lifecycle: SM-002. Invariants: INV-MUL-001..004. Una por préstamo devuelto con retraso. */
interface Fine { id: FineId; accountId: AccountId; reservationId: ReservationId; lateDays: number;
  amountEur: number; status: FineStatus; createdOn: Day; paidOn: Day | null }
```

Relaciones: ENT-001 1 → 0..n ENT-003; ENT-002 1 → 0..n ENT-003; ENT-003 1 → 0..1 ENT-004; ENT-001 1 → 0..n ENT-004.
Sesión: identidad + rol + última actividad (INV-SOC-005); no es un dato de socio.
