import './globals.css';

export const metadata = {
  title: 'Seneve',
  description: 'Seneve foundation web application.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
