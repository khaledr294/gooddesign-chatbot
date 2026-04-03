import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: 'src/index.tsx',
      name: 'GoodDesignChat',
      fileName: 'widget',
      formats: ['iife'],
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
    cssCodeSplit: false,
    minify: 'terser',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
