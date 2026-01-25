import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.didtheleafslose.com"),
  title: "Did the Leafs Lose? | Toronto Maple Leafs Score & Results",
  description:
    "Check if the Toronto Maple Leafs won or lost their latest NHL game. Get instant Leafs scores, game results, and updates for the current season.",
  keywords: [
    "Toronto Maple Leafs",
    "Leafs score",
    "Maple Leafs score",
    "did the Leafs win",
    "did the Leafs lose",
    "Leafs game result",
    "Toronto Maple Leafs score today",
    "Leafs latest game",
    "NHL scores",
    "Maple Leafs results",
  ],
  openGraph: {
    title: "Did the Leafs Lose? | Toronto Maple Leafs Score",
    description:
      "Instantly find out if the Toronto Maple Leafs won or lost their latest NHL game.",
    url: "https://www.didtheleafslose.com",
    siteName: "Did the Leafs Lose?",
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Did the Leafs Lose?",
    description:
      "Check if the Toronto Maple Leafs won or lost their latest NHL game.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://www.didtheleafslose.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1129288606167385"
          crossOrigin="anonymous"
        />
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-ECHWECBCY1"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-ECHWECBCY1');
            `,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
