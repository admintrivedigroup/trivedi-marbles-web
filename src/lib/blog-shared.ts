export type BlogPost = {
  id: string;
  title: string;
  category: string;
  date: string; // ISO date: YYYY-MM-DD
  excerpt: string;
  cover_image: string;
  content: string[];
  published: boolean;
  created_at: string;
};

export function formatBlogDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
