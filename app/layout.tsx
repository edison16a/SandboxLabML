import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Providers } from '@/features/shell/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SandboxLabML',
    template: '%s | SandboxLabML',
  },
  description: 'Watch neural networks learn to drive an SUV through a city and run a course to the finish line, then write your own training scripts.',
  openGraph: {
    title: 'SandboxLabML',
    description: 'Train your own model with machine learning, right in your browser: a self-driving SUV in a city and runners that learn to reach the finish line.',
    siteName: 'SandboxLabML',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0e14',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
