import { SampleCtx, prisma, seedRows, bySampleId, dayOffset, atTime } from './common'

const HOUSEKEEPERS: Array<[string, string, string, string, number]> = [
  ['ama', 'Ama Serwaa', 'housekeeper', 'morning', 10],
  ['esi', 'Esi Nyarko', 'housekeeper', 'morning', 10],
  ['yaw', 'Yaw Boateng', 'supervisor', 'morning', 0],
  ['adwoa', 'Adwoa Manu', 'inspector', 'morning', 12],
]

const HALLS: Array<[string, string, number, string, number, string[]]> = [
  ['ball', 'Grand Ballroom', 200, 'banquet', 3500, ['Stage', 'Sound system', 'Air conditioning']],
  ['board', 'Boardroom', 20, 'meeting', 800, ['Projector', 'Whiteboard', 'Video conferencing']],
  ['pav', 'Garden Pavilion', 80, 'conference', 1800, ['Outdoor seating', 'Portable PA system']],
]

// name, description, price per head, category, minimum order
const CATERING: Array<[string, string, string, number, string, number]> = [
  ['bfast', 'Continental Breakfast Buffet', 'Pastries, fruit, eggs, tea and coffee', 95, 'breakfast', 10],
  ['lunch', 'Ghanaian Lunch Buffet', 'Jollof, waakye, grilled chicken, salads', 140, 'lunch', 10],
  ['dinner', 'Three-Course Dinner', 'Starter, main and dessert with a soft drink', 220, 'dinner', 15],
  ['coffee', 'Tea & Coffee Break', 'Hot drinks with light snacks', 45, 'snacks', 10],
  ['juice', 'Fresh Juice Station', 'Assorted fresh fruit juices', 35, 'beverages', 10],
  ['cocktail', 'Cocktail Reception Package', 'Canapes and two drinks per guest', 180, 'dinner', 20],
]

const RECIPES: Array<[string, string, string, number, string, string, Array<[string, number, string]>, string[]]> = [
  ['jollof', 'Jollof Rice & Chicken', 'main-course', 45, 'medium', '', [['Rice', 0.3, 'kg'], ['Chicken', 0.25, 'kg'], ['Tomatoes', 0.2, 'kg'], ['Cooking Oil', 0.05, 'ltr']], ['Season and brown the chicken.', 'Fry blended tomato base until the oil rises.', 'Add rice and stock; cook covered on low heat.', 'Serve with fried plantain.']],
  ['kelewele', 'Kelewele', 'snack', 15, 'easy', '', [['Plantain', 0.3, 'kg'], ['Cooking Oil', 0.1, 'ltr']], ['Cube ripe plantain and coat with ginger, pepper and salt.', 'Deep fry until golden and crisp.']],
  ['tilapia', 'Grilled Tilapia with Banku', 'main-course', 50, 'medium', 'Fish', [['Fresh Tilapia', 0.5, 'kg'], ['Tomatoes', 0.15, 'kg']], ['Score and season the fish.', 'Grill over medium heat, turning once.', 'Serve with banku and pepper sauce.']],
  ['waakye', 'Waakye with Stew', 'main-course', 60, 'medium', 'Eggs', [['Rice', 0.25, 'kg'], ['Tomatoes', 0.2, 'kg'], ['Cooking Oil', 0.05, 'ltr']], ['Cook rice and beans together with waakye leaves.', 'Serve with tomato stew, egg and gari.']],
]

// key, first, last, points, spent, visits
const CUSTOMERS: Array<[string, string, string, number, number, number]> = [
  ['c1', 'Kwesi', 'Appiah', 120, 1450, 9], ['c2', 'Naa', 'Ayorkor', 45, 520, 4], ['c3', 'Samuel', 'Tetteh', 210, 2680, 14], ['c4', 'Linda', 'Ofori', 15, 190, 2],
]

export async function loadOperations(ctx: SampleCtx) {
  const { p, tenantId } = ctx

  // Rooms for the cleaning and maintenance work come from the hotel's own room list, when it has one.
  const settings = await prisma.systemSettings.findUnique({ where: { tenantId } })
  const configured: Array<{ number: string }> = (((settings?.roomSettings as any)?.rooms as any[]) || []).filter((r) => r && r.number && r.isActive !== false)
  const room = (i: number) => configured[i % Math.max(configured.length, 1)]?.number

  // ---- housekeeping ----
  await seedRows(prisma.housekeepingStaff, HOUSEKEEPERS.map(([key, name, role, shift, target]) => ({
    id: `${p}hk_${key}`, tenantId, name, role, shift, dailyTarget: target, isActive: true, phone: '+233 24 600 0000',
  })))
  if (configured.length > 0) {
    const task = (n: number, roomIndex: number, taskType: string, status: string, priority: string, staff: string, notes: string, extra: Record<string, any> = {}) => {
      const [, name] = HOUSEKEEPERS.find((h) => h[0] === staff)!
      return { id: `${p}task_${n}`, tenantId, roomNumber: room(roomIndex), taskType, status, priority, assignedTo: `${p}hk_${staff}`, assignedName: name, notes, scheduledFor: dayOffset(ctx, 0), ...extra }
    }
    await seedRows(prisma.housekeepingTask, [
      task(1, 0, 'cleaning', 'completed', 'normal', 'ama', 'Departure clean', { startedAt: atTime(ctx, 0, 8, 10), completedAt: atTime(ctx, 0, 8, 55) }),
      task(2, 1, 'cleaning', 'in_progress', 'high', 'esi', 'Arrival at 14:00 — please prioritise', { startedAt: atTime(ctx, 0, 9, 30) }),
      task(3, 2, 'cleaning', 'pending', 'normal', 'ama', 'Stay-over service'),
      task(4, 3, 'inspection', 'pending', 'normal', 'adwoa', 'Inspect after cleaning'),
      task(5, 4, 'deep_clean', 'pending', 'low', 'esi', 'Monthly deep clean'),
      task(6, 5, 'turndown', 'pending', 'normal', 'ama', 'Evening turndown'),
    ])
    await seedRows(prisma.maintenanceRequest, [
      { id: `${p}mnt_1`, tenantId, roomNumber: room(1), category: 'plumbing', priority: 'high', status: 'open', description: 'Bathroom tap is leaking', reportedBy: 'Ama Serwaa', estimatedCost: 120 },
      { id: `${p}mnt_2`, tenantId, roomNumber: room(3), category: 'hvac', priority: 'normal', status: 'in_progress', description: 'Air conditioner is not cooling', reportedBy: 'Yaw Boateng', assignedTo: 'Maintenance team', estimatedCost: 350 },
      { id: `${p}mnt_3`, tenantId, location: 'Second-floor corridor', category: 'electrical', priority: 'low', status: 'completed', description: 'Replaced two corridor bulbs', reportedBy: 'Yaw Boateng', assignedTo: 'Maintenance team', estimatedCost: 30, actualCost: 30, resolvedAt: dayOffset(ctx, -1) },
    ])
  }

  // ---- events ----
  await seedRows(prisma.conferenceHall, HALLS.map(([key, name, capacity, type, price, features]) => ({ id: `${p}hall_${key}`, tenantId, name, capacity, type, price, features, status: 'available' })))
  await seedRows(prisma.cateringItem, CATERING.map(([key, name, description, price, category, minimumOrder]) => ({ id: `${p}cat_${key}`, tenantId, name, description, price, category, minimumOrder, available: true })))
  const booking = (n: number, title: string, organizer: string, hall: string, from: number, to: number, attendees: number, status: string, type: string, extra: Record<string, any>) => {
    const [, hallName] = HALLS.find((h) => h[0] === hall)!
    return { id: `${p}evt_${n}`, tenantId, title, organizer, contactPerson: organizer, contactPhone: '+233 24 800 0000', contactEmail: `events${n}@sample.hotel`, hallId: `${p}hall_${hall}`, hallName, startDate: dayOffset(ctx, from), endDate: dayOffset(ctx, to), startTime: '09:00', endTime: '17:00', attendees, status, type, ...extra }
  }
  await seedRows(prisma.eventBooking, [
    booking(1, 'Sample Mining Annual Meeting', 'Sample Mining Ltd', 'board', 14, 14, 18, 'confirmed', 'corporate', { catering: true, audioVisual: true, totalCost: 800 + 18 * 140 }),
    booking(2, 'Owusu–Mensah Wedding Reception', 'Mrs. Owusu', 'ball', 30, 30, 150, 'confirmed', 'wedding', { catering: true, decoration: true, totalCost: 3500 + 150 * 220 }),
    booking(3, 'Front Office Staff Seminar', 'Sample Hotel HR', 'pav', 7, 7, 40, 'pending', 'seminar', { catering: true, totalCost: 1800 + 40 * 45 }),
  ])

  // ---- restaurant: tables, regular customers, recipes ----
  const existingTables = new Set((await prisma.restaurantTable.findMany({ where: { tenantId }, select: { number: true } })).map((t) => t.number))
  const tables = Array.from({ length: 8 }, (_, i) => ({ number: `T${i + 1}`, capacity: i < 4 ? 2 : i < 7 ? 4 : 8, section: i < 5 ? 'main floor' : i < 7 ? 'patio' : 'bar' }))
    .filter((t) => !existingTables.has(t.number))
  await seedRows(prisma.restaurantTable, tables.map((t) => ({ id: `${p}tbl_${t.number}`, tenantId, ...t, status: 'available' })))
  await seedRows(prisma.fBCustomer, CUSTOMERS.map(([key, firstName, lastName, loyaltyPoints, totalSpent, visitCount]) => ({
    id: `${p}${key}`, tenantId, firstName, lastName, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@sample.hotel`, phone: '+233 24 900 0000', loyaltyPoints, totalSpent, visitCount, lastVisit: dayOffset(ctx, -(visitCount % 6) - 1), isActive: true,
  })))
  await seedRows(prisma.recipe, RECIPES.map(([key, name, category, preparationTime, difficulty, allergens, ingredients, instructions]) => ({
    id: `${p}rcp_${key}`, tenantId, name, category, preparationTime, difficulty, allergens: allergens || null,
    ingredients: ingredients.map(([ingredient, quantity, unit]) => ({ name: ingredient, quantity, unit })), instructions,
  })))
}

export async function removeOperations(ctx: SampleCtx) {
  const where = bySampleId(ctx)
  await prisma.housekeepingTask.deleteMany({ where })
  await prisma.housekeepingStaff.deleteMany({ where })
  await prisma.maintenanceRequest.deleteMany({ where })
  await prisma.eventBooking.deleteMany({ where })
  await prisma.cateringItem.deleteMany({ where })
  await prisma.conferenceHall.deleteMany({ where })
  await prisma.tableReservation.deleteMany({ where: { tenantId: ctx.tenantId, tableId: { startsWith: ctx.p } } })
  await prisma.restaurantTable.deleteMany({ where })
  await prisma.fBCustomer.deleteMany({ where })
  await prisma.recipe.deleteMany({ where })
}

export async function countOperations(ctx: SampleCtx) {
  return {
    housekeepingTasks: await prisma.housekeepingTask.count({ where: bySampleId(ctx) }),
    events: await prisma.eventBooking.count({ where: bySampleId(ctx) }),
    recipes: await prisma.recipe.count({ where: bySampleId(ctx) }),
  }
}
