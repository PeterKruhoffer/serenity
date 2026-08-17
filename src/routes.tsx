import { Navigate, Route } from "@solidjs/router";
import { lazy } from "solid-js";
import App from "./App";
import WorkspaceLayout from "./features/workspace/WorkspaceLayout";

const EventsPage = lazy(() => import("./features/events/EventsPage"));
const TemplatesPage = lazy(() => import("./features/templates/TemplatesPage"));
const ApprovalsPage = lazy(() => import("./features/approvals/ApprovalsPage"));
const ParticipantsPage = lazy(() => import("./features/participants/ParticipantsPage"));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage"));
const SignupEmbed = lazy(() => import("./SignupEmbed"));
const RedirectToEvents = () => <Navigate href="/events" />;

export const SerenityRoutes = () => (
  <>
    <Route path="/" component={App}>
      <Route component={WorkspaceLayout}>
        <Route path={["/", "/events", "/callback"]} component={EventsPage} />
        <Route path="/templates" component={TemplatesPage} />
        <Route path="/approvals" component={ApprovalsPage} />
        <Route path="/participants" component={ParticipantsPage} />
        <Route path="/settings" component={SettingsPage} />
      </Route>
    </Route>
    <Route path="/embed/events/:eventId/signup" component={SignupEmbed} />
    <Route path="*all" component={RedirectToEvents} />
  </>
);
