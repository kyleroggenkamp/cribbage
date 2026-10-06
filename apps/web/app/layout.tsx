import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deer Camp Cribbage',
  description: 'Cribbage from separate deer stands.',
};

export const viewport: Viewport = {
  themeColor: '#161a13', // forest-dark, matches the app background
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Dark-only in v1; data-theme is set explicitly so the theme system can grow.
  return (
    <html lang="en" data-theme="deer-camp">
      <body>{children}</body>
    </html>
  );
}
