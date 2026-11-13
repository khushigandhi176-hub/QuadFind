import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { CampusGoogleFormConfig, ItemCategory, LostFoundItem } from '../types';
import {
  createReport,
  fetchSavedGoogleForm,
  saveGoogleFormConfig,
  unlinkGoogleFormConfig,
} from '../lib/api';
import { CAMPUS_BUILDINGS, ITEM_CATEGORIES, formatRelativeTime } from '../lib/constants';
import {
  createLostAndFoundGoogleForm,
  fetchGoogleFormAndResponses,
  type ParsedFormResponse,
} from '../lib/googleForms';
import { GoogleSignInButton } from './GoogleSignInButton';

interface GoogleFormPanelProps {
  googleAccessToken: string | null;
  googleUserEmail: string | null;
  onRequestGoogleSignIn: () => Promise<string | null>;
  onGoogleLogout: () => Promise<void>;
  existingItems: LostFoundItem[];
  onImportedToDirectory: () => void;
  onBackToDirectory: () => void;
}

export function GoogleFormPanel({
  googleAccessToken,
  googleUserEmail,
  onRequestGoogleSignIn,
  onGoogleLogout,
  existingItems,
  onImportedToDirectory,
  onBackToDirectory,
}: GoogleFormPanelProps) {
  const [formConfig, setFormConfig] = useState<CampusGoogleFormConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [customFormTitle, setCustomFormTitle] = useState(
    'Northbridge College — Lost & Found Intake Form',
  );
  const [manualFormId, setManualFormId] = useState('');
  const [showManualConnect, setShowManualConnect] = useState(false);

  const [creatingForm, setCreatingForm] = useState(false);
  const [syncingResponses, setSyncingResponses] = useState(false);
  const [responses, setResponses] = useState<ParsedFormResponse[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importCategories, setImportCategories] = useState<Record<string, ItemCategory>>({});
  const [importBuildings, setImportBuildings] = useState<Record<string, string>>({});
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetchSavedGoogleForm();
      setFormConfig(res.form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Google Form configuration.');
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const importedResponseIds = new Set(
    existingItems.map((i) => i.sourceFormResponseId).filter(Boolean),
  );

  const handleCreateGoogleForm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    setCreatingForm(true);
    try {
      let token = googleAccessToken;
      if (!token) {
        token = await onRequestGoogleSignIn();
      }
      if (!token) {
        throw new Error('Sign in with Google to create a campus Google Form.');
      }

      const created = await createLostAndFoundGoogleForm(
        token,
        googleUserEmail || 'campus-coordinator@northbridge.edu',
        customFormTitle,
      );
      const saved = await saveGoogleFormConfig(created);
      setFormConfig(saved.form);
      setStatusMessage(
        'Google Form created with Class, Department, Time Lost, and Classroom questions.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create Google Form.');
    } finally {
      setCreatingForm(false);
    }
  };

  const handleConnectExistingForm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    const trimmed = manualFormId.trim();
    if (!trimmed) return;

    const match = /\/forms\/d\/([a-zA-Z0-9_-]+)/.exec(trimmed);
    const extractedId = match ? match[1] : trimmed;

    setSyncingResponses(true);
    try {
      let token = googleAccessToken;
      if (!token) {
        token = await onRequestGoogleSignIn();
      }
      if (!token) {
        throw new Error('Sign in with Google to verify and link this Google Form.');
      }

      const data = await fetchGoogleFormAndResponses(token, extractedId);
      const saved = await saveGoogleFormConfig({
        formId: extractedId,
        title: data.formTitle,
        responderUri: data.responderUri,
        editUri: `https://docs.google.com/forms/d/${encodeURIComponent(extractedId)}/edit`,
        createdBy: googleUserEmail || 'campus-coordinator@northbridge.edu',
        createdAt: new Date().toISOString(),
      });
      setFormConfig(saved.form);
      setResponses(data.responses);
      setShowManualConnect(false);
      setManualFormId('');
      setStatusMessage('Connected existing Google Form and synced responses.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link Google Form.');
    } finally {
      setSyncingResponses(false);
    }
  };

  const handleSyncResponses = async () => {
    if (!formConfig) return;
    setError(null);
    setStatusMessage(null);
    setSyncingResponses(true);
    try {
      let token = googleAccessToken;
      if (!token) {
        token = await onRequestGoogleSignIn();
      }
      if (!token) {
        throw new Error('Sign in with Google to fetch Google Form responses.');
      }

      const data = await fetchGoogleFormAndResponses(
        token,
        formConfig.formId,
        formConfig.questionMap,
      );
      setResponses(data.responses);
      setStatusMessage(
        data.responses.length === 0
          ? 'Synced with Google Forms. No submissions yet.'
          : `Synced ${data.responses.length} response${data.responses.length === 1 ? '' : 's'} from Google Forms.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load responses.');
    } finally {
      setSyncingResponses(false);
    }
  };

  const handleImportResponse = async (resp: ParsedFormResponse) => {
    setError(null);
    setImportingId(resp.responseId);
    try {
      const category = importCategories[resp.responseId] || 'Electronics';
      const building = importBuildings[resp.responseId] || CAMPUS_BUILDINGS[0];
      const reporterEmail =
        resp.respondentEmail || googleUserEmail || 'student@northbridge.edu';
      const reporterName = reporterEmail.split('@')[0] || 'Student';

      await createReport({
        type: resp.reportType,
        title: resp.itemTitle,
        category,
        building,
        locationDetail: resp.lostInClass || 'Reported via Campus Google Form',
        dateOccurred: resp.dateOccurred || new Date().toISOString().slice(0, 10),
        timeOccurred: resp.timeOccurred || undefined,
        studentClass: resp.studentClass || undefined,
        department: resp.department || undefined,
        lostInClass: resp.lostInClass || undefined,
        description:
          resp.description ||
          `Reported via Google Form (${resp.department || 'Campus'} · ${resp.lostInClass || 'Class'}).`,
        reporterName,
        reporterEmail,
        sourceFormResponseId: resp.responseId,
      });

      onImportedToDirectory();
      setStatusMessage(`Published "${resp.itemTitle}" to the campus directory.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish response to directory.');
    } finally {
      setImportingId(null);
    }
  };

  const handleUnlink = async () => {
    setError(null);
    try {
      await unlinkGoogleFormConfig();
      setFormConfig(null);
      setResponses([]);
      setConfirmUnlink(false);
      setStatusMessage('Disconnected Google Form from QuadFind.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect Google Form.');
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
          <p className="text-xs font-medium text-slate-500">Google Workspace Intake</p>
          <h2 className="mt-1 text-3xl font-semibold text-slate-900">
            Campus Lost &amp; Found Google Form
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Collect standardized lost and found reports via Google Forms asking for student class, department, time lost, and the specific class or lecture room, then sync responses into QuadFind.
          </p>
        </div>

        <div className="shrink-0">
          {googleAccessToken && googleUserEmail ? (
            <div className="flex items-center gap-3 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs">
              <span className="text-slate-600">
                Connected as <span className="font-semibold text-slate-900">{googleUserEmail}</span>
              </span>
              <button
                type="button"
                onClick={onGoogleLogout}
                className="text-slate-500 hover:text-slate-900 underline cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : (
            <GoogleSignInButton
              onClick={onRequestGoogleSignIn}
              label="Sign in with Google"
            />
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
      {statusMessage && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          {statusMessage}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Form Questions Included
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Automatically provisioned when you generate the campus Google Form.
            </p>
          </div>

          <ol className="space-y-3 text-sm border-t border-slate-100 pt-4">
            <li className="flex items-start justify-between gap-3">
              <span className="font-medium text-slate-900">01. Report Type</span>
              <span className="text-xs text-slate-500">Lost / Found</span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <span className="font-medium text-slate-900">02. Item Name &amp; Details</span>
              <span className="text-xs text-slate-500">Short + Paragraph</span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <span className="font-medium text-slate-900">03. Class / Academic Year</span>
              <span className="text-xs text-slate-500">Dropdown</span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <span className="font-medium text-slate-900">04. Department</span>
              <span className="text-xs text-slate-500">Short Answer</span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <span className="font-medium text-slate-900">05. Time Object Got Lost</span>
              <span className="text-xs text-slate-500">Time Picker</span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <span className="font-medium text-slate-900">06. Date Lost / Found</span>
              <span className="text-xs text-slate-500">Date Picker</span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <span className="font-medium text-slate-900">07. In Which Class / Room</span>
              <span className="text-xs text-slate-500">Course &amp; Room</span>
            </li>
          </ol>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {loadingConfig ? (
            <div className="h-44 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ) : formConfig ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active Campus Google Form Linked
                  </p>
                  <h3 className="mt-1.5 text-xl font-semibold text-slate-900">
                    {formConfig.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 font-mono">
                    Form ID: {formConfig.formId} · Created by {formConfig.createdBy}
                  </p>
                </div>

                {!confirmUnlink ? (
                  <button
                    type="button"
                    onClick={() => setConfirmUnlink(true)}
                    aria-label="Disconnect Google Form"
                    className="p-2 text-slate-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmUnlink(false)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUnlink}
                      className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-md cursor-pointer"
                    >
                      Confirm Unlink
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                <a
                  href={formConfig.responderUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  Open Student Google Form
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href={formConfig.editUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Edit Questions in Forms
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  disabled={syncingResponses}
                  onClick={handleSyncResponses}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingResponses ? 'animate-spin' : ''}`} />
                  {syncingResponses ? 'Syncing...' : 'Sync Responses'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Create or Link the Campus Google Form
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Generate a ready-to-share Google Form in your Google account with all required class, department, time lost, and classroom fields pre-configured.
                </p>
              </div>

              <form onSubmit={handleCreateGoogleForm} className="space-y-4">
                <div>
                  <label htmlFor="google-form-title" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Form Title
                  </label>
                  <input
                    id="google-form-title"
                    type="text"
                    required
                    maxLength={160}
                    value={customFormTitle}
                    onChange={(e) => setCustomFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {googleAccessToken ? (
                    <button
                      type="submit"
                      disabled={creatingForm}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      {creatingForm ? 'Creating Google Form...' : 'Create Google Form'}
                    </button>
                  ) : (
                    <GoogleSignInButton
                      onClick={onRequestGoogleSignIn}
                      label="Sign in with Google to Create Form"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => setShowManualConnect((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Link existing Form URL or ID
                  </button>
                </div>
              </form>

              {showManualConnect && (
                <form
                  onSubmit={handleConnectExistingForm}
                  className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-2.5"
                >
                  <input
                    type="text"
                    required
                    value={manualFormId}
                    onChange={(e) => setManualFormId(e.target.value)}
                    placeholder="Paste Google Form URL or Form ID"
                    className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                  <button
                    type="submit"
                    disabled={syncingResponses}
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    {syncingResponses ? 'Linking...' : 'Connect Form'}
                  </button>
                </form>
              )}
            </div>
          )}

          {formConfig && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Synced Google Form Submissions ({responses.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click Sync Responses to load the latest form entries and publish them to the live directory.
                  </p>
                </div>
              </div>

              {responses.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-600">
                  No synced responses loaded yet. Share the form link above and click <strong>Sync Responses</strong> to check for new submissions.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {responses.map((resp) => {
                    const alreadyImported = importedResponseIds.has(resp.responseId);
                    return (
                      <div key={resp.responseId} className="p-5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500">
                              <span
                                className={`font-semibold uppercase ${
                                  resp.reportType === 'found' ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {resp.reportType}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{resp.studentClass || 'Class unspecified'}</span>
                              <span aria-hidden="true">·</span>
                              <span>{resp.department || 'Department unspecified'}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {formatRelativeTime(resp.submittedAt)}
                              </span>
                            </div>
                            <h4 className="text-base font-semibold text-slate-900">
                              {resp.itemTitle}
                            </h4>
                            <p className="text-xs text-slate-600">
                              Class / Room: <strong className="font-medium text-slate-900">{resp.lostInClass || 'Not specified'}</strong>
                              {' · '}
                              Time Lost: <strong className="font-medium text-slate-900 font-mono">{resp.timeOccurred || 'Not specified'}</strong>
                              {' · '}
                              Date: <strong className="font-medium text-slate-900 font-mono">{resp.dateOccurred}</strong>
                            </p>
                            {resp.description && (
                              <p className="text-sm text-slate-600">{resp.description}</p>
                            )}
                          </div>

                          <div className="shrink-0">
                            {alreadyImported ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Published
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={importingId === resp.responseId}
                                onClick={() => handleImportResponse(resp)}
                                className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg whitespace-nowrap cursor-pointer"
                              >
                                {importingId === resp.responseId
                                  ? 'Publishing...'
                                  : 'Publish to Directory'}
                              </button>
                            )}
                          </div>
                        </div>

                        {!alreadyImported && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                            <select
                              aria-label="Category for imported item"
                              value={importCategories[resp.responseId] || 'Electronics'}
                              onChange={(e) =>
                                setImportCategories((prev) => ({
                                  ...prev,
                                  [resp.responseId]: e.target.value as ItemCategory,
                                }))
                              }
                              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                            >
                              {ITEM_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  Category: {c}
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label="Campus building for imported item"
                              value={importBuildings[resp.responseId] || CAMPUS_BUILDINGS[0]}
                              onChange={(e) =>
                                setImportBuildings((prev) => ({
                                  ...prev,
                                  [resp.responseId]: e.target.value,
                                }))
                              }
                              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                            >
                              {CAMPUS_BUILDINGS.map((b) => (
                                <option key={b} value={b}>
                                  Building: {b}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
