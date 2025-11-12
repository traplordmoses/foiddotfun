"use server";

export type StoredProposalMeta = {
  id: string;
  owner?: string;
  cid?: string;
  cidHash?: `0x${string}`;
  rect?: { x: number; y: number; w: number; h: number };
  cells?: number;
  name?: string;
  mime?: "image/png" | "image/jpeg";
  epoch?: number;
  bidPerCellWei?: string;
  createdAt?: string;
};

class _ProposalStore {
  private byId = new Map<string, StoredProposalMeta>();

  set(meta: StoredProposalMeta) {
    if (!meta?.id) return;
    const existing = this.byId.get(meta.id) ?? {};
    this.byId.set(meta.id, { ...existing, ...meta });
  }

  get(id: string) {
    return this.byId.get(id);
  }
}

export const ProposalStore = new _ProposalStore();
