import { useContext } from "react";
import {
  BackgroundContext,
  DEFAULT_BACKGROUND,
  type BackgroundContextValue,
} from "./backgroundState";

const noop: BackgroundContextValue = {
  background: DEFAULT_BACKGROUND,
  setBackground: () => {},
};

/** 背景演出を制御する。Provider の外では no-op */
export function useBackgroundControl(): BackgroundContextValue {
  return useContext(BackgroundContext) ?? noop;
}
