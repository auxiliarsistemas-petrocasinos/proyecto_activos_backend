import express, { NextFunction, Request, Response } from 'express'
import { Prisma, PrismaClient, LocationType, MovementType } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()
const app = express()
app.use(express.json())

const positiveInt = z.number().int().positive()

const itemSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).default('unidad')
})

const locationSchema = z.object({
  name: z.string().trim().min(1),
  type: z.nativeEnum(LocationType),
  parentId: z.string().uuid().optional()
})

const movementSchema = z.object({
  type: z.nativeEnum(MovementType),
  itemId: z.string().uuid(),
  quantity: positiveInt,
  sourceLocationId: z.string().uuid().optional(),
  targetLocationId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).optional(),
  exerciseDate: z.coerce.date().optional()
})

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/items', async (req, res) => {
  const data = itemSchema.parse(req.body)
  const item = await prisma.item.create({ data })
  res.status(201).json(item)
})

app.get('/api/items', async (_req, res) => {
  const items = await prisma.item.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
  res.json(items)
})

app.post('/api/locations', async (req, res) => {
  const data = locationSchema.parse(req.body)

  if (data.type === LocationType.GENERAL_WAREHOUSE && data.parentId) {
    throw new ApiError(400, 'La bodega general no puede tener una ubicación superior')
  }

  if (data.type !== LocationType.GENERAL_WAREHOUSE && !data.parentId) {
    throw new ApiError(400, 'Las bodegas secundarias y comedores requieren una ubicación superior')
  }

  if (data.parentId) {
    const parent = await prisma.location.findUnique({ where: { id: data.parentId } })
    if (!parent) throw new ApiError(404, 'Ubicación superior no encontrada')
    const validParent = data.type === LocationType.SECONDARY_WAREHOUSE
      ? parent.type === LocationType.GENERAL_WAREHOUSE
      : parent.type === LocationType.SECONDARY_WAREHOUSE
    if (!validParent) {
      throw new ApiError(400, 'La jerarquía de ubicaciones no es válida')
    }
  }

  const location = await prisma.location.create({ data })
  res.status(201).json(location)
})

app.get('/api/locations', async (req, res) => {
  const type = req.query.type ? z.nativeEnum(LocationType).parse(req.query.type) : undefined
  const locations = await prisma.location.findMany({
    where: { type },
    include: { parent: true },
    orderBy: { name: 'asc' }
  })
  res.json(locations)
})

app.post('/api/movements', async (req, res) => {
  const data = movementSchema.parse(req.body)

  if (data.type === MovementType.PURCHASE && (!data.targetLocationId || data.sourceLocationId)) {
    throw new ApiError(400, 'Una compra requiere destino y no puede tener origen')
  }

  if (data.type === MovementType.TRANSFER && (!data.sourceLocationId || !data.targetLocationId)) {
    throw new ApiError(400, 'Un traslado requiere origen y destino')
  }

  if (data.type === MovementType.WRITE_OFF && (!data.sourceLocationId || data.targetLocationId)) {
    throw new ApiError(400, 'Una baja requiere origen y no puede tener destino')
  }

  if (data.sourceLocationId === data.targetLocationId) {
    throw new ApiError(400, 'El origen y el destino deben ser diferentes')
  }

  const movement = await prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: data.itemId } })
    if (!item || !item.active) throw new ApiError(404, 'Elemento no encontrado o inactivo')

    const locationIds = [data.sourceLocationId, data.targetLocationId].filter(Boolean) as string[]
    const locations = await tx.location.findMany({ where: { id: { in: locationIds } } })
    if (locations.length !== locationIds.length) throw new ApiError(404, 'Ubicación no encontrada')

    if (data.sourceLocationId && data.type !== MovementType.PURCHASE) {
      const balance = await calculateBalance(tx, data.itemId, data.sourceLocationId)
      if (balance < data.quantity) throw new ApiError(409, 'Existencia insuficiente en la ubicación de origen')
    }

    return tx.movement.create({ data })
  })

  res.status(201).json(movement)
})

app.get('/api/inventory', async (req, res) => {
  const { itemId, locationId } = z.object({
    itemId: z.string().uuid(),
    locationId: z.string().uuid()
  }).parse(req.query)
  const movements = await prisma.movement.findMany({
    where: { itemId, OR: [{ sourceLocationId: locationId }, { targetLocationId: locationId }] },
    orderBy: { exerciseDate: 'asc' }
  })

  const inventory = movements.reduce((total, movement) => {
    if (movement.targetLocationId === locationId) return total + movement.quantity
    if (movement.sourceLocationId === locationId) return total - movement.quantity
    return total
  }, 0)

  res.json({ itemId, locationId, quantity: inventory, movements })
})

async function calculateBalance(tx: Prisma.TransactionClient, itemId: string, locationId: string) {
  const movements = await tx.movement.findMany({
    where: { itemId, OR: [{ sourceLocationId: locationId }, { targetLocationId: locationId }] },
    select: { quantity: true, sourceLocationId: true, targetLocationId: true }
  })
  return movements.reduce((total, movement) => {
    if (movement.targetLocationId === locationId) return total + movement.quantity
    if (movement.sourceLocationId === locationId) return total - movement.quantity
    return total
  }, 0)
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', details: error.issues })
  }
  if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
  console.error(error)
  return res.status(500).json({ error: 'Error interno del servidor' })
})

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => console.log(`API escuchando en http://localhost:${port}`))
