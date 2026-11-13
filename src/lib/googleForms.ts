import type { CampusGoogleFormConfig } from '../types';

export interface ParsedFormResponse {
  responseId: string;
  submittedAt: string;
  respondentEmail?: string;
  reportType: 'lost' | 'found';
  itemTitle: string;
  studentClass: string;
  department: string;
  timeOccurred: string;
  dateOccurred: string;
  lostInClass: string;
  description: string;
}

interface FormFieldSpec {
  key: keyof Omit<
    ParsedFormResponse,
    'responseId' | 'submittedAt' | 'respondentEmail'
  >;
  title: string;
  description?: string;
  required: boolean;
  question: Record<string, unknown>;
}

const LOST_FOUND_FORM_FIELDS: FormFieldSpec[] = [
  {
    key: 'reportType',
    title: 'Report Type',
    description: 'Select whether you lost an item or found someone else’s item.',
    required: true,
    question: {
      required: true,
      choiceQuestion: {
        type: 'RADIO',
        options: [{ value: 'Lost Item' }, { value: 'Found Item' }],
      },
    },
  },
  {
    key: 'itemTitle',
    title: 'Lost or Found Item Name',
    description: 'Short title (e.g., Black TI-84 Calculator, Silver Hydro Flask).',
    required: true,
    question: {
      required: true,
      textQuestion: { paragraph: false },
    },
  },
  {
    key: 'studentClass',
    title: 'Class / Academic Year',
    description: 'Your current class standing or role.',
    required: true,
    question: {
      required: true,
      choiceQuestion: {
        type: 'DROP_DOWN',
        options: [
          { value: 'Freshman (1st Year)' },
          { value: 'Sophomore (2nd Year)' },
          { value: 'Junior (3rd Year)' },
          { value: 'Senior (4th Year)' },
          { value: 'Graduate Student' },
          { value: 'Faculty / Staff' },
        ],
      },
    },
  },
  {
    key: 'department',
    title: 'Department',
    description: 'Academic department (e.g., Computer Science, Mechanical Engineering, Biology).',
    required: true,
    question: {
      required: true,
      textQuestion: { paragraph: false },
    },
  },
  {
    key: 'timeOccurred',
    title: 'Time at Which Object Got Lost / Found',
    description: 'Approximate time of day the item went missing or was found.',
    required: true,
    question: {
      required: true,
      timeQuestion: { duration: false },
    },
  },
  {
    key: 'dateOccurred',
    title: 'Date Object Got Lost / Found',
    required: true,
    question: {
      required: true,
      dateQuestion: { includeTime: false, includeYear: true },
    },
  },
  {
    key: 'lostInClass',
    title: 'In Which Class / Classroom Was It Lost?',
    description: 'Course name, lecture section, or room number (e.g., CS 201 — Science Hall Room 104).',
    required: true,
    question: {
      required: true,
      textQuestion: { paragraph: false },
    },
  },
  {
    key: 'description',
    title: 'Item Description & Distinguishing Marks',
    description: 'Color, brand, stickers, case details, or contact info.',
    required: true,
    question: {
      required: true,
      textQuestion: { paragraph: true },
    },
  },
];

export async function createLostAndFoundGoogleForm(
  accessToken: string,
  creatorEmail: string,
  customTitle?: string,
): Promise<CampusGoogleFormConfig> {
  const title = (customTitle || '').trim() || 'QuadFind — Campus Lost & Found Report Form';

  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title,
        documentTitle: title,
      },
    }),
  });

  const createdForm = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !createdForm.formId) {
    throw new Error(
      createdForm.error?.message || `Failed to create Google Form (${createRes.status}).`,
    );
  }

  const safeFormId = encodeURIComponent(createdForm.formId);
  const requests = [
    {
      updateFormInfo: {
        info: {
          description:
            'Report a lost or found item on campus. Please specify your class, department, the time the item went missing, and which class or lecture room you were in.',
        },
        updateMask: 'description',
      },
    },
    ...LOST_FOUND_FORM_FIELDS.map((field, index) => ({
      createItem: {
        item: {
          title: field.title,
          ...(field.description ? { description: field.description } : {}),
          questionItem: {
            question: field.question,
          },
        },
        location: { index },
      },
    })),
  ];

  const batchRes = await fetch(
    `https://forms.googleapis.com/v1/forms/${safeFormId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        includeFormInResponse: true,
        requests,
      }),
    },
  );

  const updatedPayload = await batchRes.json().catch(() => ({}));
  if (!batchRes.ok) {
    throw new Error(
      updatedPayload.error?.message || `Failed to add questions to Google Form (${batchRes.status}).`,
    );
  }

  const formObj = updatedPayload.form ?? createdForm;
  const questionMap: Record<string, string> = {};
  const formItems = Array.isArray(formObj.items) ? formObj.items : [];

  for (const item of formItems) {
    const qId = item?.questionItem?.question?.questionId;
    const itemTitle = item?.title;
    if (!qId || !itemTitle) continue;
    const matched = LOST_FOUND_FORM_FIELDS.find((f) => f.title === itemTitle);
    if (matched) {
      questionMap[qId] = matched.key;
    }
  }

  return {
    formId: formObj.formId,
    title: formObj.info?.title || title,
    responderUri:
      formObj.responderUri ||
      `https://docs.google.com/forms/d/${encodeURIComponent(formObj.formId)}/viewform`,
    editUri: `https://docs.google.com/forms/d/${encodeURIComponent(formObj.formId)}/edit`,
    createdBy: creatorEmail,
    createdAt: new Date().toISOString(),
    questionMap,
  };
}

function extractAnswerString(answerEntry: any): string {
  const answers = answerEntry?.textAnswers?.answers;
  if (Array.isArray(answers) && answers.length > 0) {
    return answers.map((a: any) => a?.value || '').filter(Boolean).join(', ');
  }
  return '';
}

export async function fetchGoogleFormAndResponses(
  accessToken: string,
  formId: string,
  savedQuestionMap?: Record<string, string>,
): Promise<{
  formTitle: string;
  responderUri: string;
  responses: ParsedFormResponse[];
}> {
  const safeFormId = encodeURIComponent(formId.trim());

  const [formRes, respRes] = await Promise.all([
    fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}/responses`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  const formJson = await formRes.json().catch(() => ({}));
  if (!formRes.ok) {
    throw new Error(formJson.error?.message || `Could not read Google Form (${formRes.status}).`);
  }

  const respJson = await respRes.json().catch(() => ({}));
  if (!respRes.ok) {
    throw new Error(
      respJson.error?.message || `Could not read Google Form responses (${respRes.status}).`,
    );
  }

  const questionMap: Record<string, string> = { ...(savedQuestionMap ?? {}) };
  const items = Array.isArray(formJson.items) ? formJson.items : [];
  for (const item of items) {
    const qId = item?.questionItem?.question?.questionId;
    const itemTitle: string = item?.title || '';
    if (!qId || questionMap[qId]) continue;
    const lower = itemTitle.toLowerCase();
    if (lower.includes('report type')) questionMap[qId] = 'reportType';
    else if (lower.includes('item name')) questionMap[qId] = 'itemTitle';
    else if (lower.includes('academic year') || lower === 'class') questionMap[qId] = 'studentClass';
    else if (lower.includes('department')) questionMap[qId] = 'department';
    else if (lower.includes('time')) questionMap[qId] = 'timeOccurred';
    else if (lower.includes('date')) questionMap[qId] = 'dateOccurred';
    else if (lower.includes('which class') || lower.includes('classroom')) {
      questionMap[qId] = 'lostInClass';
    } else if (lower.includes('description')) questionMap[qId] = 'description';
  }

  const rawResponses = Array.isArray(respJson.responses) ? respJson.responses : [];
  const parsed: ParsedFormResponse[] = rawResponses.map((r: any) => {
    const row: ParsedFormResponse = {
      responseId: r.responseId || '',
      submittedAt: r.lastSubmittedTime || r.createTime || new Date().toISOString(),
      respondentEmail: r.respondentEmail || undefined,
      reportType: 'lost',
      itemTitle: 'Campus Lost & Found Item',
      studentClass: '',
      department: '',
      timeOccurred: '',
      dateOccurred: new Date().toISOString().slice(0, 10),
      lostInClass: '',
      description: '',
    };

    const answers = r.answers || {};
    for (const [qId, ans] of Object.entries<any>(answers)) {
      const mappedKey = questionMap[qId];
      const textVal = extractAnswerString(ans);
      if (!mappedKey || !textVal) continue;

      if (mappedKey === 'reportType') {
        row.reportType = textVal.toLowerCase().includes('found') ? 'found' : 'lost';
      } else if (mappedKey === 'itemTitle') {
        row.itemTitle = textVal;
      } else if (mappedKey === 'studentClass') {
        row.studentClass = textVal;
      } else if (mappedKey === 'department') {
        row.department = textVal;
      } else if (mappedKey === 'timeOccurred') {
        row.timeOccurred = textVal;
      } else if (mappedKey === 'dateOccurred') {
        row.dateOccurred = textVal;
      } else if (mappedKey === 'lostInClass') {
        row.lostInClass = textVal;
      } else if (mappedKey === 'description') {
        row.description = textVal;
      }
    }
    return row;
  });

  parsed.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );

  return {
    formTitle: formJson.info?.title || 'Campus Lost & Found Google Form',
    responderUri:
      formJson.responderUri ||
      `https://docs.google.com/forms/d/${safeFormId}/viewform`,
    responses: parsed,
  };
}
