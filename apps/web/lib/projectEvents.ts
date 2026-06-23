export const PROJECT_UPDATED_EVENT = "landweaver:project-updated";

export function notifyProjectUpdated(projectId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECT_UPDATED_EVENT, { detail: { projectId } }));
}
