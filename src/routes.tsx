import { Navigate, Route } from "@solidjs/router";
import App from "./App";
import SignupEmbed from "./SignupEmbed";

const EventsPage = () => <App page="events" />;
const ApprovalsPage = () => <App page="approvals" />;
const ParticipantsPage = () => <App page="participants" />;
const SettingsPage = () => <App page="settings" />;
const RedirectToEvents = () => <Navigate href="/events" />;

export const SerenityRoutes = () => (
  <>
    <Route path={["/", "/events", "/callback"]} component={EventsPage} />
    <Route path="/approvals" component={ApprovalsPage} />
    <Route path="/participants" component={ParticipantsPage} />
    <Route path="/settings" component={SettingsPage} />
    <Route path="/embed/events/:eventId/signup" component={SignupEmbed} />
    <Route path="*all" component={RedirectToEvents} />
  </>
);
