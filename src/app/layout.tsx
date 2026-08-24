import type { Metadata } from "next";
import { Chivo, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { THEME_COLORS_SCRIPT } from "@/features/settings/theme-colors";
import { THEME_ICONS_SCRIPT } from "@/features/settings/theme-icons";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const chivo = Chivo({
  variable: "--font-chivo",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "UPLOG — Plan. Share. Get things done.",
    template: "%s · UPLOG",
  },
  description:
    "UPLOG is your team's work platform: log daily work, track tasks, and see what everyone is building — in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${hankenGrotesk.variable} ${chivo.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        {/* Re-applies the user's saved custom colors and icon style before
            first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLORS_SCRIPT + THEME_ICONS_SCRIPT,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="bottom-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
