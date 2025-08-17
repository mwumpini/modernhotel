'use client';

import React, { useState } from 'react';
import { Button, Input, Checkbox, Link } from "@heroui/react";

interface LoginFormProps {
  onLogin: () => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle login logic here
    console.log('Login attempt:', { email, password, rememberMe });
    
    // For demo purposes, accept any login
    if (email && password) {
      onLogin();
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
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your hotel management account
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
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
          >
            Sign In
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link
              href="#"
              className="text-ghana-green hover:text-ghana-gold font-medium transition-colors"
            >
              Contact Administrator
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
