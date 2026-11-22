import { crearManejador } from './http.js';
import { crearAlmacen } from './store.js';
import { crearReloj } from '../domain/reloj.js';
import { programarTareasDiarias } from './tareas-diarias.js';

// El mismo plugin se registra en `server` (npm run dev) y en `preview` (npm start): ambos sirven /api/*.
export function plugin({ env = process.env } = {}) {
  let manejador;
  const entrar = (servidor) => {
    if (!manejador) {
      const almacen = crearAlmacen({ env });
      const reloj = crearReloj({ env });
      manejador = crearManejador({ almacen, reloj, env });
      programarTareasDiarias({ almacen, reloj, registrar: (linea) => process.stdout.write(`${linea}\n`) });
    }
    servidor.middlewares.use((req, res, siguiente) => manejador(req, res, siguiente));
  };
  return { name: 'material-montana10-api', configureServer: entrar, configurePreviewServer: entrar };
}
