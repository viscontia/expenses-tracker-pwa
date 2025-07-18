/// <reference types="vinxi/types/client" />

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "./styles.css";
import { TRPCReactProvider } from "./trpc/react";
import { createRouter } from "./router";
import { Toaster } from "react-hot-toast";

// Set up a Router instance
const router = createRouter();

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Unregister any existing service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('Old SW unregistered');
    }

    // Register the new "empty" service worker
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('New SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <TRPCReactProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </TRPCReactProvider>,
  );
}
