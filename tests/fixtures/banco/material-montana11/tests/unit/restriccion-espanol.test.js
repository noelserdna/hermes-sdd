import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

describe('REQ-C-002 Textos en español', () => {
  // REQ-C-002 AC1: "the texts of the interface are read from the source and the Spanish messages of the criteria appear verbatim"
  it('REQ-C-002 AC1 los textos se leen del código y «Acceso no permitido», «No hay unidades libres esas fechas» y «Solo se puede cancelar hasta el día antes» salen literales', () => {
    const errores = leer('src/domain/errores.js');
    const textos = leer('src/ui/textos.js');
    expect(errores).toContain("'Acceso no permitido'");
    expect(errores).toContain("'No hay unidades libres esas fechas'");
    expect(errores).toContain("'Solo se puede cancelar hasta el día antes'");
    expect(textos).toContain("'Acceso no permitido'");
    expect(textos).toContain("'Entrar'");
    expect(textos).toContain("'Salir'");
    expect(textos).toContain("'Material disponible'");
    expect(leer('index.html')).toContain('<html lang="es">');
  });
});
