import NextAuth from 'next-auth'
import { authOptions } from '@/app/lib/auth/auth'

export const { auth, handlers: { GET, POST } } = NextAuth(authOptions)
