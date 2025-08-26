'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Button } from '@heroui/react';
import { Bars3Icon } from '@heroicons/react/24/outline';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageLayout({ children, className = '' }: PageLayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="flex-shrink-0">
        <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
      </div>
      
      {/* Main Content */}
      <div className={`flex-1 overflow-auto ${className}`}>
        {/* Mobile Menu Button */}
        <div className="lg:hidden p-4 border-b border-gray-200">
          <Button
            isIconOnly
            variant="light"
            onClick={() => setIsMobileOpen(true)}
            className="lg:hidden"
          >
            <Bars3Icon className="h-6 w-6" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
