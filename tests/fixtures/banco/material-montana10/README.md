# Material Montaña 10

Web para el préstamo de material del club de montaña: cada socio entra con su correo y su contraseña y reserva
piolets, crampones, cascos, cuerdas y tiendas para unas fechas; el encargado gestiona el inventario y los socios.

JavaScript (módulos ES) + Vite + Vitest.

## Instalar

```
npm ci
```

## Probar

```
npm test              # pruebas unitarias y de integración (Vitest, 2 workers)
npm run lint          # ESLint
npx playwright test   # recorrido en navegador con capturas y vídeo
```

Variables solo para pruebas:

- `CLOCK_FIXED=2026-12-01` fija «hoy» (fecha de Madrid) en el servidor.
- `STORE_FILE=/ruta/store.json` cambia el fichero del almacén (por defecto `data/store.json`).

## Arrancar

```
npm run build && npm start
```

`npm start` sirve lo construido (`vite preview`) y la API `/api/*` en el mismo proceso. El puerto y la dirección se
leen de `PORT` (4173 por defecto) y `HOST` (`0.0.0.0` por defecto):

```
PORT=8080 HOST=0.0.0.0 npm start
```

Con HTTPS delante, define `COOKIE_SECURE=1` para marcar la cookie de sesión como `Secure`.

## Cuentas del encargado y de la junta

Las deja preparadas quien instala la web (la API no las crea ni les cambia la contraseña):

```
npm run cuentas -- --encargado encargado@club.es --junta junta@club.es
```

Las contraseñas se piden por entorno (`CUENTA_ENCARGADO_CONTRASENA`, `CUENTA_JUNTA_CONTRASENA`) o con
`--encargado-contrasena` y `--junta-contrasena`. Repetir el comando no duplica las cuentas.
