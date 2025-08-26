'use client';

import React, { useState, useEffect } from 'react';
import { Button, Card, CardBody, CardHeader } from "@heroui/react";

export default function ThemeTest() {
  const [currentTheme, setCurrentTheme] = useState('light');

  // Function to apply theme
  const applyTheme = (theme: string) => {
    console.log('🔧 [ThemeTest] Applying theme:', theme);
    
    // Set data-theme attribute
    document.documentElement.setAttribute('data-theme', theme);
    
    // Apply CSS variables directly for immediate effect
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--background', '#0a0a0a');
      document.documentElement.style.setProperty('--foreground', '#ededed');
      document.documentElement.style.setProperty('--card-background', '#1a1a1a');
      document.documentElement.style.setProperty('--card-border', '#374151');
      document.documentElement.style.setProperty('--text-primary', '#ededed');
      document.documentElement.style.setProperty('--text-secondary', '#9ca3af');
    } else if (theme === 'light') {
      document.documentElement.style.setProperty('--background', '#ffffff');
      document.documentElement.style.setProperty('--foreground', '#171717');
      document.documentElement.style.setProperty('--card-background', '#ffffff');
      document.documentElement.style.setProperty('--card-border', '#e5e7eb');
      document.documentElement.style.setProperty('--text-primary', '#171717');
      document.documentElement.style.setProperty('--text-secondary', '#6b7280');
    }
    
    setCurrentTheme(theme);
  };

  useEffect(() => {
    // Apply default theme on mount
    applyTheme('light');
  }, []);

  return (
    <div className="p-6" style={{ 
      background: 'var(--background)', 
      color: 'var(--foreground)',
      minHeight: '100vh'
    }}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">🎨 Theme Test Component</h1>
          <p className="text-lg mb-6">Testing the theme system independently</p>
          
          <div className="flex justify-center space-x-4 mb-8">
            <Button 
              color="primary" 
              onPress={() => applyTheme('light')}
              className={currentTheme === 'light' ? 'ring-2 ring-blue-500' : ''}
            >
              🌞 Light Theme
            </Button>
            <Button 
              color="secondary" 
              onPress={() => applyTheme('dark')}
              className={currentTheme === 'dark' ? 'ring-2 ring-purple-500' : ''}
            >
              🌙 Dark Theme
            </Button>
          </div>
          
          <div className="text-sm text-gray-500">
            Current Theme: <span className="font-bold">{currentTheme}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg" style={{ 
            background: 'var(--card-background)', 
            borderColor: 'var(--card-border)',
            color: 'var(--text-primary)'
          }}>
            <CardHeader>
              <h3 className="text-xl font-semibold">Test Card 1</h3>
            </CardHeader>
            <CardBody>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This card should change colors with the theme. The background, text, and borders should all update immediately when you switch themes.
              </p>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg" style={{ 
            background: 'var(--card-background)', 
            borderColor: 'var(--card-border)',
            color: 'var(--text-primary)'
          }}>
            <CardHeader>
              <h3 className="text-xl font-semibold">Test Card 2</h3>
            </CardHeader>
            <CardBody>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Another test card to verify that all components are properly themed. You should see smooth transitions between light and dark modes.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="text-center p-4 rounded-lg" style={{ 
          background: 'var(--card-background)', 
          border: '1px solid var(--card-border)',
          color: 'var(--text-primary)'
        }}>
          <h4 className="font-semibold mb-2">CSS Variables Status</h4>
          <div className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
            <div>--background: {getComputedStyle(document.documentElement).getPropertyValue('--background') || 'not set'}</div>
            <div>--foreground: {getComputedStyle(document.documentElement).getPropertyValue('--foreground') || 'not set'}</div>
            <div>--card-background: {getComputedStyle(document.documentElement).getPropertyValue('--card-background') || 'not set'}</div>
            <div>--text-primary: {getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || 'not set'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
