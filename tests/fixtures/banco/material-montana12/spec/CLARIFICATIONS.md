# Clarifications (business rules)

> Decided by: arnés sin persona — opción recomendada por defecto (clase R/S, `references/modo-arnes.md`) · 2026-11-22. Cada RN vale para todo `spec/`. Los supuestos de requisitos (sección «Supuestos») siguen vigentes.

## Format and structure decisions

| # | Question | Decision | Rejected |
|---|---|---|---|
| D-001 | Specification format | modular UC + BDD + contratos + invariantes | SRS monolítico |
| D-002 | Contract style | `operations` en los 4 módulos; rutas fuera de spec salvo las que mandan los REQ | `http` |

## Business rules

| RN | Source | Question | Rule adopted | Rejected | Tier |
|---|---|---|---|---|---|
| RN-001 | REQ-F-001 | Bloqueo de cuenta | `LOGIN_MAX_FAILURES` fallos seguidos → bloqueo `LOGIN_LOCK_MINUTES`; en bloqueo ni la contraseña correcta entra; el acierto reinicia el contador | bloqueo permanente | 2 |
| RN-002 | REQ-F-001 | Caducidad | `SESSION_IDLE_MINUTES` sin actividad; cada petición la renueva | caducidad fija | 2 |
| RN-003 | REQ-F-001 | Salir y «atrás» | Salir invalida la sesión en servidor; las páginas privadas no se reutilizan al volver atrás | solo borrar cookie | 2 |
| RN-004 | REQ-F-002 | Contraseñas | mínimo `PASSWORD_MIN_LENGTH`; la provisional obliga a cambiarla (INV-SOC-006) | — | 2 |
| RN-005 | REQ-F-002 | Cuentas encargado y junta | datos iniciales; la web solo da de alta socios; baja = lógica y el correo no se reutiliza (ADR-003) | borrado físico | 2 |
| RN-006 | REQ-F-002 | Baja con ambos impedimentos | gana `E_BAJA_PRESTAMOS`; sin impedimentos se cancelan las reservas futuras | — | 2 |
| RN-007 | REQ-F-001 | Cuenta de baja o correo desconocido | mismo `E_CREDENCIALES`; un correo desconocido no cuenta para el bloqueo | mensaje distinto | 2 |
| RN-008 | REQ-F-003 | «Pablo» reserva y a la vez es encargado | los ejemplos con Pablo que reserva o debe multas son de un socio «Pablo Sanz»; la cuenta pablo@club.test es el encargado | reabrir REQ | 2 |
| RN-009 | REQ-F-003 | Disponibilidad | libres(día) = totales − suma de Reservada y Prestada que cubren el día; la Prestada vencida ocupa hasta hoy; `E_SIN_UNIDADES` cita el primer día con menos libres que lo pedido y sus libres | contador global | 2 |
| RN-010 | REQ-F-003 | Orden de validación al reservar | multa pendiente → fecha pasada → fin anterior → `MAX_RESERVATION_DAYS` → `MAX_UNITS_PER_RESERVATION` → disponibilidad; solo reserva el socio | — | 2 |
| RN-011 | REQ-F-004 | Cancelar | solo con hoy < inicio; inicio = hoy → `E_EMPIEZA_HOY`; ya iniciada y sin entregar → `E_YA_EMPEZADA` | cancelar el mismo día | 2 |
| RN-012 | todos | Repetir una acción | cancelar, entregar, devolver y pagar repetidos no cambian nada y avisan «ya estaba …» (ADR-005); reservar repetido crea otra reserva si caben | duplicar | 2 |
| RN-013 | REQ-F-005 | Entregar | solo Reservada con inicio ≤ hoy ≤ fin; antes → `E_ANTES_DE_INICIO`; fin pasado = No recogida (ADR-002) | entregar tarde | 2 |
| RN-014 | REQ-F-005 | Multa | retraso = devolución − fin (días naturales); 0 → «Devuelto a tiempo»; > 0 → `FINE_PER_DAY_EUR` × días, creada al devolver (ADR-004); «1 día», «N días» | multa al vencer | 2 |
| RN-015 | REQ-F-008 | Singular y plural | «1 día», «N días» en retraso y multa | — | 3 |
| RN-016 | REQ-F-006 | Bloqueo por multas | mientras haya Pendiente no se reserva; el mensaje cita la más antigua; pagar la última lo levanta | citar la mayor | 2 |
| RN-017 | REQ-F-007 | Inventario | cantidad entera ≥ 1; nombre único sin mayúsculas; retirar solo si cada día ≥ hoy `total − n ≥ ocupadas`, si no `E_BAJA_UNIDADES_NECESARIAS` (n = ocupadas ese día, primer día que falla); n > total → `E_BAJA_UNIDADES_INSUFICIENTES` | — | 2 |
| RN-018 | REQ-F-008 | Panel | Por entregar = Reservada con inicio ≤ hoy ≤ fin; Prestado = Prestada; «Vuelven hoy» / «Vuelven el {fecha}» por fin; retraso = Prestada con fin < hoy | — | 2 |
| RN-019 | REQ-F-009 | Búsqueda de la junta | por nombre o correo, parcial y sin mayúsculas; varios resultados → lista para elegir | solo exacta | 2 |
| RN-020 | REQ-NF-001 | Denegar | abrir página no permitida → `E_PAGINA_PROHIBIDA`; operación o dato ajeno → `E_ACCESO_DENEGADO` sin datos; sin sesión → formulario Entrar | — | 2 |
| RN-021 | REQ-NF-003 | Depuración | se borran reservas/préstamos con fin y multas con creación anteriores a hoy − `RETENTION_YEARS` años; al arrancar y cada día | manual | 2 |
| RN-022 | todos | «Hoy» | fecha del servidor en Europe/Madrid | hora del navegador | 2 |
| RN-023 | REQ-F-001 | Inicio de la junta | «Historial del socio» | página sin nombre | 1 |
| RN-024 | REQ-F-002 | Alta con nombre vacío o correo mal formado | `E_SOCIO_DATOS_INVALIDOS`, sin crear cuenta | aceptarlo | 1 |
| RN-025 | REQ-F-002 | Cambio voluntario de contraseña | no existe; la restablece el encargado (UC-005) | permitirlo | 1 |
| RN-026 | REQ-F-002 | Sesión de un socio dado de baja | se cierra; su siguiente petición muestra Entrar | dejarla caducar | 2 |
| RN-027 | REQ-F-002 | Restablecer o baja repetida de socio inexistente o ya de baja | `E_SOCIO_NO_ENCONTRADO`, sin cambios | éxito mudo | 1 |
| RN-028 | REQ-F-009 | Quién ve el historial | solo la junta; el encargado ve las multas en «Multas» | también el encargado | 2 |
| RN-029 | REQ-F-005 | Cómo ve el encargado una «No recogida» | el Panel la lista con «No recogida» y sin «Entregar» durante `NOT_COLLECTED_VISIBLE_DAYS` días tras su fin | no mostrarla | 1 |
| RN-030 | REQ-F-006 | Quién abre «Mis multas» | solo el socio; los demás `E_PAGINA_PROHIBIDA` | — | 2 |
| RN-031 | REQ-F-006 | «Multas» sin multas | «No hay multas» | lista vacía | 1 |
| RN-032 | REQ-F-008 | Fecha no válida en el Panel | `E_FECHA_INVALIDA`; sigue la lista de hoy | — | 1 |
| RN-033 | REQ-NF-003 | Depurar registros vivos | solo se borran los cerrados (Devuelta, Cancelada, No recogida; multa Pagada) | borrar deudas | 2 |
| RN-034 | REQ-F-003 | Cantidad < 1 o fecha vacía al reservar | `E_CANTIDAD_INVALIDA`, `E_FECHA_INVALIDA` | — | 1 |
| RN-035 | REQ-F-007 | Reenviar un alta de unidades | suma otra vez (segunda alta por diseño) | deduplicar | 2 |

## Supuestos

Los de `requirements/REQUIREMENTS.md` § Supuestos; añadidos aquí: RN-005 (correo no reutilizable), RN-008, RN-011 (mensaje de reserva ya iniciada), RN-016 (multa citada), RN-021 (cuándo se depura), RN-022 (zona horaria).
