import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, Image as ImageIcon, PackageCheck, Trash2 } from 'lucide-react';
import type { ItemClaim, LostFoundItem, StudentProfile } from '../types';
import {
  deleteItem,
  fetchMyActivity,
  reviewClaim,
  updateItemStatus,
} from '../lib/api';
import { formatRelativeTime } from '../lib/constants';
import { resolveItemImage } from '../lib/itemImages';
import { StatusIndicator } from './ItemCard';

interface MyReportsViewProps {
  studentProfile: StudentProfile;
  onUpdateProfile: (profile: StudentProfile) => void;
  onSelectItem: (item: LostFoundItem) => void;
  onOpenReportModal: () => void;
  onBackToDirectory: () => void;
  refreshSignal: number;
  onDirectoryMutated: () => void;
}

export function MyReportsView({
  studentProfile,
  onUpdateProfile,
  onSelectItem,
  onOpenReportModal,
  onBackToDirectory,
  refreshSignal,
  onDirectoryMutated,
}: MyReportsViewProps) {
  const [emailInput, setEmailInput] = useState(studentProfile.email);
  const [nameInput, setNameInput] = useState(studentProfile.name);
  const [reportedItems, setReportedItems] = useState<LostFoundItem[]>([]);
  const [submittedClaims, setSubmittedClaims] = useState<
    Array<{ claim: ItemClaim; item: LostFoundItem }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeEmail = studentProfile.email.trim();

  const loadActivity = async (email: string) => {
    if (!email) {
      setReportedItems([]);
      setSubmittedClaims([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyActivity(email);
      setReportedItems(res.reportedItems);
      setSubmittedClaims(res.submittedClaims);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your activity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEmailInput(studentProfile.email);
    setNameInput(studentProfile.name);
    loadActivity(studentProfile.email);
  }, [studentProfile.email, refreshSignal]);

  const handleProfileSave = (e: FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: nameInput.trim(),
      email: emailInput.trim().toLowerCase(),
    });
  };

  const handleMarkReturned = async (item: LostFoundItem) => {
    setBusyId(item.id);
    try {
      await updateItemStatus(
        item.id,
        item.status === 'returned' ? 'open' : 'returned',
        activeEmail,
      );
      await loadActivity(activeEmail);
      onDirectoryMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await deleteItem(itemId, activeEmail);
      await loadActivity(activeEmail);
      onDirectoryMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleClaimDecision = async (
    itemId: string,
    claimId: string,
    action: 'approve' | 'decline',
  ) => {
    setBusyId(claimId);
    try {
      await reviewClaim(itemId, claimId, action, activeEmail);
      await loadActivity(activeEmail);
      onDirectoryMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update claim.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <button
            type="button"
            onClick={onBackToDirectory}
            className="text-xs font-medium text-blue-700 hover:text-blue-800 mb-2 inline-block cursor-pointer"
          >
            &larr; Back to Campus Directory
          </button>
          <p className="text-xs font-medium text-slate-500">Student Activity Ledger</p>
          <h2 className="mt-1 text-3xl font-semibold text-slate-900">
            My Reports &amp; Claims
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Review incoming ownership verifications, mark items returned, or track claims you submitted.
          </p>
        </div>

        <form onSubmit={handleProfileSave} className="flex flex-wrap items-end gap-2.5">
          <div>
            <label htmlFor="my-name" className="block text-xs font-medium text-slate-600 mb-1">
              Name
            </label>
            <input
              id="my-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
              className="w-40 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
            />
          </div>
          <div>
            <label htmlFor="my-email" className="block text-xs font-medium text-slate-600 mb-1">
              College Email
            </label>
            <input
              id="my-email"
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@northbridge.edu"
              className="w-56 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Load Activity
          </button>
        </form>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {!activeEmail ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto">
          <PackageCheck className="w-9 h-9 text-slate-400 mx-auto" strokeWidth={1.5} />
          <h3 className="mt-3 text-lg font-semibold text-slate-900">
            Enter your college email to view your reports
          </h3>
          <p className="mt-1.5 text-sm text-slate-600">
            Any lost or found reports and claims linked to your email address will appear here automatically.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          <div className="h-20 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="h-20 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      ) : (
        <div className="space-y-10">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Items You Reported ({reportedItems.length})
              </h3>
              <button
                type="button"
                onClick={onOpenReportModal}
                className="text-sm font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
              >
                + File New Report
              </button>
            </div>

            {reportedItems.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <p className="text-sm text-slate-600">
                  No reports filed under <span className="font-medium text-slate-900">{activeEmail}</span> yet.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                {reportedItems.map((item) => {
                  const thumbSrc = resolveItemImage(item);
                  return (
                  <div key={item.id} className="p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-20 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                          {thumbSrc ? (
                            <img
                              src={thumbSrc}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500 font-mono tabular-nums">
                            <StatusIndicator item={item} />
                            <span aria-hidden="true">·</span>
                            <span>{item.caseNumber}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans">{item.building}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatRelativeTime(item.createdAt)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSelectItem(item)}
                            className="mt-1.5 text-base font-semibold text-slate-900 hover:text-blue-700 text-left flex items-center gap-1.5 cursor-pointer"
                          >
                            <span className="truncate">{item.title}</span>
                            <ArrowUpRight className="w-4 h-4 shrink-0" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => handleMarkReturned(item)}
                          className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {item.status === 'returned' ? 'Reopen Case' : 'Mark Returned'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => handleDelete(item.id)}
                          aria-label={`Delete ${item.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {item.claims.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 space-y-2.5">
                        <p className="text-xs font-medium text-slate-500">
                          Claims &amp; Sightings ({item.claims.length})
                        </p>
                        {item.claims.map((claim) => (
                          <div
                            key={claim.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">
                                  {claim.claimantName}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {claim.claimantEmail}
                                </span>
                                <span className="text-xs font-medium text-slate-600 capitalize">
                                  · {claim.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700">
                                Proof: {claim.verificationAnswer}
                              </p>
                            </div>

                            {claim.status === 'pending' && (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={busyId === claim.id}
                                  onClick={() => handleClaimDecision(item.id, claim.id, 'approve')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId === claim.id}
                                  onClick={() => handleClaimDecision(item.id, claim.id, 'decline')}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Claims &amp; Sightings You Submitted ({submittedClaims.length})
            </h3>
            {submittedClaims.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <p className="text-sm text-slate-600">
                  You have not submitted any item claims or sighting updates under {activeEmail}.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                {submittedClaims.map(({ claim, item }) => (
                  <div
                    key={claim.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono">{item.caseNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize font-medium text-slate-700">
                          Claim {claim.status}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTime(claim.createdAt)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className="mt-1 text-base font-semibold text-slate-900 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>{item.title}</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                      <p className="mt-1 text-xs text-slate-600">
                        Your response: {claim.verificationAnswer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
