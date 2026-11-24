import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const REDIRECT_URI =
  `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-callback`;

export const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

export async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data } = await supabase.auth.getUser();
  return data.user;
}

const enc = new TextEncoder();
const b64url = (s: string) =>
  s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(Deno.env.get("GOOGLE_CLIENT_SECRET")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(btoa(String.fromCharCode(...new Uint8Array(sig))));
}

// "state" assinado: diz ao callback de quem é o código, sem precisar de login
export async function makeState(uid: string) {
  const payload = b64url(
    btoa(JSON.stringify({ uid, exp: Date.now() + 10 * 60 * 1000 })),
  );
  return `${payload}.${await hmac(payload)}`;
}

export async function readState(state: string) {
  const [payload, sig] = state.split(".");
  if (!payload || !sig || sig !== (await hmac(payload))) return null;
  const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  return data.exp > Date.now() ? (data.uid as string) : null;
}