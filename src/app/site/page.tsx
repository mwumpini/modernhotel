import type { Metadata } from 'next';
import Image from 'next/image';
import DemoForm from './DemoForm';
import { CONTACT, FAQS, GHANA_POINTS, MODULES, SIGN_IN_URL, STEPS, whatsappLink } from './content';

export const metadata: Metadata = {
  title: 'AGM Sync: hotel management software built for Ghana',
  description:
    'Front desk, restaurant POS, kitchen, housekeeping, stores, payroll and accounting in one system, with Ghana’s taxes built in. Request a demo.',
  openGraph: {
    title: 'AGM Sync: run your whole hotel from one system',
    description: 'Front desk, restaurant, stores, payroll and accounts, connected and built for Ghana.',
    siteName: 'AGM Sync',
    type: 'website',
    images: [{ url: '/brand/og-image.png', width: 1200, height: 630, alt: 'AGM Sync' }],
  },
};

const TEAL = '#0B5F64';

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/brand/agm-sync-icon.svg" alt="" width={34} height={34} priority />
      <span className="text-lg font-extrabold tracking-tight">
        <span style={{ color: TEAL }}>AGM</span> <span className="text-slate-900">Sync</span>
      </span>
    </span>
  );
}

function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.1c-.24.68-1.42 1.3-1.95 1.34-.5.05-.97.23-3.27-.68-2.77-1.09-4.53-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.47.24.55.79 1.89.86 2.03.07.13.11.3.02.48-.09.18-.13.29-.27.45-.13.16-.28.35-.4.47-.13.13-.27.28-.12.55.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.61-.13.25.09 1.59.75 1.86.88.27.14.45.2.52.31.07.12.07.66-.17 1.34Z" />
    </svg>
  );
}

function Shot({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 shadow-2xl shadow-slate-900/20 ring-1 ring-black/5">
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-slate-800 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate rounded-md bg-white/10 px-3 py-0.5 text-[11px] text-slate-300">app.agmsync.com</span>
      </div>
      <Image src={src} alt={alt} width={1440} height={900} priority={priority} className="h-auto w-full" sizes="(min-width: 1024px) 60vw, 100vw" />
    </div>
  );
}

export default function SitePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased [font-family:var(--font-geist-sans),system-ui,sans-serif]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#top" aria-label="AGM Sync home"><Logo /></a>
          <nav className="hidden items-center gap-7 text-[15px] font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#ghana" className="hover:text-slate-900">Built for Ghana</a>
            <a href="#how" className="hover:text-slate-900">How it works</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href={SIGN_IN_URL} className="hidden rounded-full px-4 py-2 text-[15px] font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex">Sign in</a>
            <a href="#demo" className="rounded-full px-4 py-2 text-[15px] font-semibold text-white shadow-sm transition hover:brightness-110" style={{ background: TEAL }}>Request a demo</a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(11,95,100,0.14),transparent),radial-gradient(40rem_25rem_at_0%_10%,rgba(233,162,59,0.14),transparent)]" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:pb-24 lg:pt-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#0B5F64]/20 bg-[#0B5F64]/5 px-3 py-1 text-sm font-medium text-[#0B5F64]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E9A23B]" /> Hotel management software for Ghana
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
                Run your whole hotel from <span style={{ color: TEAL }}>one system</span>.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                Front desk, restaurant and bar, kitchen, housekeeping, stores, payroll and accounts, connected. A sale at the bar updates stock and the books on its own, with Ghana’s taxes worked out on every bill.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#demo" className="rounded-full px-6 py-3 font-semibold text-white shadow-lg shadow-[#0B5F64]/25 transition hover:brightness-110" style={{ background: TEAL }}>Request a demo</a>
                <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition hover:border-[#25D366] hover:text-[#128C7E]">
                  <WhatsAppIcon /> Chat on WhatsApp
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                <li>✓ Nothing to install</li>
                <li>✓ Works on PCs and tablets</li>
                <li>✓ Setup and training included</li>
              </ul>
            </div>
            <Shot src="/site/dashboard.png" alt="AGM Sync executive dashboard showing in-house guests, arrivals, occupancy and today’s revenue" priority />
          </div>
        </section>

        {/* Problem */}
        <section className="border-y border-slate-100 bg-slate-50/70">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Stop stitching your hotel together.</h2>
              <p className="mt-4 text-slate-600">
                Many hotels run the front desk in one program, the restaurant on another, the books in a spreadsheet and the store on paper. Figures are typed twice, stock goes missing, and the night audit takes hours.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { k: 'One record', v: 'A guest, a sale or a delivery is entered once and appears everywhere it matters.' },
                { k: 'No double entry', v: 'Restaurant sales, room charges and payments post to your accounts automatically.' },
                { k: 'Stock you can trust', v: 'Every bottle and every recipe ingredient is taken from stock as it sells.' },
              ].map((card) => (
                <div key={card.k} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-base font-semibold" style={{ color: TEAL }}>{card.k}</div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Modules */}
        <section id="features" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything your hotel runs on</h2>
              <p className="mt-4 text-slate-600">Use the whole system, or only the parts you need today. Every module shares the same guests, stock and accounts.</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {MODULES.map((m) => (
                <div key={m.title} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#0B5F64]/30 hover:shadow-lg hover:shadow-slate-200/70">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-2xl ring-1 ring-slate-100">{m.icon}</div>
                  <h3 className="mt-4 font-semibold text-slate-900">{m.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{m.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Spotlights */}
        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-6xl space-y-24 px-4 py-24 sm:px-6">
            {[
              { img: '/site/front-office.png', alt: 'Reservations and bookings list with guests, rooms, dates and rates', tag: 'Front desk', title: 'Every booking, guest and bill in front of you', text: 'See who is arriving, who is in house and who owes what. Check guests in and out, move rooms, take deposits and print a clear check-out bill in seconds.' },
              { img: '/site/housekeeping.png', alt: 'Housekeeping floor view with room cards showing dirty, cleaning and occupied status', tag: 'Housekeeping', title: 'Know the state of every room', text: 'Rooms turn dirty at checkout and ready when cleaned and inspected. The front desk sees it the moment it changes, with no phone calls between floors.' },
              { img: '/site/accounting.png', alt: 'Accounts receivable aging table showing customer balances by age', tag: 'Accounting', title: 'Books that keep themselves up to date', text: 'Room, restaurant and event sales post to the right accounts with their taxes. Follow up company accounts by age, reconcile the bank, and print your statements.' },
            ].map((s, i) => (
              <div key={s.tag} className={`grid items-center gap-10 lg:grid-cols-2 ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                <div>
                  <span className="text-sm font-semibold uppercase tracking-wider text-[#E9A23B]">{s.tag}</span>
                  <h3 className="mt-3 text-3xl font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-slate-300">{s.text}</p>
                </div>
                <Shot src={s.img} alt={s.alt} />
              </div>
            ))}
          </div>
        </section>

        {/* Built for Ghana */}
        <section id="ghana" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-4 flex h-1.5 w-24 overflow-hidden rounded-full">
                <span className="flex-1 bg-[#CE1126]" /><span className="flex-1 bg-[#FCD116]" /><span className="flex-1 bg-[#006B3F]" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built for hotels in Ghana</h2>
              <p className="mt-4 text-slate-600">Not foreign software with Ghana bolted on. The taxes, documents and payments work the way your hotel already does.</p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {GHANA_POINTS.map((p) => (
                <div key={p.title} className="rounded-2xl border border-slate-200 p-6">
                  <h3 className="font-semibold text-slate-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.text}</p>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-[#0B5F64]/15 bg-[#0B5F64]/[0.04] p-6">
              <div className="text-sm font-semibold text-slate-500">Example: a ₵1,000 room night</div>
              <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[15px] sm:grid-cols-[1fr_auto]">
                <dt className="text-slate-600">Room charge</dt><dd className="text-right font-medium">₵1,000.00</dd>
                <dt className="text-slate-600">NHIL/GETFund (5%)</dt><dd className="text-right font-medium">₵50.00</dd>
                <dt className="text-slate-600">VAT (15%)</dt><dd className="text-right font-medium">₵150.00</dd>
                <dt className="text-slate-600">Tourism Levy (1%)</dt><dd className="text-right font-medium">₵10.00</dd>
                <dt className="border-t border-slate-200 pt-2 font-semibold">Guest pays</dt><dd className="border-t border-slate-200 pt-2 text-right font-bold" style={{ color: TEAL }}>₵1,210.00</dd>
              </dl>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-slate-100 bg-slate-50/70">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">From first call to first guest</h2>
              <p className="mt-4 text-slate-600">You don’t have to work it out alone. We set up your hotel and train your team.</p>
            </div>
            <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: TEAL }}>{i + 1}</span>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Questions hotels ask</h2>
            <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200">
              {FAQS.map((f) => (
                <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                    {f.q}
                    <span className="text-xl text-slate-400 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Demo */}
        <section id="demo" className="scroll-mt-20 pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid overflow-hidden rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/60 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="relative p-8 text-white sm:p-10" style={{ background: `linear-gradient(150deg, ${TEAL}, #073f43)` }}>
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-[#E9A23B]/25 blur-3xl" />
                <h2 className="text-3xl font-bold tracking-tight">See AGM Sync with your own hotel</h2>
                <p className="mt-4 leading-relaxed text-white/85">Tell us a little about your hotel and we’ll arrange a short demo using your rooms and your menu. No obligation.</p>
                <div className="mt-8 space-y-4">
                  <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 transition hover:bg-white/15">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white"><WhatsAppIcon /></span>
                    <span>
                      <span className="block text-sm text-white/70">WhatsApp (messages only)</span>
                      <span className="block font-semibold">{CONTACT.whatsappDisplay}</span>
                    </span>
                  </a>
                  <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 transition hover:bg-white/15">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg" style={{ color: TEAL }}>@</span>
                    <span>
                      <span className="block text-sm text-white/70">Email</span>
                      <span className="block font-semibold">{CONTACT.email}</span>
                    </span>
                  </a>
                </div>
              </div>
              <div className="bg-white p-8 sm:p-10">
                <DemoForm />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>Your property, simply connected. © {new Date().getFullYear()} AGM Sync</p>
          <div className="flex gap-5">
            <a href={SIGN_IN_URL} className="hover:text-slate-900">Staff sign in</a>
            <a href={`mailto:${CONTACT.email}`} className="hover:text-slate-900">{CONTACT.email}</a>
          </div>
        </div>
      </footer>

      <a
        href={whatsappLink()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with AGM Sync on WhatsApp"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-black/20 transition hover:scale-105"
      >
        <WhatsAppIcon className="h-7 w-7" />
      </a>
    </div>
  );
}
