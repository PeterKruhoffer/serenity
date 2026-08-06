import { Match, Show, Switch, type Component } from "solid-js";
import { useWorkOSAuth } from "./auth";

const App: Component = () => {
  const auth = useWorkOSAuth();
  const displayName = () => {
    const currentUser = auth.user();
    if (!currentUser) return "there";
    return currentUser.firstName || currentUser.email;
  };

  return (
    <div class="app">
      <header class="app-header">
        <a class="wordmark" href="/" aria-label="Serenity home">
          <span class="wordmark-mark" aria-hidden="true">
            S
          </span>
          <span>Serenity</span>
        </a>

        <Show
          when={auth.isAuthenticated()}
          fallback={
            <span class="status">
              <span class="status-dot" aria-hidden="true" />
              Secure workspace
            </span>
          }
        >
          <button class="text-button" type="button" onClick={auth.signOut}>
            Sign out
          </button>
        </Show>
      </header>

      <main class="app-main">
        <Switch>
          <Match when={!auth.isConfigured()}>
            <section class="welcome" aria-labelledby="welcome-title">
              <p class="eyebrow">Authentication setup</p>
              <h1 id="welcome-title">Connect WorkOS to continue.</h1>
              <p class="intro">
                Add the WorkOS client ID to this environment to enable Google and GitHub login.
              </p>
              <div class="setup-note" role="status">
                Missing <code>VITE_WORKOS_CLIENT_ID</code>
              </div>
            </section>
          </Match>

          <Match when={auth.isLoading()}>
            <section class="welcome" aria-labelledby="welcome-title">
              <p class="eyebrow">Securing your workspace</p>
              <h1 id="welcome-title">Checking your session…</h1>
              <p class="intro">Serenity is connecting WorkOS AuthKit to Convex.</p>
            </section>
          </Match>

          <Match when={auth.isAuthenticated()}>
            <section class="welcome" aria-labelledby="welcome-title">
              <p class="eyebrow">Workspace ready</p>
              <h1 id="welcome-title">Welcome, {displayName()}.</h1>
              <p class="intro">
                Your WorkOS session is verified and authenticated requests are connected to Convex.
              </p>
              <div class="identity-card">
                <span class="avatar" aria-hidden="true">
                  {displayName().slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{auth.user()?.email}</strong>
                  <span>Authenticated with WorkOS AuthKit</span>
                </div>
              </div>
            </section>
          </Match>

          <Match when={true}>
            <section class="welcome" aria-labelledby="welcome-title">
              <p class="eyebrow">Your work, in one calm place</p>
              <h1 id="welcome-title">Start with what matters.</h1>
              <p class="intro">
                Sign in securely with Google or GitHub to open your Serenity workspace.
              </p>
              <div class="auth-actions">
                <button
                  class="primary-button"
                  type="button"
                  onClick={() => void auth.signIn("GoogleOAuth")}
                >
                  Continue with Google
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  class="secondary-button"
                  type="button"
                  onClick={() => void auth.signIn("GitHubOAuth")}
                >
                  Continue with GitHub
                </button>
                <button class="email-button" type="button" onClick={() => void auth.signIn()}>
                  Continue with email
                </button>
              </div>
              <Show when={auth.error()}>
                <p class="auth-error" role="alert">
                  {auth.error()}
                </p>
              </Show>
              <p class="auth-note">Authentication is securely handled by WorkOS AuthKit.</p>
            </section>
          </Match>
        </Switch>
      </main>

      <footer class="app-footer">
        <span>Serenity</span>
        <span>Solid · Vite+ · Convex · WorkOS</span>
      </footer>
    </div>
  );
};

export default App;
