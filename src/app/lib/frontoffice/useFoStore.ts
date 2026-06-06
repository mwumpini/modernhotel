'use client';

import { useRef } from 'react';
import { frontOfficeStore } from './store';

// Prefer with-selector to avoid unnecessary re-renders on unrelated store updates
// Falls back to basic useSyncExternalStore if the shim isn't available
let useSyncExternalStoreWithSelector: any;
try {
	 
	useSyncExternalStoreWithSelector = require('use-sync-external-store/shim/with-selector').useSyncExternalStoreWithSelector;
} catch {
	 
	useSyncExternalStoreWithSelector = require('use-sync-external-store/shim').useSyncExternalStore;
}

type EqualityFn<T> = (a: T, b: T) => boolean;

const subscribe = (onStoreChange: () => void) => frontOfficeStore.subscribe(onStoreChange);
const getSnapshot = () => frontOfficeStore;
const getServerSnapshot = () => frontOfficeStore;

export function useFrontOfficeSelector<T>(
	selector: (s: typeof frontOfficeStore) => T,
	isEqual?: EqualityFn<T>
): T {
	const lastSelectorRef = useRef(selector);
	// If selector identity changes, let with-selector handle recomputation/equality
	lastSelectorRef.current = selector;

	return useSyncExternalStoreWithSelector(
		subscribe,
		getSnapshot,
		getServerSnapshot,
		(state: typeof frontOfficeStore) => lastSelectorRef.current(state),
		isEqual
	);
}

export function useFrontOfficeRooms() {
	return useFrontOfficeSelector(s => s.rooms);
}

export function useFrontOfficeRoomTypes() {
	return useFrontOfficeSelector(s => s.roomTypes);
}

export function useFrontOfficeReservations() {
	return useFrontOfficeSelector(s => s.reservations);
}


