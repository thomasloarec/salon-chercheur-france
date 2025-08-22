export async function debugFetch(url: string, options: RequestInit & { debugLabel?: string } = {}) {
  const { debugLabel, ...rest } = options;
  const start = Date.now();
  console.group(`🔍 ${debugLabel || "fetch"}`); 
  console.log("URL:", url, "opts:", rest);
  
  try {
    const res = await fetch(url, { mode:"cors", credentials:"omit", cache:"no-cache", ...rest });
    console.log(`✅ ${res.status} ${res.statusText} (${Date.now()-start}ms)`);
    
    try { 
      const clone = res.clone(); 
      const json = await clone.json(); 
      console.log("Body:", json); 
    } catch {}
    
    console.groupEnd(); 
    return res;
  } catch (err:any) {
    console.error(`❌ Fetch failed (${Date.now()-start}ms):`, err?.message || err);
    console.groupEnd(); 
    throw err;
  }
}