import type { EditorState } from "../mcp/workspace";

interface Snapshot { revision: number; paused: boolean; state: EditorState }
export async function connectCompanion(api: { getState(): EditorState; apply(state: EditorState): void; status(message: string, conflict?: boolean): void; access(paused: boolean): void }) {
  if (!["127.0.0.1", "localhost"].includes(location.hostname)) return null;
  try {
    const health = await (await fetch("/api/status")).json();
    if (health.app !== "qr-studio-companion") return null;
  } catch { return null; }
  let current: Snapshot;
  let applying = false, pending: EditorState | null = null, saving = false, conflicted = false;
  let timer: ReturnType<typeof setTimeout>;
  async function read(): Promise<Snapshot> {
    const response = await fetch("/api/editor", { cache: "no-store" });
    if (!response.ok) throw new Error("Local companion disconnected.");
    return response.json();
  }
  function apply(snapshot: Snapshot) {
    applying = true;
    try {
      if (!current || current.revision !== snapshot.revision) api.apply(snapshot.state);
      current = snapshot;
      api.access(snapshot.paused);
      api.status(snapshot.paused ? "Editor access paused · Your edits still sync locally" : "Agents connected to this local editor");
    } finally { applying = false; }
  }
  async function save() {
    if (saving || conflicted) return;
    saving = true;
    try {
      while (pending) {
        const next = pending; pending = null;
        const response = await fetch("/api/editor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: next, expectedRevision: current.revision }) });
        if (!response.ok) throw new Error("Editor changed elsewhere or disconnected. Your visible edits are preserved. Reload shared state to reconnect.");
        current = await response.json();
      }
    } catch (error) { conflicted = true; api.status(error instanceof Error ? error.message : "Could not sync editor.", true); }
    finally { saving = false; }
  }
  apply(await read());
  const poll = setInterval(() => {
    if (!pending && !saving && !conflicted) void read().then(snapshot => { if (!pending && !saving && !conflicted) apply(snapshot); }).catch(() => api.status("Local companion disconnected · Your visible code is preserved"));
  }, 800);
  addEventListener("pagehide", () => { clearInterval(poll); clearTimeout(timer); }, { once: true });
  return {
    changed() { if (applying || conflicted) return; pending = structuredClone(api.getState()); clearTimeout(timer); timer = setTimeout(() => void save(), 300); },
    async reload() { clearTimeout(timer); if (saving) return; const next = await read(); pending = null; conflicted = false; current.revision = -1; apply(next); },
    async pause(paused: boolean) {
      const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused }) });
      if (!response.ok) throw new Error("Could not change editor access.");
      const snapshot: Snapshot = await response.json();
      current.paused = snapshot.paused; api.access(snapshot.paused);
      api.status(snapshot.paused ? "Editor access paused · Your edits still sync locally" : "Agents connected to this local editor");
    },
  };
}
