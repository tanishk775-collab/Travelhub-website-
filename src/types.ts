export enum Category {
  Luxury = "Luxury",
  Adventure = "Adventure",
  Beach = "Beach",
  Cultural = "Cultural",
  Nature = "Nature",
}

export interface Package {
  id: string;
  name: string;
  destination: string;
  price: number;
  description: string;
  images: string[];
  category: Category;
  rating: number;
  totalReviews: number;
  tags: string[];
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  packageId: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export interface Booking {
  id: string;
  userId: string;
  packageId: string;
  packageName: string;
  startDate: string;
  endDate: string;
  guests: number;
  totalAmount: number;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: any;
  hasInsurance: boolean;
  insuranceCost?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  preferences: string[];
  savedPackages: string[];
}
