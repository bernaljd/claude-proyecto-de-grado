# Resultados del DSS para restaurante PyME

Todas las cifras salen de ejecutar el código sobre `data/raw/Anonymized_Restaurant_Sales_Data.csv`
(`python -m src.entrenar`, `python -m src.exportar`, `pytest`, `npm test`, `scripts/verificar_web.cjs`).

## 1. Cumplimiento por objetivo

| Objetivo | Evidencia |
|---|---|
| **OE2** flujos de información entre ingesta, predicción, ingeniería de menú y visualización | `src/ingesta.py`, `src/preparacion.py`, `src/exportar.py` (Python) y `web/src/lib/preparacion.ts`, `web/src/lib/pipeline.ts` (navegador): flujos F1–F9. Pruebas de paridad Python ↔ navegador en `web/src/lib/lib.test.ts` |
| **OE3** modelos de predicción con datos reales | `src/modelos/base.py`, `xgboost_modelo.py`, `lstm.py`; búsquedas en `results/busqueda_xgb.csv` (144 combinaciones) y `results/busqueda_lstm.csv` (27); modelos en `models/` |
| **OE4** desempeño con MAE, RMSE y SMAPE | `src/evaluacion.py`, `results/metricas.json` / `.csv`, `results/tabla_resultados.tex`, figuras `results/fig_*.png` |
| **Objetivo general** DSS con predicción + ingeniería de menú, evaluado con métricas | Dashboard `web/` (7 vistas), `src/ingenieria_menu.py` y `web/src/lib/ingenieriaMenu.ts`, `models/modelo_vigente.json` |

## 2. Valores para la tesis

**Filas de entrenamiento.** XGBoost y modelo base: **4.545** (101 semanas × 45 platos, tras quitar las 4 primeras semanas sin rezagos).
LSTM (ventana de 12 semanas): 4.185 filas de entrenamiento.

**Cuadro 6.2: XGBoost** (`results/tabla_config_xgb.tex`)

| Hiperparámetro | Valores explorados | Valor elegido |
|---|---|---|
| objective | reg:squarederror, reg:tweedie | reg:tweedie |
| tweedie_variance_power | 1,2; 1,5 | 1,5 |
| n_estimators | hasta 1.000 (parada temprana 50) | 99 |
| max_depth | 3, 4, 6 | 6 |
| learning_rate | 0,03; 0,1 | 0,1 |
| subsample | 0,8; 1,0 | 0,8 |
| colsample_bytree | 0,8; 1,0 | 0,8 |
| min_child_weight | 1, 5 | 1 |
| random_state | 42 | 42 |

**Configuración final de la LSTM** (PyTorch, una capa LSTM, dropout, capa densa, Adam lr 1e-3, pérdida MSE, lotes de 64, parada temprana con paciencia 15, semilla 42, variables escaladas a [0, 1] con parámetros de entrenamiento).

| Hiperparámetro | Valores explorados | Valor elegido |
|---|---|---|
| Ventana (semanas) | 4, 8, 12 | **12** |
| Unidades LSTM | 16, 32, 64 | **64** |
| Dropout | 0; 0,2; 0,4 | **0** |
| Épocas (parada temprana) | hasta 200 | 16 |

Nota: la configuración de referencia de la tesis (ventana 8, 32 unidades) dio MAE de validación 0,643 (dropout 0); la elegida dio 0,590. La ventana de 8 con 64 unidades quedó casi igual (0,591).

**Cuadro 7.1: métricas en prueba** (`results/tabla_resultados.tex`)

| Modelo | MAE | RMSE | SMAPE (%) | MAE total | RMSE total | SMAPE total (%) |
|---|---|---|---|---|---|---|
| | *por plato y semana* | | | *demanda total semanal* | | |
| Base (mm4) | 0,500 | 0,871 | 102,57 | 9,519 | 11,726 | 62,50 |
| XGBoost | 0,558 | 0,841 | 176,24 | 9,848 | 12,358 | 59,43 |
| **LSTM (vigente)** | **0,485** | **0,835** | 117,67 | **9,515** | 11,898 | 61,25 |

Métricas de validación (MAE por plato): base 0,639; XGBoost 0,699; LSTM 0,590. Detalle completo en `results/metricas.csv`.

**Criterio de éxito** (menor error que el base en ≥ 2 de 3 métricas, en prueba):
- LSTM: por plato mejora MAE y RMSE (2 de 3); en el total semanal mejora MAE y SMAPE (2 de 3). **Cumple.**
- XGBoost: 1 de 3 en ambos niveles. **No cumple.**

**Modelo vigente (CA-07):** LSTM, por tener el menor MAE por plato en validación (`models/modelo_vigente.json`).

**Versiones:** `results/versions.txt` (Python 3.13.17, pandas 3.0.5, numpy 2.5.3, xgboost 3.4.1, scikit-learn 1.9.1, matplotlib 3.11.2, pyarrow 26.0.0, torch 2.14.1, pytest 9.1.1; Node 22, Vite 5, React 18, vitest 2).

## 3. Validación funcional

| Requisito | Método | Resultado | Evidencia |
|---|---|---|---|
| RF-01 carga del CSV | Playwright: subir el CSV original | Cumple | `scripts/verificar_web.cjs` (4.385 leídos, 24 excluidos, 62 platos) |
| RF-02 validación de campos mínimos | Prueba unitaria + vista | Cumple | `lib.test.ts` («nombra el campo faltante»); `web/src/pages/Cargar.tsx` |
| RF-03 resumen de inicio | Captura | Cumple | `results/capturas/` |
| RF-04 demanda proyectada por plato | Captura | Cumple | `results/capturas/` |
| RF-05 proyección diaria (suma exacta) | pytest + vitest | Cumple | `test_mayor_residuo_suma_exacta`, `lib.test.ts` (paridad con Python) |
| RF-06 clasificación del menú (histórica y proyectada) | pytest + vitest | Cumple | caso de referencia de los 12 platos (2/6/4/0, £3,36, 5,83 %) |
| RF-07 filtros de periodo y categoría | Captura | Cumple | `results/capturas/` |
| RF-08 alertas | Captura | Cumple | 1 alerta: Ayamase Sauce, de Puzzle a Estrella |
| RF-09 detalle del plato y acción sugerida | Captura | Cumple | `results/capturas/` (detalle del plato) |
| RF-10 marcas «Poco historial» y «Retirado del menú» | Captura | Cumple | vista de demanda |
| RF-11 confiabilidad | Captura | Cumple | `results/capturas/` |
| RNF-01 prueba con usuarios reales | — | **No verificado (requiere participantes)** | — |
| RNF-02 sin términos técnicos fuera de «Confiabilidad» | Revisión del código | Cumple | los nombres de modelo y métricas solo están en `Confiabilidad.tsx` |
| RNF-03 sin desplazamiento horizontal a 360, 768 y 1280 px | Playwright | Cumple (21 de 21) | `scripts/verificar_web.cjs`, capturas |
| RNF-04 carga < 3 s | Playwright sobre `npm run preview` | Cumple (≈0,6 s) | ídem |
| RNF-05 cambiar el modelo vigente sin tocar el dashboard | Se cambió el vigente a «Modelo base», se reexportó y se volvió a la LSTM | Cumple | `npm test` (9 de 9) y `npm run build` pasaron en ambos casos, sin cambiar código web |
| RNF-06 aviso del costo estimado | Revisión de la vista | Cumple | `Menu.tsx` |
| Accesibilidad básica | Contraste calculado (mín. 4,83:1), `label` en campos, botones y enlaces reales, áreas táctiles de 44 px por CSS | Cumple (no se usó una herramienta externa de auditoría) | `web/src/estilos.css` |
| Restricción tecnológica: sitio estático sin servidor | `npm run build` genera `web/dist`; `vercel.json` con rewrites | Cumple en local. **El despliegue en Vercel no se ejecutó desde este entorno** | README |

Pruebas automáticas: `pytest` 11 pasan; `vitest` 9 pasan (paridad del XGBoost en 200 filas con diferencia < 1e-4, serie, estados, variables de la semana siguiente, proyección, reparto y clasificación).

## 4. Análisis honesto

- **¿Supera la LSTM al modelo base?** Sí, pero por muy poco. El MAE por plato baja de 0,500 a 0,485 (3 %) y el RMSE de 0,871 a 0,835; en el total semanal el MAE es casi idéntico (9,515 frente a 9,519). El SMAPE por plato es peor (117,7 % frente a 102,6 %). Con una sola semilla, un solo conjunto de prueba y diferencias tan pequeñas no se puede afirmar que sea una mejora estable. El criterio de éxito de la tesis se cumple de forma formal, no contundente.
- **XGBoost no supera al base.** Mejora solo el RMSE por plato y el SMAPE del total. En validación tampoco ganó por MAE.
- **Qué significa el MAE.** Un MAE de 0,485 es que la proyección se aleja, en promedio, medio plato por plato y semana. Como el plato promedio vende 0,37 unidades por semana en prueba y el 78 % de las filas son cero, ese error es grande en términos relativos y por eso el SMAPE es alto. Para planificar compras sirve más la demanda total: se aleja unas 9,5 unidades por semana sobre un promedio real de 16,8 en prueba (más de la mitad). Es una guía de orden de magnitud, no una cifra para fijar pedidos exactos.
- **Efecto de la caída de la demanda.** El promedio semanal cae de 25,7 unidades en validación a 16,8 en prueba, y el último año tiene semanas con 0 a 5 unidades. Los modelos se entrenaron con niveles más altos y tienden a sobreestimar al final (se ve en `results/fig_real_vs_pred_total.png`). Por eso las métricas de prueba no son comparables con las de validación.
- **Proyección de la semana 2026-01-05:** parte de semanas con ventas muy bajas (4 y 5 unidades). El total proyectado es de 12 unidades y hay 1 alerta. Al redondear a enteros, casi todos los platos quedan en 0; el detalle del plato muestra además el valor sin redondear.
- **Recarga de archivos en el navegador:** como el vigente es la LSTM, que no se evalúa en el navegador, al cargar un archivo nuevo se recalcula con XGBoost. Esto está avisado en la vista «Confiabilidad». XGBoost fue el peor modelo, así que esas proyecciones recalculadas son menos confiables que las originales.
- **Limitaciones:**
  - datos de un solo restaurante del Reino Unido; la estacionalidad aprendida no es transferible a Colombia sin reentrenar;
  - el estado de los platos usa la fecha de corte fija 2024-12-30 de la tesis;
  - el costo es una estimación (≈ 35 % del precio), por lo que un margen alto equivale a un precio alto;
  - la búsqueda de la LSTM usó una sola semilla.

## 5. Cómo ejecutar

```bash
# 1. Instalar
pip install -r requirements.txt
cd web && npm install && cd ..

# 2. Preparar datos (escribe data/processed/), entrenar (incluye la LSTM; tarda unos 25 min en CPU) y exportar
python -m src.pipeline
python -m src.entrenar
python -m src.exportar

# 3. Probar
python -m pytest
cd web && npm test && npm run build

# 4. Dashboard en local
cd web && npm run dev                # http://localhost:5173
cd web && npm run dev -- --host      # abrir desde el celular en la red local

# 5. Verificar RNF-03 y RNF-04 (con `npm run preview` activo en otra terminal)
NODE_PATH=$(npm root -g) node scripts/verificar_web.cjs
```

**Publicar en Vercel:** subir el repositorio a GitHub → *Add New → Project* en Vercel → importar el repositorio → **Root Directory `web`** (preset Vite, salida `dist`) → *Deploy*. No requiere variables de entorno ni funciones.
