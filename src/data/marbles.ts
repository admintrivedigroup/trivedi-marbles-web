export type MarbleImage = {
  image: string;
  name: string;
};

export type Marble = {
  id: string;
  name: string;
  color: string;
  finish: string;
  thickness: string;
  description: string;
  image: string;
  imageName: string;
  gallery: MarbleImage[];
  applications: string;
  origin: string;
};

export type SignatureProject = {
  id: string;
  title: string;
  location: string;
  image: string;
  imageAlt: string;
  heightClassName?: string;
};

export const marbles: Marble[] = [
  {
    id: "1",
    name: "Ambaji White - A Essence of Purity and Contrast",
    color: "White",
    finish: "Mirror Finish, Honed Finish, Leather Finish,",
    thickness: "20mm",
    description:
      "A true testament to elegance and sophistication, Ambaji White is a masterpiece of purity and contrast. This Premium white marble, sourced from the finest quarry in the world of D.K. Trivedi & Sons, features a pristine surface with subtle veins, creating a scene and luxurious aesthetic that elevates any space. Ideal for grand flooring, statement walls, and refined countertops, Ambaji White brings timeless beauty and a touch of opulence to both residential and commercial interiors.",
    image: "/images/ambaji_white_mirror.webp",
    imageName: "Mirror",
    gallery: [
      { image: "/images/ambaji_white_honed.webp", name: "Honed" },
      { image: "/images/ambaji_white_leather.webp", name: "Leather" },
    ],
    applications: "Flooring, Wall Cladding, Countertops",
    origin: "India - Ambaji",
  },
  {
    id: "2",
    name: "Fusion Black - A Statement of Darkness and Gold",
    color: "Black",
    finish: "Mirror Finish, Leather Finish, Honed Finish, Lappato Finish",
    thickness: "20mm",
    description:
      "Fusion Black is a masterpiece of nature, a striking fusion of deep black, earthy browns, and flowing golden veins, creating a mesmerizing, timeless aesthetic. Ideal for both contemporary and classic interiors, this exotic marble embodies sophistication and luxury, making it a perfect choice for dramatic feature walls, elegant vanity tops, and statement counters that captivate attention and elevate design.",
    image: "/images/fusionblack_lappato.webp",
    imageName: "Lappato",
    gallery: [
      { image: "/images/fusion_black_mirror.webp", name: "Mirror" },
      { image: "/images/fusionblack_leather.webp", name: "Leather" },
      { image: "/images/fusionblack_honed.webp", name: "Honed" },
    ],
    applications: "Accent Walls, Vanity Tops, Feature Counters",
    origin: "India - Ambaji",
  },
  {
    id: "3",
    name: "Exotic Green - A Symphony of Nature's Elegance",
    color: "Green",
    finish: "Mirror Polished",
    thickness: "20mm",
    description:
      "Inspired by the lush tones of nature, Exotic Green from our Exotic Collection is a masterpiece of elegance and grandeur. With its deep green hues blended seamlessly with earthy textures, this marble transforms any space into a statement of luxury and refinement. Perfect for feature walls, tabletops, and bathroom surfaces, Exotic Green infuses interiors with a rich, natural beauty that captivates the senses and elevates design to new heights.",
    image: "/images/exoticgreen.webp",
    imageName: "Mirror",
    gallery: [],
    applications: "Feature Walls, Tabletops, Bathrooms",
    origin: "India - Ambaji",
  },
  {
    id: "4",
    name: "Ice White - Timeless Elegence in Every Vein",
    color: "White",
    finish: "Mirror Finish, Leather Finish, Honed Finish, Lappato Finish",
    thickness: "20mm",
    description:
      "A haemonious blend of purity and strength, Ice White from our Venetian Collection is a masterpiece of natural artistry. Its soft white canavs, rich in calcium, is beautifully enriched with bold quartz veins in shades of black, adding depth and character to any space. Ideal for flooring, statement walls, and high-end hospitality interiors, Ice White brings a timeless elegance and a touch of sophistication to both residential and commercial projects.",
    image: "/images/icewhite_mirror.webp",
    imageName: "Mirror",
    gallery: [{ image: "/images/icewhite_leather.webp", name: "Leather" },
    { image: "/images/icewhite_honed.webp", name: "Honed" },
    { image: "/images/icewhite_lappato.webp", name: "Lappato" }
    ],
    applications: "Flooring, Statement Walls, Hospitality Interiors",
    origin: "India - Ambaji",
  },
  {
    id: "5",
    name: "Lava Green - Nature's Artistic Marvel",
    color: "Green",
    finish: "Mirror Finish, Honed Finish",
    thickness: "20mm",
    description:
      " A striking blend of earthy greens and deep textures, Lava Green from our Exotic Collection is a rare masterpiece inspired by nature's raw beauty. Its dynamic patterns and rich color palette make it an exceptional choice for creating bold and luxurious spaces.",
    image: "/images/lavagreenmirror.webp",
    imageName: "Mirror",
    gallery: [{ image: "/images/lavagreen_honed.webp", name: "Honed" }],
    applications: "Feature Panels, Reception Desks, Wall Cladding",
    origin: "India - Ambaji",
  },
  {
    id: "6",
    name: "Fusion Green Extra - Nature's gift of Elegance and Depth",
    color: "Green",
    finish: "Mirror Finish, Honed Finish, Leather Finish, Lappato Finish",
    thickness: "20mm",
    description:
      "Fusion Green Extra (FGE) is inspired by the tranquil hues of nature. This masterpiece is a  fusion of soft green tones with striking veins of grey and white. This exquisite marble excudes serenity and sophistication, making it a perfect choice for luxury interiors and architectural marvels. Ideal for flooring, wall cladding, and statement pieces, Fusion Green Extra brings a touch of natural elegance and timeless beauty to any space.",
    image: "/images/fge_mirror.webp",
    imageName: "Mirror",
    gallery: [{ image: "/images/fge_honed.webp", name: "Honed" },
      { image: "/images/fge_leather.webp", name: "Leather" },
      { image: "/images/fge_lappato.webp", name: "Lappato" }
    ],
    applications: "Flooring, Bathrooms, Wall Cladding",
    origin: "India - Ambaji",
  },
  {
    id: "7",
    name: "Fusion Brown",
    color: "Brown",
    finish: "Mirror Finish, Honed Finish, Leather Finish, Lappato Finish",
    thickness: "20mm",
    description:
      "Fusion Brown features rich brown tones layered with natural movement and depth, making it a strong fit for warm, luxurious interiors. Suitable for statement walls, flooring, and counters, it brings a grounded, premium character to residential and commercial spaces.",
    image: "/images/fusionbrown_mirror.webp",
    imageName: "Mirror",
    gallery: [{ image: "/images/fusionbrown_honed.webp", name: "Honed" },
      { image: "/images/fusionbrown_leather.webp", name: "Leather" },
      { image: "/images/fusionbrown_lappato.webp", name: "Lappato" }
    ],
    applications: "Flooring, Wall Cladding, Countertops",
    origin: "India - Ambaji",
  },
];

export const signatureProjects: SignatureProject[] = [
  {
    id: "baps-london",
    title: "THE BAPS SHRI SWAMINARAYAN MANDIR",
    location: "Neasden, London",
    image: "/images/baps_temple_london.webp",
    imageAlt: "The BAPS Shri Swaminarayan Mandir in Neasden, London",
  },
  {
    id: "palitana-jain-temples",
    title: "THE SHRI PALITANA JAIN TEMPLES",
    location: "Palitana, Gujarat",
    image: "/images/spj_temple.webp",
    imageAlt: "The Shri Palitana Jain Temples in Palitana, Gujarat",
  },
  {
    id: "swaminarayan-bhuj",
    title: "THE SHRI SWAMINARAYAN BHUJ TEMPLE",
    location: "Bhuj, Gujarat",
    image: "/images/baps_temple_bhuj.webp",
    imageAlt: "The Shri Swaminarayan Bhuj Temple in Bhuj, Gujarat",
    heightClassName: "h-[30.8rem]",
  },
];

export const marbleColors = ["All", ...new Set(marbles.map((marble) => marble.color))];

export const getMarbleById = (id: string) =>
  marbles.find((marble) => marble.id === id);
