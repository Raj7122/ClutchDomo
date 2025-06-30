import './globals.css';
import type { Metadata } from 'next';
import { AppStateProvider } from '@/src/contexts/AppStateProvider';
import { AgentProvider } from '@/src/agent/contexts/AgentContext';

export const metadata: Metadata = {
  title: 'Next.js Supabase App',
  description: 'A full-stack application with Next.js and Supabase',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AppStateProvider>
          <AgentProvider>
            {children}
          </AgentProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}