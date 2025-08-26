'use client';

import React from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import LoginForm from './components/LoginForm';
import Navigation from './components/Navigation';

export default function Home() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🏨 Ghana Hotel Management
            </h1>
            <p className="text-gray-600">
              Sign in to continue
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    );
  }

  // Authenticated: render the original app shell/design
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onLogout={() => signOut()} />
    </div>
  );
}
