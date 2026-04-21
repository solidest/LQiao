import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist/esm',
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    target: 'es2022',
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    outDir: 'dist/cjs',
    dts: false,
    clean: false,
    sourcemap: true,
    minify: false,
    target: 'es2022',
    outExtension: () => ({ js: '.cjs' }),
  },
]);
