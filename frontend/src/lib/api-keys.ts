// frontend/src/lib/api-keys.ts
export const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

export type CreateApiKeyReq = {
  name?: string;
  ttl_days?: number;
};

export type CreateApiKeyRes = {
  api_key: string;
  token_id: string;
  name?: string | null;
  last_four: string;
  expires_at?: string | null;
  created_at: string;
};

export type ApiKeyItem = {
  token_id: string;
  name?: string | null;
  last_four: string;
  created_at?: string | null;
  last_used_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
};

export type ListApiKeysRes = { keys: ApiKeyItem[] };

export type AuthHeaders = { bearer: string } | { apiKey: string };

function buildHeaders(auth: AuthHeaders): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if ("bearer" in auth) h.Authorization = `Bearer ${auth.bearer}`;
  else h["X-API-Key"] = auth.apiKey;
  return h;
}

export async function createApiKey(
  body: CreateApiKeyReq,
  auth: AuthHeaders
): Promise<CreateApiKeyRes> {
  const res = await fetch(`${BASE_URL}/api/auth/api-keys`, {
    method: "POST",
    headers: buildHeaders(auth),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function listApiKeys(auth: AuthHeaders): Promise<ListApiKeysRes> {
  const res = await fetch(`${BASE_URL}/api/auth/api-keys`, {
    headers: buildHeaders(auth),
  });
  if (!res.ok) throw new Error(`List failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function revokeApiKey(
  tokenId: string,
  auth: AuthHeaders
): Promise<{ success: boolean }> {
  const res = await fetch(
    `${BASE_URL}/api/auth/api-keys/${encodeURIComponent(tokenId)}`,
    { method: "DELETE", headers: buildHeaders(auth) }
  );
  if (!res.ok) throw new Error(`Revoke failed: ${res.status} ${res.statusText}`);
  return res.json();
}