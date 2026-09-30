import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Literata, Nunito_Sans, Source_Sans_3 } from "next/font/google";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth/auth";
import Providers from "./components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ghana Hotel Management System",
  description: "Professional hospitality facility management system for 4-star hotels in Ghana",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    // Auth route may still be compiling in dev; client can retry later.
  }

  return (
    <html lang="en" data-theme="light" data-font="source" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t='light',f='source',s='medium',bg='';var r=localStorage.getItem('system.currentUser');if(r){var p=(JSON.parse(r)||{}).preferences||{};if(p.theme==='light'||p.theme==='dark'||p.theme==='auto')t=p.theme;if(p.font==='source'||p.font==='nunito'||p.font==='geist'||p.font==='serif')f=p.font;if(p.fontSize==='small'||p.fontSize==='medium'||p.fontSize==='large'||p.fontSize==='xlarge')s=p.fontSize;var d=t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);bg=d?p.backgroundDark:p.backgroundLight;}else{var d=false;}var root=document.documentElement;root.setAttribute('data-theme',t);root.setAttribute('data-font',f);root.setAttribute('data-font-size',s);root.classList.toggle('dark',d);root.classList.toggle('light',!d);root.style.colorScheme=d?'dark':'light';if(bg&&/^#[0-9a-fA-F]{6}$/.test(bg)){root.style.setProperty('--page-background',bg);root.setAttribute('data-bg','custom');}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sourceSans.variable} ${nunitoSans.variable} ${literata.variable} antialiased`}
      >
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
