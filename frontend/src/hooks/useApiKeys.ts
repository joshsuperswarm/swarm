// frontend/src/hooks/useApiKeys.ts
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type CreateApiKeyRes,
  type ListApiKeysRes,
} from "../lib/api-keys";

export function useApiKeys() {
  const { getToken } = useClerkAuth();

  async function authBearer() {
    const bearer = (await getToken?.({ template: "backend" })) || "";
    if (!bearer) throw new Error("Missing Clerk JWT (template: backend)");
    return { bearer };
  }

  async function create(name?: string, ttlDays?: number): Promise<CreateApiKeyRes> {
    const a = await authBearer();
    const res = await createApiKey({ name, ttl_days: ttlDays }, a);
    return res; // NOTE: res.api_key is only returned here (show-once)
  }

  async function list(): Promise<ListApiKeysRes> {
    const a = await authBearer();
    return listApiKeys(a);
  }

  async function revoke(tokenId: string) {
    const a = await authBearer();
    return revokeApiKey(tokenId, a);
  }

  return { create, list, revoke };
}