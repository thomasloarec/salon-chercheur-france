// src/lib/env.ts
type AnyRecord = Record<string, any>;

export function getEnv(key: string, fallback?: string): string | undefined {
  // Vite
  try {
    const viteEnv = (import.meta as any)?.env as AnyRecord | undefined;
    if (viteEnv && typeof viteEnv[key] === "string") return viteEnv[key];
  } catch {}
  
  // Next (serveur ou code mal bundle)
  try {
    // @ts-ignore
    if (typeof process !== "undefined" && process?.env && typeof process.env[key] === "string") {
      // @ts-ignore
      return process.env[key] as string;
    }
  } catch {}
  
  // Optionnel : injecté sur window
  try {
    if (typeof window !== "undefined") {
      const w = window as any;
      if (w.__ENV && typeof w.__ENV[key] === "string") return w.__ENV[key];
      
      // Supporter NEXT_PUBLIC_ <-> VITE_ miroirs
      const alt = key.startsWith("VITE_")
        ? key.replace(/^VITE_/, "NEXT_PUBLIC_")
        : key.startsWith("NEXT_PUBLIC_")
        ? key.replace(/^NEXT_PUBLIC_/, "VITE_")
        : null;
      if (alt && w.__ENV && typeof w.__ENV[alt] === "string") return w.__ENV[alt];
    }
  } catch {}
  
  return fallback;
}