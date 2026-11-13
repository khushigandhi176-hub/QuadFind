import type {
  CampusDesk,
  ItemCategory,
  ItemClaim,
  ItemStatus,
  ItemsResponse,
  LostFoundItem,
  ReportType,
} from '../types';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface ItemQueryFilters {
  type?: 'all' | ReportType;
  status?: 'all' | 'active' | ItemStatus;
  category?: 'all' | ItemCategory;
  building?: string;
  q?: string;
  viewerEmail?: string;
}

export async function fetchItems(filters: ItemQueryFilters): Promise<ItemsResponse> {
  const params = new URLSearchParams();
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.building && filters.building !== 'all') params.set('building', filters.building);
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.viewerEmail?.trim()) params.set('viewerEmail', filters.viewerEmail.trim());
  const qs = params.toString();
  return requestJson<ItemsResponse>(`/api/items${qs ? `?${qs}` : ''}`);
}

export async function fetchItemDetail(
  id: string,
  viewerEmail?: string,
): Promise<{ item: LostFoundItem; matches: LostFoundItem[] }> {
  const qs = viewerEmail?.trim()
    ? `?viewerEmail=${encodeURIComponent(viewerEmail.trim())}`
    : '';
  return requestJson<{ item: LostFoundItem; matches: LostFoundItem[] }>(`/api/items/${id}${qs}`);
}

export async function fetchDesks(): Promise<{ desks: CampusDesk[] }> {
  return requestJson<{ desks: CampusDesk[] }>('/api/desks');
}

export interface UploadImageResponse {
  imageUrl: string;
  mimeType: string;
  sizeBytes: number;
}

export async function uploadItemImage(payload: {
  dataUrl: string;
  filename?: string;
}): Promise<UploadImageResponse> {
  return requestJson<UploadImageResponse>('/api/uploads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface CreateReportPayload {
  type: ReportType;
  title: string;
  category: ItemCategory;
  building: string;
  locationDetail: string;
  dateOccurred: string;
  description: string;
  imageUrl?: string;
  imageDataUrl?: string;
  verificationQuestion?: string;
  handoffDesk?: string;
  reporterName: string;
  reporterEmail: string;
}

export async function createReport(
  payload: CreateReportPayload,
): Promise<{ item: LostFoundItem; matches: LostFoundItem[] }> {
  return requestJson<{ item: LostFoundItem; matches: LostFoundItem[] }>('/api/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateItemPhoto(
  itemId: string,
  imageUrl: string | null,
  actorEmail: string,
): Promise<{ item: LostFoundItem }> {
  return requestJson<{ item: LostFoundItem }>(`/api/items/${itemId}/photo`, {
    method: 'PATCH',
    body: JSON.stringify({ imageUrl, actorEmail }),
  });
}

export interface SubmitClaimPayload {
  claimantName: string;
  claimantEmail: string;
  claimantPhone?: string;
  verificationAnswer: string;
  message: string;
}

export async function submitClaim(
  itemId: string,
  payload: SubmitClaimPayload,
): Promise<{ item: LostFoundItem; claim: ItemClaim }> {
  return requestJson<{ item: LostFoundItem; claim: ItemClaim }>(`/api/items/${itemId}/claims`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function reviewClaim(
  itemId: string,
  claimId: string,
  action: 'approve' | 'decline',
  actorEmail: string,
): Promise<{ item: LostFoundItem }> {
  return requestJson<{ item: LostFoundItem }>(`/api/items/${itemId}/claims/${claimId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action, actorEmail }),
  });
}

export async function updateItemStatus(
  itemId: string,
  status: ItemStatus,
  actorEmail: string,
): Promise<{ item: LostFoundItem }> {
  return requestJson<{ item: LostFoundItem }>(`/api/items/${itemId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, actorEmail }),
  });
}

export async function deleteItem(itemId: string, actorEmail: string): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>(
    `/api/items/${itemId}?actorEmail=${encodeURIComponent(actorEmail)}`,
    { method: 'DELETE' },
  );
}

export async function fetchMyActivity(email: string): Promise<{
  reportedItems: LostFoundItem[];
  submittedClaims: Array<{ claim: ItemClaim; item: LostFoundItem }>;
}> {
  return requestJson(
    `/api/my-activity?email=${encodeURIComponent(email.trim())}`,
  );
}
