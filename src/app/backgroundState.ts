import { createContext } from "react";
import type { BackgroundMode } from "../components/Background";

export interface BackgroundState {
  mode: BackgroundMode;
  intensity: number;
}

export interface BackgroundContextValue {
  background: BackgroundState;
  setBackground(next: BackgroundState): void;
}

export const DEFAULT_BACKGROUND: BackgroundState = { mode: "normal", intensity: 0 };

export const BackgroundContext = createContext<BackgroundContextValue | null>(null);
