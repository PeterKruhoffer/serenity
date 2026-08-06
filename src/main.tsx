import { render } from "solid-js/web";
import App from "./App";
import "./style.css";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Application root element was not found");
}

render(() => <App />, root);
