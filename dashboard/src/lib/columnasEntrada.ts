// Las 14 columnas que exige M1 (las del CSV de ventas original del restaurante).
// Si falta alguna, M1 se detiene; la vista «Cargar datos» valida lo mismo en el
// navegador antes de que el usuario corra el pipeline.
export const COLUMNAS_ENTRADA = [
  'OrderID',
  'Date',
  'DayOfWeek',
  'Time',
  'Category',
  'Line item name',
  'Quantity',
  'Price Per Item',
  'Gross Sales',
  'Est. Cost',
  'Est. Profit',
  'OrderType',
  'Payment',
  'Cancelled',
] as const;

// Qué significa cada columna, en lenguaje operativo
export const DESCRIPCION_COLUMNAS: Record<string, string> = {
  OrderID: 'número del pedido',
  Date: 'fecha del pedido (día/mes/año)',
  DayOfWeek: 'día de la semana',
  Time: 'hora del pedido',
  Category: 'categoría del menú',
  'Line item name': 'nombre del plato',
  Quantity: 'cantidad pedida',
  'Price Per Item': 'precio por unidad',
  'Gross Sales': 'venta de la línea',
  'Est. Cost': 'costo estimado',
  'Est. Profit': 'ganancia estimada',
  OrderType: 'tipo de pedido (mesa, domicilio…)',
  Payment: 'medio de pago',
  Cancelled: 'si el pedido fue cancelado (Yes/No)',
};
