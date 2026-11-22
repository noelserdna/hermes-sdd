---
title: Wireframes — material-montana10
version: 1.0
date: 2026-11-21
refs: UC-001..UC-010, RN-015, RN-016
---

# Wireframes

Símbolos: `[ Botón ]` botón, `[____]` campo, `[v]` selector, `( )` opción, `{!}` mensaje de error, `{i}` mensaje de éxito, `===` separador de sección. Componentes: ver `UI-DESIGN-SYSTEM.md` sección 3. Los textos entre llaves son los del catálogo de errores o de los casos de uso.

Pantallas por rol (RN-016) y pantalla inicial (RN-015):

| Pantalla | Id | Socio | Encargado | Junta | UC |
|---|---|---|---|---|---|
| Entrar | SCR-001 | todos (sin sesión) | | | UC-001 |
| Mis reservas | SCR-002 | inicial | | | UC-004 |
| Reservar | SCR-003 | si | | | UC-003 |
| Entregas y devoluciones | SCR-004 | | inicial | solo lectura | UC-005, UC-006, UC-009 |
| Multas | SCR-005 | | si | | UC-007 |
| Socios | SCR-006 | | si | | UC-002 |
| Inventario | SCR-007 | | si | | UC-008 |
| Historial | SCR-008 | | si | inicial | UC-010 |

Una pantalla a la que el rol no tiene acceso no muestra datos: aparece `mol-alert` con el mensaje `E_SIN_PERMISO` del catálogo y un enlace a su pantalla inicial. Sin sesión (`E_NO_AUTENTICADO`, `E_SESION_CADUCADA`) se muestra SCR-001 con el mensaje. `E_ALMACEN_NO_DISPONIBLE` se muestra como `mol-alert` de error en cualquier pantalla y no cambia lo que había.

## SCR-001 Entrar (UC-001)

`tmpl-login`, `page-entrar`.

```
+--------------------------------------+
|  Material Montaña 10                 |
|  ==================================  |
|  <h1> Entrar                         |
|  {!} (mensaje de error, si lo hay)   |
|  Correo                              |
|  [______________________________]    |
|  Contraseña                          |
|  [______________________________]    |
|  [ Entrar ]                          |
+--------------------------------------+
```

- Entrada: sin sesión, o tras Salir o caducidad.
- Un solo mensaje para correo desconocido, contraseña mala o cuenta en Baja (`E_CREDENCIALES_INVALIDAS`); `E_CUENTA_BLOQUEADA` con el suyo. Nunca se dice cuál de los dos campos falla.
- Tras entrar: "Hola, {nombre}" y pantalla inicial del rol. Un doble envío no crea dos sesiones: el botón pasa a `aria-busy` y queda inactivo mientras espera.
- Tab: correo, contraseña, Entrar. Foco inicial en `h1`; tras error, foco al mensaje.
- Móvil: misma columna, ancho completo. Sin mostrar contraseña (SEC-002).

## SCR-002 Mis reservas (UC-004)

`tmpl-app`, `page-mis-reservas`. Rol socio.

```
[Mis reservas] [Reservar]                    [Salir]
=====================================================
<h1> Mis reservas
{i} Reserva creada: Casco del 2026-12-01 al 2026-12-03
{!} Multa pendiente: 4 €
-----------------------------------------------------
Material   Desde       Hasta       Estado
Casco      2026-12-01  2026-12-03  (Reservada) [ Cancelar ]
Piolet     2026-11-10  2026-11-12  (Devuelta)
Cuerda     2026-11-01  2026-11-03  (No recogida)
-----------------------------------------------------
(sin reservas)  No tienes reservas
```

- Solo ve sus reservas y multas (INV-ACC-009). "Multa pendiente: {importe} €" aparece solo si debe alguna.
- "Cancelar" solo en filas Reservada; al pulsarlo la fila pide confirmación ("Cancelar / Mantener", `mol-confirm`). Si el servidor rechaza (`E_CANCELACION_TARDIA`), mensaje y la fila no cambia.
- Móvil: cada reserva es una tarjeta con el estado como `atom-badge` y el botón al pie.

## SCR-003 Reservar (UC-003)

`page-reservar`, `org-reservation-form`. Rol socio.

```
[Mis reservas] [Reservar]                    [Salir]
=====================================================
<h1> Reservar material
{!} (resumen de errores del servidor)
Material      [ Casco          v]   (Piolet, Crampones, Casco, Cuerda, Tienda)
Desde         [ 2026-12-01      ]
Hasta         [ 2026-12-03      ]
[ Reservar ]
```

- Errores del servidor junto al campo y en el resumen: `E_FECHA_PASADA`, `E_FECHAS_INVERTIDAS`, `E_RESERVA_MUY_LARGA` (máx. 14 días), `E_MULTA_PENDIENTE` (con importe), `E_SIN_UNIDADES_LIBRES`. No se bloquea el envío en cliente.
- Al éxito: navega a Mis reservas con la confirmación. Reenviar la misma reserva no duplica la fila.
- Móvil: selector y fechas nativos, ancho completo.

## SCR-004 Entregas y devoluciones (UC-005, UC-006, UC-009)

`page-entregas`, `org-loan-list` x4. Encargado con acciones; junta sin botones (INV-LOA-401).

```
[Entregas y devoluciones] [Multas] [Socios] [Inventario] [Historial] [Salir]
=============================================================================
<h1> Entregas y devoluciones
{i} Crampones-03 · Lucía Pérez · Devuelta
{!} Multa de 4 € para Lucía Pérez (2 días de retraso)

== Entregar hoy
Casco · Lucía Pérez         Unidad [Casco-02 v] [ Entregar ]
(vacío) No hay entregas para hoy

== Vuelve hoy
Piolet-01 · Marta Ruiz · hasta 2026-11-21     [ Devolver ]

== Con retraso
Cuerda-02 · Pau Sala · hasta 2026-11-18 · 3 días de retraso   [ Devolver ]

== Prestado
Piolet-01 · Marta Ruiz · hasta 2026-11-21     [ Devolver ]
(vacío) No hay material prestado
```

- Cuatro secciones con `h2`; orden fijo: entregar hoy, vuelve hoy, con retraso, prestado. El retraso se muestra además con texto y badge, no solo color.
- Entregar: el encargado elige la unidad (RN-020: Activa, del tipo, no prestada); errores del servidor en la fila.
- Devolver: sin confirmación extra (acción frecuente y reversible solo por el servidor); el resultado "{unidad} · {socio} · Devuelta" se anuncia con `role="status"`.
- Junta: mismas secciones sin botones ni selector de unidad. Un socio que abre la URL ve `E_SIN_PERMISO`.
- Una reserva vencida sin recoger no aparece (cuenta como No recogida, AC-009-07).
- Móvil: una tarjeta por línea con el botón a ancho completo.

## SCR-005 Multas (UC-007)

`page-multas`. Encargado.

```
[Entregas y devoluciones] [Multas] ...      [Salir]
=====================================================
<h1> Multas
Socio          Importe   Estado       Pago
Lucía Pérez    4 €       (Pendiente)  [ Marcar como pagada ]
Pau Sala       2 €       (Pagada)     pagada el 2026-11-19
(vacío) No hay multas
{i} Multa de 4 € · Lucía Pérez · Pagada
```

- Marcar como pagada repetido no cambia nada. Si el socio tiene otra Pendiente, sigue bloqueado (lo gestiona el servidor).
- Móvil: tarjetas.

## SCR-006 Socios (UC-002)

`page-socios`, `org-member-form`. Encargado.

```
<h1> Socios
{i} Contraseña restablecida
Nombre        Correo              Estado    Acciones
Lucía Pérez   lucia@club.es       (Activa)  [ Restablecer contraseña ] [ Dar de baja ]
Pau Sala      pau@club.es         (Baja)
== Añadir socio
Nombre      [____________]
Correo      [____________]
Contraseña inicial  [____________]  Mínimo 8 caracteres
[ Añadir socio ]
```

- Errores: `E_CORREO_DUPLICADO`, `E_CONTRASENA_CORTA`, `E_DATOS_SOCIO_INVALIDOS`, `E_BAJA_SOCIO_BLOQUEADA`.
- "Restablecer contraseña" despliega en la fila un campo de contraseña nueva y "Guardar". "Dar de baja" pide confirmación en la fila.
- Nunca se muestra ni devuelve la contraseña ni su hash (REQ-NF-001).
- Móvil: tarjetas; el formulario va debajo de la lista.

## SCR-007 Inventario (UC-008)

`page-inventario`, `org-stock-form`. Encargado.

```
<h1> Inventario
{i} Añadidas 3 unidades de Casco
Casco · 5 unidades
   Casco-01 (Activa)   [ Marcar como rota ]
   Casco-02 (De baja)
Piolet · 2 unidades
== Añadir unidades
Material [ Casco v]   Cantidad [ 1 ]   [ Añadir ]
```

- El recuento por tipo cuenta solo unidades Activas. "Marcar como rota" pide confirmación en la fila y no se ofrece en una unidad prestada (si el servidor la rechaza, mensaje de error).
- Añadir repetido suma otra vez: el aviso de éxito dice siempre la cantidad añadida.
- Móvil: tipos como secciones plegables (`details`).

## SCR-008 Historial (UC-010)

`page-historial`. Junta (inicial) y encargado; solo lectura (INV-LOA-402).

```
<h1> Historial
Socio [ Lucía Pérez v ]  [ Ver historial ]
== Préstamos
Unidad      Desde       Hasta       Estado
Casco-02    2026-11-01  2026-11-03  (Devuelta)
== Multas
4 €  (Pendiente)
(vacío) Este socio no tiene préstamos ni multas
{!} (socio inexistente: puede elegir otro)
```

- Selector alimentado por la lista de socios (permitida a la junta solo para esto). Sin botones de acción.
- Móvil: dos listas apiladas.

## Estructura común

`tmpl-app`: región `header` con `org-nav`, `main` con un único `h1`, zona de avisos encima del contenido (`role="status"` o `role="alert"`). Bajo 640px la navegación se pliega en un botón "Menú" (`aria-expanded`) con "Salir" siempre visible dentro.
