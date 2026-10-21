# Control de inventarios

Aplicación para controlar menaje por elemento y ubicación. Incluye un panel web operativo servido por el mismo proceso Express.

## Regla de inventario

`saldo final = saldo inicial + entradas - salidas - bajas`

Los traslados generan una salida en el origen y una entrada en el destino, sin modificar el inventario total de la organización.

## Estructura inicial

- `Item`: elemento de menaje.
- `Location`: bodega general, bodega secundaria o comedor.
- `Movement`: compra, traslado o baja, con fecha y trazabilidad.
- `Balance`: inventario inicial y final de un elemento por ubicación y ejercicio.

## Frontend

La interfaz está en `public/` y se sirve automáticamente desde Express. Incluye:

- Resumen con métricas, distribución por ubicación y actividad reciente.
- Inventario consultable por elemento y ubicación.
- Historial de compras, traslados y bajas.
- Catálogo de elementos y ubicaciones.
- Registro de movimientos desde un formulario operativo.

## Puesta en marcha

1. En pgAdmin 4, crear o seleccionar una base de datos llamada `AppMenaje` dentro del servidor PostgreSQL local.
2. Copiar `.env.example` a `.env` y reemplazar `TU_PASSWORD` por la contraseña del usuario PostgreSQL.
3. Verificar que `localhost` y `5432` coincidan con el host y puerto configurados en pgAdmin 4.
4. Ejecutar `npm install`.
5. Ejecutar `npx prisma generate`.
6. Ejecutar `npx prisma migrate dev --name initial_inventory`.
7. Ejecutar `npm run dev` y abrir `http://localhost:3000`.
8. Confirmar la conexión en `http://localhost:3000/health/db`.

pgAdmin 4 no recibe conexiones directamente: el backend se conecta al servidor PostgreSQL que pgAdmin administra mediante `DATABASE_URL`.
