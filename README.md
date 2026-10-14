# API de control de inventarios

Backend inicial para controlar menaje por elemento y ubicación.

## Regla de inventario

`saldo final = saldo inicial + entradas - salidas - bajas`

Los traslados generan una salida en el origen y una entrada en el destino, sin modificar el inventario total de la organización.

## Estructura inicial

- `Item`: elemento de menaje.
- `Location`: bodega general, bodega secundaria o comedor.
- `Movement`: compra, traslado o baja, con fecha y trazabilidad.
- `Balance`: inventario inicial y final de un elemento por ubicación y ejercicio.

## Puesta en marcha

1. Copiar `.env.example` a `.env`.
2. Crear la base de datos PostgreSQL.
3. Ejecutar `npm install`.
4. Ejecutar `npx prisma generate`.
5. Ejecutar `npx prisma migrate dev --name initial_inventory`.
