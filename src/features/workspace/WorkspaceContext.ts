import type { FunctionReturnType } from "convex/server";
import { createContext, useContext, type Accessor } from "solid-js";
import { api } from "../../../convex/_generated/api";

export type WorkspaceData = FunctionReturnType<typeof api.workspace.list>;
export type Organization = WorkspaceData["organizations"][number];

export type WorkspaceContextValue = {
  workspace: Accessor<WorkspaceData>;
  activeOrganization: Accessor<Organization>;
};

export const WorkspaceContext = createContext<WorkspaceContextValue>();

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within a WorkspaceLayout provider");
  return context;
};
