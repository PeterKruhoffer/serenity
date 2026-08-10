import {
  LoginRequiredError,
  NoSessionError,
  createClient,
  type User,
} from "@workos-inc/authkit-js";
import type { ConvexClient } from "convex/browser";
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
  isConfigured: () => false,
  isLoading: () => false,
  error: () => null,
  signIn: async () => undefined,
  signOut: () => undefined,
};

const WorkOSAuthContext = createContext<WorkOSAuth>(unavailableAuth);

export const WorkOSAuthProvider: ParentComponent<{ client: ConvexClient }> = (props) => {
  const clientId = import.meta.env.VITE_WORKOS_CLIENT_ID;
  const redirectUri =
    import.meta.env.VITE_WORKOS_REDIRECT_URI || `${window.location.origin}/callback`;
  const [authClient, setAuthClient] = createSignal<WorkOSClient | null>(null);
  const [user, setUser] = createSignal<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(Boolean(clientId));
  const [error, setError] = createSignal<string | null>(null);
  let disposed = false;

  onMount(() => {
    if (!clientId) return;

    void createClient(clientId, {
      redirectUri,
      onRefresh: ({ user: refreshedUser }) => {
        if (!disposed) setUser(refreshedUser);
      },
      onRefreshFailure: () => {
        if (!disposed) {
          setUser(null);
          setIsAuthenticated(false);
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
              setIsAuthenticated(authenticated);
              setIsLoading(false);
            }
          },
        );

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
    isAuthenticated,
    isConfigured: () => Boolean(clientId),
    isLoading,
    error,
    signIn: async () => {
      setError(null);
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
          setIsAuthenticated(false);
          return;
        }
        throw authError;
      }
    },
  };

  return <WorkOSAuthContext.Provider value={value}>{props.children}</WorkOSAuthContext.Provider>;
};

export const useWorkOSAuth = () => useContext(WorkOSAuthContext);
