export type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  image: string;
};

export const products: Product[] = [
  {
    id: "calacatta-gold",
    name: "Calacatta Gold",
    slug: "calacatta-gold",
    category: "Italian Marble",
    description: "Soft white marble with warm veining for elegant interiors.",
    image: "/images/products/calacatta-gold.jpg",
  },
  {
    id: "statuario-classic",
    name: "Ambaji White",
    slug: "statuario-classic",
    category: "Premium Marble",
    description: "A crisp, high-contrast surface suited to statement spaces.",
    image: "/images/products/statuario-classic.jpg",
  },
  {
    id: "emperador-dark",
    name: "Emperador Dark",
    slug: "emperador-dark",
    category: "Designer Stone",
    description: "Rich brown marble with subtle drama and timeless depth.",
    image: "/images/products/emperador-dark.jpg",
  },
];
