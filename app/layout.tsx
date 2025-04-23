import HeaderAuth from "@/components/header-auth";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Trade Business Growth: Scale Your Success Today",
  description: "Master Trade Business Growth: Unlock Success TodayTransform your trade business with strategies &amp; support from Trade Business School. Scale your operations &amp; boost profits. Watch our FREE intro video now!",
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
    
          <main className="min-h-screen flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-20 items-center">
              <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
                  <div className="flex gap-5 items-center font-semibold">
                    <Link href={"/"} className="text-2xl" >TBS</Link>
                  
                  </div>
                  <HeaderAuth />
                </div>
              </nav>
              <div className="flex flex-col gap-20 max-w-5xl p-5 min-h-screen">
                {children}
              </div>

              <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
                <p>
                  Powered by  <b>We Build Trades</b>
                </p>
              </footer>
            </div>
          </main>
      </body>
    </html>
  );
}
