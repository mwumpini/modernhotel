import { prisma } from '../database/client'

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

/** Ownership-checked upsert — see tablesRepository.ts for the full rationale. */
async function ownershipCheckedUpsert<T>(
  model: { findUnique: (args: any) => Promise<any>; create: (args: any) => Promise<T>; update: (args: any) => Promise<T> },
  id: string,
  tenantId: string,
  data: Record<string, any>,
  createExtra: Record<string, any> = {},
): Promise<T> {
  const existing = await model.findUnique({ where: { id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Record belongs to a different tenant')
  }
  if (existing) {
    return model.update({ where: { id }, data })
  }
  return model.create({ data: { id, tenantId, ...createExtra, ...data } })
}

function toStoreRecipe(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    preparationTime: row.preparationTime,
    difficulty: row.difficulty,
    allergens: row.allergens ? row.allergens.split(',').map((a: string) => a.trim()).filter(Boolean) : [],
    menuItemId: row.menuItemId || null,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    instructions: Array.isArray(row.instructions) ? row.instructions : [],
    isActive: row.isActive !== false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listRecipes(tenantId: string) {
  const rows = await prisma.recipe.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  return rows.map(toStoreRecipe)
}

export async function upsertRecipe(tenantId: string, id: string, recipe: Record<string, any>) {
  const data = stripUndefined({
    name: recipe.name,
    category: recipe.category,
    preparationTime: recipe.preparationTime,
    difficulty: recipe.difficulty,
    allergens: recipe.allergens,
    menuItemId: recipe.menuItemId === undefined ? undefined : (recipe.menuItemId || null),
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    isActive: recipe.isActive,
  })
  const row = await ownershipCheckedUpsert(prisma.recipe, id, tenantId, data, {
    name: recipe.name,
    category: recipe.category,
    menuItemId: recipe.menuItemId || null,
    ingredients: recipe.ingredients ?? [],
    instructions: recipe.instructions ?? [],
    isActive: recipe.isActive !== false,
  })
  return toStoreRecipe(row)
}

export async function deleteRecipe(tenantId: string, id: string) {
  const existing = await prisma.recipe.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.recipe.delete({ where: { id } })
  return true
}
