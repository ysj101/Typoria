import { Outlet } from "react-router";
import { Background } from "../components/Background";

/** 共通レイアウト。背景（#3）を配置し、各画面を <Outlet /> に描画する */
export function Layout() {
  return (
    <>
      <Background />
      <div className="relative min-h-screen text-text">
        <Outlet />
      </div>
    </>
  );
}
