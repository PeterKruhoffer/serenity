import styles from "./approvals.module.css";
import { useMutation, useQuery } from "convex-solidjs";
import { For, Show, createSignal } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "../../components/empty-state";
import { FormError } from "../../components/form-error";
import { Page } from "../../components/page";
import { SectionHeader } from "../../components/section-header";
import { convexErrorMessage } from "../../lib/convex-error-message";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { ApprovalCard } from "./ApprovalCard";

type OrganizationRole = "administrator" | "super_user" | "event_manager";

const canReviewRevisions = (role: OrganizationRole | undefined) =>
  role === "administrator" || role === "super_user";

export default function ApprovalsPage() {
  const { activeOrganization } = useWorkspace();
  const pendingRevisions = useQuery(
    api.publication.listPending,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: canReviewRevisions(activeOrganization()?.role) }),
  );
  const approveRevision = useMutation(api.publication.approve);
  const rejectRevision = useMutation(api.publication.reject);
  const [formError, setFormError] = createSignal<string | null>(null);

  const handleReview = async (
    revisionId: Id<"event_revisions">,
    decision: "approve" | "reject",
  ) => {
    setFormError(null);
    try {
      if (decision === "approve") {
        await approveRevision.mutate({ revisionId, note: "" });
      } else {
        await rejectRevision.mutate({ revisionId, note: "Changes requested by reviewer" });
      }
    } catch (error) {
      setFormError(convexErrorMessage(error));
    }
  };

  return (
    <Page.Root labelledBy="approvals-page-title">
      <Page.Header variant="page">
        <Page.Heading>
          <Page.Eyebrow>Publication review</Page.Eyebrow>
          <Page.Title id="approvals-page-title">Approvals</Page.Title>
          <Page.Description>Review submitted revisions before they are published.</Page.Description>
        </Page.Heading>
        <Page.Meta>{pendingRevisions.data()?.length ?? 0} pending</Page.Meta>
      </Page.Header>
      <Show when={formError()}>
        <FormError>{formError()}</FormError>
      </Show>
      <Show
        when={canReviewRevisions(activeOrganization()?.role)}
        fallback={
          <EmptyState.Root class="empty-page-state">
            <EmptyState.Icon>✓</EmptyState.Icon>
            <EmptyState.Content>
              <EmptyState.Title as="h2">
                Approvals are handled by administrators and super users.
              </EmptyState.Title>
              <EmptyState.Description>
                You can still track submitted events from the Events page.
              </EmptyState.Description>
            </EmptyState.Content>
          </EmptyState.Root>
        }
      >
        <section class={styles.approvalsSection} aria-labelledby="approvals-title">
          <SectionHeader.Root>
            <SectionHeader.Heading>
              <SectionHeader.Eyebrow>Safety boundary</SectionHeader.Eyebrow>
              <SectionHeader.Title id="approvals-title">Awaiting review</SectionHeader.Title>
            </SectionHeader.Heading>
            <SectionHeader.Count>
              {pendingRevisions.data()?.length ?? 0} pending
            </SectionHeader.Count>
          </SectionHeader.Root>
          <div class={styles.approvalList}>
            <Show
              when={(pendingRevisions.data()?.length ?? 0) > 0}
              fallback={
                <EmptyState.Root class={`empty-page-state ${styles.compactEmptyState}`}>
                  <EmptyState.Icon>✓</EmptyState.Icon>
                  <EmptyState.Content>
                    <EmptyState.Title as="h2">Everything is reviewed.</EmptyState.Title>
                    <EmptyState.Description>
                      New submissions will appear here when they are ready.
                    </EmptyState.Description>
                  </EmptyState.Content>
                </EmptyState.Root>
              }
            >
              <For each={pendingRevisions.data()}>
                {(revision) => (
                  <ApprovalCard
                    revision={revision}
                    approving={approveRevision.isLoading()}
                    rejecting={rejectRevision.isLoading()}
                    onReview={(decision) => void handleReview(revision.id, decision)}
                  />
                )}
              </For>
            </Show>
          </div>
        </section>
      </Show>
    </Page.Root>
  );
}
