import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  Camera,
  Check,
  MapPin,
  Maximize2,
  PackageCheck,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { LostFoundItem, StudentProfile } from '../types';
import {
  deleteItem,
  fetchItemDetail,
  reviewClaim,
  submitClaim,
  updateItemPhoto,
  updateItemStatus,
} from '../lib/api';
import { formatRelativeTime, formatShortDate } from '../lib/constants';
import { resolveItemImage } from '../lib/itemImages';
import { StatusIndicator } from './ItemCard';
import { PhotoUploadField } from './PhotoUploadField';

interface ItemDetailModalProps {
  item: LostFoundItem | null;
  studentProfile: StudentProfile;
  onUpdateProfile: (profile: StudentProfile) => void;
  onClose: () => void;
  onItemChanged: () => void;
  onSelectItem: (item: LostFoundItem) => void;
}

export function ItemDetailModal({
  item,
  studentProfile,
  onUpdateProfile,
  onClose,
  onItemChanged,
  onSelectItem,
}: ItemDetailModalProps) {
  const [detail, setDetail] = useState<LostFoundItem | null>(item);
  const [matches, setMatches] = useState<LostFoundItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [claimantName, setClaimantName] = useState(studentProfile.name);
  const [claimantEmail, setClaimantEmail] = useState(studentProfile.email);
  const [claimantPhone, setClaimantPhone] = useState('');
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [message, setMessage] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [reporterVerifyEmail, setReporterVerifyEmail] = useState('');
  const [showReporterUnlock, setShowReporterUnlock] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(false);

  useEffect(() => {
    setDetail(item);
    setClaimFeedback(null);
    setError(null);
    setConfirmDelete(false);
    setVerificationAnswer('');
    setMessage('');
    setLightboxOpen(false);
    setEditingPhoto(false);

    if (!item) return;

    let cancelled = false;
    setLoadingDetail(true);
    fetchItemDetail(item.id, studentProfile.email)
      .then((res) => {
        if (!cancelled) {
          setDetail(res.item);
          setMatches(res.matches);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item?.id, studentProfile.email]);

  if (!item || !detail) return null;

  const isReporter =
    studentProfile.email.trim().toLowerCase() === detail.reporterEmail.trim().toLowerCase();
  const imageSrc = resolveItemImage(detail);

  const handleClaimSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmittingClaim(true);
    try {
      const res = await submitClaim(detail.id, {
        claimantName,
        claimantEmail,
        claimantPhone,
        verificationAnswer,
        message,
      });
      onUpdateProfile({
        name: claimantName.trim(),
        email: claimantEmail.trim().toLowerCase(),
      });
      setDetail(res.item);
      setClaimFeedback(
        detail.type === 'found'
          ? 'Your ownership claim has been sent to the finder for verification.'
          : 'Your sighting report has been sent to the owner.',
      );
      setVerificationAnswer('');
      setMessage('');
      onItemChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit response.');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleClaimAction = async (claimId: string, action: 'approve' | 'decline') => {
    setError(null);
    setActionBusy(true);
    try {
      const res = await reviewClaim(detail.id, claimId, action, studentProfile.email);
      setDetail(res.item);
      onItemChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update claim.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkStatus = async (status: 'open' | 'returned') => {
    setError(null);
    setActionBusy(true);
    try {
      const res = await updateItemStatus(detail.id, status, studentProfile.email);
      setDetail(res.item);
      onItemChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setActionBusy(true);
    try {
      await deleteItem(detail.id, studentProfile.email);
      onItemChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete report.');
      setActionBusy(false);
    }
  };

  const handleReporterUnlock = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = reporterVerifyEmail.trim().toLowerCase();
    if (!cleaned) return;
    onUpdateProfile({
      name: studentProfile.name || detail.reporterName,
      email: cleaned,
    });
    setShowReporterUnlock(false);
  };

  const handlePhotoChange = async (nextUrl: string | undefined) => {
    setError(null);
    setActionBusy(true);
    try {
      const res = await updateItemPhoto(detail.id, nextUrl ?? null, studentProfile.email);
      setDetail(res.item);
      setEditingPhoto(false);
      onItemChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update photo.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <StatusIndicator item={detail} />
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{detail.caseNumber}</span>
            <span aria-hidden="true">·</span>
            <span>Posted {formatRelativeTime(detail.createdAt)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close item details"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 space-y-5">
            <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group">
              {imageSrc ? (
                <>
                  <img
                    src={imageSrc}
                    alt={detail.title}
                    referrerPolicy="no-referrer"
                    onClick={() => setLightboxOpen(true)}
                    className="w-full h-full object-cover cursor-zoom-in"
                  />
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    aria-label="Inspect full-size photo"
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white/92 hover:bg-white border border-slate-200 rounded-lg shadow-sm transition-opacity cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Inspect Photo
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                  <PackageCheck className="w-10 h-10" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-slate-500">No photo provided</span>
                </div>
              )}
            </div>

            <div className="space-y-3 text-sm text-slate-700 border-t border-slate-200 pt-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-slate-900">{detail.building}</span>
                  <span className="text-slate-500"> — {detail.locationDetail}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  {detail.type === 'found' ? 'Found on ' : 'Lost on '}
                  {formatShortDate(detail.dateOccurred)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Reported by {detail.reporterName}</span>
              </div>
              {detail.handoffDesk && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                  <span className="text-slate-900 font-medium">
                    Held at {detail.handoffDesk}
                  </span>
                </div>
              )}
            </div>

            {!loadingDetail && matches.length > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Potential Campus Matches
                </h4>
                <div className="mt-2.5 divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                  {matches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => onSelectItem(match)}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {match.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {match.caseNumber} · {match.building}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-700 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 space-y-6">
            <div>
              <p className="text-xs font-medium text-slate-500">{detail.category}</p>
              <h2 id="detail-modal-title" className="mt-1 text-2xl font-semibold text-slate-900">
                {detail.title}
              </h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{detail.description}</p>
            </div>

            {detail.status === 'returned' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                <PackageCheck className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Case Resolved — Item Returned
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Marked returned {detail.returnedAt ? formatRelativeTime(detail.returnedAt) : 'recently'}.
                  </p>
                </div>
              </div>
            )}

            {isReporter ? (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Manage Your Report
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setEditingPhoto((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {editingPhoto ? 'Close Photo Editor' : imageSrc ? 'Update Photo' : 'Add Photo'}
                    </button>

                    {detail.status !== 'returned' ? (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleMarkStatus('returned')}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Mark Returned
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleMarkStatus('open')}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Reopen Case
                      </button>
                    )}

                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="p-1.5 text-slate-500 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        aria-label="Delete report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={handleDelete}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-md cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                    )}
                  </div>
                </div>

                {editingPhoto && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <p className="text-xs font-medium text-slate-700">
                      Attach or Replace Item Photo
                    </p>
                    <PhotoUploadField
                      compact
                      value={detail.imageUrl || imageSrc || undefined}
                      onChange={handlePhotoChange}
                    />
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-2">
                    Incoming Claims &amp; Sightings ({detail.claims.length})
                  </h4>
                  {detail.claims.length === 0 ? (
                    <p className="text-sm text-slate-500 py-3">
                      No claims or sightings submitted yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {detail.claims.map((claim) => (
                        <div
                          key={claim.id}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {claim.claimantName}
                            </span>
                            <span className="text-xs font-medium text-slate-600 capitalize">
                              {claim.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {claim.claimantEmail}
                            {claim.claimantPhone ? ` · ${claim.claimantPhone}` : ''}
                          </p>
                          <p className="text-sm text-slate-800">
                            <span className="font-medium text-slate-600">Verification: </span>
                            {claim.verificationAnswer}
                          </p>
                          {claim.message && (
                            <p className="text-xs text-slate-600">{claim.message}</p>
                          )}
                          {claim.status === 'pending' && (
                            <div className="flex items-center gap-2 pt-2">
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => handleClaimAction(claim.id, 'approve')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve &amp; Mark Returned
                              </button>
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => handleClaimAction(claim.id, 'decline')}
                                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
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
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-200 space-y-4">
                {detail.status !== 'returned' && (
                  <>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {detail.type === 'found'
                          ? 'Claim This Item'
                          : 'Report a Sighting or Return'}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {detail.type === 'found'
                          ? 'Provide identifying proof so the finder or desk can verify ownership.'
                          : 'Let the owner know where you spotted or dropped off this item.'}
                      </p>
                    </div>

                    {detail.verificationQuestion && (
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <span className="font-semibold text-slate-900 block">
                            Finder Verification Question
                          </span>
                          <span className="text-slate-700">{detail.verificationQuestion}</span>
                        </div>
                      </div>
                    )}

                    {claimFeedback ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900">
                        {claimFeedback}
                      </div>
                    ) : (
                      <form onSubmit={handleClaimSubmit} className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="claim-name" className="block text-xs font-medium text-slate-700 mb-1">
                              Your Name
                            </label>
                            <input
                              id="claim-name"
                              type="text"
                              required
                              maxLength={80}
                              value={claimantName}
                              onChange={(e) => setClaimantName(e.target.value)}
                              placeholder="Alex Carter"
                              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                            />
                          </div>
                          <div>
                            <label htmlFor="claim-email" className="block text-xs font-medium text-slate-700 mb-1">
                              College Email
                            </label>
                            <input
                              id="claim-email"
                              type="email"
                              required
                              maxLength={120}
                              value={claimantEmail}
                              onChange={(e) => setClaimantEmail(e.target.value)}
                              placeholder="name@northbridge.edu"
                              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="claim-verification" className="block text-xs font-medium text-slate-700 mb-1">
                            {detail.type === 'found'
                              ? 'Proof of Ownership / Verification Answer'
                              : 'Where You Found or Left It'}
                          </label>
                          <input
                            id="claim-verification"
                            type="text"
                            required
                            maxLength={300}
                            value={verificationAnswer}
                            onChange={(e) => setVerificationAnswer(e.target.value)}
                            placeholder={
                              detail.type === 'found'
                                ? 'Describe a hidden detail, initials, wallpaper, or ID number'
                                : 'e.g., Turned in to Student Union Service Desk at 3 PM'
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="claim-phone" className="block text-xs font-medium text-slate-700 mb-1">
                              Phone (Optional)
                            </label>
                            <input
                              id="claim-phone"
                              type="tel"
                              maxLength={30}
                              value={claimantPhone}
                              onChange={(e) => setClaimantPhone(e.target.value)}
                              placeholder="(555) 123-4567"
                              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                            />
                          </div>
                          <div>
                            <label htmlFor="claim-message" className="block text-xs font-medium text-slate-700 mb-1">
                              Pickup Availability
                            </label>
                            <input
                              id="claim-message"
                              type="text"
                              maxLength={500}
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              placeholder="Free between classes after 2 PM"
                              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                            />
                          </div>
                        </div>

                        {error && (
                          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={submittingClaim}
                          className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                        >
                          {submittingClaim
                            ? 'Submitting...'
                            : detail.type === 'found'
                              ? 'Submit Ownership Claim'
                              : 'Send Sighting Update'}
                        </button>
                      </form>
                    )}
                  </>
                )}

                <div className="pt-2 border-t border-slate-100">
                  {!showReporterUnlock ? (
                    <button
                      type="button"
                      onClick={() => setShowReporterUnlock(true)}
                      className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer"
                    >
                      Did you post this report? Verify your email to manage it
                    </button>
                  ) : (
                    <form onSubmit={handleReporterUnlock} className="flex items-center gap-2">
                      <input
                        type="email"
                        required
                        value={reporterVerifyEmail}
                        onChange={(e) => setReporterVerifyEmail(e.target.value)}
                        placeholder="Enter reporter email"
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
                      >
                        Verify
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxOpen && imageSrc && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-6"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Full-size item photo"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close full-size photo"
            className="absolute top-5 right-5 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={imageSrc}
            alt={detail.title}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
