import "./globals.css";
import Link from "next/link";
import { Providers } from "./providers";

export const metadata = { title: "Guides" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/" className="nav-brand">Guides</Link>
          <Link href="/compose">Compose</Link>
        </nav>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
