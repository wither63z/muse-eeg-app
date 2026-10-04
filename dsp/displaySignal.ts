/** Filtro visual de ~0.5 Hz. No modifica los buffers crudos ni las grabaciones.
 * Reinicia su estado en cada ventana copiada para que el dibujo sea determinista.
 */
export function highPassDisplayWindow(samples: Float32Array, count: number): void {
  if (count === 0) return;
  let previousInput = samples[0];
  let previousOutput = 0;
  const alpha = 0.9879;
  for (let i = 0; i < count; i++) {
    const input = samples[i];
    previousOutput = alpha * (previousOutput + input - previousInput);
    samples[i] = previousOutput;
    previousInput = input;
  }
}
