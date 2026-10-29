import { useEffect, useState } from 'react';
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function useConnectivity() {
  const [state, setState] = useState(() => ({ online: navigator.onLine, generation: 0 }));
  useEffect(() => {
    const update = () =>
      setState((s) => ({ online: navigator.onLine, generation: s.generation + 1 }));
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return state;
}
