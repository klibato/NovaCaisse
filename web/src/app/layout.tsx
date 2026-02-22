import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NovaCaisse',
  description: 'Caisse enregistreuse SaaS pour fast foods - Conforme ISCA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
