import { useEffect, useState } from 'react';

export type Tema = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cardi-theme';

function obtenerPreferenciaSistema(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function temaEfectivo(tema: Tema): 'light' | 'dark' {
  return tema === 'system' ? obtenerPreferenciaSistema() : tema;
}

function aplicar(tema: Tema): void {
  const efectivo = temaEfectivo(tema);
  const root = document.documentElement;
  root.classList.toggle('dark', efectivo === 'dark');
  root.style.colorScheme = efectivo;
}

/**
 * Inicializa el tema al cargar la app — se llama una sola vez antes de render
 * para evitar flash of light content.
 */
export function initTheme(): void {
  const guardado = (localStorage.getItem(STORAGE_KEY) as Tema | null) ?? 'system';
  aplicar(guardado);
}

/**
 * Hook para leer y cambiar el tema. Persiste en localStorage y re-aplica al
 * cambiar las preferencias del sistema si está en modo 'system'.
 */
export function useTheme(): {
  tema: Tema;
  efectivo: 'light' | 'dark';
  setTema: (t: Tema) => void;
} {
  const [tema, setTemaState] = useState<Tema>(() =>
    typeof window === 'undefined'
      ? 'light'
      : ((localStorage.getItem(STORAGE_KEY) as Tema | null) ?? 'system'),
  );
  const [efectivo, setEfectivo] = useState<'light' | 'dark'>(() => temaEfectivo(tema));

  useEffect(() => {
    aplicar(tema);
    setEfectivo(temaEfectivo(tema));
    localStorage.setItem(STORAGE_KEY, tema);
  }, [tema]);

  // Si está en modo 'system', escuchar cambios del SO
  useEffect(() => {
    if (tema !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      aplicar('system');
      setEfectivo(temaEfectivo('system'));
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [tema]);

  return { tema, efectivo, setTema: setTemaState };
}
