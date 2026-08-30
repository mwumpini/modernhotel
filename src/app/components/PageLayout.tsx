'use client';

import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageLayout({ children, className = '' }: PageLayoutProps) {
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {children}
    </div>
  );
}
