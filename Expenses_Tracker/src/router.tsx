import { jsxDEV } from "react/jsx-dev-runtime";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "~/generated/tanstack-router/routeTree.gen";
import { TRPCReactProvider } from "./trpc/react";

export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPendingComponent: () => <div>Loading...</div>,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
