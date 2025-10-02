import React, { useState, useEffect } from 'react';

interface ThemeSwitcherProps {
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

// --- Material You palette generation (lightweight) ---
// Approximates Material 3 tonal palettes from a seed color.
// Returns key tones for primary, secondary, tertiary, neutral and neutral-variant.
type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(Math.max(0, Math.min(255, Math.round(r))))}${toHex(Math.max(0, Math.min(255, Math.round(g))))}${toHex(Math.max(0, Math.min(255, Math.round(b))))}`;
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

function mix(a: RGB, b: RGB, t: number): RGB {
  const k = clamp01(t);
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
}

function lighten(color: RGB, amount: number): RGB {
  return mix(color, { r: 255, g: 255, b: 255 }, amount);
}

function darken(color: RGB, amount: number): RGB {
  return mix(color, { r: 0, g: 0, b: 0 }, amount);
}

function rotateHue(rgb: RGB, degrees: number): RGB {
  // Simple hue rotation via matrix approximation (not exact HCT, but lightweight)
  const rad = (degrees * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const newR = (
    (.213 + .787 * cosA - .213 * sinA) * r +
    (.715 - .715 * cosA - .715 * sinA) * g +
    (.072 - .072 * cosA + .928 * sinA) * b
  );
  const newG = (
    (.213 - .213 * cosA + .143 * sinA) * r +
    (.715 + .285 * cosA + .140 * sinA) * g +
    (.072 - .072 * cosA - .283 * sinA) * b
  );
  const newB = (
    (.213 - .213 * cosA - .787 * sinA) * r +
    (.715 - .715 * cosA + .715 * sinA) * g +
    (.072 + .928 * cosA + .072 * sinA) * b
  );
  return { r: Math.round(newR * 255), g: Math.round(newG * 255), b: Math.round(newB * 255) };
}

function deriveMaterialTones(seedHex: string) {
  const seed = hexToRgb(seedHex) || { r: 0, g: 136, b: 204 };
  const primary = seed;
  const secondary = rotateHue(seed, 30);
  const tertiary = rotateHue(seed, -30);
  const neutral = mix(seed, { r: 128, g: 128, b: 128 }, 0.6);
  const neutralVariant = mix(seed, { r: 128, g: 128, b: 128 }, 0.4);

  // Tonal steps (approx Material: 10,20,30,40,50,60,70,80,90,95,99)
  const tones = (c: RGB) => ({
    10: rgbToHex(darken(c, 0.8)),
    20: rgbToHex(darken(c, 0.6)),
    30: rgbToHex(darken(c, 0.4)),
    40: rgbToHex(darken(c, 0.2)),
    50: rgbToHex(c),
    60: rgbToHex(lighten(c, 0.15)),
    70: rgbToHex(lighten(c, 0.3)),
    80: rgbToHex(lighten(c, 0.45)),
    90: rgbToHex(lighten(c, 0.7)),
    95: rgbToHex(lighten(c, 0.85)),
    99: rgbToHex(lighten(c, 0.96)),
  });

  return {
    primary: tones(primary),
    secondary: tones(secondary),
    tertiary: tones(tertiary),
    neutral: tones(neutral),
    neutralVariant: tones(neutralVariant),
  };
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ onThemeChange }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [seedColor, setSeedColor] = useState<string>(localStorage.getItem('admin-seed-color') || '#0088cc');

  // Загружаем сохраненную тему при инициализации
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    setIsDarkMode(defaultTheme === 'dark');
    
    // Добавляем плавные переходы
    document.body.classList.add('theme-transition');
    
    applyTheme(defaultTheme as 'light' | 'dark', seedColor);
  }, []);

  const applyTheme = (theme: 'light' | 'dark', seed: string) => {
    const root = document.documentElement;
    // Derive tonal palettes from seed
    const palette = deriveMaterialTones(seed);
    // Map Material tokens to CSS variables (core subset)
    const setVar = (name: string, value: string) => root.style.setProperty(name, value);
    // Light scheme
    if (theme === 'light') {
      setVar('--md-sys-color-primary', palette.primary[40]);
      setVar('--md-sys-color-on-primary', palette.primary[99]);
      setVar('--md-sys-color-primary-container', palette.primary[90]);
      setVar('--md-sys-color-on-primary-container', palette.primary[10]);
      setVar('--md-sys-color-secondary', palette.secondary[40]);
      setVar('--md-sys-color-on-secondary', palette.secondary[99]);
      setVar('--md-sys-color-secondary-container', palette.secondary[90]);
      setVar('--md-sys-color-on-secondary-container', palette.secondary[10]);
      setVar('--md-sys-color-tertiary', palette.tertiary[40]);
      setVar('--md-sys-color-on-tertiary', palette.tertiary[99]);
      setVar('--md-sys-color-background', palette.neutral[99]);
      setVar('--md-sys-color-on-background', palette.neutral[10]);
      setVar('--md-sys-color-surface', palette.neutral[99]);
      setVar('--md-sys-color-on-surface', palette.neutral[10]);
      setVar('--md-sys-color-outline', palette.neutralVariant[50]);
    } else {
      // Dark scheme
      setVar('--md-sys-color-primary', palette.primary[80]);
      setVar('--md-sys-color-on-primary', palette.primary[20]);
      setVar('--md-sys-color-primary-container', palette.primary[30]);
      setVar('--md-sys-color-on-primary-container', palette.primary[90]);
      setVar('--md-sys-color-secondary', palette.secondary[80]);
      setVar('--md-sys-color-on-secondary', palette.secondary[20]);
      setVar('--md-sys-color-secondary-container', palette.secondary[30]);
      setVar('--md-sys-color-on-secondary-container', palette.secondary[90]);
      setVar('--md-sys-color-tertiary', palette.tertiary[80]);
      setVar('--md-sys-color-on-tertiary', palette.tertiary[20]);
      setVar('--md-sys-color-background', palette.neutral[10]);
      setVar('--md-sys-color-on-background', palette.neutral[90]);
      setVar('--md-sys-color-surface', palette.neutral[10]);
      setVar('--md-sys-color-on-surface', palette.neutral[90]);
      setVar('--md-sys-color-outline', palette.neutralVariant[60]);
    }

    // Bridge Material tokens to existing variables used across AdminJS styles
    setVar('--color-primary', getComputedStyle(root).getPropertyValue('--md-sys-color-primary').trim());
    setVar('--color-bg', getComputedStyle(root).getPropertyValue('--md-sys-color-surface').trim());
    setVar('--color-bg-secondary', getComputedStyle(root).getPropertyValue('--md-sys-color-background').trim());
    setVar('--color-text', getComputedStyle(root).getPropertyValue('--md-sys-color-on-surface').trim());
    setVar('--color-text-secondary', getComputedStyle(root).getPropertyValue('--md-sys-color-outline').trim());
    setVar('--color-border', getComputedStyle(root).getPropertyValue('--md-sys-color-outline').trim());
    setVar('--color-sidebar-bg', getComputedStyle(root).getPropertyValue('--md-sys-color-surface').trim());
    setVar('--color-sidebar-text', getComputedStyle(root).getPropertyValue('--md-sys-color-on-surface').trim());

    if (theme === 'dark') {
      root.style.setProperty('--color-bg', '#1a1a1a');
      root.style.setProperty('--color-bg-secondary', '#2d2d2d');
      root.style.setProperty('--color-text', '#ffffff');
      root.style.setProperty('--color-text-secondary', '#cccccc');
      root.style.setProperty('--color-border', '#404040');
      root.style.setProperty('--color-primary', '#0088cc');
      root.style.setProperty('--color-sidebar-bg', '#262626');
      root.style.setProperty('--color-sidebar-text', '#ffffff');
      
      // Применяем темную тему к body
      document.body.style.backgroundColor = '#1a1a1a';
      document.body.style.color = '#ffffff';
      
      // Добавляем класс для более сложных стилей
      document.body.classList.add('theme--dark');
      document.body.classList.remove('theme--light');
    } else {
      root.style.setProperty('--color-bg', '#ffffff');
      root.style.setProperty('--color-bg-secondary', '#f8f9fa');
      root.style.setProperty('--color-text', '#333333');
      root.style.setProperty('--color-text-secondary', '#666666');
      root.style.setProperty('--color-border', '#dee2e6');
      root.style.setProperty('--color-primary', '#0088cc');
      root.style.setProperty('--color-sidebar-bg', '#ffffff');
      root.style.setProperty('--color-sidebar-text', '#333333');
      
      // Применяем светлую тему к body
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#333333';
      
      // Добавляем класс для более сложных стилей
      document.body.classList.add('theme--light');
      document.body.classList.remove('theme--dark');
    }
    
    onThemeChange?.(theme);
  };

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('admin-theme', newTheme);
    applyTheme(newTheme, seedColor);
  };

  const onSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setSeedColor(next);
    localStorage.setItem('admin-seed-color', next);
    const currentTheme = isDarkMode ? 'dark' : 'light';
    applyTheme(currentTheme, next);
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '20px', 
      right: '20px', 
      zIndex: 1000,
      backgroundColor: 'var(--color-bg-secondary, #f8f9fa)',
      border: '1px solid var(--color-border, #dee2e6)',
      borderRadius: '8px',
      padding: '8px 12px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <button
        onClick={toggleTheme}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--color-text, #333333)',
          padding: '4px 8px',
          borderRadius: '4px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-primary, #0088cc)';
          e.currentTarget.style.color = '#ffffff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--color-text, #333333)';
        }}
        title={isDarkMode ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
      >
        <span style={{ fontSize: '18px' }}>
          {isDarkMode ? '☀️' : '🌙'}
        </span>
        <span style={{ fontSize: '14px', fontWeight: '500' }}>
          {isDarkMode ? 'Светлая' : 'Темная'}
        </span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
        <input
          type="color"
          value={seedColor}
          onChange={onSeedChange}
          title="Базовый цвет (Material You)"
          style={{ width: '36px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--color-text, #333333)' }}>Материал: базовый цвет</span>
      </div>
    </div>
  );
};

export default ThemeSwitcher;
