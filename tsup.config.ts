import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/clockin.ts',
    'src/config.ts',
    'src/enums.ts',
    'src/types.ts',
    'src/errors/index.ts',
    'src/factories/index.ts',
    'src/schemas/index.ts',
    'src/core/index.ts',
    'src/services/index.ts',
    'src/utils/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  external: ['mongoose'],
  outDir: 'dist',
});
