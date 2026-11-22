# 01 — Glosario

| Término | Definición (≤ 20 palabras) | No usar |
|---|---|---|
| Cuenta | Registro de acceso con correo, contraseña y rol (ENT-001) | perfil, login |
| Socio | Cuenta de rol socio: reserva material y ve solo lo suyo | miembro, cliente |
| Encargado | Cuenta de rol encargado: gestiona cuentas, inventario, entregas, devoluciones y multas | administrador, gestor, almacenero |
| Junta | Cuenta de rol junta: consulta el historial de cualquier socio sin poder cambiar nada | directiva, consejo |
| Tipo de material | Categoría del catálogo: Piolet, Crampones, Casco, Cuerda o Tienda (`MATERIAL_TYPES`) | categoría de material |
| Unidad | Pieza concreta de un tipo, identificada por número ("Casco 2") (ENT-002) | ítem, artículo, ejemplar |
| Baja | Estado final de una unidad ("De baja") o de una cuenta ("Baja") | borrado, eliminación |
| Reserva | Petición de una unidad para un rango de días, con estado (ENT-003, SM-001) | booking, apartado |
| Rango | Días completos de inicio a fin, ambos incluidos | periodo, intervalo |
| Préstamo | Reserva en estado Entregado: la unidad está fuera del almacén | alquiler, cesión |
| Entrega | Acto del encargado que pasa una reserva a Entregado | recogida registrada |
| Devolución | Acto del encargado que pasa un préstamo a Devuelto | retorno |
| Retraso | Días naturales entre la fecha de fin y la de devolución, si esta es posterior | demora |
| Multa | Importe pendiente o pagado por un retraso (ENT-004, SM-002) | sanción, penalización, recargo |
| Multa pendiente | Multa en estado Pendiente; impide reservar | deuda |
| Sesión | Acceso abierto de una cuenta, con caducidad por inactividad (ENT-005) | token de usuario |
| Hoy | Fecha actual del reloj del sistema (ADR-002) | fecha actual del navegador |
| Historial | Préstamos y multas de un socio, en solo lectura | registro de actividad |
