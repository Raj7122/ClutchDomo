import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interactive Demo | DOMO',
  description: 'Experience our product through an interactive AI-powered demo',
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}