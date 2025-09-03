// Production-safe debug logging
const isProduction = typeof window !== 'undefined' && window.location.hostname === 'lotexpo.com';

export async function debugFetch(url: string, options: RequestInit & { debugLabel?: string } = {}) {
  const { debugLabel, ...rest } = options;
  const start = Date.now();
  
  if (!isProduction) {
    console.group(`🔍 ${debugLabel || "fetch"}`); 
    console.log("URL:", url, "opts:", rest);
  }
  
  try {
    const res = await fetch(url, { mode:"cors", credentials:"omit", cache:"no-cache", ...rest });
    
    if (!isProduction) {
      console.log(`✅ ${res.status} ${res.statusText} (${Date.now()-start}ms)`);
      
      // Only log response body in development
      try { 
        const clone = res.clone(); 
        const json = await clone.json(); 
        console.log("Body:", json); 
      } catch {}
      
      console.groupEnd(); 
    }
    
    return res;
  } catch (err:any) {
    if (!isProduction) {
      console.error(`❌ Fetch failed (${Date.now()-start}ms):`, err?.message || err);
      console.groupEnd(); 
    }
    throw err;
  }
}