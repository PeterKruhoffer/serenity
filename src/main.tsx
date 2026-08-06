import { render } from "solid-js/web";
import { ConvexProvider, setupConvex } from "convex-solidjs";
import App from "./App";
import "./style.css";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Application root element was not found");
}

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "VITE_CONVEX_URL is required. Run `vp run convex:dev` to configure a Convex deployment.",
  );
}

const convexClient = setupConvex(convexUrl);

render(
  () => (
    <ConvexProvider client={convexClient}>
      <App />
    </ConvexProvider>
  ),
  root,
);
