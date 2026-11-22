# Material Montaña

Web para el préstamo de material del club de montaña: los socios reservan, el encargado entrega y recibe, y la junta consulta.

## Instalar

```bash
npm install
```

## Probar

```bash
npm test                # pruebas unitarias y de integración (Vitest)
npx playwright test     # recorridos en el navegador, con capturas y vídeo
npm run lint
```

## Arrancar

```bash
npm run build && npm start
```

`npm start` sirve la web ya construida (`vite preview`) y la API en `/api`, en el mismo proceso. Para desarrollar: `npm run dev`.

## Variables de entorno

| Variable | Para qué sirve | Por defecto |
|----------|----------------|-------------|
| `PORT` | puerto en el que escucha | `4173` |
| `HOST` | dirección en la que escucha | `0.0.0.0` |
| `MM_DATOS` | ruta del fichero de datos (el directorio debe existir y poder escribirse) | `./data/datos.json` |

Los datos viven en el servidor, en `MM_DATOS`; reiniciar no los pierde (las sesiones sí se cierran).
