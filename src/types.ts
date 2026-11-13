export type ReportType = 'lost' | 'found';
export type ItemStatus = 'open' | 'claimed' | 'returned';
export type ClaimStatus = 'pending' | 'approved' | 'declined';

export type ItemCategory =
  | 'Electronics'
  | 'Keys & IDs'
  | 'Books & Notes'
  | 'Bottles & Gear'
  | 'Eyewear & Accessories'
  | 'Bags & Apparel';

export interface ItemClaim {
  id: string;
  itemId: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone?: string;
  verificationAnswer: string;
  message: string;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LostFoundItem {
  id: string;
  caseNumber: string;
  type: ReportType;
  status: ItemStatus;
  title: string;
  category: ItemCategory;
  building: string;
  locationDetail: string;
  dateOccurred: string;
  description: string;
  imageKey?: string;
  imageUrl?: string;
  imageDataUrl?: string;
  verificationQuestion?: string;
  handoffDesk?: string;
  reporterName: string;
  reporterEmail: string;
  claims: ItemClaim[];
  createdAt: string;
  updatedAt: string;
  returnedAt?: string;
}

export interface CampusDesk {
  id: string;
  name: string;
  building: string;
  room: string;
  hours: string;
  phone: string;
  notes: string;
}

export interface DirectorySummary {
  openLost: number;
  openFound: number;
  claimedPending: number;
  returnedTotal: number;
  deskCount: number;
}

export interface ItemsResponse {
  items: LostFoundItem[];
  summary: DirectorySummary;
}

export interface StudentProfile {
  name: string;
  email: string;
}
