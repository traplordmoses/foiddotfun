// src/lib/proposalStore.ts
export type StoredProposal = {
  id: string;
  owner?: string;
  cid?: string;
  cidHash?: `0x${string}`;
  name?: string;
  filename?: string;
  mime?: "image/png" | "image/jpeg";
  width?: number;
  height?: number;
  epoch?: number;
  rect?: { x: number; y: number; w: number; h: number };
  bidPerCellWei?: string | number | bigint;
};

class _ProposalStore {
  private map = new Map<string, StoredProposal>();

  get(id: string) {
    return this.map.get(id);
  }
  set(id: string, value: StoredProposal) {
    this.map.set(id, { ...value, id });
  }
  upsert(value: StoredProposal) {
    if (!value?.id) return;
    const prev = this.map.get(value.id);
    this.map.set(value.id, { ...prev, ...value, id: value.id });
  }
  has(id: string) {
    return this.map.has(id);
  }
  delete(id: string) {
    this.map.delete(id);
  }
  all() {
    return Array.from(this.map.values());
  }
}

// HMR-safe singleton (Next.js dev)
const g = globalThis as any;
export const ProposalStore: _ProposalStore =
  g.__proposalStore ?? (g.__proposalStore = new _ProposalStore());
