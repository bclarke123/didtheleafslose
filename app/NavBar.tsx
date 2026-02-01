"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavBar() {
  const pathname = usePathname();

  let rightLink: { href: string; label: string };
  if (pathname.startsWith("/archive/")) {
    rightLink = { href: "/archive", label: "Archive" };
  } else if (pathname === "/archive") {
    rightLink = { href: "/", label: "Latest Game" };
  } else {
    rightLink = { href: "/archive", label: "Archive" };
  }

  return (
    <nav className="bg-[#00205B] text-white px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-bold text-lg hover:text-gray-200">
        Did the Leafs Lose?
      </Link>
      <Link href={rightLink.href} className="text-sm hover:text-gray-200">
        {rightLink.label}
      </Link>
    </nav>
  );
}
