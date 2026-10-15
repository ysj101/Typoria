import { createHashRouter, createMemoryRouter, type RouteObject } from "react-router";
import { Layout } from "./Layout";
import { ROUTES } from "./navigation";
import { Home } from "../pages/Home";
import { Game } from "../pages/Game";
import { CategorySelect } from "../pages/CategorySelect";
import { Glossary } from "../pages/Glossary";
import { Learn } from "../pages/Learn";
import { Result } from "../pages/Result";
import { History } from "../pages/History";
import { Settings } from "../pages/Settings";

/** 画面ルート（docs/spec.md §4 の 5 画面に、学習モード /learn と用語帳を加える） */
export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: ROUTES.game.slice(1), element: <Game /> },
      { path: ROUTES.learn.slice(1), element: <CategorySelect /> },
      { path: ROUTES.learnRound.slice(1), element: <Learn /> },
      { path: ROUTES.glossary.slice(1), element: <Glossary /> },
      { path: ROUTES.result.slice(1), element: <Result /> },
      { path: ROUTES.history.slice(1), element: <History /> },
      { path: ROUTES.settings.slice(1), element: <Settings /> },
      { path: "*", element: <Home /> },
    ],
  },
];

/** オフライン SPA で動くよう hash ルーティングを使う（§14） */
export function createAppRouter() {
  return createHashRouter(routes);
}

/** テスト用 */
export function createTestRouter(
  initialEntries: (string | { pathname: string; state?: unknown })[],
) {
  return createMemoryRouter(routes, { initialEntries });
}
