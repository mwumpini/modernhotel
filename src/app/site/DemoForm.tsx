'use client';

import React from 'react';
import { FACILITIES, whatsappLink } from './content';

type State = { status: 'idle' | 'sending' | 'sent' | 'error'; message?: string };

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0B5F64] focus:ring-4 focus:ring-[#0B5F64]/10';
const label = 'mb-1.5 block text-sm font-medium text-slate-700';

export default function DemoForm() {
  const [state, setState] = React.useState<State>({ status: 'idle' });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form.entries());
    setState({ status: 'sending' });
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, source: 'website' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ status: 'error', message: body.error || 'Something went wrong. Please message us on WhatsApp.' });
        return;
      }
      setState({ status: 'sent' });
    } catch {
      setState({ status: 'error', message: 'No connection. Please try again, or message us on WhatsApp.' });
    }
  };

  if (state.status === 'sent') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-4 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">✓</div>
        <h3 className="text-xl font-semibold text-slate-900">Thank you. We’ll be in touch shortly.</h3>
        <p className="mt-2 text-slate-600">We usually reply within one working day. For a faster answer, message us on WhatsApp.</p>
        <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 font-semibold text-white shadow-sm hover:brightness-95">
          Chat on WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div>
        <label className={label} htmlFor="name">Your name *</label>
        <input id="name" name="name" required autoComplete="name" className={field} placeholder="Ama Mensah" />
      </div>
      <div>
        <label className={label} htmlFor="hotelName">Business name *</label>
        <input id="hotelName" name="hotelName" required autoComplete="organization" className={field} placeholder="Golden Palm Lodge" />
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="facilityType">Type of business</label>
        <select id="facilityType" name="facilityType" defaultValue="" className={field}>
          <option value="">Choose one (optional)</option>
          {FACILITIES.map((f) => <option key={f.title} value={f.title}>{f.title}</option>)}
          <option value="Other">Something else</option>
        </select>
      </div>
      <div>
        <label className={label} htmlFor="whatsapp">WhatsApp number</label>
        <input id="whatsapp" name="whatsapp" type="tel" autoComplete="tel" className={field} placeholder="+233 24 000 0000" />
      </div>
      <div>
        <label className={label} htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" className={field} placeholder="you@yourbusiness.com" />
      </div>
      <div>
        <label className={label} htmlFor="rooms">Rooms or units (if any)</label>
        <input id="rooms" name="rooms" type="number" min={1} inputMode="numeric" className={field} placeholder="24" />
      </div>
      <div>
        <label className={label} htmlFor="city">Town or city</label>
        <input id="city" name="city" autoComplete="address-level2" className={field} placeholder="Kumasi" />
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="message">What would you like to see? (optional)</label>
        <textarea id="message" name="message" rows={3} className={field} placeholder="E.g. restaurant POS and stock, or the full front desk." />
      </div>
      {/* Left empty by people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Give a WhatsApp number or an email so we can reach you.</p>
        <button
          type="submit"
          disabled={state.status === 'sending'}
          className="inline-flex items-center justify-center rounded-full bg-[#0B5F64] px-7 py-3 font-semibold text-white shadow-lg shadow-[#0B5F64]/20 transition hover:bg-[#094c50] disabled:opacity-60"
        >
          {state.status === 'sending' ? 'Sending…' : 'Request a demo'}
        </button>
      </div>
      {state.status === 'error' && (
        <p role="alert" className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.message}{' '}
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Message us on WhatsApp</a>
        </p>
      )}
    </form>
  );
}
