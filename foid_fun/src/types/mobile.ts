export interface BoardNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  type: 'text' | 'image' | 'meme';
  /** 'voting' for proposals under vote, 'canonized' for finalized placements */
  status?: 'voting' | 'canonized';
  /** Vote counts (only for voting proposals) */
  forCount?: number;
  againstCount?: number;
}

export interface Point {
  x: number;
  y: number;
}
