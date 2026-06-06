import { useEffect, useState } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isInstalled: boolean;
  isActive: boolean;
  isControlling: boolean;
  hasUpdate: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isInstalled: false,
    isActive: false,
    isControlling: false,
    hasUpdate: false,
    registration: null,
  });

  useEffect(() => {
    if (!state.isSupported) return;
    
    // Additional check for development environment
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      console.log('Service Worker disabled in development mode');
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;

    const registerServiceWorker = async () => {
      try {
        // Check if service worker is already registered
        registration = (await navigator.serviceWorker.getRegistration()) ?? null;
        
        if (!registration) {
          // Check if service worker file exists before registering
          try {
            const response = await fetch('/sw.js');
            if (!response.ok) {
              console.log('Service Worker file not found, skipping registration');
              return;
            }
          } catch (error) {
            console.log('Service Worker file not accessible, skipping registration');
            return;
          }
          
          // Register new service worker
          registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          });
          console.log('Service Worker registered successfully:', registration);
        }

        // Update state
        setState(prev => ({
          ...prev,
          isRegistered: true,
          registration,
        }));

        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                setState(prev => ({ ...prev, isInstalled: true }));
                if (navigator.serviceWorker.controller) {
                  setState(prev => ({ ...prev, hasUpdate: true }));
                }
              }
            });
          }
        });

        // Listen for controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          setState(prev => ({ ...prev, isControlling: true }));
        });

        // Check if service worker is already controlling
        if (navigator.serviceWorker.controller) {
          setState(prev => ({ ...prev, isControlling: true }));
        }

        // Listen for service worker state changes
        if (registration.installing) {
          setState(prev => ({ ...prev, isInstalled: false }));
        } else if (registration.waiting) {
          setState(prev => ({ ...prev, isInstalled: true }));
        } else if (registration.active) {
          setState(prev => ({ ...prev, isActive: true }));
        }

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };

    registerServiceWorker();

    // Cleanup
    return () => {
      if (registration) {
        registration.removeEventListener('updatefound', () => {});
      }
    };
  }, [state.isSupported]);

  const updateServiceWorker = async () => {
    if (!state.registration) return;

    try {
      await state.registration.update();
      setState(prev => ({ ...prev, hasUpdate: false }));
    } catch (error) {
      console.error('Failed to update service worker:', error);
    }
  };

  const skipWaiting = async () => {
    if (!state.registration || !state.registration.waiting) return;

    try {
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setState(prev => ({ ...prev, hasUpdate: false }));
    } catch (error) {
      console.error('Failed to skip waiting:', error);
    }
  };

  const unregisterServiceWorker = async () => {
    if (!state.registration) return;

    try {
      await state.registration.unregister();
      setState(prev => ({
        ...prev,
        isRegistered: false,
        isInstalled: false,
        isActive: false,
        isControlling: false,
        hasUpdate: false,
        registration: null,
      }));
    } catch (error) {
      console.error('Failed to unregister service worker:', error);
    }
  };

  return {
    ...state,
    updateServiceWorker,
    skipWaiting,
    unregisterServiceWorker,
  };
}
