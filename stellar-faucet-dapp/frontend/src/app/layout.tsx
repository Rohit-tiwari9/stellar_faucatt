import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Stellar Faucet | Testnet XLM',
  description:
    'Request testnet XLM via a Soroban smart contract faucet on the Stellar network.',
  keywords: ['Stellar', 'Soroban', 'Faucet', 'Testnet', 'XLM', 'Blockchain'],
  openGraph: {
    title: 'Stellar Testnet Faucet',
    description: 'Get free testnet XLM instantly with smart contract rate limiting.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
