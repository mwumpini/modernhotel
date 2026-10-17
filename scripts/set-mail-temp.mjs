import { PrismaClient } from '@prisma/client'

const pass = process.env.SMTP_PASS || ''
const prisma = new PrismaClient()
const tenant = await prisma.tenant.findUnique({ where: { subdomain: 'demo' } })
if (!tenant) throw new Error('missing demo hotel')
const metadata = (tenant.metadata && typeof tenant.metadata === 'object') ? { ...tenant.metadata } : {}
if (process.argv[2] === 'clear') {
  delete metadata.mail
} else {
  if (!pass) throw new Error('missing password')
  metadata.mail = {
    host: 'mail.menishhotel.com',
    port: 465,
    user: 'marketing@menishhotel.com',
    pass,
  }
}
await prisma.tenant.update({ where: { id: tenant.id }, data: { metadata } })
console.log(process.argv[2] === 'clear' ? 'cleared' : 'set')
await prisma.$disconnect()
