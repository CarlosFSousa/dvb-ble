import "./globals.css";
import Nav from './components/Nav';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>DVB Ble Manager</title>
      </head>
      <body>
        <Nav/>
        {children}
      </body>
    </html>
  );
}
