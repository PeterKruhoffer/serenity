import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

type PendingRevision = FunctionReturnType<typeof api.publication.listPending>[number];

type ApprovalCardProps = {
  revision: PendingRevision;
  approving: boolean;
  rejecting: boolean;
  onReview: (decision: "approve" | "reject") => void;
};

export const ApprovalCard = (props: ApprovalCardProps) => (
  <article class="approval-card">
    <div>
      <span>Revision {props.revision.revisionNumber}</span>
      <h3>{props.revision.title}</h3>
      <p>
        {props.revision.teamName} · {props.revision.occurrenceCount} dates ·{" "}
        {props.revision.sessionCount} sessions
      </p>
    </div>
    <div class="approval-actions">
      <button
        class="secondary-button compact-button"
        type="button"
        disabled={props.rejecting}
        onClick={() => props.onReview("reject")}
      >
        Request changes
      </button>
      <button
        class="primary-button compact-button"
        type="button"
        disabled={props.approving}
        onClick={() => props.onReview("approve")}
      >
        Approve & publish
      </button>
    </div>
  </article>
);
