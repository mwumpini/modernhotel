'use client';

import React, { useEffect, Suspense } from 'react';

// This route only redirects to the Front Office dashboard's embedded Clients &
// Services tab — the real content lives in ClientsServicesContent.tsx (moved
// out of this file since a page.tsx may only export `default`/`metadata`/etc.,
// not an extra named component; FrontdeskDashboard.tsx dynamically imports
// ClientsServicesContent directly from that file, not from this page).
function ClientsRedirect() {
	useEffect(() => {
		try {
			localStorage.setItem('nav.section', 'frontdesk');
			localStorage.setItem('fo.tab', 'clients');
		} catch {
			/* ignore */
		}
		window.location.replace('/');
	}, []);
	return <div className="p-6 text-center">Opening Front Office...</div>;
}

export default function ClientsServicesPage() {
	return (
		<Suspense fallback={<div className="p-6 text-center">Opening Front Office...</div>}>
			<ClientsRedirect />
		</Suspense>
	);
}
