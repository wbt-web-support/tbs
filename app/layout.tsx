import HeaderAuth from "@/components/header-auth";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/toaster";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // If user is authenticated and tries to access root, redirect to dashboard
  if (session && typeof window !== 'undefined' && window.location.pathname === '/') {
    redirect('/dashboard');
  }

  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
    
          <main className="min-h-screen flex flex-col items-center">
            <div className="w-full">
              {/* <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
                  <div className="flex gap-5 items-center font-semibold">
                    <Link href={"/"} className="text-2xl" >TBS</Link>
                  
                  </div>
                  <HeaderAuth />
                </div>
              </nav> */}
              <div className="min-h-screen flex justify-center items-center w-full">
                {children}
              </div>

            </div>
          </main>
          <Toaster />
      </body>
    </html>
  );
}
