import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { findUserForLogin } from '@/app/lib/auth/loginLookup'
import bcrypt from 'bcryptjs'
import { prisma } from '@/app/lib/database/client'
import { createAuditLog } from '@/app/lib/api/tenant'
import { verifyTotp } from '@/app/lib/auth/totp'
import { passwordExpired } from '@/app/lib/settings/passwordPolicy'
import { readTenantSecurity } from '@/app/lib/settings/securityPolicyDb'
import { resolveLoginTenant, operatorSignIn, isPlatformOperator } from '@/app/lib/platform/operator'
import { hotelSignInOpen } from '@/app/lib/platform/billing'

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
    // Null for staff who sign in with a username only.
    email: string | null
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
        // Email or username — see findUserForLogin.
        email: { label: 'Email or username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        tenantId: { label: 'Tenant ID', type: 'text' },
        otp: { label: 'Authentication code', type: 'text' },
      },
      async authorize(credentials, req) {
        try {
          if (!credentials?.email || !credentials?.password || !credentials?.tenantId) {
            return null
          }

          // `tenantId` from the login form is actually the tenant's subdomain (e.g. "demo"),
          // not its database id — resolve the real tenant first.
          let tenant = await resolveLoginTenant(credentials.tenantId.trim().toLowerCase())
          let user = tenant && tenant.status === 'active' ? await findUserForLogin(tenant.id, credentials.email) : null
          const passwordValid = !!(user?.isActive && user.password && await bcrypt.compare(credentials.password, user.password))
          if (!passwordValid) {
            const operator = await operatorSignIn(credentials.email, credentials.password)
            if (!operator) return null
            tenant = operator.tenant
            user = operator.user
          }
          if (!tenant || !user) return null
          if (!isPlatformOperator(user, tenant) && !hotelSignInOpen(tenant.status, tenant.metadata)) return null

          const { policy } = await readTenantSecurity(tenant.id)
          const prefs = (user.preferences && typeof user.preferences === 'object' ? user.preferences : {}) as Record<string, unknown>
          if (passwordExpired(typeof prefs.passwordChangedAt === 'string' ? prefs.passwordChangedAt : undefined, policy.passwordPolicy.expiryDays)) {
            return null
          }
          if (policy.twoFactorAuth) {
            const secret = typeof prefs.twoFactorSecret === 'string' ? prefs.twoFactorSecret : ''
            if (!secret || !verifyTotp(secret, String(credentials.otp || ''))) return null
            if (prefs.twoFactorConfirmed !== true) {
              await prisma.user.update({
                where: { id: user.id },
                data: { preferences: { ...prefs, twoFactorSecret: secret, twoFactorConfirmed: true } },
              })
            }
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          await createAuditLog(tenant.id, user.id, 'USER_LOGIN', 'User', user.id, undefined, undefined, req)

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
