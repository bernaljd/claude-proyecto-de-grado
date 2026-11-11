# DSS para un restaurante pyme: pronóstico de demanda e ingeniería de menú

Trabajo de grado de Ingeniería de Sistemas (Pontificia Universidad Javeriana Cali).
Sistema de soporte a la toma de decisiones (DSS) que combina **pronóstico de demanda
por plato con machine learning** (MM4, GradientBoosting, LSTM, ARIMA y SARIMA) e
**ingeniería de menú (Kasavana y Smith)**, con un **dashboard web de solo lectura**.

## Estructura del repositorio

```
dataset/raw/ventas_originales.csv   Ventas del restaurante (entrada de M1, sin modificar)
dataset/processed/                  CSV que produce el pipeline (M1 a M6)
code/src/                           Pipeline de Python: m1_… a m6_…
code/requirements.txt               Dependencias del pipeline
modelos/                            Modelos reentrenados que deja M4
dashboard/                          Dashboard web (React + Vite + TypeScript)
dashboard/public/data/              Copia de los CSV que lee el navegador + manifiesto.json
dashboard/capturas/                 Capturas a 360, 768 y 1280 px (las genera Playwright)
```

Regla de oro: **el dashboard no calcula pronósticos ni entrena nada**: lee los CSV y
los muestra, cada número con su fuente (archivo, módulo M1–M6 y origen OBS/PRED/CALC).
El único cálculo del navegador es la matriz de menú al cambiar el período, con la
misma fórmula del pipeline y una prueba que exige que reproduzca `06_ingenieria_menu.csv`.

## Correr el pipeline (Python)

```bash
pip install -r code/requirements.txt
```

```bash
cd code/src && python3 m1_ingesta_limpieza.py && python3 m2_serie_semanal.py && python3 m3_ventanas_modelos.py && python3 m4_entrenamiento.py && python3 m5_evaluacion.py && python3 m6_pronostico_menu.py
```

M4 (entrenamiento) tarda unos 15 minutos. Cada módulo se detiene con un
`AssertionError` si falla un control de calidad y no escribe salidas a medias.

## Correr el dashboard en el computador

```bash
cd dashboard && npm install && npm run dev
```

Abre `http://localhost:5173`. Los CSV ya están copiados en `dashboard/public/data/`.

## Actualizar los datos

1. Reemplace `dataset/raw/ventas_originales.csv` por el CSV de ventas nuevo
   (las mismas 14 columnas del restaurante).
2. Desde `dashboard/`:

```bash
npm run actualizar
```

Corre M1→M6 en orden (avisa antes de M4, que tarda ~15 min), se detiene en el primer
error, copia los 11 CSV a `dashboard/public/data/` y escribe `manifiesto.json`.
Si los CSV ya están generados, `npm run copiar` hace solo la copia.

3. Recargue la página del dashboard.

## Pruebas

```bash
cd dashboard && npm test        # vitest: parseo, formato, regla de la matriz,
                                # paridad con 06_ingenieria_menu.csv, reparto por día,
                                # detección de columnas pred_* y RNF-02
npm run build                   # TypeScript + Vite sin errores
npm run capturas                # Playwright sobre npm run preview: cada ruta a 360,
                                # 768 y 1280 px, falla si hay scroll horizontal,
                                # exige carga < 3 s y guarda dashboard/capturas/
```

## Publicar en Vercel (sitio estático)

1. Suba el repositorio a GitHub.
2. En Vercel: **Add New → Project** e importe el repositorio.
3. Configure: **Framework Preset: Vite** · **Root Directory: `dashboard`** ·
   salida `dist` (la del preset). No se necesitan variables de entorno.
4. Deploy. `dashboard/vercel.json` ya reescribe todas las rutas a `index.html`
   para que funcionen las direcciones como `/menu` o `/demanda/<plato>`.

**Por qué un sitio estático:** el administrador puede consultarlo desde el celular
sin instalar nada, no hay servidor ni funciones que mantener, y los datos del
restaurante se quedan en su equipo: solo se publican los CSV de resultados que el
dueño decide copiar, y la vista «Cargar datos» valida archivos sin que salgan del
navegador.
