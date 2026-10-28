import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const workbookPath = 'C:\\Users\\SISTE\\Downloads\\10 OCTUBRE 2026 - GA FO 02 - 007 CAMPO L.xlsx'
const pythonPath = 'C:\\Users\\SISTE\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe'
const pythonScript = String.raw`
import json, sys, openpyxl
path = sys.argv[1]
ws = openpyxl.load_workbook(path, data_only=True, read_only=True)['Menaje']
rows = list(ws.iter_rows(values_only=True))
records = []
for row in rows[9:]:
    if row[0] in (None, ''):
        continue
    records.append({
        'reference': str(row[0]).strip(),
        'name': ' '.join(str(row[1] or '').split()),
        'detail1': ' '.join(str(row[2] or '').split()) or None,
        'detail2': ' '.join(str(row[3] or '').split()) or None,
        'quantity': int(row[4] or 0)
    })
print(json.dumps(records, ensure_ascii=False))
`

const records = JSON.parse(execFileSync(pythonPath, ['-c', pythonScript, workbookPath], { encoding: 'utf8' }))
const prisma = new PrismaClient()

try {
  const result = await prisma.$transaction(async (tx) => {
    const fieldRows = await tx.$queryRawUnsafe('SELECT "id" FROM "Field" WHERE "name" = $1 LIMIT 1', 'Campo L')
    const fieldId = fieldRows[0]?.id ?? (await tx.$queryRawUnsafe(
      'INSERT INTO "Field" ("id", "name", "active", "createdAt", "updatedAt") VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING "id"',
      randomUUID(), 'Campo L'
    ))[0].id

    const locationRows = await tx.$queryRawUnsafe(
      'SELECT "id" FROM "Location" WHERE "name" = $1 AND "type" = $2::"LocationType" AND "fieldId" = $3 LIMIT 1',
      'Bodega Principal', 'GENERAL_WAREHOUSE', fieldId
    )
    const locationId = locationRows[0]?.id ?? (await tx.$queryRawUnsafe(
      'INSERT INTO "Location" ("id", "name", "type", "fieldId") VALUES ($1, $2, $3::"LocationType", $4) RETURNING "id"',
      randomUUID(), 'Bodega Principal', 'GENERAL_WAREHOUSE', fieldId
    ))[0].id

    let createdItems = 0
    let createdMovements = 0
    for (const record of records) {
      const existing = await tx.$queryRawUnsafe(
        'SELECT "id" FROM "Item" WHERE "name" = $1 AND "reference" = $2 AND "detail1" IS NOT DISTINCT FROM $3 AND "detail2" IS NOT DISTINCT FROM $4 LIMIT 1',
        record.name, record.reference, record.detail1, record.detail2
      )
      const itemId = existing[0]?.id ?? (await tx.$queryRawUnsafe(
        'INSERT INTO "Item" ("id", "name", "reference", "detail1", "detail2", "category", "unit", "active", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING "id"',
        randomUUID(), record.name, record.reference, record.detail1, record.detail2, 'Menaje', 'unidad'
      ))[0].id
      if (!existing[0]) createdItems += 1

      const movementExists = await tx.$queryRawUnsafe(
        'SELECT "id" FROM "Movement" WHERE "type" = $1::"MovementType" AND "itemId" = $2 AND "targetLocationId" = $3 AND "quantity" = $4 AND "exerciseDate" = $5 LIMIT 1',
        'INITIAL_BALANCE', itemId, locationId, record.quantity, new Date('2026-10-01T12:00:00.000Z')
      )
      if (!movementExists[0] && record.quantity > 0) {
        await tx.$executeRawUnsafe(
          'INSERT INTO "Movement" ("id", "type", "itemId", "quantity", "targetLocationId", "reason", "exerciseDate", "createdAt") VALUES ($1, $2::"MovementType", $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)',
          randomUUID(), 'INITIAL_BALANCE', itemId, record.quantity, locationId, 'Carga de inventario inicial Campo L', new Date('2026-10-01T12:00:00.000Z')
        )
        createdMovements += 1
      }
    }
    return { fieldId, locationId, records: records.length, createdItems, createdMovements, totalUnits: records.reduce((sum, item) => sum + item.quantity, 0) }
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await prisma.$disconnect()
}
