export interface Post {
  id: string;            // UUID
  url: string;
  title: string;
  dateAdded: number;     // epoch ms
  rating: number;        // 0.0–5.0
  read: boolean;
}
