import { Category, Package } from "./types";

export const SAMPLE_PACKAGES: Package[] = [
  {
    id: "pkg_1",
    name: "Santorini Sunset Escapade",
    destination: "Santorini, Greece",
    price: 1200,
    description: "Experience the iconic blue domes and breathtaking sunsets of Oia. Includes luxury villa stay and private boat tour.",
    images: ["https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&q=80&w=800"],
    category: Category.Luxury,
    rating: 4.9,
    totalReviews: 128,
    tags: ["Greece", "Sunset", "Romance", "Mediterranean"]
  },
  {
    id: "pkg_2",
    name: "Kyoto Zen Discovery",
    destination: "Kyoto, Japan",
    price: 1500,
    description: "Immerse yourself in tradition with tea ceremonies, temple visits, and a stay in a classic ryokan.",
    images: ["https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=800"],
    category: Category.Cultural,
    rating: 4.8,
    totalReviews: 85,
    tags: ["Japan", "Zen", "Temples", "Tradition"]
  },
  {
    id: "pkg_3",
    name: "Maldives Overwater Bliss",
    destination: "Baa Atoll, Maldives",
    price: 3500,
    description: "Unparalleled luxury in an overwater bungalow. Perfect for honeymooners and sun seekers.",
    images: ["https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&q=80&w=800"],
    category: Category.Beach,
    rating: 5.0,
    totalReviews: 42,
    tags: ["Maldives", "Ocean", "Luxury", "Tropical"]
  },
  {
    id: "pkg_4",
    name: "Patagonia Trekking Adventure",
    destination: "Torres del Paine, Chile",
    price: 2200,
    description: "Conquer the 'W' trek and see glaciers, granite towers, and untouched wilderness.",
    images: ["https://images.unsplash.com/photo-1511316695145-4992006ffddb?auto=format&fit=crop&q=80&w=800"],
    category: Category.Adventure,
    rating: 4.7,
    totalReviews: 67,
    tags: ["Hiking", "Chile", "Nature", "Wilderness"]
  },
  {
    id: "pkg_5",
    name: "Swiss Alps Mastery",
    destination: "Zermatt, Switzerland",
    price: 2800,
    description: "Skiing in the shadow of the Matterhorn. Cozy cabins and world-class slopes await.",
    images: ["https://images.unsplash.com/photo-1531210483974-4f8c1f33f103?auto=format&fit=crop&q=80&w=800"],
    category: Category.Nature,
    rating: 4.9,
    totalReviews: 54,
    tags: ["Skiing", "Mountains", "Winter", "Luxury"]
  },
  {
    id: "pkg_6",
    name: "Amalfi Coast Explorer",
    destination: "Positano, Italy",
    price: 1800,
    description: "Drive along the winding cliffs, eat fresh seafood, and enjoy the 'Dolce Vita'.",
    images: ["https://images.unsplash.com/photo-1533929736458-ca588d08c8be?auto=format&fit=crop&q=80&w=800"],
    category: Category.Luxury,
    rating: 4.8,
    totalReviews: 112,
    tags: ["Italy", "Coastal", "Food", "Vintage"]
  }
];
