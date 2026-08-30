'use client';

import React, { useState } from 'react';
import { Button, Input, Checkbox, Link } from "@heroui/react";
import { signIn } from 'next-auth/react';
import { setClientTenantSubdomain } from '../lib/api/clientTenant';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('demo'); // Default to demo tenant
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        tenantId,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials. Please try again.');
      } else {
        setClientTenantSubdomain(tenantId.trim().toLowerCase());
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ghana-green to-ghana-gold">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-ghana-gold rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">🏨</span>
          </div>
          <h2 className="text-3xl font-bold text-ghana-black">
            Welcome Back
          </h2>
          <p className="mt-2 text-sm text-ghana-black">
            Sign in to your hotel management account
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              type="text"
              label="Tenant ID"
              placeholder="Enter tenant ID (e.g., demo)"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              variant="bordered"
              classNames={{
                input: "text-ghana-black",
                label: "text-ghana-black font-medium",
                inputWrapper: "border-ghana-green focus-within:border-ghana-gold"
              }}
            />

            <Input
              type="email"
              label="Email Address"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              variant="bordered"
              classNames={{
                input: "text-ghana-black",
                label: "text-ghana-black font-medium",
                inputWrapper: "border-ghana-green focus-within:border-ghana-gold"
              }}
            />
            
            <Input
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              variant="bordered"
              classNames={{
                input: "text-ghana-black",
                label: "text-ghana-black font-medium",
                inputWrapper: "border-ghana-green focus-within:border-ghana-gold"
              }}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Checkbox
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              classNames={{
                label: "text-sm text-ghana-black"
              }}
            >
              Remember me
            </Checkbox>
            
            <Link
              href="#"
              className="text-sm text-ghana-green hover:text-ghana-gold transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full bg-ghana-green hover:bg-ghana-gold text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
            size="lg"
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Demo Credentials: demo / admin@demohotel.com / password123
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Also try: manager@demohotel.com or staff@demohotel.com (same password)
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
