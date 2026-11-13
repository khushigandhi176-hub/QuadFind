import { useCallback, useEffect, useState } from 'react';
import { Clock, MapPin, Phone, Search, X } from 'lucide-react';
import type {
  CampusDesk,
  DirectorySummary,
  ItemCategory,
  LostFoundItem,
  ReportType,
  StudentProfile,
} from './types';
import { fetchDesks, fetchItems } from './lib/api';
import { CAMPUS_BUILDINGS, ITEM_CATEGORIES } from './lib/constants';
import {
  googleSignIn,
  initAuth,
  logoutGoogleWorkspace,
} from './lib/googleWorkspaceAuth';
import { HERO_CAMPUS_DESK_IMAGE } from './lib/itemImages';
import { ItemCard } from './components/ItemCard';
import { ItemDetailModal } from './components/ItemDetailModal';
import { ReportItemModal } from './components/ReportItemModal';
import { MyReportsView } from './components/MyReportsView';
import { GoogleFormPanel } from './components/GoogleFormPanel';

type DirectoryTab = 'active' | 'found' | 'lost' | 'returned';
type PrimaryView = 'directory' | 'google-form' | 'my-reports';

const PROFILE_STORAGE_KEY = 'quadfind_student_profile_v1';

function loadSavedProfile(): StudentProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { name: '', email: '' };
    const parsed = JSON.parse(raw) as Partial<StudentProfile>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
    };
  } catch {
    return { name: '', email: '' };
  }
}

export default function App() {
  const [view, setView] = useState<PrimaryView>('directory');
  const [tab, setTab] = useState<DirectoryTab>('active');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ItemCategory>('all');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [summary, setSummary] = useState<DirectorySummary>({
    openLost: 0,
    openFound: 0,
    claimedPending: 0,
    returnedTotal: 0,
    deskCount: 3,
  });
  const [desks, setDesks] = useState<CampusDesk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [studentProfile, setStudentProfile] = useState<StudentProfile>(loadSavedProfile);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportInitialType, setReportInitialType] = useState<ReportType>('found');

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleAccessToken(token);
        setGoogleUserEmail(user.email || null);
      },
      () => {
        setGoogleAccessToken(null);
        setGoogleUserEmail(null);
      },
    );
    return () => unsubscribe();
  }, []);

  const handleRequestGoogleSignIn = useCallback(async (): Promise<string | null> => {
    if (googleAccessToken) return googleAccessToken;
    const { user, accessToken } = await googleSignIn();
    setGoogleAccessToken(accessToken);
    setGoogleUserEmail(user.email || null);
    return accessToken;
  }, [googleAccessToken]);

  const handleGoogleLogout = useCallback(async () => {
    await logoutGoogleWorkspace();
    setGoogleAccessToken(null);
    setGoogleUserEmail(null);
  }, []);

  const updateProfile = useCallback((next: StudentProfile) => {
    setStudentProfile(next);
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota issues
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchDesks()
      .then((res) => setDesks(res.desks))
      .catch(() => {});
  }, []);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const typeParam = tab === 'found' || tab === 'lost' ? tab : 'all';
      const statusParam = tab === 'returned' ? 'returned' : 'active';
      const data = await fetchItems({
        type: typeParam,
        status: statusParam,
        category: categoryFilter,
        building: buildingFilter,
        q: debouncedQuery,
        viewerEmail: studentProfile.email,
      });
      setItems(data.items);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load directory.');
    } finally {
      setLoading(false);
    }
  }, [tab, categoryFilter, buildingFilter, debouncedQuery, studentProfile.email]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory, refreshTick]);

  const triggerRefresh = () => setRefreshTick((t) => t + 1);

  const openReportModal = (defaultType: ReportType = 'found') => {
    setReportInitialType(defaultType);
    setReportModalOpen(true);
  };

  const scrollToSection = (sectionId: string) => {
    setView('directory');
    window.requestAnimationFrame(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const hasActiveFilters =
    tab !== 'active' ||
    categoryFilter !== 'all' ||
    buildingFilter !== 'all' ||
    searchInput.trim() !== '';

  const resetFilters = () => {
    setTab('active');
    setCategoryFilter('all');
    setBuildingFilter('all');
    setSearchInput('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setView('directory');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-xl font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            QuadFind
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => scrollToSection('directory')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
                view === 'directory'
                  ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-700'
                  : 'hover:text-slate-900'
              }`}
            >
              Browse Items
            </button>
            <button
              type="button"
              onClick={() => {
                setView('google-form');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
                view === 'google-form'
                  ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-700'
                  : 'hover:text-slate-900'
              }`}
            >
              Google Form
            </button>
            <button
              type="button"
              onClick={() => {
                setView('my-reports');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
                view === 'my-reports'
                  ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-700'
                  : 'hover:text-slate-900'
              }`}
            >
              My Reports
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('campus-desks')}
              className="whitespace-nowrap shrink-0 py-1 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Campus Desks
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="whitespace-nowrap shrink-0 py-1 hover:text-slate-900 transition-colors cursor-pointer"
            >
              How It Works
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => openReportModal('found')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Report Item
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {view === 'google-form' ? (
          <GoogleFormPanel
            googleAccessToken={googleAccessToken}
            googleUserEmail={googleUserEmail}
            onRequestGoogleSignIn={handleRequestGoogleSignIn}
            onGoogleLogout={handleGoogleLogout}
            existingItems={items}
            onImportedToDirectory={triggerRefresh}
            onBackToDirectory={() => setView('directory')}
          />
        ) : view === 'my-reports' ? (
          <MyReportsView
            studentProfile={studentProfile}
            onUpdateProfile={updateProfile}
            onSelectItem={(item) => setSelectedItem(item)}
            onOpenReportModal={() => openReportModal('found')}
            onBackToDirectory={() => setView('directory')}
            refreshSignal={refreshTick}
            onDirectoryMutated={triggerRefresh}
          />
        ) : (
          <>
            <section className="bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
                  <div className="lg:col-span-6 flex flex-col justify-center">
                    <p className="text-xs font-medium text-slate-500">
                      Northbridge College · Campus Lost &amp; Found
                    </p>
                    <h1
                      className="mt-3 font-display font-semibold text-slate-900 tracking-tight leading-[1.08] text-balance"
                      style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.25rem)' }}
                    >
                      Recover what went missing across campus.
                    </h1>
                    <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                      Browse verified lost and found reports from lecture halls, libraries, and student service desks. Verify ownership or log a recovered item in under a minute.
                    </p>

                    <div className="mt-7 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openReportModal('lost')}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Report Lost or Found
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollToSection('directory')}
                        className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Browse Active Items
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    <div className="aspect-[16/10] lg:h-full w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                      <img
                        src={HERO_CAMPUS_DESK_IMAGE}
                        alt="Northbridge College Student Union Lost and Found service desk"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Found Items Available</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                      {summary.openFound}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Open Lost Reports</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                      {summary.openLost}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Claims In Review</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                      {summary.claimedPending}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Returned This Term</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                      {summary.returnedTotal}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section id="directory" className="max-w-7xl mx-auto px-6 py-12 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Campus Item Directory</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Select any listing to inspect details, answer verification questions, or report a sighting.
                  </p>
                </div>

                <div className="flex items-center gap-2 md:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setView('google-form');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg cursor-pointer"
                  >
                    Google Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('my-reports')}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
                  >
                    My Reports
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div
                  role="tablist"
                  aria-label="Filter items by report status"
                  className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
                >
                  {(
                    [
                      { id: 'active', label: 'All Active' },
                      { id: 'found', label: 'Found Items' },
                      { id: 'lost', label: 'Lost Items' },
                      { id: 'returned', label: 'Returned' },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === option.id}
                      onClick={() => setTab(option.id)}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        tab === option.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 lg:max-w-2xl">
                  <div className="relative flex-1">
                    <Search
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      aria-label="Search lost and found items"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search item, building, or case ID..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>

                  <select
                    aria-label="Filter by category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as 'all' | ItemCategory)}
                    className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  >
                    <option value="all">All Categories</option>
                    {ITEM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by campus building"
                    value={buildingFilter}
                    onChange={(e) => setBuildingFilter(e.target.value)}
                    className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  >
                    <option value="all">All Buildings</option>
                    {CAMPUS_BUILDINGS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {error ? (
                <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    type="button"
                    onClick={loadDirectory}
                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[0, 1, 2, 3, 4, 5].map((idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse"
                    >
                      <div className="aspect-[4/3] bg-slate-100" />
                      <div className="p-5 space-y-3">
                        <div className="h-3 w-1/2 bg-slate-100 rounded" />
                        <div className="h-5 w-4/5 bg-slate-100 rounded" />
                        <div className="h-4 w-full bg-slate-100 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                  <h3 className="text-lg font-semibold text-slate-900">
                    No matching campus items found
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
                    Try adjusting your building or category filters, or file a new lost report so finders can contact you if it turns up.
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-3">
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openReportModal('lost')}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                    >
                      File a Report
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onSelect={(selected) => setSelectedItem(selected)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section id="campus-desks" className="bg-white border-t border-slate-200">
              <div className="max-w-7xl mx-auto px-6 py-14 space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    Campus Drop-off &amp; Verification Desks
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Prefer to hand off a found item or pick up a verified match through campus staff? Visit any staffed intake desk below.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {desks.map((desk) => (
                    <div
                      key={desk.id}
                      className="p-6 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between gap-4"
                    >
                      <div>
                        <p className="text-xs font-medium text-blue-700">{desk.building}</p>
                        <h3 className="mt-1 text-base font-semibold text-slate-900">
                          {desk.name}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{desk.notes}</p>
                      </div>
                      <div className="pt-4 border-t border-slate-200 space-y-2 text-xs text-slate-600">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <span>{desk.room}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <span>{desk.hours}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono tabular-nums">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{desk.phone}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="how-it-works" className="border-t border-slate-200 bg-slate-50">
              <div className="max-w-7xl mx-auto px-6 py-14 space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    How Campus Recovery Works
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Designed to reunite students with their belongings safely without exposing personal contact details publicly.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      01. File or Search Reports
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Log a lost or found item with the building, room, and optional photo. QuadFind automatically highlights matching reports in the same category.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      02. Verify Ownership Privately
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Claimants answer a verification prompt only visible to the reporter or service desk, keeping serial numbers and unique marks private.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      03. Pick Up &amp; Close the Case
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Once verified, approve the claim or meet at a staffed campus desk and mark the case returned so the directory stays up to date.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">QuadFind — Northbridge College</p>
            <p>
              Unclaimed high-value items held over 30 days are transferred to Campus Safety &amp; After-Hours Annex.
            </p>
          </div>
          <div className="flex items-center gap-6 whitespace-nowrap">
            <button
              type="button"
              onClick={() => openReportModal('lost')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Report Lost
            </button>
            <button
              type="button"
              onClick={() => openReportModal('found')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Report Found
            </button>
            <button
              type="button"
              onClick={() => {
                setView('google-form');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-900 cursor-pointer"
            >
              Google Form
            </button>
            <button
              type="button"
              onClick={() => {
                setView('my-reports');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-900 cursor-pointer"
            >
              My Reports
            </button>
          </div>
        </div>
      </footer>

      {reportModalOpen && (
        <ReportItemModal
          isOpen={reportModalOpen}
          initialType={reportInitialType}
          desks={desks}
          studentProfile={studentProfile}
          onUpdateProfile={updateProfile}
          googleAccessToken={googleAccessToken}
          onRequestGoogleSignIn={handleRequestGoogleSignIn}
          onOpenGoogleForm={() => {
            setView('google-form');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onClose={() => setReportModalOpen(false)}
          onCreated={() => triggerRefresh()}
          onSelectMatch={(match) => setSelectedItem(match)}
        />
      )}

      <ItemDetailModal
        item={selectedItem}
        studentProfile={studentProfile}
        onUpdateProfile={updateProfile}
        googleAccessToken={googleAccessToken}
        onRequestGoogleSignIn={handleRequestGoogleSignIn}
        onClose={() => setSelectedItem(null)}
        onItemChanged={triggerRefresh}
        onSelectItem={(match) => setSelectedItem(match)}
      />
    </div>
  );
}
