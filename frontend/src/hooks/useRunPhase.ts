import { useEffect, useState } from "react";

export function useRunPhase(status?: string | null): "spinning" | "running" | null {
  const [phase, setPhase] = useState<"spinning" | "running" | null>(null);

  useEffect(() => {
    if (status === "spinning") setPhase("spinning");
    else if (status === "running") setPhase("running");
    else setPhase(null);
  }, [status]);

  return phase;
}