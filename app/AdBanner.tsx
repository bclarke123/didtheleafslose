"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export function AdBanner() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

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
