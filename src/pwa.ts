import { registerSW } from "virtual:pwa-register";

/** Service Worker を登録する（§14 オフライン）。autoUpdate のため更新は自動で反映される */
export function registerPwa(): void {
  if (!("serviceWorker" in navigator)) return;
  registerSW({ immediate: true });
}
