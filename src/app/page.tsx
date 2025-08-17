'use client';

import React, { useState } from 'react';
import LoginForm from './components/LoginForm';
import Navigation from './components/Navigation';
import MobileNavigation from './components/MobileNavigation';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return (
      <div>
        <LoginForm onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="flex">
      {/* Desktop Navigation with Integrated Dashboard */}
      <div className="hidden lg:block w-full">
        <Navigation onLogout={handleLogout} />
      </div>
      
      {/* Mobile Navigation */}
      <div className="lg:hidden w-full">
        <MobileNavigation onLogout={handleLogout} />
        {/* Mobile content will be handled by MobileNavigation */}
      </div>
    </div>
  );
}
