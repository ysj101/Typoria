import { useState } from "react";
import { RouterProvider } from "react-router";
import { AppProvider } from "./app/AppContext";
import { createAppRouter } from "./app/router";
import type { AppStorage } from "./app/storage";

export interface AppProps {
  storage?: AppStorage;
}

export default function App({ storage }: AppProps) {
  const [router] = useState(() => createAppRouter());
  return (
    <AppProvider storage={storage}>
      <RouterProvider router={router} />
    </AppProvider>
  );
}
