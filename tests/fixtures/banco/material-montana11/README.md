# Material del club de montaña

Web para el préstamo de material del club (piolets, crampones, cascos, cuerdas y tiendas). Cada socio entra con su
correo y su contraseña, reserva material para unas fechas y ve o cancela sus reservas; el encargado entrega y recoge
el material, y la junta consulta.

## Instalar

```bash
npm ci
```

## Probar

```bash
npm test           # pruebas unitarias y de la API (Vitest)
npm run lint       # reglas de código
npm run test:e2e   # recorridos en el navegador (Playwright)
```

## Arrancar

```bash
npm run build && npm start
```

`npm start` sirve la web y la API con `vite preview`. Lee `PORT` (por defecto 4173) y `HOST` (por defecto `0.0.0.0`).
Los datos se guardan en un único fichero JSON (`data/almacen.json`, o el que indique `DATA_FILE`), que es el mismo
para todos los dispositivos.

## Crear la primera cuenta del encargado

La web no crea al encargado: lo prepara quien la instala, una sola vez, con el comando `seed`:

```bash
SEED_ENCARGADO_CORREO=marta@club.test \
SEED_ENCARGADO_NOMBRE=Marta \
SEED_ENCARGADO_CONTRASENA=Cumbre2026 \
npm run seed
```

Con `SEED_ROL=junta` crea una cuenta de la junta (solo lectura) con las mismas variables. Repetir el comando no
duplica la cuenta. Después el encargado da de alta a los socios desde la pantalla «Socios».

## Variables de entorno

| Variable | Para qué |
|----------|----------|
| `PORT`, `HOST` | puerto y dirección de `npm start` |
| `DATA_FILE` | fichero del almacén (por defecto `data/almacen.json`) |
| `CLOCK_FIXED` | solo para pruebas: fija «hoy» (`2026-12-05`); se ignora con `NODE_ENV=production` |
