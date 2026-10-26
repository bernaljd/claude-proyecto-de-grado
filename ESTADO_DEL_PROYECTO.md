# Estado del proyecto: DSS para restaurante PyME

Resumen para el equipo de tesis. Rama: `claude/new-session-a151ka`. **Estado: fases A a F completas; falta solo el despliegue real en Vercel y la prueba con usuarios.** Todas las cifras salen de ejecutar el código sobre `data/raw/Anonymized_Restaurant_Sales_Data.csv`.

## 1. Qué es y cómo está armado

- **Python (CRISP-DM):** prepara los datos, entrena y evalúa los modelos, y exporta tablas CSV estáticas. Solo corre en el computador de los autores.
- **Dashboard (`web/`):** React + Vite + TypeScript, sitio estático sin servidor. Lee los CSV de `web/public/data/` y se publica en Vercel.
- **Carga de un CSV nuevo:** se calcula en el navegador y el archivo no sale del equipo. No reentrena el modelo.
- **Reentrenar:** `python -m src.entrenar` y luego `python -m src.exportar`.

## 2. Qué se hizo

### Fase A: preparación de datos (cumple lo esperado)
- 4.385 registros, 24 cancelados y 4.361 válidos; 7.118 unidades; £38.480,25.
- 62 platos, 157 semanas y 9.734 filas plato-semana (con ceros). La suma de la serie coincide con los datos (CA-01).
- Estados de los platos: **45 modelables, 7 con historial insuficiente y 10 retirados** (CA-02).
- Partición cronológica: 105 semanas de entrenamiento, 26 de validación y 26 de prueba. El entrenamiento queda en **4.545 filas** tras quitar las 4 primeras semanas sin rezagos.
- Variables: rezagos 1 a 4, media móvil de 4 semanas, semana ISO (seno y coseno), mes, precio previo y one-hot de plato y categoría. Hay pruebas de que no hay fuga de información.
- Discrepancia con el prompt: el promedio semanal de 2024 y 2025 sale 42,06 y 23,42 si se promedia por semana. Coincide (70,6 / 42,6 / 23,7) si se divide las unidades de cada año calendario entre 52.

### Fase B: modelos
- Se probaron 144 combinaciones de hiperparámetros en validación (`results/busqueda_xgb.csv`).
- Configuración elegida de XGBoost: `reg:tweedie` con potencia 1,5, `max_depth` 6, `learning_rate` 0,1, `subsample` 0,8, `colsample_bytree` 0,8, `min_child_weight` 1 y 99 árboles.
- Dos ejecuciones dan exactamente las mismas métricas.

Métricas en el conjunto de **prueba**:

| Modelo | MAE / RMSE / SMAPE por plato | MAE / RMSE / SMAPE total semanal |
|---|---|---|
| Base (mm4) | 0,500 / 0,871 / 102,6 | 9,52 / 11,73 / 62,5 |
| XGBoost | 0,558 / 0,841 / 176,2 | 9,85 / 12,36 / 59,4 |

**Hallazgo importante:** XGBoost **no cumple el criterio de éxito** de la tesis. Mejora solo 1 de 3 métricas por plato (el RMSE) y 1 de 3 en el total semanal (el SMAPE). Por la regla CA-07 (menor MAE en validación), el **modelo vigente es el modelo base**.

Causas probables:
- la serie por plato es muy intermitente;
- la demanda cae de forma sostenida;
- el periodo de prueba tiene el nivel más bajo de la serie.

El SMAPE de XGBoost por plato es alto porque predice valores pequeños (por ejemplo 0,3) donde lo real es 0, y cada caso vale 200 %.

### Fase C: ingeniería de menú y proyección diaria
- Clasificación Estrella, Caballo de arado, Puzzle y Perro, en versión histórica (últimas 12 semanas por defecto) y proyectada. También genera alertas y acciones sugeridas.
- Reparto diario de lunes a sábado con el método del mayor residuo; la suma diaria es igual a la semanal.
- Caso de referencia verificado: con los 12 platos más vendidos sale margen £3,36, umbral 5,83 % y 2 Estrellas, 6 Caballos de arado, 4 Puzzles y 0 Perros.
- Ambos módulos están escritos dos veces, en Python y en TypeScript, con pruebas de paridad.

### Fase D: exportación y dashboard
- `src/exportar.py` genera los CSV y el XGBoost para el navegador (`modelo_xgb_arboles.csv` y `modelo_meta.csv`).
- 7 vistas: Inicio, Demanda por plato, Ingeniería de menú (con matriz), Detalle del plato, Alertas, Cargar datos y Confiabilidad.
- Es responsive: barra lateral en computador y barra inferior en celular.
- `web/vercel.json` ya redirige las rutas al SPA.

### Verificación
| Qué | Resultado |
|---|---|
| `pytest` | 11 pruebas pasan |
| `vitest` | 8 pruebas pasan |
| Paridad XGBoost Python vs navegador | diferencia < 1e-4 en 200 filas |
| `npm run build` | pasa |
| Sin desplazamiento horizontal a 360, 768 y 1280 px (RNF-03) | cumple en las 7 vistas |
| Carga de cada vista (RNF-04) | unos 0,6 s (límite 3 s) |
| Subir el CSV original en el navegador | 4.385 leídos, 24 excluidos y 62 platos |

Capturas en `results/capturas/`.

## 3. Cómo ejecutarlo

```bash
# Python
pip install -r requirements.txt pytest
python -m src.entrenar && python -m src.exportar && python -m pytest

# Dashboard
cd web && npm install && npm run dev        # npm run dev -- --host para abrirlo desde el celular
npm run build && npm test
```

**Publicar en Vercel:** subir el repo a GitHub, importarlo en Vercel y poner **Root Directory = `web`**. Sin variables de entorno.

## 4. Limitaciones conocidas (decirlas en la tesis)

- La semana proyectada (2026-01-05) parte de 4 semanas con ventas muy bajas. El total proyectado es de **6 unidades** y no hay alertas.
- Las proyecciones se redondean a enteros, así que casi todos los platos quedan en 0. El detalle del plato muestra además el valor sin redondear.
- Con el modelo base vigente, el navegador usa la media móvil. El XGBoost exportado solo se usa si en el futuro pasa a ser el vigente.
- En el navegador, el estado de los platos usa la fecha de corte fija 2024-12-30 de la tesis. Con datos posteriores habría que parametrizarla.
- Datos de un solo restaurante del Reino Unido; la estacionalidad aprendida no es transferible a Colombia sin reentrenar.

## 5. Lo que falta

Las fases A a F del prompt están completas. El detalle final está en `RESULTADOS.md`.

- [ ] **Desplegar en Vercel.** El build estático y `vercel.json` están listos y verificados en local (`npm run build` y `npm run preview`), pero el despliegue real no se pudo ejecutar desde este entorno. Hay que importar el repositorio en Vercel con **Root Directory `web`**.
- [ ] **RNF-01:** prueba de uso con usuarios reales. Requiere participantes y queda como «No verificado».
- [ ] Pasar `results/tabla_resultados.tex` y `results/tabla_config_xgb.tex` a los Cuadros 7.1 y 6.2 del documento de tesis.
- [ ] Confirmar con el director el promedio semanal de 2024 y 2025 (el prompt dice 42,5 y 23,7; por semana de inicio sale 42,06 y 23,42).
- [ ] Opcional: repetir la LSTM con varias semillas para ver si su ventaja sobre el modelo base se sostiene.

## 5b. Cambios desde la primera versión de este resumen

- **LSTM hecha** (PyTorch): ventana 12, 64 unidades, dropout 0. Es el **modelo vigente** y **cumple el criterio de éxito** (mejora MAE y RMSE por plato frente al base), aunque por muy poco: MAE 0,485 frente a 0,500.
- XGBoost sigue sin cumplir el criterio.
- RNF-05 probado de verdad: se cambió el vigente a «Modelo base», se reexportó y el dashboard no necesitó cambios.
- Paridad de las variables de la semana siguiente (rezagos, media móvil, calendario, precio) entre Python y el navegador, probada.
- Contraste de color corregido (Caballo de arado, texto oscuro: 5,02:1) y vista de Demanda en celular con el gráfico arriba.
- Pruebas: `pytest` 11 y `vitest` 9, todas pasan; 21 de 21 verificaciones de Playwright.

## 6. Mapa de archivos

| Ruta | Contenido |
|---|---|
| `src/` | Python: ingesta, preparación, modelos, evaluación, ingeniería de menú, proyección diaria, entrenar y exportar |
| `tests/` | pytest |
| `results/` | métricas (csv), tablas `.tex`, figuras, búsqueda de hiperparámetros, versiones y capturas |
| `models/` | `modelo_vigente.csv`, `xgb_config.csv`, `xgb.ubj` y `lstm/` |
| `web/` | dashboard React (`src/lib/` tiene la lógica; `public/data/` los CSV exportados) |
| `scripts/verificar_web.cjs` | verificación de RNF-03 y RNF-04 con Playwright |
| `README.md`, `RESULTADOS.md` | instrucciones y resultados parciales |

## Actualización: datos en CSV y XGBoost con ventaneo

- **CSV en lugar de JSON:** todo lo que intercambian Python y la web ahora son tablas CSV (`web/public/data/`, `models/*.csv`, fixtures de prueba). El XGBoost del navegador se exporta como tabla de nodos (`modelo_xgb_arboles.csv`).
- **XGBoost en igualdad de condiciones con la LSTM:** misma ventana (se probaron 4, 8 y 12 semanas; ganó 12), mismas entradas por paso y mismas filas de evaluación. Su MAE por plato en prueba bajó a **0,432** (el más bajo), pero su RMSE y el total semanal siguen peores que los del modelo base, así que no cumple el criterio de éxito.
- **Modelo vigente:** sigue siendo la LSTM, elegida por validación (MAE 0,590 frente a 0,611 de XGBoost).
- Pruebas: `pytest` 14 y `vitest` 8, todas pasan; 21 de 21 verificaciones de Playwright.
