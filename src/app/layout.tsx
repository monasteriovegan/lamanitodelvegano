import type { Metadata } from 'next';
import { Syne, Space_Grotesk, Fraunces } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-syne',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://lamanitodelvegano.vercel.app'),
  title: {
    default: 'La Manito Del Vegano 🌱 | Comida Vegana Artesanal en Santiago y Pucón',
    template: '%s | La Manito Del Vegano',
  },
  description:
    'Taller 100% plant-based en Santiago y Pucón. Empanadas veganas, pies artesanales y el primer manjar de semilla de cáñamo de Chile. Delivery a todo Santiago.',
  keywords: ['comida vegana chile', 'empanadas veganas', 'manjar de cáñamo', 'pie vegano', 'delivery vegano santiago'],
  openGraph: {
    title: 'La Manito Del Vegano 🌱',
    description: 'Comida vegana que enamora. Elaborada con amor y conciencia en Santiago y Pucón.',
    url: 'https://lamanitodelvegano.vercel.app',
    siteName: 'La Manito Del Vegano',
    locale: 'es_CL',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${syne.variable} ${spaceGrotesk.variable} ${fraunces.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
