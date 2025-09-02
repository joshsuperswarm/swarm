import './global.css';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Navbar } from './components/nav';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { siteUrl } from '../lib/siteUrl';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Swarm - Agent IDE',
    template: '%s | Swarm',
  },
  description: 'We containerize your repo so AI agents can run it.',
  openGraph: {
    title: 'Swarm - Agent IDE',
    description: 'We containerize your repo so AI agents can run it.',
    url: siteUrl,
    siteName: 'Swarm',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 1200,
        alt: 'Swarm - Agent IDE',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Swarm - Agent IDE',
    description: 'We containerize your repo so AI agents can run it.',
    images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const cx = (...classes) => classes.filter(Boolean).join(' ');

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cx(GeistSans.variable, GeistMono.variable)}>
      <body className="flex flex-col min-h-screen antialiased bg-[#1B1F24] text-[#EAEAEA]">
        <main className="flex-1 min-w-0 flex flex-col">
          {children}
          <Analytics />
          <SpeedInsights />
        </main>
      </body>
    </html>
  );
}
