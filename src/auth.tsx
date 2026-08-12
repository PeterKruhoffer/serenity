import {
  LoginRequiredError,
  NoSessionError,
  createClient,
  type User,
} from "@workos-inc/authkit-js";
import type { ConvexClient } from "convex/browser";
import { useNavigate } from "@solidjs/router";
import {
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentComponent,
} from "solid-js";

type WorkOSAuth = {
  user: Accessor<User | null>;
  isAuthenticated: Accessor<boolean>;
  isWorkspaceAuthenticated: Accessor<boolean>;
  isConfigured: Accessor<boolean>;
  isLoading: Accessor<boolean>;
  error: Accessor<string | null>;
  signIn: () => Promise<void>;
  signOut: () => void;
};

type WorkOSClient = Awaited<ReturnType<typeof createClient>>;

const unavailableAuth: WorkOSAuth = {
  user: () => null,
  isAuthenticated: () => false,
  isWorkspaceAuthenticated: () => false,
  isConfigured: () => false,
  isLoading: () => false,
  error: () => null,
  signIn: async () => undefined,
  signOut: () => undefined,
};

const WorkOSAuthContext = createContext<WorkOSAuth>(unavailableAuth);
const portalSignInParameter = "workos-sign-in";

export const workOSRedirectUri = (configuredRedirectUri: string | undefined, origin: string) =>
  origin.endsWith(".onamp.dev")
    ? `${origin}/callback`
    : configuredRedirectUri || `${origin}/callback`;

export const usesWorkOSDevelopmentStorage = (hostname: string) => hostname.endsWith(".onamp.dev");

export const topLevelSignInUrl = (location: Pick<Location, "href">) => {
  const url = new URL(location.href);
  url.searchParams.set(portalSignInParameter, "true");
  return url.toString();
};

export const WorkOSAuthProvider: ParentComponent<{ client: ConvexClient }> = (props) => {
  const navigate = useNavigate();
  const clientId = import.meta.env.VITE_WORKOS_CLIENT_ID;
  const redirectUri = workOSRedirectUri(
    import.meta.env.VITE_WORKOS_REDIRECT_URI,
    window.location.origin,
  );
  const [authClient, setAuthClient] = createSignal<WorkOSClient | null>(null);
  const [user, setUser] = createSignal<User | null>(null);
  const [isWorkspaceAuthenticated, setIsWorkspaceAuthenticated] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(Boolean(clientId));
  const [error, setError] = createSignal<string | null>(null);
  let disposed = false;

  onMount(() => {
    if (!clientId) return;

    void createClient(clientId, {
      redirectUri,
      devMode: usesWorkOSDevelopmentStorage(window.location.hostname) || undefined,
      onRedirectCallback: () => {
        navigate("/", { replace: true, scroll: false });
      },
      onRefresh: ({ user: refreshedUser }) => {
        if (!disposed) setUser(refreshedUser);
      },
      onRefreshFailure: () => {
        if (!disposed) {
          setUser(null);
          setIsWorkspaceAuthenticated(false);
        }
      },
    })
      .then((workOSClient) => {
        if (disposed) {
          workOSClient.dispose();
          return;
        }

        setAuthClient(workOSClient);
        const initialUser = workOSClient.getUser();
        setUser(initialUser);

        props.client.setAuth(
          async ({ forceRefreshToken }) => {
            try {
              return await workOSClient.getAccessToken({
                forceRefresh: forceRefreshToken,
              });
            } catch (authError) {
              if (authError instanceof LoginRequiredError) return null;
              throw authError;
            }
          },
          (authenticated) => {
            if (!disposed) {
              setIsWorkspaceAuthenticated(authenticated);
              if (!authenticated && user()) {
                setError(
                  "WorkOS sign-in succeeded, but the secure workspace could not verify this session.",
                );
              }
              setIsLoading(false);
            }
          },
        );

        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has(portalSignInParameter)) {
          currentUrl.searchParams.delete(portalSignInParameter);
          window.history.replaceState({}, "", currentUrl);
          if (!initialUser) {
            void workOSClient.signIn().catch((authError: unknown) => {
              if (!disposed) {
                setError(
                  authError instanceof Error ? authError.message : "Unable to start sign in",
                );
              }
            });
          }
        }

        if (!initialUser) setIsLoading(false);
      })
      .catch((authError: unknown) => {
        if (!disposed) {
          setError(authError instanceof Error ? authError.message : "Authentication failed");
          setIsLoading(false);
        }
      });
  });

  onCleanup(() => {
    disposed = true;
    authClient()?.dispose();
  });

  const value: WorkOSAuth = {
    user,
    isAuthenticated: () => user() !== null,
    isWorkspaceAuthenticated,
    isConfigured: () => Boolean(clientId),
    isLoading,
    error,
    signIn: async () => {
      setError(null);
      if (window.self !== window.top) {
        const signInWindow = window.open(topLevelSignInUrl(window.location), "_blank");
        if (!signInWindow) {
          setError("Open Serenity in a new tab to sign in with WorkOS.");
        } else {
          signInWindow.opener = null;
        }
        return;
      }
      const workOSClient = authClient();
      if (!workOSClient) {
        setError("WorkOS AuthKit is not ready yet");
        return;
      }
      try {
        await workOSClient.signIn();
      } catch (authError) {
        setError(authError instanceof Error ? authError.message : "Unable to start sign in");
      }
    },
    signOut: () => {
      const workOSClient = authClient();
      if (!workOSClient) return;

      try {
        workOSClient.signOut({ returnTo: window.location.origin });
      } catch (authError) {
        if (authError instanceof NoSessionError) {
          setUser(null);
          setIsWorkspaceAuthenticated(false);
          return;
        }
        throw authError;
      }
    },
  };

  return <WorkOSAuthContext.Provider value={value}>{props.children}</WorkOSAuthContext.Provider>;
};

export const useWorkOSAuth = () => useContext(WorkOSAuthContext);
