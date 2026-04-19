import { buildSync } from 'esbuild'
import path from 'path'

buildSync({
  entryPoints: [path.resolve(__dirname, '../src/workers/sw.ts')],
  outfile: path.resolve(__dirname, '../public/sw.js'),
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  sourcemap: false,
})

console.log('Service worker built: public/sw.js')
