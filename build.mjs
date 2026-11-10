// Genera index.html (la página que sirve GitHub Pages) y copia React a vendor/.
// Uso: npm ci && npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const REACT = JSON.parse(readFileSync('node_modules/react/package.json', 'utf8')).version;

// React y ReactDOM (UMD de producción) se sirven desde el propio sitio, sin CDN.
mkdirSync('vendor', { recursive: true });
copyFileSync('node_modules/react/umd/react.production.min.js', 'vendor/react.production.min.js');
copyFileSync('node_modules/react-dom/umd/react-dom.production.min.js', 'vendor/react-dom.production.min.js');
copyFileSync('node_modules/react/LICENSE', 'vendor/LICENSE-react.txt');

const out = await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  write: false,
  jsx: 'transform',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/styles.css', 'utf8');
// Base mínima del documento: margen cero y márgenes seguros en teléfonos con muesca.
const base = `html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0}
img{max-width:100%}
[hidden]{display:none!important}
`;

writeFileSync(
  'index.html',
  `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="description" content="Laboratorio educativo de la placa ESP32-DevKitC V4: inspector de GPIO, cableado de componentes, simulación de comportamiento y código Arduino de ejemplo.">
<title>Laboratorio ESP32-DevKitC V4</title>
<style>
${base}${css}</style>
</head>
<body>
<noscript><p style="padding:16px">Este laboratorio necesita JavaScript para funcionar.</p></noscript>
<div id="root"></div>
<script src="vendor/react.production.min.js?v=${REACT}"></script>
<script src="vendor/react-dom.production.min.js?v=${REACT}"></script>
<script>
${js}</script>
</body>
</html>
`,
);
console.log(`index.html listo · React ${REACT} · app ${(js.length / 1024).toFixed(1)} kB · css ${(css.length / 1024).toFixed(1)} kB`);
