# DSS para un restaurante PyME: predicción de demanda + ingeniería de menú

Python (CRISP-DM) prepara los datos, entrena y evalúa los modelos y exporta JSON estáticos.
El dashboard (`web/`, React + Vite + TypeScript) lee esos JSON y se publica como **sitio estático** en Vercel,
sin servidor. La carga de un CSV nuevo se calcula en el navegador (el archivo no sale del equipo).

**Por qué no Streamlit:** el cliente pidió acceso desde celular y tableta (RNF-03); un sitio estático responsive
se publica sin servidor y el cálculo en el navegador mantiene los datos del restaurante en su equipo.

**Terminología de conjuntos** (convención scikit-learn): *validación* = elegir hiperparámetros y modelo
(2025-01-06 a 2025-06-30); *prueba* = evaluación final, una sola vez (2025-07-07 a 2025-12-29).

## Ejecutar (Python, solo en el computador de los autores)
```bash
pip install -r requirements.txt pytest
python -m src.pipeline     # CSV -> data/processed/ (serie semanal y dataset de modelado)
python -m src.entrenar     # búsqueda en validación, evaluación, results/ y models/
python -m src.exportar     # escribe web/public/data/*.json y las fixtures de paridad
python -m pytest
```
Cambiar el modelo vigente solo exige reentrenar y exportar de nuevo: el dashboard lee `modelo_meta.json`.

## Dashboard en local
```bash
cd web && npm install
npm run dev              # desarrollo
npm run dev -- --host    # abrirlo desde el celular en la red local
npm run build && npm run preview
npm test                 # vitest: paridad XGBoost, preparación, ingeniería de menú, reparto diario
```
RNF-03/RNF-04 (con `npm run preview` activo): `NODE_PATH=$(npm root -g) node scripts/verificar_web.cjs`

## Publicar en Vercel
1. Suba el repositorio a GitHub.
2. En Vercel: *Add New → Project* e importe el repositorio.
3. **Root Directory: `web`**. Framework preset: Vite. Build `npm run build`, salida `dist`.
4. *Deploy*. No requiere variables de entorno ni funciones; `web/vercel.json` redirige las rutas al SPA.

## Modelos
Modelo base (media móvil de 4 semanas), XGBoost y LSTM (PyTorch). El vigente es el de menor MAE en validación
(`models/modelo_vigente.json`). El navegador solo evalúa XGBoost; si el vigente es la LSTM, las proyecciones
originales usan la LSTM y la recarga de un archivo usa XGBoost (se avisa en «Confiabilidad»).
Resultados completos en `RESULTADOS.md`; estado y pendientes en `ESTADO_DEL_PROYECTO.md`.

### Si Vercel dice que no encuentra el punto de entrada de Python
Vercel está construyendo desde la raíz y ve `requirements.txt`. Solución: *Settings → General → Root Directory → `web`* y volver a desplegar.
Como respaldo, la raíz trae un `vercel.json` y un `.vercelignore` que permiten desplegar también desde la raíz
(construye `web/` y publica `web/dist`); no se pudo probar contra Vercel desde este entorno.
