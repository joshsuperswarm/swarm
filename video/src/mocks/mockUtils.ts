import { type ClassValue, clsx } from "clsx";

// Mock utility function
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}