import { useState } from "react";
import type { RunMode } from "@/services/api";

export function useRunMode(initialMode: RunMode = "execute") {
  const [mode, setMode] = useState<RunMode>(initialMode);
  
  const runModes: RunMode[] = ['plan', 'execute', 'review'];
  
  const cycleRunMode = () => {
    const currentIndex = runModes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % runModes.length;
    setMode(runModes[nextIndex]);
  };
  
  const getModeConfig = (mode: RunMode) => {
    switch (mode) {
      case 'execute':
        return { icon: '→', label: 'Execute', color: 'text-green-600' };
      case 'plan':
        return { icon: '◊', label: 'Plan', color: 'text-blue-600' };
      case 'review':
        return { icon: '◈', label: 'Review', color: 'text-purple-600' };
    }
  };
  
  return {
    mode,
    setMode,
    cycleRunMode,
    getModeConfig,
    runModes,
  };
}