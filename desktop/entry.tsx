import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/styles.css";
import { Dashboard } from "../src/routes/index";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
