import { useState } from "react";
import { getModeConfig } from "@/components/RunModeButton";
import type { RunMode } from "@/services/api";

export function useRunMode(initialMode: RunMode = "execute") {
  const [mode, setMode] = useState<RunMode>(initialMode);
  
  const runModes: RunMode[] = ['execute', 'chat'];
  
  const cycleRunMode = () => {
    const currentIndex = runModes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % runModes.length;
    setMode(runModes[nextIndex]);
  };
  
  return {
    mode,
    setMode,
    cycleRunMode,
    getModeConfig,
    runModes,
  };
}