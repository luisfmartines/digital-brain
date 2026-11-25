import { admin, readState, REDIRECT_URI } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const connection = state ? await readState(state) : null;
  const app = connection?.native ? "digitalbrain://calendar" : Deno.env.get("APP_URL")!;
  const back = (status: string) =>
    Response.redirect(`${app}/?calendar=${status}`, 302);
  if (url.searchParams.get("error") || !code || !state) return back("denied");

  if (!connection) return back("error");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await res.json();
  if (!res.ok || !tokens.refresh_token) return back("error");

  const { error } = await admin().from("google_tokens").upsert({
    user_id: connection.uid,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    updated_at: new Date().toISOString(),
  });

  return back(error ? "error" : "connected");
});
