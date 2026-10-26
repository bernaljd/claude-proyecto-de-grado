# Estado del proyecto: DSS para restaurante PyME

Resumen para el equipo de tesis. Rama: `claude/new-session-a151ka`. Todas las cifras salen de ejecutar el código sobre `data/raw/Anonymized_Restaurant_Sales_Data.csv`.

## 1. Qué es y cómo está armado

- **Python (CRISP-DM):** prepara los datos, entrena y evalúa los modelos, y exporta JSON estáticos. Solo corre en el computador de los autores.
- **Dashboard (`web/`):** React + Vite + TypeScript, sitio estático sin servidor. Lee los JSON de `web/public/data/` y se publica en Vercel.
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
- `src/exportar.py` genera los JSON y el XGBoost para el navegador (`modelo_xgb.json` y `modelo_meta.json`).
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

### Obligatorio para el anteproyecto
- [ ] **Desplegar en Vercel.** El build y la configuración están listos, pero nadie ha hecho el despliegue real. Hay que importar el repo, poner Root Directory `web` y confirmar que el sitio publicado funciona.
- [ ] **Fase E: modelo LSTM.** El anteproyecto promete XGBoost y LSTM comparados con el modelo base. Falta todo: ventana de 8 semanas, 32 unidades, dropout, parada temprana, escalado solo con entrenamiento y ajuste en validación. Hay que agregar sus filas a las tablas comparativas y recalcular el modelo vigente.
- [ ] **Decidir qué hacer con que XGBoost no supera al base.** Opciones:
  - reportarlo tal cual y analizarlo (lo más honesto);
  - probar mejoras decididas **solo con validación**, nunca con prueba, por ejemplo evaluar con predicciones redondeadas o quitar los one-hot de plato;
  - ver si la LSTM mejora el resultado.
- [ ] **Fase F, cierre de `RESULTADOS.md`:**
  - cumplimiento por objetivo (OE2, OE3, OE4 y general);
  - configuración final de la LSTM;
  - Cuadro 7.1 completo;
  - análisis honesto (qué significa el MAE en unidades por plato y semana para planificar compras, y el efecto de la caída de demanda en el periodo de prueba).

### Pendiente menor
- [ ] Probar RNF-05 de verdad: cambiar el vigente a XGBoost, reexportar y comprobar que el dashboard no necesita cambios.
- [ ] Prueba de Python que compare la preparación del navegador con la de Python variable por variable (hoy se compara la serie, los estados, la proyección y el reparto, no cada columna de rezagos).
- [ ] Revisar contraste de color (4,5:1) y áreas táctiles de 44 px con una herramienta de accesibilidad; se aplicó en el diseño pero no se midió.
- [ ] En celular, la vista de Demanda muestra la lista larga antes que el gráfico del plato. Conviene subir el gráfico o colapsar la lista.
- [ ] Pasar `results/tabla_resultados.tex` y `results/tabla_config_xgb.tex` a los Cuadros 7.1 y 6.2 de la tesis (cuando esté la LSTM).
- [ ] Verificar contra el documento de tesis la discrepancia del promedio semanal de 2024 y 2025.

### Fuera de nuestro alcance
- [ ] **RNF-01:** prueba de uso con usuarios reales. Requiere participantes y queda como «No verificado».

## 6. Mapa de archivos

| Ruta | Contenido |
|---|---|
| `src/` | Python: ingesta, preparación, modelos, evaluación, ingeniería de menú, proyección diaria, entrenar y exportar |
| `tests/` | pytest |
| `results/` | métricas (json y csv), tablas `.tex`, figuras, búsqueda de hiperparámetros, versiones y capturas |
| `models/` | `modelo_vigente.json`, `xgb.json` y `xgb_config.json` |
| `web/` | dashboard React (`src/lib/` tiene la lógica; `public/data/` los JSON exportados) |
| `scripts/verificar_web.cjs` | verificación de RNF-03 y RNF-04 con Playwright |
| `README.md`, `RESULTADOS.md` | instrucciones y resultados parciales |
