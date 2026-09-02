import styles from "./App.module.css";
import { Match, Show, Switch, type Component, type JSX } from "solid-js";
import { useWorkOSAuth } from "./auth";
import { FormError } from "./components/form-error";
import { accountNameFor } from "./display-name";

const App: Component<{ children?: JSX.Element }> = (props) => {
  const auth = useWorkOSAuth();
  const signedInName = () => accountNameFor(auth.user());
  return (
    <div class={styles.app}>
      <header class={styles.appHeader}>
        <a class={styles.wordmark} href="/" aria-label="Serenity home">
          <span class={styles.wordmarkMark} aria-hidden="true">
            S
          </span>
          <span>Serenity</span>
        </a>
        <Show when={auth.isAuthenticated()}>
          <div class={styles.accountSummary} aria-label={`Signed in as ${signedInName()}`}>
            <span class={styles.headerAvatar} aria-hidden="true">
              {signedInName().slice(0, 1).toUpperCase()}
            </span>
            <span class={styles.accountCopy}>
              <strong>{signedInName()}</strong>
              <small>{auth.user()?.email || "WorkOS authenticated"}</small>
            </span>
            <button class="text-button" type="button" onClick={auth.signOut}>
              Sign out
            </button>
          </div>
        </Show>
      </header>
      <main class={styles.appMain}>
        <Switch>
          <Match when={!auth.isConfigured()}>
            <section class={styles.welcome} aria-labelledby="welcome-title">
              <p class="eyebrow">Authentication setup</p>
              <h1 id="welcome-title">Connect WorkOS to continue.</h1>
              <p class="intro">
                Add the WorkOS client ID to this environment to enable Google and GitHub login.
              </p>
              <div class={styles.setupNote} role="status">
                Missing <code>VITE_WORKOS_CLIENT_ID</code>
              </div>
            </section>
          </Match>
          <Match when={auth.isLoading()}>
            <section class={styles.welcome} aria-labelledby="welcome-title">
              <p class="eyebrow">Securing your workspace</p>
              <h1 id="welcome-title">Checking your session…</h1>
              <p class="intro">Serenity is connecting WorkOS AuthKit to Convex.</p>
            </section>
          </Match>
          <Match when={auth.isWorkspaceAuthenticated()}>{props.children}</Match>
          <Match when={auth.isAuthenticated()}>
            <section class={styles.welcome} aria-labelledby="welcome-title">
              <p class="eyebrow">Authentication complete</p>
              <h1 id="welcome-title">You’re signed in.</h1>
              <p class="intro">
                WorkOS recognized {auth.user()?.email}. Serenity is still waiting for the secure
                workspace connection.
              </p>
              <div class={styles.authActions}>
                <button
                  class="primary-button"
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Retry connection <span aria-hidden="true">→</span>
                </button>
              </div>
              <Show when={auth.error()}>
                <FormError>{auth.error()}</FormError>
              </Show>
            </section>
          </Match>
          <Match when={true}>
            <section class={styles.welcome} aria-labelledby="welcome-title">
              <p class="eyebrow">Event operations</p>
              <h1 id="welcome-title">Open your workspace.</h1>
              <p class="intro">Sign in to manage events, schedules, approvals, and participants.</p>
              <div class={styles.authActions}>
                <button class="primary-button" type="button" onClick={() => void auth.signIn()}>
                  Continue to sign in <span aria-hidden="true">→</span>
                </button>
              </div>
              <Show when={auth.error()}>
                <FormError>{auth.error()}</FormError>
              </Show>
              <p class={styles.authNote}>
                Provider selection and verification are securely handled by WorkOS AuthKit.
              </p>
            </section>
          </Match>
        </Switch>
      </main>
      <footer class={styles.appFooter}>
        <span>Serenity</span>
        <span>Event operations</span>
      </footer>
    </div>
  );
};
export default App;
