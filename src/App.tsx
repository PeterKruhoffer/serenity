import type { Component } from "solid-js";

const App: Component = () => (
  <div class="app">
    <header class="app-header">
      <a class="wordmark" href="/" aria-label="Serenity home">
        <span class="wordmark-mark" aria-hidden="true">
          S
        </span>
        <span>Serenity</span>
      </a>

      <span class="status">
        <span class="status-dot" aria-hidden="true" />
        Ready to build
      </span>
    </header>

    <main class="app-main">
      <section class="welcome" aria-labelledby="welcome-title">
        <p class="eyebrow">A clean foundation</p>
        <h1 id="welcome-title">Start with what matters.</h1>
        <p class="intro">Serenity is ready for the first piece of the real product.</p>

        <div class="next-step">
          <span class="next-step-number" aria-hidden="true">
            01
          </span>
          <div>
            <h2>Build the first feature</h2>
            <p>Replace this welcome screen when the product direction is ready.</p>
          </div>
        </div>
      </section>
    </main>

    <footer class="app-footer">
      <span>Serenity</span>
      <span>Solid · Vite+ · Convex</span>
    </footer>
  </div>
);

export default App;
