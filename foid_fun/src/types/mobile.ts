export interface BoardNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  type: 'text' | 'image' | 'meme';
}

export interface Point {
  x: number;
  y: number;
}
