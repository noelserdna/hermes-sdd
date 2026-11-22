# Wireframes — material-montana11

## Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-21 | sdd-ux-designer | 12 pantallas para REQ-F-001..010, REQ-NF-001 |

## Conventions

`[ Botón ]` botón · `[____]` campo · `(•)` seleccionado · `▼` desplegable · `{...}` dato · `<...>` aviso. Componentes: ver `UI-DESIGN-SYSTEM.md` §5. Todas las pantallas autenticadas usan `tmpl-app`: `org-header` (nombre, usuario, «Salir»), `org-nav` por rol, `main` con un único `h1`, zona de avisos (`mol-alert`) justo debajo del `h1`. En <768 px la navegación pasa a botón «Menú» y las tablas a tarjetas. Los textos entre comillas son los literales de los criterios.

## Screen Index

| SCR | Pantalla | Rol | UC | REQ |
|---|---|---|---|---|
| SCR-001 | Entrar | anónimo | UC-001, UC-002 | REQ-F-001 |
| SCR-002 | Material disponible (inicio del socio y Reservar) | socio | UC-005 | REQ-F-003 |
| SCR-003 | Mis reservas | socio | UC-006, UC-007 | REQ-F-004 |
| SCR-004 | Mis multas | socio | UC-011 | REQ-F-006 |
| SCR-005 | Panel del encargado | encargado | UC-015 | REQ-F-001, REQ-F-009 |
| SCR-006 | Socios | encargado | UC-003, UC-004 | REQ-F-002 |
| SCR-007 | Préstamos | encargado | UC-008, UC-009, UC-010 | REQ-F-005, REQ-F-006 |
| SCR-008 | Multas | encargado | UC-012 | REQ-F-006, REQ-F-007 |
| SCR-009 | Inventario | encargado | UC-013, UC-014 | REQ-F-008 |
| SCR-010 | Prestado | encargado | UC-015 | REQ-F-009 |
| SCR-011 | Historial de socios / Historial del socio | junta | UC-016 | REQ-F-010, REQ-NF-001 |
| SCR-012 | Acceso no permitido | cualquiera con sesión | UC-002 | REQ-F-002, 005, 007, 008, 010, REQ-NF-001 |

---

## SCR-001: Entrar

### Purpose
Identificarse con correo y contraseña (REQ-F-001). Entrada a toda la web; también destino de sesión caducada, salida y visitantes anónimos.

### Entry Conditions
Sin sesión; sesión caducada («Sesión caducada, vuelve a entrar»); tras «Salir»; dirección protegida sin sesión.

### ASCII Wireframe (Desktop)
```
+--------------------------------------------------+
| Material Montaña 11                              |
+--------------------------------------------------+
|        <Sesión caducada, vuelve a entrar>        |
|        h1: Entrar                                |
|        Correo (obligatorio)                      |
|        [______________________]                  |
|        Contraseña (obligatorio)                  |
|        [______________________]                  |
|        <Correo o contraseña incorrectos>         |
|        [ Entrar ]                                |
+--------------------------------------------------+
```
### ASCII Wireframe (Mobile)
```
+------------------------+
| Material Montaña 11    |
| Entrar                 |
| Correo   [____________]|
| Contraseña [__________]|
| [      Entrar        ] |
+------------------------+
```
### Layout Description
Columna única centrada, ancho máx. 24rem. `tmpl-public`.
### Component Inventory
`org-login-form` (2 × `mol-field`, `atom-button`), `mol-alert`.
### Interactive Elements
Envío con Entrar o Intro. Mensajes exactos: «Correo o contraseña incorrectos» (credenciales erróneas y cuenta en baja, idénticos), «Cuenta bloqueada durante 15 minutos», «Sesión caducada, vuelve a entrar». Tras éxito se muestra el inicio del rol: SCR-002, SCR-005 o SCR-011. El campo contraseña no se vacía de forma que impida pegar.
### Responsive Adaptations
Ancho completo en móvil; campos de 44 px.
### Accessibility Notes
El mensaje de error va en `role="alert"` y se enlaza con los campos por `aria-describedby`; foco al `h1` o al aviso tras error; `autocomplete="username"` y `current-password`; sin CAPTCHA (3.3.8).
### Related Specs
UC-001, UC-002, INV-ACC-004..006, WF-002.

---

## SCR-002: Material disponible (inicio del socio y Reservar)

### Purpose
Ver los tipos de material con las unidades libres para unas fechas y reservar (REQ-F-003).
### Entry Conditions
Rol socio. Si tiene multa pendiente se avisa arriba y el envío se rechaza con el mensaje del servidor.
### ASCII Wireframe (Desktop)
```
+----------------------------------------------------------------+
| Material Montaña 11            lucia@club.test  [ Salir ]      |
| Material disponible | Mis reservas | Mis multas                |
+----------------------------------------------------------------+
| h1: Material disponible                                        |
| <Reserva creada: Piolet, 2026-12-05 a 2026-12-07>              |
| <Tienes una multa pendiente: no puedes reservar hasta pagarla> |
|                                                                |
| Material (obligatorio) [ Piolet        ▼]                      |
| Inicio (obligatorio)   [ 2026-12-05 ]  Fin [ 2026-12-07 ]      |
| [ Reservar ]                                                   |
|                                                                |
| Disponibilidad para esas fechas                                |
| Piolet     2 libres      Crampones  3 libres                   |
| Casco      4 libres      Cuerda     1 libres                   |
| Tienda     0 libres                                            |
+----------------------------------------------------------------+
```
### ASCII Wireframe (Mobile)
```
+------------------------+
| ≡ Menú        [Salir]  |
| Material disponible    |
| <aviso>                |
| Material  [Piolet ▼]   |
| Inicio    [2026-12-05] |
| Fin       [2026-12-07] |
| [      Reservar      ] |
| Piolet        2 libres |
| Casco         4 libres |
+------------------------+
```
### Layout Description
Formulario arriba, lista de disponibilidad debajo (definición de pares tipo/libres).
### Component Inventory
`org-reservation-form` (`atom-select`, `mol-date-range`, `atom-button`), `org-data-list`, `mol-alert`.
### Interactive Elements
Reservar → aviso «Reserva creada: {material}, {inicio} a {fin}» y la disponibilidad se refresca («2 libres»). Errores literales: «No hay unidades libres esas fechas», «No se puede reservar en fechas pasadas», «La fecha de fin no puede ser anterior a la de inicio», «La reserva no puede superar 14 días», «Tienes una multa pendiente: no puedes reservar hasta pagarla». Reenviar el mismo formulario no duplica (RN-011). El botón se desactiva con `aria-disabled` durante el envío para evitar doble clic. Las fechas se pueden teclear (formato AAAA-MM-DD) además de usar el selector nativo.
### Responsive Adaptations
Una columna en móvil; disponibilidad como lista de líneas.
### Accessibility Notes
Disponibilidad en una `dl`; el aviso de éxito es `role="status"`, los errores `role="alert"`; «0 libres» se escribe, no solo se atenúa.
### Related Specs
UC-005, INV-RES-002..005, 008, 009.

---

## SCR-003: Mis reservas

### Purpose
Listar solo las reservas propias y cancelar las futuras (REQ-F-004).
### Entry Conditions
Rol socio.
### ASCII Wireframe (Desktop)
```
| h1: Mis reservas                                        |
| <Reserva cancelada>                                     |
| Material | Inicio     | Fin        | Estado    | Acción  |
| Piolet   | 2026-12-05 | 2026-12-07 | Reservada | [Cancelar Piolet 2026-12-05] |
| Casco    | 2026-11-02 | 2026-11-04 | Devuelto  |         |
| (vacío:) No tienes reservas                             |
```
### ASCII Wireframe (Mobile)
```
+------------------------+
| Piolet                 |
| 2026-12-05 a 2026-12-07|
| Estado: Reservada      |
| [ Cancelar ]           |
+------------------------+
```
### Layout Description
Tabla (≥768 px) o tarjetas; las más recientes primero.
### Component Inventory
`org-data-list`, `mol-list-row`, `atom-badge`, `mol-confirm`, `mol-alert`.
### Interactive Elements
«Cancelar» solo aparece en reservas Reservadas; confirmación en línea («¿Cancelar la reserva de Piolet?» [Sí, cancelar] [No]). Resultado «Reserva cancelada» y estado «Cancelada». Si ya es el día de inicio: «Solo se puede cancelar hasta el día antes». Sin reservas: «No tienes reservas».
### Responsive Adaptations
Tabla → tarjetas.
### Accessibility Notes
Nombre accesible del botón incluye material y fecha («Cancelar Piolet 2026-12-05») para distinguir filas; al confirmar, el foco vuelve al aviso; tabla con `th scope`.
### Related Specs
UC-006, UC-007, INV-RES-006, 007.

---

## SCR-004: Mis multas

### Purpose
El socio ve sus multas y entiende por qué no puede reservar (REQ-F-006).
### Entry Conditions
Rol socio.
### ASCII Wireframe (Desktop)
```
| h1: Mis multas                                       |
| Material | Devuelto   | Importe | Estado    |        |
| Casco    | 2026-12-10 | 6,00 €  | Pendiente |        |
| (sin multas:) Sin multas                             |
| Pendiente: no puedes reservar hasta pagarla. Habla con el encargado. |
```
### ASCII Wireframe (Mobile)
Tarjetas: Casco · 6,00 € · Pendiente.
### Layout Description
Lista de solo lectura; el socio no marca el pago (lo anota el encargado).
### Component Inventory
`org-data-list`, `atom-badge`.
### Interactive Elements
Ninguna acción. Importes con coma decimal y «€».
### Responsive Adaptations
Tabla → tarjetas.
### Accessibility Notes
Estado en texto («Pendiente»/«Pagada») además del color.
### Related Specs
UC-011, INV-FIN-002..004.

---

## SCR-005: Panel del encargado

### Purpose
Inicio del encargado: resumen del día y accesos (REQ-F-001 «Panel del encargado», REQ-F-009).
### Entry Conditions
Rol encargado.
### ASCII Wireframe (Desktop)
```
| Panel | Préstamos | Prestado | Multas | Inventario | Socios | Salir |
| h1: Panel del encargado                                           |
| Vuelven hoy: {n}     Retrasados: {n}     Multas pendientes: {n}   |
| [ Ir a Préstamos ] [ Ir a Prestado ]                              |
```
### ASCII Wireframe (Mobile)
Tres bloques apilados con cifra y enlace.
### Layout Description
Tres tarjetas de resumen + accesos.
### Component Inventory
`tmpl-app`, `mol-list-row` (resumen), `atom-link`.
### Interactive Elements
Enlaces a las pantallas de trabajo.
### Responsive Adaptations
3 columnas → 1.
### Accessibility Notes
Cifras con su etiqueta en el mismo texto, no solo visual.
### Related Specs
UC-015, UC-001.

---

## SCR-006: Socios

### Purpose
Alta, restablecer contraseña y baja de socios (REQ-F-002).
### Entry Conditions
Rol encargado.
### ASCII Wireframe (Desktop)
```
| h1: Socios                                                        |
| <Contraseña restablecida> / <Ya existe un socio con ese correo>   |
| Nuevo socio:  Nombre [____]  Correo [____]  Contraseña [____]     |
|               [ Crear socio ]                                     |
| Nombre       | Correo           | Estado | Acciones              |
| Lucía Gil    | lucia@club.test  | Activo | [Restablecer contraseña] [Dar de baja] |
| Pablo Ruiz   | pablo@club.test  | Baja   | (sin acciones)        |
```
### ASCII Wireframe (Mobile)
Formulario a una columna; cada socio es una tarjeta con sus botones apilados.
### Layout Description
Formulario de alta arriba, lista debajo.
### Component Inventory
`org-member-form`, `org-data-list`, `mol-confirm`, `atom-badge`.
### Interactive Elements
Restablecer abre un campo «Nueva contraseña» en línea. Dar de baja pide confirmación. Mensajes: «La contraseña debe tener al menos 8 caracteres», «Ya existe un socio con ese correo», «No se puede dar de baja: tiene material sin devolver», «Contraseña restablecida». Estado «Baja» visible. La contraseña se escribe oculta con opción «Mostrar contraseña».
### Responsive Adaptations
Tabla → tarjetas.
### Accessibility Notes
Botones con nombre completo («Dar de baja a Pablo Ruiz»); error enlazado al campo.
### Related Specs
UC-003, UC-004, INV-ACC-002, 006, 008, 009, INV-LOA-004.

---

## SCR-007: Préstamos

### Purpose
Entregar lo reservado y registrar devoluciones (REQ-F-005, REQ-F-006).
### Entry Conditions
Rol encargado.
### ASCII Wireframe (Desktop)
```
| h1: Préstamos                                                       |
| <No se puede entregar antes de la fecha de inicio>                  |
| Material | Socio      | Inicio     | Fin        | Estado    | Acción |
| Piolet 1 | Lucía Gil  | 2026-12-05 | 2026-12-07 | Reservada | [Entregar Piolet 1] |
| Casco 2  | Pablo Ruiz | 2026-12-04 | 2026-12-07 | Entregado | [Devolver Casco 2]  |
| Cuerda 1 | Ana Mir    | 2026-12-05 | 2026-12-06 | No recogida |           |
```
### ASCII Wireframe (Mobile)
Tarjetas con estado y un único botón de acción grande.
### Layout Description
Una lista con todas las reservas operables, filtro por estado (`atom-select`: Todas, Reservada, Entregado…).
### Component Inventory
`org-data-list`, `mol-list-row`, `atom-badge`, `mol-alert`.
### Interactive Elements
Solo la acción válida para el estado aparece activa. Resultado: estados «Entregado», «Devuelto», «No recogida». Al devolver tarde el aviso muestra la multa creada («{importe} €»). Repetir Devolver no cambia nada.
### Responsive Adaptations
Tabla → tarjetas.
### Accessibility Notes
Cambio de estado anunciado por `role="status"`; foco vuelve a la fila actualizada.
### Related Specs
UC-008, UC-009, UC-010, INV-LOA-001..003.

---

## SCR-008: Multas

### Purpose
Revisar multas de todos los socios y marcarlas pagadas (REQ-F-006, REQ-F-007).
### Entry Conditions
Rol encargado.
### ASCII Wireframe (Desktop)
```
| h1: Multas                                                  |
| Socio      | Importe | Estado    | Pagada el  | Acción      |
| Pablo Ruiz | 6,00 €  | Pendiente |            | [Marcar pagada: Pablo Ruiz 6,00 €] |
| Ana Mir    | 2,00 €  | Pagada    | 2026-12-09 |             |
| (vacío:) Sin multas                                         |
```
### ASCII Wireframe (Mobile)
Tarjetas por multa.
### Layout Description
Lista con pendientes primero.
### Component Inventory
`org-data-list`, `atom-badge`, `mol-confirm`.
### Interactive Elements
«Marcar pagada» con confirmación en línea; resultado «Pagada» con la fecha. Repetirlo no cambia la fecha.
### Responsive Adaptations
Tabla → tarjetas.
### Accessibility Notes
Mismas pautas que SCR-007.
### Related Specs
UC-012, INV-FIN-003, INV-FIN-004.

---

## SCR-009: Inventario

### Purpose
Añadir material y dar de baja unidades (REQ-F-008).
### Entry Conditions
Rol encargado.
### ASCII Wireframe (Desktop)
```
| h1: Inventario                                                     |
| <1 reserva cancelada por la baja> <No se puede dar de baja: está prestada> |
| Añadir:  Tipo [Crampones ▼]  Cantidad [__]  [ Añadir ]             |
| Casco: 3 unidades                                                  |
|   Casco 1  Libre       [Dar de baja Casco 1]                       |
|   Casco 2  Prestada    [Dar de baja Casco 2]                       |
|   Casco 3  De baja                                                 |
| Crampones: 2 unidades ...                                          |
```
### ASCII Wireframe (Mobile)
Un bloque por tipo con unidades como lista.
### Layout Description
Formulario arriba; un grupo (`section` con `h2`) por tipo (Piolet, Crampones, Casco, Cuerda, Tienda).
### Component Inventory
`org-inventory-form`, `org-data-list`, `atom-badge`, `mol-confirm`.
### Interactive Elements
Mensajes: «{tipo}: {n} unidades», «La cantidad debe ser al menos 1», «No se puede dar de baja: está prestada», «{n} reserva cancelada por la baja». «De baja» sin acción. Dar de baja pide confirmación mencionando las reservas futuras que se cancelarán.
### Responsive Adaptations
Lista simple en todos los anchos.
### Accessibility Notes
Cantidad con `aria-required`, error con `aria-describedby`; sin `min` bloqueante.
### Related Specs
UC-013, UC-014, INV-STK-001.

---

## SCR-010: Prestado

### Purpose
Ver qué material está fuera y qué vuelve cada día (REQ-F-009).
### Entry Conditions
Rol encargado.
### ASCII Wireframe (Desktop)
```
| h1: Prestado                                                   |
| Día [ 2026-12-07 ] [ Ver ]                                     |
| h2: Vuelven hoy                                                |
|   Piolet 1 — Lucía Gil — hasta 2026-12-07                      |
| h2: Prestado ahora                                             |
|   Casco 2 — Pablo Ruiz — hasta 2026-12-08                      |
|   Cuerda 1 — Ana Mir — hasta 2026-12-05  [Retrasado 1 día]     |
| (vacío:) No hay material prestado                              |
```
### ASCII Wireframe (Mobile)
Mismas líneas apiladas; la etiqueta de retraso en su propia línea.
### Layout Description
Selector de día + dos listas; retrasados primero con insignia ámbar con texto.
### Component Inventory
`mol-date-range` (un solo día), `org-data-list`, `atom-badge`.
### Interactive Elements
Cambiar día actualiza «Vuelven hoy» (si el día no es hoy se titula con la fecha, literal «Vuelven hoy» solo para hoy). Solo lectura.
### Responsive Adaptations
Líneas con ajuste de texto, sin truncar.
### Accessibility Notes
Listas `ul`; el retraso se dice «Retrasado 1 día», no solo color.
### Related Specs
UC-015.

---

## SCR-011: Historial de socios / Historial del socio

### Purpose
La junta elige un socio y ve sus préstamos y multas, solo lectura (REQ-F-010).
### Entry Conditions
Rol junta (inicio de la junta).
### ASCII Wireframe (Desktop)
```
| Material Montaña 11     {usuario}   [ Salir ]  |
| Historial de socios                            |
| h1: Historial de socios                        |
| Socio [ Pablo Ruiz ▼ ] [ Ver historial ]       |
| h2: Historial de Pablo Ruiz                    |
| Casco 2 — 2026-12-04 a 2026-12-07 — Devuelto   |
| Multa 6,00 € Pendiente                         |
| (vacío:) Sin préstamos ni multas               |
```
### ASCII Wireframe (Mobile)
Selector y lista apilados.
### Layout Description
Selector arriba, resultado debajo. No hay ningún botón que modifique datos.
### Component Inventory
`atom-select`, `atom-button` (Ver historial), `org-data-list`, `atom-badge`.
### Interactive Elements
Elegir socio y ver. Solo se muestran datos del socio elegido.
### Responsive Adaptations
Una columna.
### Accessibility Notes
El resultado se anuncia con `role="status"` («Historial de Pablo Ruiz cargado»); foco al `h2` del resultado.
### Related Specs
UC-016, INV-SEC-001, INV-SEC-002.

---

## SCR-012: Acceso no permitido

### Purpose
Respuesta uniforme cuando un rol abre una pantalla que no es suya (REQ-F-002/005/007/008/010, REQ-NF-001).
### Entry Conditions
Sesión válida con rol sin permiso para la dirección abierta.
### ASCII Wireframe (Desktop)
```
| cabecera y navegación del rol                |
| h1: Acceso no permitido                      |
| No tienes permiso para ver esta pantalla.    |
| [ Volver al inicio ]                         |
```
### ASCII Wireframe (Mobile)
Igual, una columna.
### Layout Description
Contenido mínimo; no revela datos ni la existencia de registros.
### Component Inventory
`tmpl-app`, `atom-button` (enlace a su inicio).
### Interactive Elements
Volver al inicio del rol.
### Responsive Adaptations
Ninguna.
### Accessibility Notes
El título de la página (`<title>`) también dice «Acceso no permitido»; foco al `h1`.
### Related Specs
INV-ACC-007, PERMISSIONS-MATRIX.
