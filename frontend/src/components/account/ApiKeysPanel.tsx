// frontend/src/components/account/ApiKeysPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useApiKeys } from "../../hooks/useApiKeys";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { ApiKeyItem } from "../../lib/api-keys";

export default function ApiKeysPanel() {
  const { create, list, revoke } = useApiKeys();
  const [name, setName] = useState("");
  const [ttlDays, setTtlDays] = useState<number | undefined>(undefined);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await list();
      setKeys(res.keys ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const canCreate = useMemo(() => !loading, [loading]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await create(name || undefined, ttlDays);
      setPlaintext(res.api_key); // show-once
      setName("");
      setTtlDays(undefined);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to create key");
    }
  }

  async function onRevoke(tokenId: string) {
    setError(null);
    try {
      await revoke(tokenId);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to revoke key");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setPlaintext(null); // discard after copy
      alert("API key copied. It won't be shown again.");
    } catch {
      alert("Copy failed—please copy manually.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Create API key</h2>
        <p className="text-sm text-gray-500">
          Keys are shown once on creation. Store them securely.
        </p>
        <form onSubmit={onCreate} className="mt-3 flex gap-2 items-end flex-wrap">
          <label className="flex flex-col">
            <span className="text-sm">Name (optional)</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CLI, Desktop"
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm">TTL days (optional)</span>
            <Input
              type="number"
              min={1}
              value={ttlDays ?? ""}
              onChange={(e) =>
                setTtlDays(e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-28"
              placeholder="30"
            />
          </label>

          <Button
            type="submit"
            disabled={!canCreate}
            variant="outline"
          >
            Create API key
          </Button>
        </form>

        {plaintext && (
          <div className="mt-4 p-3 border rounded bg-gray-50">
            <div className="font-mono break-all">{plaintext}</div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(plaintext)}
              >
                Copy & hide
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPlaintext(null)}
              >
                Hide
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This is the only time you'll see the full key.
            </p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold">Your keys</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-500">No keys yet.</p>
        ) : (
          <ul className="divide-y border rounded">
            {keys.map((k) => (
              <li key={k.token_id} className="p-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {k.name || "Untitled"} • • • • {k.last_four}
                  </div>
                  <div className="text-xs text-gray-500">
                    Created {k.created_at || "—"}
                    {k.last_used_at ? ` • Last used ${k.last_used_at}` : ""}
                    {k.expires_at ? ` • Expires ${k.expires_at}` : ""}
                    {k.revoked_at ? ` • Revoked ${k.revoked_at}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRevoke(k.token_id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}