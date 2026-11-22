# Pendientes

Lo que se aceptó sin cumplir del todo. Cada fila es una exención firmada en una puerta (acceptance/decisions.jsonl) y su número es la referencia de seguimiento que pide el método; se cierra cuando un cambio o una FASE posterior lo cumple.

| Id | Requisito | Qué falta | Motivo | Quién | Fecha | Puerta | Estado |
|---|---|---|---|---|---|---|---|
| MATERIALMONTANA11-1 | REQ-F-008 Gestionar el inventario | AC1 (weakened) | Q1: A, Q2: A. El recuento «{tipo}: {n} unidades» sí se comprueba en pantalla (captura y e2e de REQ-F-008 AC1); el MISSING es un falso aviso del arnés: el lint de citas busca el literal «unidad(es)» que genera su propia concordancia del plural. Se arregla en el arnés, no en el proyecto. | Andres Leon (Cliente) | 2026-11-22 | g1795304221376b | abierto |
