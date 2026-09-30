import { useEffect, useRef } from 'react';

/**
 * Hook para bucle requestAnimationFrame.
 * 
 * @param callback — función a ejecutar en cada frame
 * @param active — si es false, el bucle se pausa
 */
export function useRafLoop(callback: (time: number) => void, active: boolean = true): void {
  const savedCallback = useRef<(time: number) => void>(callback);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) return;

    const loop = (time: number) => {
      savedCallback.current(time);
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [active]);
}
