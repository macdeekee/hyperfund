import './globals.css';

export const metadata = {
  title: 'HyperFund',
  description: 'Hyperliquid fundamentals, valuation scenarios, and forecast drivers.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
