import { render } from "solid-js/web";
import { ConvexProvider, setupConvex } from "convex-solidjs";
import { Router, type RouteSectionProps } from "@solidjs/router";
import { WorkOSAuthProvider } from "./auth";
import { SerenityRoutes } from "./routes";
import "./style.css";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Application root element was not found");
}

render(() => {
  const convex = setupConvex(import.meta.env.VITE_CONVEX_URL);
  const RouteRoot = (props: RouteSectionProps) =>
    window.location.pathname.startsWith("/embed/") ? (
      props.children
    ) : (
      <WorkOSAuthProvider client={convex}>{props.children}</WorkOSAuthProvider>
    );

  return (
    <ConvexProvider client={convex}>
      <Router root={RouteRoot}>
        <SerenityRoutes />
      </Router>
    </ConvexProvider>
  );
}, root);
