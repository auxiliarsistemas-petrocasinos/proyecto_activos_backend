import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const workbookPath = 'C:\\Users\\SISTE\\Downloads\\03 MARZO 2026 - GA FO 02 - 199 HIDROITUANGO EPM.xlsx'
const pythonPath = 'C:\\Users\\SISTE\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe'
const exerciseDate = new Date('2026-03-01T12:00:00.000Z')

const pythonScript = String.raw`
import json, openpyxl, sys

path = sys.argv[1]
wb = openpyxl.load_workbook(path, data_only=True, read_only=True)

def clean(value):
    if value is None:
        return None
    value = ' '.join(str(value).replace('�', 'ó').split())
    return value or None

fixed = []
for row in list(wb['Activos fijos'].iter_rows(values_only=True))[9:]:
    if not row or not row[0] or not row[2]:
        continue
    fixed.append({
        'name': clean(row[2]),
        'reference': clean(row[1]),
        'detail1': clean(row[0]),
        'detail2': clean(row[3]),
        'quantity': 1,
        'category': 'Activos fijos',
        'location': 'Bodega Principal',
        'locationType': 'GENERAL_WAREHOUSE'
    })

menaje = []
for row in list(wb['Menaje'].iter_rows(values_only=True))[9:]:
    if not row or not row[0]:
        continue
    quantity = int(row[4] or 0)
    menaje.append({
        'name': clean(row[0]),
        'reference': None,
        'detail1': None,
        'detail2': None,
        'quantity': quantity,
        'category': 'Menaje',
        'location': 'Bodega Principal',
        'locationType': 'GENERAL_WAREHOUSE'
    })

client = []
for row in list(wb['Activos clientes - Proveedores'].iter_rows(values_only=True))[10:]:
    if not row or not row[2] or clean(row[2]) == 'Desc. item':
        continue
    location = clean(row[8]) or 'Bodega Principal'
    client.append({
        'name': clean(row[2]),
        'reference': clean(row[0]),
        'detail1': clean(row[4]),
        'detail2': location,
        'quantity': int(row[5] or 0),
        'category': 'Activos clientes/proveedores',
        'location': location,
        'locationType': 'SECONDARY_WAREHOUSE'
    })

print(json.dumps({'fixed': fixed, 'menaje': menaje, 'client': client}, ensure_ascii=False))
`

const extracted = JSON.parse(execFileSync(pythonPath, ['-c', pythonScript, workbookPath], { encoding: 'utf8' }))
const records = [...extracted.fixed, ...extracted.menaje, ...extracted.client]
const prisma = new PrismaClient()

async function findOrCreateField(tx, name) {
  const found = await tx.$queryRawUnsafe('SELECT "id" FROM "Field" WHERE "name" = $1 LIMIT 1', name)
  if (found[0]) return found[0].id
  const created = await tx.$queryRawUnsafe(
    'INSERT INTO "Field" ("id", "name", "active", "createdAt", "updatedAt") VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING "id"',
    randomUUID(), name
  )
  return created[0].id
}

async function findOrCreateLocation(tx, fieldId, name, type) {
  const found = await tx.$queryRawUnsafe(
    'SELECT "id" FROM "Location" WHERE "name" = $1 AND "type" = $2::"LocationType" AND "fieldId" = $3 AND "parentId" IS NULL LIMIT 1',
    name, type, fieldId
  )
  if (found[0]) return found[0].id
  const created = await tx.$queryRawUnsafe(
    'INSERT INTO "Location" ("id", "name", "type", "fieldId") VALUES ($1, $2, $3::"LocationType", $4) RETURNING "id"',
    randomUUID(), name, type, fieldId
  )
  return created[0].id
}

try {
  const result = await prisma.$transaction(async (tx) => {
    const fieldId = await findOrCreateField(tx, 'Hidroituango EPM')
    const locations = new Map()
    let createdItems = 0
    let createdMovements = 0
    let totalUnits = 0
    const byCategory = {}

    for (const record of records) {
      const locationKey = `${record.location}|${record.locationType}`
      let locationId = locations.get(locationKey)
      if (!locationId) {
        locationId = await findOrCreateLocation(tx, fieldId, record.location, record.locationType)
        locations.set(locationKey, locationId)
      }

      const existing = await tx.$queryRawUnsafe(
        'SELECT "id" FROM "Item" WHERE "name" = $1 AND "reference" IS NOT DISTINCT FROM $2 AND "detail1" IS NOT DISTINCT FROM $3 AND "detail2" IS NOT DISTINCT FROM $4 LIMIT 1',
        record.name, record.reference, record.detail1, record.detail2
      )
      const itemId = existing[0]?.id ?? (await tx.$queryRawUnsafe(
        'INSERT INTO "Item" ("id", "name", "reference", "detail1", "detail2", "category", "unit", "active", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING "id"',
        randomUUID(), record.name, record.reference, record.detail1, record.detail2, record.category, 'unidad'
      ))[0].id
      if (!existing[0]) createdItems += 1

      if (record.quantity > 0) {
        const movementExists = await tx.$queryRawUnsafe(
          'SELECT "id" FROM "Movement" WHERE "type" = $1::"MovementType" AND "itemId" = $2 AND "targetLocationId" = $3 AND "quantity" = $4 AND "exerciseDate" = $5 LIMIT 1',
          'INITIAL_BALANCE', itemId, locationId, record.quantity, exerciseDate
        )
        if (!movementExists[0]) {
          await tx.$executeRawUnsafe(
            'INSERT INTO "Movement" ("id", "type", "itemId", "quantity", "targetLocationId", "reason", "exerciseDate", "createdAt") VALUES ($1, $2::"MovementType", $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)',
            randomUUID(), 'INITIAL_BALANCE', itemId, record.quantity, locationId, 'Carga de inventario inicial Hidroituango EPM', exerciseDate
          )
          createdMovements += 1
        }
      }

      totalUnits += record.quantity
      byCategory[record.category] ??= { records: 0, units: 0 }
      byCategory[record.category].records += 1
      byCategory[record.category].units += record.quantity
    }

    return {
      fieldId,
      locations: [...locations.keys()],
      records: records.length,
      createdItems,
      createdMovements,
      totalUnits,
      byCategory
    }
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await prisma.$disconnect()
}
