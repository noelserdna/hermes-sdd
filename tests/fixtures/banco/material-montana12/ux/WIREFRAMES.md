# Wireframes

> Generado por sdd-ux-designer v1.0.0 · Fecha: 2026-11-22 · Basado en: spec/use-cases/ (UC-001…UC-018; UC-019 es automático y no tiene pantalla)
> Componentes y tokens: [UI-DESIGN-SYSTEM.md](UI-DESIGN-SYSTEM.md)

## Historial

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0.0 | 2026-11-22 | Wireframes iniciales |

Convenciones: las del método (`[Botón]`, `[______]` campo, `[v ]` desplegable, `(o)`). Los textos entre comillas son los literales de los requisitos; `{…}` son datos. Todos los mensajes de resultado salen en `org-toast-region` (zona viva en el flujo, justo bajo el título, que permanece hasta la siguiente acción).

## Índice de pantallas

| ID | Pantalla | Casos de uso | Rol | Prioridad | Anchos |
|---|---|---|---|---|---|
| SCR-001 | Entrar | UC-001 | todos | ALTA | escritorio, móvil |
| SCR-002 | Cambiar contraseña | UC-004 | socio nuevo / restablecido | ALTA | ambos |
| SCR-003 | Mis reservas | UC-008, UC-009, UC-002 | socio | ALTA | ambos |
| SCR-004 | Reservar | UC-007 | socio | ALTA | ambos |
| SCR-005 | Mis multas | UC-012 | socio | MEDIA | ambos |
| SCR-006 | Panel del encargado | UC-017, UC-010, UC-011 | encargado | ALTA | ambos |
| SCR-007 | Socios | UC-003, UC-005, UC-006 | encargado | ALTA | ambos |
| SCR-008 | Material | UC-015, UC-016 | encargado | ALTA | ambos |
| SCR-009 | Multas | UC-014, UC-013 | encargado | ALTA | ambos |
| SCR-010 | Historial del socio | UC-018 | junta | MEDIA | ambos |
| SCR-011 | Sin permiso | UC-017 E1/E2, REQ-NF-001 | todos | MEDIA | ambos |

«Salir» (UC-002) vive en `org-header` de todas las pantallas privadas.

Estructura común de pantalla privada (`tmpl-privada`), escritorio:

```
+--------------------------------------------------------------------+
| Material Montaña   Hola, {nombre}      [Mis reservas] [Reservar] ... [Salir] |  <- banner + nav
+--------------------------------------------------------------------+
| <h1>Título de la página</h1>                                       |
| [ zona de mensajes: role=status / alert ]                          |
| contenido                                                          |
+--------------------------------------------------------------------+
```

---

## SCR-001: Entrar

### Propósito
Identificarse con correo y contraseña (REQ-F-001). Es la pantalla a la que se vuelve al salir, al caducar la sesión (30 min) o al abrir cualquier página privada sin sesión.

### Condiciones de entrada
Visitante sin sesión; «Salir»; sesión caducada; ruta privada sin sesión.

### Escritorio
```
+----------------------------------------------+
| Material Montaña                             |
+----------------------------------------------+
|              Entrar                          |
|  [ Correo o contraseña incorrectos ]  (error)|
|                                              |
|  Correo                                      |
|  [______________________________]            |
|  Contraseña                                  |
|  [______________________________]            |
|                                              |
|  [Entrar]                                    |
+----------------------------------------------+
```

### Móvil
```
+------------------------+
| Material Montaña       |
| Entrar                 |
| [ mensaje de error ]   |
| Correo                 |
| [____________________] |
| Contraseña             |
| [____________________] |
| [        Entrar      ] |
+------------------------+
```

### Descripción
- **Estructura:** tarjeta centrada de ancho máx. 24 rem; sin navegación.
- **Acción principal:** «Entrar». No hay «Registrarse» (las cuentas las crea el encargado) ni «¿Olvidaste tu contraseña?» con envío de correo: texto de ayuda «Si has olvidado tu contraseña, pídele una provisional al encargado.»
- **Mensajes (servidor):** «Correo o contraseña incorrectos» (también cuenta de baja, INV-SOC-008), «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos».
- Tras entrar: socio → SCR-003 «Hola, {nombre}»; encargado → SCR-006; junta → SCR-010; con contraseña provisional → SCR-002.

### Inventario de componentes

| Zona | Componente | Tipo | Variantes |
|---|---|---|---|
| Cabecera | marca | atom | sin nav (`tmpl-publica`) |
| Principal | `mol-field` ×2, `mol-password-field`, `atom-button` primary, `org-toast-region` | mol/atom/org | correo `autocomplete=username`, contraseña `current-password` |

### Elementos interactivos

| Elemento | Disparador | Acción | Feedback |
|---|---|---|---|
| Entrar | enviar (clic o Intro) | el servidor comprueba | éxito: cambia de página con «Hola, {nombre}»; error: mensaje en la zona de mensajes y foco al mensaje; campos conservados, contraseña vaciada |

### Adaptación responsive
< md: tarjeta a ancho completo. 

### Accesibilidad
- **Orden de tabulación:** Correo → Contraseña → Entrar.
- **Landmarks:** `main`; `h1` «Entrar».
- **Foco:** tras error, foco al mensaje (`role="alert"`); el campo no se marca como inválido para no revelar cuál falla.
- **Lector:** el error se anuncia al aparecer. Los campos no usan `required`/`type=email` bloqueantes.

### Specs relacionadas
UC-001, BDD-UC-001, INV-SOC-004, INV-SOC-005.

---

## SCR-002: Cambiar contraseña

### Propósito
Elegir contraseña nueva en el primer acceso o tras un restablecimiento (REQ-F-002, INV-SOC-006). Es lo único accesible mientras `mustChangePassword`.

### Condiciones de entrada
Entrar con contraseña provisional; abrir cualquier otra página en ese estado.

### Escritorio
```
+----------------------------------------------+
| Material Montaña                [Salir]      |
+----------------------------------------------+
| Elige una contraseña nueva                   |
| [ La contraseña debe tener al menos 8        |
|   caracteres ]                               |
|                                              |
| Contraseña nueva  (mínimo 8 caracteres)      |
| [______________________________]             |
| [Guardar contraseña]                         |
+----------------------------------------------+
```

### Móvil
Misma disposición a una columna; botón a ancho completo.

### Descripción
- `h1` = «Elige una contraseña nueva» (literal de los AC). Sin navegación a otras páginas; solo «Salir».
- Una sola contraseña nueva (sin campo «repetir»: evita escribirla dos veces, 3.3.7/3.3.8; el campo permite pegar y mostrar la contraseña con un botón opcional `aria-pressed`).
- Error: «La contraseña debe tener al menos 8 caracteres» vía `aria-describedby`, `aria-invalid="true"` en el campo.
- Éxito: se pasa a la página del rol (la definición del mensaje es del servidor).

### Inventario

| Zona | Componente |
|---|---|
| Header | `org-header` reducido (solo «Salir») |
| Principal | `mol-password-field` (`autocomplete=new-password`), `atom-button` primary, `org-toast-region` |

### Accesibilidad
Orden: Contraseña nueva → (Mostrar) → Guardar → Salir. Foco inicial en el campo. Error enfocado como en SCR-001 pero con campo `aria-invalid`.

### Specs relacionadas
UC-004, WF-002, AC-004-01…04.

---

## SCR-003: Mis reservas

### Propósito
Ver las reservas propias y cancelar las que empiezan después de hoy (REQ-F-004).

### Condiciones de entrada
Socio con sesión (tras entrar, «Mis reservas» es su página; «/mis-reservas»); tras reservar con éxito.

### Escritorio
```
+--------------------------------------------------------------------+
| Material Montaña  Hola, Lucía   [Mis reservas][Reservar][Mis multas] [Salir] |
+--------------------------------------------------------------------+
| Mis reservas                                                       |
| [ Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07 ]         |
|                                                                    |
| +----------------------------------------------------------------+ |
| | 2 × Casco del 2026-12-05 al 2026-12-07 — Reservada  [Cancelar] | |
| +----------------------------------------------------------------+ |
| | 1 × Tienda del 2026-12-01 al 2026-12-03 — Devuelta             | |
| +----------------------------------------------------------------+ |
| | 2 × Cuerda del 2026-12-05 al 2026-12-06 — Reservada            | |
| | No se puede cancelar: empieza hoy                              | |
| +----------------------------------------------------------------+ |
|  vacío:  Aún no tienes reservas        [Reservar material]         |
+--------------------------------------------------------------------+
```

### Móvil
```
+------------------------+
| Material Montaña [Menú]|
| Mis reservas           |
| [ mensaje ]            |
| 2 × Casco del          |
| 2026-12-05 al          |
| 2026-12-07 — Reservada |
| [      Cancelar      ] |
| ---------------------- |
| ...                    |
+------------------------+
```

### Descripción
- Lista de solo las reservas del socio (INV-RES-010), con estado en texto + `atom-badge`.
- «Cancelar» solo si hoy < inicio; si empieza hoy, en su lugar el texto «No se puede cancelar: empieza hoy» y **sin** botón. Reservas Prestada, Devuelta, Cancelada y No recogida: sin botón.
- Tras cancelar: «Reserva cancelada» y la fila pasa a «— Cancelada». Repetir: «La reserva ya estaba cancelada».
- Vacío: «Aún no tienes reservas».
- Con multa pendiente, aviso arriba: «No puedes reservar hasta pagar tu multa de {importe} €» con enlace a «Mis multas» (ver SCR-004; no cambia los datos).

### Inventario

| Zona | Componente | Variantes |
|---|---|---|
| Header | `org-header`, `org-nav` (socio) | |
| Principal | `org-list-reservas` con `mol-row-reserva`, `org-toast-region`, estado vacío | acción: danger/secondary «Cancelar» |

### Elementos interactivos

| Elemento | Disparador | Acción | Feedback |
|---|---|---|---|
| Cancelar | clic | cancela y libera unidades | «Reserva cancelada»; foco al mensaje; fila actualizada |
| Cancelar (repetido) | clic | sin cambios | «La reserva ya estaba cancelada» |

### Responsive
< md: filas como tarjetas apiladas; «Cancelar» a ancho completo bajo el texto.

### Accesibilidad
- Orden: nav → «Cancelar» de cada fila en orden de lista. Cada botón se anuncia como «Cancelar» + texto de la fila (`aria-describedby` a la fila).
- Cancelar no pide confirmación (reversible rehaciendo la reserva si hay unidades; el AC no lo contempla); el foco, tras actualizar, va a la zona de mensajes.
- Landmarks: `main`, `nav`, `banner`; lista como `<ul>`.

### Specs relacionadas
UC-008, UC-009, UC-002, BDD-UC-008/009.

---

## SCR-004: Reservar

### Propósito
Reservar un tipo de material, cantidad y fechas (REQ-F-003).

### Escritorio
```
+--------------------------------------------------------------------+
| (header socio)                                                     |
+--------------------------------------------------------------------+
| Reservar                                                           |
| [ No hay unidades libres: solo queda 1 de Tienda el 2026-12-06 ]   |
|                                                                    |
| Material            Cantidad                                       |
| [v Casco        ]   [__1__]  (máximo 5)                            |
| Fecha de inicio     Fecha de fin                                   |
| [2026-12-05____]    [2026-12-07____]  (máximo 14 días)             |
|                                                                    |
| [Reservar]                                                         |
+--------------------------------------------------------------------+
```

### Móvil
Campos apilados en una columna, botón a ancho completo.

### Descripción
- El desplegable «Material» lista solo los tipos con unidades (> 0) (AC-007-10: «Casco» sí, «Cuerda» con 0 no).
- Validación solo del servidor; mensajes literales: «La fecha de inicio no puede ser pasada», «La fecha de fin no puede ser anterior a la de inicio», «Máximo 14 días por reserva», «Máximo 5 unidades por reserva», «No hay unidades libres: solo queda {n} de {material} el {día}», «No puedes reservar hasta pagar tu multa de {importe} €».
- Éxito: se muestra Mis reservas (SCR-003) con «Reserva creada: {cantidad} × {material} del {inicio} al {fin}».
- Con multa pendiente: el formulario sigue visible; al enviar sale el bloqueo. (Decisión: no ocultar el formulario, para que el mensaje sea el literal del requisito y se vea por qué.)
- Los valores del formulario se conservan tras un error. El botón no se deshabilita; mientras se envía queda en estado `loading` y evita el doble envío del mismo formulario.

### Inventario

| Zona | Componente |
|---|---|
| Principal | `org-form-reservar` = `mol-field`(select), `mol-field`(number), 2 × `mol-date-field`, `atom-button` primary; `org-toast-region` |

### Accesibilidad
- Orden: Material → Cantidad → Inicio → Fin → Reservar. Etiquetas visibles; las reglas (máx. 5, máx. 14 días) como ayuda visible enlazada con `aria-describedby`.
- Los campos usan `aria-required="true"` y nunca `required`/`min`/`max` bloqueantes. Errores de campo asociados al campo y resumen en la zona de mensajes; foco al primer campo con error o al mensaje.
- Fechas: campo de fecha nativo con formato ISO indicado en la ayuda; escribir a mano permitido.

### Specs relacionadas
UC-007, BDD-UC-007, WF-001.

---

## SCR-005: Mis multas

### Escritorio
```
+--------------------------------------------------------------------+
| (header socio)                                                     |
+--------------------------------------------------------------------+
| Mis multas                                                         |
|  Multa de 6 € — Pendiente                                          |
|  Multa de 2 € — Pagada                                             |
|  Mientras tengas una multa pendiente no podrás reservar.           |
|  vacío:  No tienes multas                                          |
+--------------------------------------------------------------------+
```

### Descripción
Solo lectura; solo las multas propias (INV-SEC-001). Estado en texto + badge (warn «Pendiente», ok «Pagada»). La nota informativa solo aparece si hay alguna pendiente. Para pagar, la ayuda dice «Se paga al encargado, que la marca como pagada.»
Móvil: filas apiladas. Accesibilidad: lista `<ul>`, sin elementos interactivos aparte de la navegación.

### Specs relacionadas
UC-012, REQ-F-006.

---

## SCR-006: Panel del encargado

### Propósito
Ver qué entregar, qué está prestado, qué vuelve hoy o el día elegido y qué va con retraso; entregar y recibir (REQ-F-008, REQ-F-005).

### Escritorio
```
+--------------------------------------------------------------------+
| Material Montaña Hola, Pablo   [Panel][Socios][Material][Multas] [Salir] |
+--------------------------------------------------------------------+
| Panel del encargado                                                |
| [ Entregado: 2 × Casco a Lucía Gil ]                               |
|                                                                    |
| Fecha  [2026-12-05____] [Ver]                                      |
|                                                                    |
| Por entregar                                                       |
|  Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05 [Entregar] |
|                                                                    |
| Vuelven hoy                       (o «Vuelven el {fecha}»)         |
|  Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07 [Devolver] |
|                                                                    |
| Prestado                                                           |
|  Prestado: 1 × Tienda — Pablo Sanz — vuelve el 2026-12-09 [Devolver] |
|  Prestado: 2 × Cuerda — Marta Ruiz — vuelve el 2026-12-04          |
|     (Retraso: 3 días)                                  [Devolver]  |
|  vacío:  No hay material prestado                                  |
+--------------------------------------------------------------------+
```

### Móvil
```
+------------------------+
| Panel del encargado    |
| Fecha [2026-12-05____] |
|       [     Ver      ] |
| Por entregar           |
| Por entregar: 2 ×      |
| Casco — Lucía Gil —    |
| desde el 2026-12-05    |
| [      Entregar      ] |
| Vuelven hoy ...        |
+------------------------+
```

### Descripción
- Cuatro grupos con `h2`: Por entregar, Vuelven hoy (o «Vuelven el {fecha}» si se elige otra), Prestado, y el retraso se marca en la propia fila como «Retraso: {n} día(s)» (`atom-badge` warn con texto, nunca solo color).
- Los literales de fila son los de los AC. «Entregar» solo en Reservadas con inicio ≤ hoy ≤ fin.
- Mensajes: «Entregado: {cantidad} × {material} a {nombre}», «Ya estaba entregada», «No se puede entregar antes de la fecha de inicio», «Devuelto a tiempo», «Devuelto con {n} día(s) de retraso: multa de {importe} €», «Ya estaba devuelta»; reservas pasadas sin recoger: «No recogida».
- Sin préstamos: «No hay material prestado». La fecha vacía o inválida mantiene la lista de hoy y muestra el mensaje del servidor (RN-032).
- «Devolver» no pide confirmación: crea una multa solo si hay retraso y el mensaje la anuncia; repetirlo no cambia nada.

### Inventario

| Zona | Componente |
|---|---|
| Cabecera | `org-header` + `org-nav` (encargado) |
| Principal | `mol-date-field` + «Ver», `org-list-panel` (`mol-row-prestamo`), `atom-badge` retraso, `org-toast-region` |

### Elementos interactivos

| Elemento | Disparador | Acción | Feedback |
|---|---|---|---|
| Ver | clic | recalcula «vuelven» | título del grupo cambia a «Vuelven el {fecha}» |
| Entregar | clic | registra el préstamo | mensaje; la fila pasa de «Por entregar» a «Prestado» |
| Devolver | clic | cierra préstamo; crea multa si hay retraso | mensaje con importe; la fila desaparece de la lista |

### Responsive
< md: filas apiladas, acciones a ancho completo (44 px).

### Accesibilidad
Orden: nav → Fecha → Ver → acciones en orden de fila. Cada botón: «Entregar» / «Devolver» con `aria-describedby` a su fila. Tras una acción, el foco va al mensaje; si la fila desaparece, no se pierde el foco (va al mensaje). Retraso con texto.

### Specs relacionadas
UC-017, UC-010, UC-011, WF-001, BDD-UC-010/011/017.

---

## SCR-007: Socios

### Propósito
Dar de alta, restablecer contraseña y dar de baja (REQ-F-002).

### Escritorio
```
+--------------------------------------------------------------------+
| (header encargado)                                                 |
+--------------------------------------------------------------------+
| Socios                                                             |
| [ Socio creado: Marta Ruiz ]                                       |
| Alta de socio                                                      |
|  Nombre [__________]  Correo [__________]                          |
|  Contraseña provisional [__________] (mínimo 8 caracteres)         |
|  [Dar de alta]                                                     |
|                                                                    |
| Lista                                                              |
|  Marta Ruiz — Activo       [Restablecer contraseña] [Dar de baja]  |
|  Lucía Gil — Activo        [Restablecer contraseña] [Dar de baja]  |
|  (con «Restablecer»: campo «Contraseña provisional» + [Guardar])   |
+--------------------------------------------------------------------+
```

### Móvil
Formulario a una columna; filas apiladas con las dos acciones una bajo otra.

### Descripción
- Lista de socios con «{nombre} — Activo»; los dados de baja no se listan como activos (el requisito solo fija «Activo»). Un socio dado de baja se muestra como «{nombre} — Baja» sin acciones.
- Mensajes literales: «Socio creado: {nombre}», «Ya existe un socio con ese correo», «La contraseña debe tener al menos 8 caracteres», «Contraseña provisional guardada para {nombre}», «Socio dado de baja: {nombre}», «No se puede dar de baja: tiene material sin devolver», «No se puede dar de baja: tiene multas sin pagar».
- «Restablecer contraseña» abre un campo en la propia fila (en línea, sin modal), foco al campo; Esc lo cierra.
- «Dar de baja» abre `org-confirm` («¿Dar de baja a {nombre}? Se cancelarán sus reservas futuras.» · [Dar de baja] [No]); el botón de confirmación conserva el nombre «Dar de baja».

### Inventario
`org-header`, formulario con 3 `mol-field`, `org-list-socios`, `org-confirm`, `org-toast-region`.

### Accesibilidad
Orden: formulario → lista (por fila: Restablecer, Dar de baja). Los botones de fila llevan el nombre del socio en `aria-describedby`. Foco al cerrar el diálogo vuelve al botón que lo abrió, o al mensaje si la fila cambia. El campo de contraseña provisional es visible (no es secreto del encargado; permite pegar).

### Specs relacionadas
UC-003, UC-005, UC-006, WF-002.

---

## SCR-008: Material

### Escritorio
```
+--------------------------------------------------------------------+
| (header encargado)                                                 |
+--------------------------------------------------------------------+
| Material                                                           |
| [ Cuerda: 6 unidades ]                                             |
| Casco: 6 unidades          Cantidad [__] [Añadir] [Dar de baja]    |
| Cuerda: 6 unidades         Cantidad [__] [Añadir] [Dar de baja]    |
| Tienda: 2 unidades         Cantidad [__] [Añadir] [Dar de baja]    |
|                                                                    |
| Tipo nuevo                                                         |
|  Nombre [__________] Unidades [__] [Añadir tipo]                   |
+--------------------------------------------------------------------+
```

### Móvil
Cada tipo como tarjeta: título «Casco: 6 unidades», campo cantidad y dos botones apilados.

### Descripción
- Filas «{material}: {total} unidades» (también con 0). Añadir a un tipo existente o crear uno nuevo con nombre y unidades; el mensaje tras actuar es la línea actualizada.
- Errores literales: «No se puede dar de baja: hay {n} unidades de {material} necesarias el {día}», «No hay tantas unidades para dar de baja»; cantidad o nombre inválidos: mensaje del servidor.
- «Dar de baja» (unidades rotas) pide confirmación `org-confirm` («¿Dar de baja {n} unidades de {material}?»); repetir el mismo envío no cambia nada (RN-035).
- Un tipo con 0 unidades queda en la lista pero no se ofrece en Reservar.

### Accesibilidad
Cada campo «Cantidad» con etiqueta que incluye el material («Cantidad de Casco», visible o `aria-label` equivalente). Botones nombrados «Añadir» y «Dar de baja» con contexto por `aria-describedby`.

### Specs relacionadas
UC-015, UC-016, BDD-UC-015/016.

---

## SCR-009: Multas

### Escritorio
```
+--------------------------------------------------------------------+
| (header encargado)                                                 |
+--------------------------------------------------------------------+
| Multas                                                             |
| [ Multa pagada ]                                                   |
|  Pablo Sanz — Multa de 6 € — Pendiente            [Marcar pagada]  |
|  Lucía Gil — Multa de 2 € — Pagada                                 |
|  vacío:  No hay multas                                             |
+--------------------------------------------------------------------+
```

### Descripción
Todas las multas con su estado; «Marcar pagada» solo en las pendientes. Mensajes: «Multa pagada», «La multa ya estaba pagada». Sin confirmación (idempotente, ADR-005). Móvil: filas apiladas, botón a ancho completo. (El texto «No hay multas» del estado vacío es mi redacción; el requisito no la fija.)

### Accesibilidad
Botón «Marcar pagada» con `aria-describedby` a su fila; foco al mensaje tras la acción.

### Specs relacionadas
UC-013, UC-014, BDD-UC-013/014.

---

## SCR-010: Historial del socio

### Propósito
La junta busca un socio por nombre o correo y ve sus préstamos y multas, solo lectura (REQ-F-009).

### Escritorio
```
+--------------------------------------------------------------------+
| Material Montaña   Hola, {nombre}             [Historial del socio] [Salir] |
+--------------------------------------------------------------------+
| Historial del socio                                                |
| Buscar por nombre o correo [lucia_________] [Buscar]               |
|                                                                    |
| Lucía Gil (lucia@club.test)                                        |
|  Préstamos                                                         |
|   2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09  |
|  Multas                                                            |
|   Multa de 4 € — Pagada                                            |
|  vacío: Sin préstamos ni multas   |  sin resultado: Ningún socio coincide |
+--------------------------------------------------------------------+
```

### Móvil
Búsqueda en una columna; resultados apilados.

### Descripción
- Sin ningún botón «Entregar», «Devolver», «Marcar pagada» ni «Cancelar» (AC-018-04): ni deshabilitados ni ocultos con CSS; no existen en el DOM.
- Varias coincidencias: lista de socios para elegir (cada nombre es un enlace «{nombre}») y el historial aparece al elegir (AC-018-05).
- Solo se muestran nombre, correo y su historial (INV-SOC-009).

### Inventario
`org-header` + `org-nav` (junta), `mol-search`, `org-historial`, `org-toast-region`.

### Accesibilidad
Búsqueda en `role="search"`; resultados anunciados en la zona viva («{n} socios encontrados» o «Ningún socio coincide»). El resultado único se muestra con `h2` de nombre.

### Specs relacionadas
UC-018, BDD-UC-018.

---

## SCR-011: Sin permiso

### Escritorio
```
+----------------------------------------------+
| (header del rol)                             |
+----------------------------------------------+
| Sin permiso                                  |
| No tienes permiso para ver esta página       |
| [Volver a mi página]                         |
+----------------------------------------------+
```

### Descripción
Se muestra a socio o junta que abre el panel u otra página de gestión (`/panel`: «No tienes permiso para ver esta página», AC de REQ-F-008). No muestra ningún dato de la página pedida. «Volver a mi página» lleva a la página de inicio del rol. Sesión inexistente → SCR-001, no esta pantalla.

### Accesibilidad
`h1` «Sin permiso»; mensaje en el contenido principal (no solo en alerta); foco al `h1` al cargar.

### Specs relacionadas
UC-017 E1/E2, REQ-NF-001, INV-SEC-002/003.
