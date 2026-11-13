import { useState, type FormEvent } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { CampusDesk, ItemCategory, LostFoundItem, ReportType, StudentProfile } from '../types';
import { createReport } from '../lib/api';
import { CAMPUS_BUILDINGS, ITEM_CATEGORIES } from '../lib/constants';
import { resolveItemImage } from '../lib/itemImages';
import { StatusIndicator } from './ItemCard';
import { PhotoUploadField } from './PhotoUploadField';

interface ReportItemModalProps {
  isOpen: boolean;
  initialType?: ReportType;
  desks: CampusDesk[];
  studentProfile: StudentProfile;
  onUpdateProfile: (profile: StudentProfile) => void;
  onClose: () => void;
  onCreated: (item: LostFoundItem) => void;
  onSelectMatch: (item: LostFoundItem) => void;
}

export function ReportItemModal({
  isOpen,
  initialType = 'found',
  desks,
  studentProfile,
  onUpdateProfile,
  onClose,
  onCreated,
  onSelectMatch,
}: ReportItemModalProps) {
  const [type, setType] = useState<ReportType>(initialType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItemCategory>('Electronics');
  const [building, setBuilding] = useState(CAMPUS_BUILDINGS[0]);
  const [locationDetail, setLocationDetail] = useState('');
  const [dateOccurred, setDateOccurred] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [verificationQuestion, setVerificationQuestion] = useState('');
  const [handoffDesk, setHandoffDesk] = useState('');
  const [reporterName, setReporterName] = useState(studentProfile.name);
  const [reporterEmail, setReporterEmail] = useState(studentProfile.email);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    item: LostFoundItem;
    matches: LostFoundItem[];
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await createReport({
        type,
        title,
        category,
        building,
        locationDetail,
        dateOccurred,
        description,
        imageUrl,
        verificationQuestion: type === 'found' ? verificationQuestion : undefined,
        handoffDesk: type === 'found' ? handoffDesk : undefined,
        reporterName,
        reporterEmail,
      });
      onUpdateProfile({ name: reporterName.trim(), email: reporterEmail.trim().toLowerCase() });
      onCreated(result.item);
      setCreatedResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-white border-b border-slate-200">
          <div>
            <h2 id="report-modal-title" className="text-xl font-semibold text-slate-900">
              {createdResult ? 'Report Published' : 'Report a Lost or Found Item'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report dialog"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdResult ? (
          <div className="p-6 space-y-6">
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-4 items-start">
              {resolveItemImage(createdResult.item) && (
                <div className="w-28 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0">
                  <img
                    src={resolveItemImage(createdResult.item)!}
                    alt={createdResult.item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                  <StatusIndicator item={createdResult.item} />
                  <span aria-hidden="true">·</span>
                  <span>Case {createdResult.item.caseNumber}</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {createdResult.item.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Listed under {createdResult.item.building} ({createdResult.item.locationDetail}). You can track claims and mark it returned anytime under My Reports.
                </p>
              </div>
            </div>

            {createdResult.matches.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Potential Campus Matches ({createdResult.matches.length})
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  These open {createdResult.item.type === 'lost' ? 'found' : 'lost'} reports share a category or keywords with your item.
                </p>
                <div className="mt-3 divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {createdResult.matches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectMatch(match);
                      }}
                      className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <StatusIndicator item={match} />
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{match.caseNumber}</span>
                          <span aria-hidden="true">·</span>
                          <span>{match.building}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-900 truncate">
                          {match.title}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-700 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Report Type
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setType('found')}
                  className={`py-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    type === 'found'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  I Found an Item
                </button>
                <button
                  type="button"
                  onClick={() => setType('lost')}
                  className={`py-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    type === 'lost'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  I Lost an Item
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="report-title" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Item Name
                </label>
                <input
                  id="report-title"
                  type="text"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Silver MacBook Charger or Blue Hydro Flask"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              <div>
                <label htmlFor="report-category" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Category
                </label>
                <select
                  id="report-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ItemCategory)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                >
                  {ITEM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="report-date" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Date {type === 'found' ? 'Found' : 'Lost'}
                </label>
                <input
                  id="report-date"
                  type="date"
                  required
                  value={dateOccurred}
                  onChange={(e) => setDateOccurred(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              <div>
                <label htmlFor="report-building" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Campus Building
                </label>
                <select
                  id="report-building"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                >
                  {CAMPUS_BUILDINGS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="report-location" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Room or Specific Spot
                </label>
                <input
                  id="report-location"
                  type="text"
                  maxLength={120}
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder="e.g., 2nd Floor Study Tables"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
            </div>

            <div>
              <label htmlFor="report-description" className="block text-sm font-medium text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                id="report-description"
                required
                rows={3}
                maxLength={800}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  type === 'found'
                    ? 'Describe color, brand, and condition without giving away unique hidden details.'
                    : 'Describe distinguishing marks, stickers, case details, or contents.'
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            {type === 'found' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label htmlFor="report-question" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Ownership Verification Prompt
                  </label>
                  <input
                    id="report-question"
                    type="text"
                    maxLength={200}
                    value={verificationQuestion}
                    onChange={(e) => setVerificationQuestion(e.target.value)}
                    placeholder="e.g., What lockscreen photo or sticker is on it?"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                  />
                </div>
                <div>
                  <label htmlFor="report-desk" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Drop-off Desk (Optional)
                  </label>
                  <select
                    id="report-desk"
                    value={handoffDesk}
                    onChange={(e) => setHandoffDesk(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                  >
                    <option value="">Holding item personally</option>
                    {desks.map((d) => (
                      <option key={d.id} value={d.name}>
                        Turned in at {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">
                Item Photo (Optional)
              </span>
              <PhotoUploadField
                value={imageUrl}
                onChange={setImageUrl}
                onBusyChange={setPhotoUploading}
              />
            </div>

            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reporter-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Your Name
                </label>
                <input
                  id="reporter-name"
                  type="text"
                  required
                  maxLength={80}
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Jordan Reyes"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
              <div>
                <label htmlFor="reporter-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  College Email
                </label>
                <input
                  id="reporter-email"
                  type="email"
                  required
                  maxLength={120}
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  placeholder="name@northbridge.edu"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || photoUploading}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                {submitting ? 'Publishing...' : 'Publish Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
