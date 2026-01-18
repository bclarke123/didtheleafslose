"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdBannerProps {
  size?: "small" | "large";
}

export function AdBanner({ size = "small" }: AdBannerProps) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  if (size === "large") {
    return (
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-1129288606167385"
        data-ad-slot="auto"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    );
  }

  return (
    <ins
      className="adsbygoogle h-[50px] sm:h-[90px]"
      style={{ display: "block" }}
      data-ad-client="ca-pub-1129288606167385"
      data-ad-slot="auto"
      data-ad-format="horizontal"
      data-full-width-responsive="true"
    />
  );
}
