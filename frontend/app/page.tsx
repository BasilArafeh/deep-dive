/**
 * Landing page — editorial introduction and research topic entry.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LandingView } from "@/components/landing/LandingView";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return <LandingView />;
}
