export type VoteSubmission = { id: number; hash: `0x${string}`; status: "confirmed" | "reverted" | "pending" };
/** A returned hash is not confirmation. Stop on an uncertain receipt or a wallet
 * rejection so the caller can retain all unsubmitted choices for review. */
export async function submitVoteBatch(
  entries: [number, boolean][],
  send: (id: number, approve: boolean) => Promise<`0x${string}`>,
  receipt: (hash: `0x${string}`) => Promise<{ status: "success" | "reverted" }>,
  onSubmitted: (item: VoteSubmission) => void,
) {
  const submissions: VoteSubmission[] = [];
  const errors: string[] = [];
  for (const [id, approve] of entries) {
    let hash: `0x${string}`;
    try { hash = await send(id, approve); }
    catch { errors.push(`Vote #${id} was not submitted. Your remaining choices are kept for retry.`); break; }
    const item: VoteSubmission = { id, hash, status: "pending" };
    submissions.push(item);
    onSubmitted({ ...item });
    try {
      item.status = (await receipt(hash)).status === "success" ? "confirmed" : "reverted";
      if (item.status === "reverted") errors.push(`Vote #${id} reverted. Review it before retrying.`);
    } catch {
      errors.push(`Vote #${id} was submitted but confirmation is still pending. Check its status before submitting again.`);
      break;
    }
  }
  return { submissions, errors };
}
