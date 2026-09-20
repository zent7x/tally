import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FinanceApp from "./FinanceApp";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "../index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary><FinanceApp /></AppErrorBoundary>
  </StrictMode>,
);
