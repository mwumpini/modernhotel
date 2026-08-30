import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/app/lib/database/client'

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      tenantId: string
      role: string
      tenant: {
        id: string
        name: string
        subdomain: string
        plan: string
        status: string
      }
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: string
    tenantId: string
    tenant: {
      id: string
      name: string
      subdomain: string
      plan: string
      status: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId: string
    role: string
    tenant: {
      id: string
      name: string
      subdomain: string
      plan: string
      status: string
    }
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantId: { label: 'Tenant ID', type: 'text' }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password || !credentials?.tenantId) {
            return null
          }

          // `tenantId` from the login form is actually the tenant's subdomain (e.g. "demo"),
          // not its database id — resolve the real tenant first.
          const tenant = await prisma.tenant.findUnique({
            where: { subdomain: credentials.tenantId.trim().toLowerCase() },
          })
          if (!tenant || tenant.status !== 'active') return null

          const user = await prisma.user.findUnique({
            where: { tenantId_email: { tenantId: tenant.id, email: credentials.email } },
          })
          if (!user || !user.isActive || !user.password) return null

          const passwordValid = await bcrypt.compare(credentials.password, user.password)
          if (!passwordValid) return null

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: tenant.id,
            tenant: {
              id: tenant.id,
              name: tenant.name,
              subdomain: tenant.subdomain,
              plan: tenant.plan,
              status: tenant.status,
            },
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          token.tenantId = user.tenantId
          token.role = user.role
          token.tenant = user.tenant
        }
        return token
      } catch (error) {
        console.error('JWT callback error:', error)
        return token
      }
    },
    async session({ session, token }) {
      try {
        if (token) {
          session.user.id = token.sub!
          session.user.tenantId = token.tenantId as string
          session.user.role = token.role as string
          session.user.tenant = token.tenant as any
        }
        return session
      } catch (error) {
        console.error('Session callback error:', error)
        return session
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development'
}
