import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const rateLimitSalt = Deno.env.get("SPIN_RATE_LIMIT_SALT");
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function corsHeaders(origin: string | null) {
  const allowed = !origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? (origin || "*") : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...corsHeaders(origin) }
  });
}

async function hashClientAddress(address: string, salt: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(address));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins.length && !allowedOrigins.includes("*") && !allowedOrigins.includes(origin)) {
    return jsonResponse({ error: "Origin is not allowed" }, 403, origin);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }
  if (!supabaseUrl || !serviceRoleKey || !rateLimitSalt || !allowedOrigins.length) {
    console.error("Missing public-spin function secrets");
    return jsonResponse({ error: "Spin service is not configured" }, 503, origin);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return jsonResponse({ error: "Request body is too large" }, 413, origin);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400, origin);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse({ error: "Request body must be a JSON object" }, 400, origin);
  }

  const spinRequest = payload as {
    storeId?: unknown;
    sellerId?: unknown;
    idempotencyKey?: unknown;
  };
  if (typeof spinRequest.storeId !== "string" || spinRequest.storeId.length > 64 ||
      typeof spinRequest.sellerId !== "string" || spinRequest.sellerId.length > 128 ||
      typeof spinRequest.idempotencyKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(spinRequest.idempotencyKey)) {
    return jsonResponse({ error: "Store, seller and a UUID idempotency key are required" }, 400, origin);
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientAddress = request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    forwardedFor?.split(",")[0]?.trim() ??
    "unknown";
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: withinLimit, error: rateLimitError } = await client.rpc("consume_spin_rate_limit", {
    p_ip_hash: await hashClientAddress(clientAddress, rateLimitSalt)
  });
  if (rateLimitError) {
    console.error("Rate limit check failed", rateLimitError.message);
    return jsonResponse({ error: "Unable to validate spin request" }, 503, origin);
  }
  if (!withinLimit) {
    return jsonResponse({ error: "Too many spin requests. Try again in a minute." }, 429, origin);
  }

  const { data: result, error } = await client.rpc("record_public_spin", {
    p_store_id: spinRequest.storeId,
    p_seller_id: spinRequest.sellerId,
    p_idempotency_key: spinRequest.idempotencyKey
  });
  if (error) {
    const status = /Unknown store|Active seller not found|different request|exactly 40 positions/i.test(error.message)
      ? 409
      : 500;
    if (status === 500) console.error("Spin recording failed", error.message);
    return jsonResponse({ error: status === 409 ? error.message : "Unable to record this spin" }, status, origin);
  }

  return jsonResponse(result, 200, origin);
});
