import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  CampusDesk,
  ClaimStatus,
  DirectorySummary,
  ItemCategory,
  ItemClaim,
  ItemStatus,
  LostFoundItem,
  ReportType,
} from './src/types.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'lost_and_found.json');
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const SAFE_UPLOAD_NAME_RE = /^[a-zA-Z0-9_-]+\.(jpg|png)$/;

async function saveUploadedDataUrl(dataUrl: string): Promise<{
  imageUrl: string;
  mimeType: 'image/jpeg' | 'image/png';
  sizeBytes: number;
}> {
  const match = /^data:(image\/(?:jpeg|jpg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new Error('Only JPEG (.jpg, .jpeg) and PNG (.png) images are supported.');
  }

  const rawMime = match[1].toLowerCase();
  const mimeType: 'image/jpeg' | 'image/png' = rawMime === 'image/png' ? 'image/png' : 'image/jpeg';
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.byteLength === 0 || buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Uploaded image exceeds the 2 MB server limit.');
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `item-${crypto.randomUUID().slice(0, 12)}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return {
    imageUrl: `/api/uploads/${filename}`,
    mimeType,
    sizeBytes: buffer.byteLength,
  };
}

function validateUploadUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/api/uploads/')) return undefined;
  const filename = trimmed.slice('/api/uploads/'.length);
  if (!SAFE_UPLOAD_NAME_RE.test(filename)) return undefined;
  return trimmed;
}

async function tryRemoveUploadFile(imageUrl?: string) {
  if (!imageUrl || !imageUrl.startsWith('/api/uploads/')) return;
  const filename = imageUrl.slice('/api/uploads/'.length);
  if (!SAFE_UPLOAD_NAME_RE.test(filename)) return;
  await fs.unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
}

const VALID_CATEGORIES: ItemCategory[] = [
  'Electronics',
  'Keys & IDs',
  'Books & Notes',
  'Bottles & Gear',
  'Eyewear & Accessories',
  'Bags & Apparel',
];

const CAMPUS_DESKS: CampusDesk[] = [
  {
    id: 'desk-union',
    name: 'Student Union Service Desk',
    building: 'Student Union',
    room: 'Main Concourse, Level 1',
    hours: 'Mon–Fri 8:00 AM – 8:00 PM · Sat 10:00 AM – 5:00 PM',
    phone: '(555) 234-8810',
    notes: 'Primary campus intake hub for electronics, keys, IDs, and high-value items.',
  },
  {
    id: 'desk-library',
    name: 'Main Library Circulation Desk',
    building: 'Main Library',
    room: 'North Atrium, Ground Floor',
    hours: 'Daily 7:30 AM – 11:30 PM',
    phone: '(555) 234-8842',
    notes: 'Holds study room items, notebooks, chargers, and eyeglasses found inside the library.',
  },
  {
    id: 'desk-safety',
    name: 'Campus Safety & After-Hours Annex',
    building: 'Science Hall',
    room: 'West Wing, Suite 104',
    hours: 'Open 24/7 for emergency key & student ID retrieval',
    phone: '(555) 234-8900',
    notes: 'After-hours drop box and urgent verification for residence hall keys and wallets.',
  },
];

interface StoreShape {
  nextCaseSeq: number;
  items: LostFoundItem[];
}

function createSeedStore(): StoreShape {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
  const daysAgo = (d: number) => new Date(now - d * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const items: LostFoundItem[] = [
    {
      id: 'item-1041',
      caseNumber: 'LF-1041',
      type: 'found',
      status: 'open',
      title: 'Matte Black Wireless Over-Ear Headphones',
      category: 'Electronics',
      building: 'Main Library',
      locationDetail: '3rd Floor Quiet Study Carrel 3B',
      dateOccurred: daysAgo(0),
      description:
        'Left on the corner desk near the north windows around 11:15 AM. Turned in to the Library Circulation Desk with a short USB-C charging cable in the right earcup.',
      imageKey: 'headphones',
      verificationQuestion: 'What brand mark or sticker is visible inside the headband?',
      handoffDesk: 'Main Library Circulation Desk',
      reporterName: 'Maya Lin',
      reporterEmail: 'maya.lin@northbridge.edu',
      claims: [],
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(3),
    },
    {
      id: 'item-1040',
      caseNumber: 'LF-1040',
      type: 'found',
      status: 'open',
      title: 'Cobalt Lanyard with Brass Keys & Leather ID Sleeve',
      category: 'Keys & IDs',
      building: 'Student Union',
      locationDetail: 'South Patio Benches outside Café',
      dateOccurred: daysAgo(0),
      description:
        'Set of two brass Yale keys attached to a cobalt blue woven lanyard and dark brown leather card sleeve. Currently held safely at the Student Union Service Desk.',
      imageKey: 'keys',
      verificationQuestion: 'Please confirm the full name printed on the ID card inside the sleeve.',
      handoffDesk: 'Student Union Service Desk',
      reporterName: 'Jordan Reyes',
      reporterEmail: 'j.reyes@northbridge.edu',
      claims: [
        {
          id: 'claim-201',
          itemId: 'item-1040',
          claimantName: 'Alex Carter',
          claimantEmail: 'alex.carter@northbridge.edu',
          claimantPhone: '(555) 891-2240',
          verificationAnswer: 'Alex Carter, Staff ID #4419 in Facilities.',
          message: 'Dropped these walking back from lunch! Can stop by the Student Union desk after 2 PM.',
          status: 'pending',
          createdAt: hoursAgo(1),
          updatedAt: hoursAgo(1),
        },
      ],
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(1),
    },
    {
      id: 'item-1039',
      caseNumber: 'LF-1039',
      type: 'lost',
      status: 'open',
      title: 'TI-84 Graphing Calculator & Black Grid Notebook',
      category: 'Books & Notes',
      building: 'Engineering Quad',
      locationDetail: 'Lecture Hall 204, middle row',
      dateOccurred: daysAgo(1),
      description:
        'Left my black hardcover grid notebook (Calculus III notes) along with a black TI-84 Plus CE calculator and mechanical pencil after the 2:00 PM section.',
      imageKey: 'calculator',
      reporterName: 'Devon Patel',
      reporterEmail: 'd.patel@northbridge.edu',
      claims: [],
      createdAt: hoursAgo(18),
      updatedAt: hoursAgo(18),
    },
    {
      id: 'item-1038',
      caseNumber: 'LF-1038',
      type: 'found',
      status: 'open',
      title: 'Tortoiseshell Eyeglasses with Charcoal Felt Case',
      category: 'Eyewear & Accessories',
      building: 'Science Hall',
      locationDetail: 'Organic Chemistry Lab 112',
      dateOccurred: daysAgo(1),
      description:
        'Found on the side bench near the lab coat lockers after the afternoon lab block. Frames are in good condition with a snap-button dark felt case.',
      imageKey: 'glasses',
      verificationQuestion: 'What color or engraving is on the snap strap of the felt case?',
      handoffDesk: 'Campus Safety & After-Hours Annex',
      reporterName: 'Dr. Elena Rostova',
      reporterEmail: 'erostova@northbridge.edu',
      claims: [],
      createdAt: hoursAgo(22),
      updatedAt: hoursAgo(22),
    },
    {
      id: 'item-1037',
      caseNumber: 'LF-1037',
      type: 'found',
      status: 'open',
      title: 'Navy Insulated Stainless Water Bottle (24 oz)',
      category: 'Bottles & Gear',
      building: 'Athletic Center',
      locationDetail: 'Court 2 Bleachers',
      dateOccurred: daysAgo(2),
      description:
        'Matte navy insulated bottle with brushed steel loop cap. Left on the lower bleachers after intramural volleyball.',
      imageKey: 'water_bottle',
      verificationQuestion: 'What logo or text is printed near the base of the bottle?',
      handoffDesk: 'Student Union Service Desk',
      reporterName: 'Samira Okafor',
      reporterEmail: 's.okafor@northbridge.edu',
      claims: [],
      createdAt: hoursAgo(40),
      updatedAt: hoursAgo(40),
    },
    {
      id: 'item-1036',
      caseNumber: 'LF-1036',
      type: 'lost',
      status: 'returned',
      title: 'Charcoal Canvas Messenger Bag with Lab Manual',
      category: 'Bags & Apparel',
      building: 'Dining Commons',
      locationDetail: 'Upper Mezzanine Tables',
      dateOccurred: daysAgo(3),
      description:
        'Left beside the window booth during dinner hours. Returned via the Student Union desk after another student turned it in.',
      reporterName: 'Claire Bennett',
      reporterEmail: 'c.bennett@northbridge.edu',
      claims: [
        {
          id: 'claim-200',
          itemId: 'item-1036',
          claimantName: 'Noah Kim',
          claimantEmail: 'n.kim@northbridge.edu',
          verificationAnswer: 'Found at upper mezzanine and dropped off at Student Union.',
          message: 'Turned this in to the main service desk around 7:15 PM.',
          status: 'approved',
          createdAt: hoursAgo(65),
          updatedAt: hoursAgo(58),
        },
      ],
      createdAt: hoursAgo(70),
      updatedAt: hoursAgo(58),
      returnedAt: hoursAgo(58),
    },
  ];

  return {
    nextCaseSeq: 1042,
    items,
  };
}

let storeWriteLock: Promise<void> = Promise.resolve();

async function ensureStore(): Promise<StoreShape> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed || !Array.isArray(parsed.items)) {
      throw new Error('Invalid store format');
    }
    return parsed;
  } catch {
    const seeded = createSeedStore();
    await fs.writeFile(DATA_FILE, JSON.stringify(seeded, null, 2), 'utf8');
    return seeded;
  }
}

type StoreOutcome<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

async function withStore<T>(fn: (store: StoreShape) => Promise<{ result: T; dirty?: boolean }>): Promise<T> {
  let resultValue!: T;
  storeWriteLock = storeWriteLock.then(async () => {
    const store = await ensureStore();
    const { result, dirty } = await fn(store);
    if (dirty) {
      await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
    }
    resultValue = result;
  });
  await storeWriteLock;
  return resultValue;
}

function computeSummary(items: LostFoundItem[]): DirectorySummary {
  let openLost = 0;
  let openFound = 0;
  let claimedPending = 0;
  let returnedTotal = 0;

  for (const item of items) {
    if (item.status === 'returned') {
      returnedTotal += 1;
    } else {
      if (item.type === 'lost') openLost += 1;
      if (item.type === 'found') openFound += 1;
      if (item.status === 'claimed' || item.claims.some((c) => c.status === 'pending')) {
        claimedPending += 1;
      }
    }
  }

  return {
    openLost,
    openFound,
    claimedPending,
    returnedTotal,
    deskCount: CAMPUS_DESKS.length,
  };
}

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function sanitizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().slice(0, 120);
}

function findPotentialMatches(target: LostFoundItem, allItems: LostFoundItem[]): LostFoundItem[] {
  const oppositeType: ReportType = target.type === 'lost' ? 'found' : 'lost';
  const targetTokens = new Set(
    `${target.title} ${target.description}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3),
  );

  return allItems
    .filter((candidate) => {
      if (candidate.id === target.id) return false;
      if (candidate.type !== oppositeType) return false;
      if (candidate.status === 'returned') return false;
      if (candidate.category === target.category) return true;
      const candWords = `${candidate.title} ${candidate.description}`.toLowerCase().split(/[^a-z0-9]+/);
      return candWords.some((w) => w.length >= 3 && targetTokens.has(w));
    })
    .slice(0, 3);
}

function redactItemForViewer(item: LostFoundItem, viewerEmail?: string): LostFoundItem {
  const normalizedViewer = viewerEmail?.trim().toLowerCase() || '';
  const isReporter = normalizedViewer !== '' && item.reporterEmail.toLowerCase() === normalizedViewer;

  return {
    ...item,
    claims: item.claims.map((claim) => {
      const isClaimant = normalizedViewer !== '' && claim.claimantEmail.toLowerCase() === normalizedViewer;
      if (isReporter || isClaimant) {
        return claim;
      }
      return {
        ...claim,
        verificationAnswer: 'Hidden for ownership privacy (visible to item reporter)',
        claimantEmail: claim.claimantEmail.replace(/^(.).*(@.*)$/, '$1***$2'),
        claimantPhone: undefined,
      };
    }),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/uploads', async (req, res) => {
    try {
      const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
      if (!dataUrl) {
        res.status(400).json({ error: 'Image payload is required.' });
        return;
      }
      const saved = await saveUploadedDataUrl(dataUrl);
      res.status(201).json(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload image.';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/uploads/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (!SAFE_UPLOAD_NAME_RE.test(filename)) {
      res.status(400).json({ error: 'Invalid image path.' });
      return;
    }
    const filePath = path.join(UPLOAD_DIR, filename);
    try {
      const data = await fs.readFile(filePath);
      const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(data);
    } catch {
      res.status(404).json({ error: 'Uploaded image not found.' });
    }
  });

  app.get('/api/desks', (_req, res) => {
    res.json({ desks: CAMPUS_DESKS });
  });

  app.get('/api/items', async (req, res) => {
    try {
      const typeFilter = sanitizeText(req.query.type, 20);
      const statusFilter = sanitizeText(req.query.status, 20);
      const categoryFilter = sanitizeText(req.query.category, 60);
      const buildingFilter = sanitizeText(req.query.building, 60);
      const queryText = sanitizeText(req.query.q, 100).toLowerCase();
      const viewerEmail = sanitizeEmail(req.query.viewerEmail);

      const payload = await withStore(async (store) => {
        const summary = computeSummary(store.items);

        const filtered = store.items
          .filter((item) => {
            if (typeFilter && typeFilter !== 'all' && item.type !== typeFilter) return false;
            if (statusFilter && statusFilter !== 'all') {
              if (statusFilter === 'active' && item.status === 'returned') return false;
              if (statusFilter !== 'active' && item.status !== statusFilter) return false;
            }
            if (categoryFilter && categoryFilter !== 'all' && item.category !== categoryFilter) {
              return false;
            }
            if (buildingFilter && buildingFilter !== 'all' && item.building !== buildingFilter) {
              return false;
            }
            if (queryText) {
              const haystack = `${item.caseNumber} ${item.title} ${item.description} ${item.building} ${item.locationDetail} ${item.category}`.toLowerCase();
              if (!haystack.includes(queryText)) return false;
            }
            return true;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((item) => redactItemForViewer(item, viewerEmail));

        return { result: { items: filtered, summary }, dirty: false };
      });

      res.json(payload);
    } catch (err) {
      console.error('GET /api/items error:', err);
      res.status(500).json({ error: 'Failed to load items.' });
    }
  });

  app.get('/api/items/:id', async (req, res) => {
    try {
      const itemId = sanitizeText(req.params.id, 64);
      const viewerEmail = sanitizeEmail(req.query.viewerEmail);

      const data = await withStore(async (store) => {
        const found = store.items.find((i) => i.id === itemId);
        if (!found) return { result: null, dirty: false };
        const matches = findPotentialMatches(found, store.items).map((m) =>
          redactItemForViewer(m, viewerEmail),
        );
        return {
          result: {
            item: redactItemForViewer(found, viewerEmail),
            matches,
          },
          dirty: false,
        };
      });

      if (!data) {
        res.status(404).json({ error: 'Report not found.' });
        return;
      }
      res.json(data);
    } catch (err) {
      console.error('GET /api/items/:id error:', err);
      res.status(500).json({ error: 'Failed to load item details.' });
    }
  });

  app.post('/api/items', async (req, res) => {
    try {
      const body = req.body ?? {};
      const type = body.type === 'lost' || body.type === 'found' ? (body.type as ReportType) : null;
      const title = sanitizeText(body.title, 120);
      const category = VALID_CATEGORIES.includes(body.category) ? (body.category as ItemCategory) : null;
      const building = sanitizeText(body.building, 80);
      const locationDetail = sanitizeText(body.locationDetail, 120);
      const dateOccurred = sanitizeText(body.dateOccurred, 20) || new Date().toISOString().slice(0, 10);
      const description = sanitizeText(body.description, 800);
      const verificationQuestion = sanitizeText(body.verificationQuestion, 200);
      const handoffDesk = sanitizeText(body.handoffDesk, 120);
      const reporterName = sanitizeText(body.reporterName, 80);
      const reporterEmail = sanitizeEmail(body.reporterEmail);

      let imageUrl = validateUploadUrl(body.imageUrl);
      let imageDataUrl: string | undefined;

      if (!imageUrl && typeof body.imageDataUrl === 'string' && body.imageDataUrl.trim()) {
        try {
          const saved = await saveUploadedDataUrl(body.imageDataUrl);
          imageUrl = saved.imageUrl;
        } catch (uploadErr) {
          res.status(400).json({
            error: uploadErr instanceof Error ? uploadErr.message : 'Invalid image upload.',
          });
          return;
        }
      }

      if (!type || !title || !category || !building || !description || !reporterName || !reporterEmail) {
        res.status(400).json({ error: 'Please complete all required fields before submitting.' });
        return;
      }

      const created = await withStore(async (store) => {
        const nowIso = new Date().toISOString();
        const caseNumber = `LF-${store.nextCaseSeq}`;
        store.nextCaseSeq += 1;

        const newItem: LostFoundItem = {
          id: `item-${crypto.randomUUID().slice(0, 8)}`,
          caseNumber,
          type,
          status: 'open',
          title,
          category,
          building,
          locationDetail: locationDetail || 'General area',
          dateOccurred,
          description,
          imageUrl,
          imageDataUrl,
          verificationQuestion: verificationQuestion || undefined,
          handoffDesk: handoffDesk || undefined,
          reporterName,
          reporterEmail,
          claims: [],
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        store.items.unshift(newItem);
        const matches = findPotentialMatches(newItem, store.items).map((m) =>
          redactItemForViewer(m, reporterEmail),
        );

        return {
          result: { item: newItem, matches },
          dirty: true,
        };
      });

      res.status(201).json(created);
    } catch (err) {
      console.error('POST /api/items error:', err);
      res.status(500).json({ error: 'Failed to create report.' });
    }
  });

  app.post('/api/items/:id/claims', async (req, res) => {
    try {
      const itemId = sanitizeText(req.params.id, 64);
      const body = req.body ?? {};
      const claimantName = sanitizeText(body.claimantName, 80);
      const claimantEmail = sanitizeEmail(body.claimantEmail);
      const claimantPhone = sanitizeText(body.claimantPhone, 30);
      const verificationAnswer = sanitizeText(body.verificationAnswer, 300);
      const message = sanitizeText(body.message, 500);

      if (!claimantName || !claimantEmail || !verificationAnswer) {
        res.status(400).json({ error: 'Name, college email, and verification details are required.' });
        return;
      }

      const outcome = await withStore<StoreOutcome<{ item: LostFoundItem; claim: ItemClaim }>>(
        async (store) => {
          const item = store.items.find((i) => i.id === itemId);
          if (!item) {
            return { result: { ok: false, error: 'Item not found.', status: 404 }, dirty: false };
          }
          if (item.status === 'returned') {
            return {
              result: { ok: false, error: 'This item has already been returned.', status: 400 },
              dirty: false,
            };
          }

          const nowIso = new Date().toISOString();
          const claim: ItemClaim = {
            id: `claim-${crypto.randomUUID().slice(0, 8)}`,
            itemId: item.id,
            claimantName,
            claimantEmail,
            claimantPhone: claimantPhone || undefined,
            verificationAnswer,
            message: message || 'Ready to coordinate pickup.',
            status: 'pending',
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          item.claims.unshift(claim);
          if (item.status === 'open') {
            item.status = 'claimed';
          }
          item.updatedAt = nowIso;

          return {
            result: {
              ok: true,
              status: 201,
              data: {
                item: redactItemForViewer(item, claimantEmail),
                claim,
              },
            },
            dirty: true,
          };
        },
      );

      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }

      res.status(201).json(outcome.data);
    } catch (err) {
      console.error('POST /api/items/:id/claims error:', err);
      res.status(500).json({ error: 'Failed to submit claim.' });
    }
  });

  app.patch('/api/items/:id/claims/:claimId', async (req, res) => {
    try {
      const itemId = sanitizeText(req.params.id, 64);
      const claimId = sanitizeText(req.params.claimId, 64);
      const body = req.body ?? {};
      const actorEmail = sanitizeEmail(body.actorEmail);
      const action = body.action === 'approve' || body.action === 'decline' ? body.action : null;

      if (!actorEmail || !action) {
        res.status(400).json({ error: 'Valid action and reporter email are required.' });
        return;
      }

      const outcome = await withStore<StoreOutcome<{ item: LostFoundItem }>>(async (store) => {
        const item = store.items.find((i) => i.id === itemId);
        if (!item) return { result: { ok: false, error: 'Item not found.', status: 404 }, dirty: false };
        if (item.reporterEmail.toLowerCase() !== actorEmail) {
          return {
            result: {
              ok: false,
              error: 'Only the original reporter can review claims for this item.',
              status: 403,
            },
            dirty: false,
          };
        }

        const claim = item.claims.find((c) => c.id === claimId);
        if (!claim) return { result: { ok: false, error: 'Claim not found.', status: 404 }, dirty: false };

        const nowIso = new Date().toISOString();
        const nextClaimStatus: ClaimStatus = action === 'approve' ? 'approved' : 'declined';
        claim.status = nextClaimStatus;
        claim.updatedAt = nowIso;

        if (action === 'approve') {
          item.status = 'returned';
          item.returnedAt = nowIso;
          for (const other of item.claims) {
            if (other.id !== claim.id && other.status === 'pending') {
              other.status = 'declined';
              other.updatedAt = nowIso;
            }
          }
        } else {
          const hasPending = item.claims.some((c) => c.status === 'pending');
          if (!hasPending && item.status === 'claimed') {
            item.status = 'open';
          }
        }
        item.updatedAt = nowIso;

        return { result: { ok: true, status: 200, data: { item } }, dirty: true };
      });

      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.data);
    } catch (err) {
      console.error('PATCH /api/items/:id/claims/:claimId error:', err);
      res.status(500).json({ error: 'Failed to update claim.' });
    }
  });

  app.patch('/api/items/:id/status', async (req, res) => {
    try {
      const itemId = sanitizeText(req.params.id, 64);
      const body = req.body ?? {};
      const actorEmail = sanitizeEmail(body.actorEmail);
      const nextStatus: ItemStatus | null =
        body.status === 'open' || body.status === 'claimed' || body.status === 'returned'
          ? body.status
          : null;

      if (!actorEmail || !nextStatus) {
        res.status(400).json({ error: 'Status and reporter email are required.' });
        return;
      }

      const outcome = await withStore<StoreOutcome<{ item: LostFoundItem }>>(async (store) => {
        const item = store.items.find((i) => i.id === itemId);
        if (!item) return { result: { ok: false, error: 'Item not found.', status: 404 }, dirty: false };
        if (item.reporterEmail.toLowerCase() !== actorEmail) {
          return {
            result: {
              ok: false,
              error: 'Only the original reporter can update this report.',
              status: 403,
            },
            dirty: false,
          };
        }

        const nowIso = new Date().toISOString();
        item.status = nextStatus;
        item.updatedAt = nowIso;
        if (nextStatus === 'returned') {
          item.returnedAt = nowIso;
        } else {
          item.returnedAt = undefined;
        }
        return { result: { ok: true, status: 200, data: { item } }, dirty: true };
      });

      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.data);
    } catch (err) {
      console.error('PATCH /api/items/:id/status error:', err);
      res.status(500).json({ error: 'Failed to update status.' });
    }
  });

  app.patch('/api/items/:id/photo', async (req, res) => {
    try {
      const itemId = sanitizeText(req.params.id, 64);
      const body = req.body ?? {};
      const actorEmail = sanitizeEmail(body.actorEmail);
      const nextImageUrl = body.imageUrl === null ? null : validateUploadUrl(body.imageUrl);

      if (!actorEmail || (body.imageUrl !== null && !nextImageUrl)) {
        res.status(400).json({ error: 'Valid photo URL and reporter email are required.' });
        return;
      }

      let previousUploadUrl: string | undefined;
      const outcome = await withStore<StoreOutcome<{ item: LostFoundItem }>>(async (store) => {
        const item = store.items.find((i) => i.id === itemId);
        if (!item) return { result: { ok: false, error: 'Item not found.', status: 404 }, dirty: false };
        if (item.reporterEmail.toLowerCase() !== actorEmail) {
          return {
            result: {
              ok: false,
              error: 'Only the original reporter can update the photo for this report.',
              status: 403,
            },
            dirty: false,
          };
        }

        previousUploadUrl = item.imageUrl;
        item.imageUrl = nextImageUrl ?? undefined;
        if (nextImageUrl === null) {
          item.imageDataUrl = undefined;
          item.imageKey = undefined;
        }
        item.updatedAt = new Date().toISOString();
        return { result: { ok: true, status: 200, data: { item } }, dirty: true };
      });

      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      if (previousUploadUrl && previousUploadUrl !== nextImageUrl) {
        await tryRemoveUploadFile(previousUploadUrl);
      }
      res.json(outcome.data);
    } catch (err) {
      console.error('PATCH /api/items/:id/photo error:', err);
      res.status(500).json({ error: 'Failed to update photo.' });
    }
  });

  app.delete('/api/items/:id', async (req, res) => {
    try {
      const itemId = sanitizeText(req.params.id, 64);
      const actorEmail = sanitizeEmail(req.query.actorEmail);

      if (!actorEmail) {
        res.status(400).json({ error: 'Reporter email is required to delete a report.' });
        return;
      }

      let removedImageUrl: string | undefined;
      const outcome = await withStore<StoreOutcome<{ ok: boolean }>>(async (store) => {
        const index = store.items.findIndex((i) => i.id === itemId);
        if (index === -1) {
          return { result: { ok: false, error: 'Report not found.', status: 404 }, dirty: false };
        }
        if (store.items[index].reporterEmail.toLowerCase() !== actorEmail) {
          return {
            result: {
              ok: false,
              error: 'Only the original reporter can delete this report.',
              status: 403,
            },
            dirty: false,
          };
        }
        removedImageUrl = store.items[index].imageUrl;
        store.items.splice(index, 1);
        return { result: { ok: true, status: 200, data: { ok: true } }, dirty: true };
      });

      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      await tryRemoveUploadFile(removedImageUrl);
      res.json(outcome.data);
    } catch (err) {
      console.error('DELETE /api/items/:id error:', err);
      res.status(500).json({ error: 'Failed to delete report.' });
    }
  });

  app.get('/api/my-activity', async (req, res) => {
    try {
      const email = sanitizeEmail(req.query.email);
      if (!email) {
        res.json({ reportedItems: [], submittedClaims: [] });
        return;
      }

      const data = await withStore(async (store) => {
        const reportedItems = store.items
          .filter((item) => item.reporterEmail.toLowerCase() === email)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const submittedClaims: Array<{
          claim: ItemClaim;
          item: LostFoundItem;
        }> = [];

        for (const item of store.items) {
          for (const claim of item.claims) {
            if (claim.claimantEmail.toLowerCase() === email) {
              submittedClaims.push({
                claim,
                item: redactItemForViewer(item, email),
              });
            }
          }
        }

        submittedClaims.sort(
          (a, b) => new Date(b.claim.createdAt).getTime() - new Date(a.claim.createdAt).getTime(),
        );

        return {
          result: { reportedItems, submittedClaims },
          dirty: false,
        };
      });

      res.json(data);
    } catch (err) {
      console.error('GET /api/my-activity error:', err);
      res.status(500).json({ error: 'Failed to load student activity.' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuadFind server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
