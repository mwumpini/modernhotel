'use client';

import React, { useState } from 'react';
import { Button, Input, Checkbox } from "@heroui/react";
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { signIn } from 'next-auth/react';
import { setClientTenantSubdomain } from '../lib/api/clientTenant';
import BrandLogo from './BrandLogo';
import ForgotPasswordPanel from './ForgotPasswordPanel';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [tenantId, setTenantId] = useState('demo'); // Default to demo tenant
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [enrollSecret, setEnrollSecret] = useState('');
  const [code, setCode] = useState('');

  const finishSignIn = async (otp?: string) => {
    setClientTenantSubdomain(tenantId.trim().toLowerCase());
    const result = await signIn('credentials', {
      email,
      password,
      tenantId,
      otp: otp || '',
      redirect: false,
    });
    if (result?.error) {
      setError(otp ? 'That code is not valid. Try the current 6-digit code.' : 'Invalid credentials. Please try again.');
      return;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (needsCode) {
        await finishSignIn(code);
        return;
      }

      const challenge = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tenantId }),
      });
      const data = await challenge.json().catch(() => ({}));
      if (data?.expired) {
        setError(data.error || 'This password has expired. An administrator must set a new one.');
        return;
      }
      if (!challenge.ok) {
        setError(data?.error || 'Invalid credentials. Please try again.');
        return;
      }
      if (data?.required) {
        setNeedsCode(true);
        setEnrollSecret(data.enroll ? String(data.secret || '') : '');
        return;
      }
      await finishSignIn();
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0B5F64] via-[#0E7C80] to-[#E9A23B]">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center">
          <BrandLogo size="lg" stacked syncClass="text-slate-900" />
          <p className="mt-1 text-xs text-gray-500">agmsync.com</p>
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
              type="text"
              label="Email or username"
              placeholder="Enter your email or username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
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
              type={showPassword ? 'text' : 'password'}
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              variant="bordered"
              endContent={
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="text-gray-500 hover:text-ghana-black"
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" aria-hidden /> : <EyeIcon className="h-5 w-5" aria-hidden />}
                </button>
              }
              classNames={{
                input: "text-ghana-black",
                label: "text-ghana-black font-medium",
                inputWrapper: "border-ghana-green focus-within:border-ghana-gold"
              }}
            />

            {needsCode && (
              <>
                {enrollSecret && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                    <p className="text-sm text-ghana-black">
                      Add this key to an authenticator app, then enter the 6-digit code it shows.
                    </p>
                    <p className="mt-2 font-mono text-sm break-all text-ghana-black">{enrollSecret}</p>
                  </div>
                )}
                <Input
                  type="text"
                  label="Authentication code"
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  variant="bordered"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  classNames={{
                    input: "text-ghana-black",
                    label: "text-ghana-black font-medium",
                    inputWrapper: "border-ghana-green focus-within:border-ghana-gold"
                  }}
                />
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {!forgot && (
            <>
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

                <button
                  type="button"
                  className="text-sm text-ghana-green hover:text-ghana-gold transition-colors"
                  onClick={() => setForgot(true)}
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                className="w-full bg-ghana-green hover:bg-ghana-gold text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
                size="lg"
                isLoading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : needsCode ? 'Verify code' : 'Sign In'}
              </Button>
            </>
          )}
        </form>
        {forgot && <ForgotPasswordPanel tenantId={tenantId} login={email} onClose={() => setForgot(false)} />}

          {/* Local development only: on the live site this would hand anyone the admin login. */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Demo Credentials: demo / admin@demohotel.com / password123
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Also try: manager@demohotel.com or staff@demohotel.com (same password)
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Operator: platform / operator@platform.local / password123
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
