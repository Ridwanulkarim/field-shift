import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import "./styles.css";
import { router } from "./routes/Router";
import { LanguageProvider } from "./layouts/context/LanguageContext";
import { SelectionProvider } from "./layouts/context/SelectionContext";
import "leaflet/dist/leaflet.css";
import { warmUpApi } from "./hooks/useAxios";

warmUpApi();


createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      <SelectionProvider>
        <RouterProvider router={router} />
      </SelectionProvider>
    </LanguageProvider>
  </StrictMode>,
);
