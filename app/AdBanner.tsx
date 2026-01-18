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
      className="adsbygoogle"
      style={{ display: "block", height: 90, maxWidth: 728 }}
      data-ad-client="ca-pub-1129288606167385"
      data-ad-slot="auto"
      data-ad-format="horizontal"
      data-full-width-responsive="true"
    />
  );
}
