import { Outlet } from "react-router";
import { Background } from "../components/Background";
import { BackgroundProvider } from "./BackgroundContext";
import { useBackgroundControl } from "./useBackgroundControl";

function LayoutInner() {
  const { background } = useBackgroundControl();
  return (
    <>
      <Background mode={background.mode} intensity={background.intensity} />
      <div className="relative min-h-screen text-text">
        <Outlet />
      </div>
    </>
  );
}

/**
 * 共通レイアウト。背景（#3）を配置し、各画面を <Outlet /> に描画する。
 * 背景の演出段階は画面側から `useBackgroundControl` で制御できる（#23）。
 */
export function Layout() {
  return (
    <BackgroundProvider>
      <LayoutInner />
    </BackgroundProvider>
  );
}
