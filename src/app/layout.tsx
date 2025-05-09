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
        {/* <div className="p-4 max-w-4xl mx-auto"> */}
        <div>
          {children}
        </div>
      </body>
    </html>
  );
}
