import { render } from "solid-js/web";
import { ConvexProvider, setupConvex } from "convex-solidjs";
import { Route, Router } from "@solidjs/router";
import App from "./App";
import { WorkOSAuthProvider } from "./auth";
import "./style.css";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Application root element was not found");
}

render(() => {
  const convex = setupConvex(import.meta.env.VITE_CONVEX_URL);

  return (
    <ConvexProvider client={convex}>
      <WorkOSAuthProvider client={convex}>
        <Router>
          <Route path="*all" component={App} />
        </Router>
      </WorkOSAuthProvider>
    </ConvexProvider>
  );
}, root);
