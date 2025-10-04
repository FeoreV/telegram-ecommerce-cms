import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      jsxRuntime: 'automatic',
    }),
  ],
  base: '/',
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
  resolve: {
    dedupe: ['@emotion/react', '@emotion/styled', '@emotion/cache', 'react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      '@emotion/react',
      '@emotion/styled',
      '@emotion/cache',
      '@emotion/serialize',
      '@emotion/sheet',
      '@emotion/utils',
      '@emotion/use-insertion-effect-with-fallbacks',
      '@mui/material',
      '@mui/icons-material',
    ],
    esbuildOptions: {
      target: 'es2020',
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    // Force new file hashes on each build
    cssCodeSplit: true,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      external: [
        // Exclude server-side only packages that might be accidentally included
        'fsevents'
      ],
      output: {
        // CRITICAL FIX: Prevent code splitting for Emotion/MUI to avoid circular dependencies
        manualChunks: undefined,
      },
    },
  },
})
