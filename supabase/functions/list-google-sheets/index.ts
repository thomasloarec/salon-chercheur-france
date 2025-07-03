import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate, Header } from "https://deno.land/x/djwt@v2.8/mod.ts";

// Charger la clé du Service Account
const serviceAccount = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!);

// Helper pour transformer la clé PEM en ArrayBuffer
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr.buffer;
}

async function getAccessToken() {
  // Convertir PEM -> CryptoKey
  const keyDer = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Préparer JWT
  const header: Header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: getNumericDate(60 * 60),
    iat: getNumericDate(0),
  };

  // Créer l'assertion signée
  const assertion = await create(header, payload, cryptoKey);

  // Échanger contre un access_token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const { access_token } = await res.json();
  console.log('✅ Obtained access_token, length:', access_token.length);
  return access_token;
}

serve(async (req) => {
  console.log('📥 list-google-sheets called, method:', req.method);
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  };
  if (req.method === "OPTIONS") {
    console.log('↔️ Preflight OPTIONS request');
    return new Response(null, { status: 204, headers: CORS });
  }
  try {
    console.log('🔐 Generating access token...');
    const token = await getAccessToken();
    console.log('🌐 Fetching Drive files list from Google API...');
    const driveRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?mimeType=application/vnd.google-apps.spreadsheet&pageSize=100",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('🔄 Drive API response status:', driveRes.status);
    const driveText = await driveRes.text();
    console.log('🔄 Drive API raw body:', driveText);
    // Puis retransformer en JSON si ok
    const driveJson = JSON.parse(driveText);
    const files = driveJson.files;
    return new Response(JSON.stringify({ files }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('❌ list-google-sheets error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
    }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});