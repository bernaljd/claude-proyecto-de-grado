# Resultados (parcial: fases A–D)

Pendiente: LSTM (fase E) y cierre completo (fase F). Las cifras salen de ejecutar el código sobre el CSV.

## Métricas en prueba (`results/metricas.json`)
| Modelo | MAE / RMSE / SMAPE por plato | MAE / RMSE / SMAPE total semanal |
|---|---|---|
| Base (mm4) | 0,500 / 0,871 / 102,6 | 9,52 / 11,73 / 62,5 |
| XGBoost | 0,558 / 0,841 / 176,2 | 9,85 / 12,36 / 59,4 |

XGBoost (`reg:tweedie` 1,5; profundidad 6; tasa 0,1; 99 árboles) **no cumple** el criterio de éxito (mejora 1 de 3 métricas).
Por la regla CA-07 (menor MAE en validación) el modelo vigente es el **modelo base**. El entrenamiento usa 4.545 filas.

## Estado de requisitos
| Requisito | Resultado | Evidencia |
|---|---|---|
| RF-01/02 carga y validación del CSV | Cumple | `scripts/verificar_web.cjs`, `web/src/lib/lib.test.ts` |
| RF-03…RF-11 vistas | Cumple | `results/capturas/` |
| RNF-03 sin desplazamiento horizontal (360/768/1280) | Cumple | `verificar_web.cjs` |
| RNF-04 carga < 3 s | Cumple (≈0,6 s) | ídem |
| RNF-05 cambiar el modelo vigente sin tocar el dashboard | Cumple por diseño (`modelo_meta.json`); no probado con XGBoost como vigente | — |
| RNF-01 usuarios reales | No verificado (requiere participantes) | — |
| Sitio estático / Vercel | Build y `vercel.json` listos; el despliegue en Vercel no se ejecutó desde aquí | README |

## Limitaciones
- La semana proyectada (2026-01-05) parte de 4 semanas con ventas muy bajas: proyección total de 6 unidades y sin alertas.
- Las proyecciones se redondean a enteros, así que la mayoría de platos queda en 0; el detalle muestra el valor sin redondear.
- Un solo restaurante del Reino Unido; la estacionalidad no es transferible a Colombia sin reentrenar.
- En el navegador, el estado de los platos usa la fecha de corte fija 2024-12-30 de la tesis.
