// Actualiza los datos del dashboard.
//
//   npm run actualizar  -> corre el pipeline M1 a M6 (Python) y copia los CSV
//   npm run copiar      -> solo copia los CSV ya generados (pasos 2 y 3)
//
// El script se detiene en el primer error del pipeline (cada módulo se detiene
// con un AssertionError si falla un control) y no copia resultados a medias.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizDashboard = dirname(dirname(fileURLToPath(import.meta.url)));
const raizRepo = dirname(raizDashboard);
const carpetaPipeline = join(raizRepo, 'code', 'src');
const carpetaProcesados = join(raizRepo, 'dataset', 'processed');
const carpetaDestino = join(raizDashboard, 'public', 'data');

const MODULOS = [
  ['m1_ingesta_limpieza.py', 'M1 · ingesta y limpieza'],
  ['m2_serie_semanal.py', 'M2 · serie semanal'],
  ['m3_ventanas_modelos.py', 'M3 · partición y ventanas'],
  ['m4_entrenamiento.py', 'M4 · entrenamiento (tarda unos 15 minutos)'],
  ['m5_evaluacion.py', 'M5 · evaluación en prueba'],
  ['m6_pronostico_menu.py', 'M6 · pronóstico e ingeniería de menú'],
];

// Los CSV que lee el dashboard, con el módulo que genera cada uno
const ARCHIVOS = [
  ['01_ventas_limpias.csv', 'M1'],
  ['02_serie_semanal.csv', 'M2'],
  ['03_particion_semanas.csv', 'M3'],
  ['03_platos_modelables.csv', 'M3'],
  ['04_entrenamiento.csv', 'M4'],
  ['04_matriz_confusion.csv', 'M4'],
  ['05_predicciones.csv', 'M5'],
  ['05_metricas.csv', 'M5'],
  ['05_matriz_confusion.csv', 'M5'],
  ['06_pronostico.csv', 'M6'],
  ['06_ingenieria_menu.csv', 'M6'],
];

const soloCopiar = process.argv.includes('--solo-copiar');

if (!soloCopiar) {
  console.log('Corriendo el pipeline M1 a M6 desde code/src…\n');
  for (const [script, descripcion] of MODULOS) {
    if (script.startsWith('m4')) {
      console.log('\nAviso: M4 entrena los modelos y tarda unos 15 minutos. No cierre la terminal.');
    }
    console.log(`\n==> ${descripcion} (${script})`);
    const resultado = spawnSync('python3', [script], { cwd: carpetaPipeline, stdio: 'inherit' });
    if (resultado.status !== 0) {
      console.error(`\nEl pipeline se detuvo en ${script} (ver el mensaje de arriba).`);
      console.error('No se copió ningún archivo: el dashboard sigue con los datos anteriores.');
      process.exit(resultado.status ?? 1);
    }
  }
}

// Paso 2: copiar los CSV a public/data/
mkdirSync(carpetaDestino, { recursive: true });
const manifiesto = { generado_en: new Date().toISOString(), archivos: [] };
for (const [nombre, modulo] of ARCHIVOS) {
  const origen = join(carpetaProcesados, nombre);
  let contenido;
  try {
    contenido = readFileSync(origen, 'utf8');
  } catch {
    console.error(`Falta ${origen}. Corra primero el pipeline con: npm run actualizar`);
    process.exit(1);
  }
  copyFileSync(origen, join(carpetaDestino, nombre));
  const filas = Math.max(contenido.trimEnd().split('\n').length - 1, 0);
  manifiesto.archivos.push({
    nombre,
    modulo,
    filas,
    bytes: statSync(origen).size,
    copiado_en: new Date().toISOString(),
  });
  console.log(`Copiado ${nombre} (${modulo}, ${filas} filas)`);
}

// Paso 3: el manifiesto que usa la vista «Datos y fuentes»
writeFileSync(join(carpetaDestino, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
console.log(`\nListo: ${ARCHIVOS.length} CSV y manifiesto.json en dashboard/public/data/`);
