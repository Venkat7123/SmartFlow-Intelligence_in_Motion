import type { Metadata } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartFlow – Intelligence in Motion',
  description:
    'Real-time crowd intelligence and AI-powered routing for the ultimate stadium experience. Navigate smarter, not harder.',
  keywords: 'stadium, crowd intelligence, smart routing, event navigation, SmartFlow',
  openGraph: {
    title: 'SmartFlow – Intelligence in Motion',
    description: 'Real-time crowd intelligence and AI-powered routing for the ultimate stadium experience.',
    type: 'website',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
