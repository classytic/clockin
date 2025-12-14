import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/clockin.ts',
    'src/schemas/index.ts',
    'src/core/index.ts',
    'src/services/index.ts',
    'src/utils/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  external: ['mongoose'],
  outDir: 'dist',
});
