import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

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

// Mock user data for development
const mockUsers = [
  {
    id: '1',
    email: 'admin@demohotel.com',
    name: 'Admin User',
    role: 'admin',
    tenantId: 'demo',
    tenant: {
      id: 'demo',
      name: 'Demo Hotel Accra',
      subdomain: 'demo',
      plan: 'professional',
      status: 'active'
    }
  },
  {
    id: '2',
    email: 'manager@demohotel.com',
    name: 'Manager User',
    role: 'manager',
    tenantId: 'demo',
    tenant: {
      id: 'demo',
      name: 'Demo Hotel Accra',
      subdomain: 'demo',
      plan: 'professional',
      status: 'active'
    }
  },
  {
    id: '3',
    email: 'staff@demohotel.com',
    name: 'Staff User',
    role: 'staff',
    tenantId: 'demo',
    tenant: {
      id: 'demo',
      name: 'Demo Hotel Accra',
      subdomain: 'demo',
      plan: 'professional',
      status: 'active'
    }
  }
]

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

          // For development, accept any password if email and tenant match
          const user = mockUsers.find(u => 
            u.email === credentials.email && 
            u.tenantId === credentials.tenantId
          )

          if (user) {
            return user
          }

          return null
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
