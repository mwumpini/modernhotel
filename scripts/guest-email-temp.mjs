import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const guest = await prisma.guest.findFirst({
  where: { name: 'Fuseini Alhassan' },
  select: { id: true, email: true },
})
if (!guest) throw new Error('guest missing')
if (process.argv[2] === 'set') {
  await prisma.guest.update({ where: { id: guest.id }, data: { email: 'mwumpini@gmail.com' } })
  console.log('set', guest.id, 'was', guest.email || '')
} else {
  await prisma.guest.update({ where: { id: guest.id }, data: { email: process.argv[2] === 'empty' ? null : guest.email } })
  console.log('restored')
}
await prisma.$disconnect()
