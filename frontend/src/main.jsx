import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import "./styles.css";
import { router } from "./routes/Router";
import { LanguageProvider } from "./layouts/context/LanguageContext";
import "leaflet/dist/leaflet.css";


createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      <RouterProvider router={router} />
    </LanguageProvider>
  </StrictMode>,
);
