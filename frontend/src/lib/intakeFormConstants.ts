import type { IntakeQuestion } from "@/lib/api";

/** Stored in `form_type` (max 50 chars). */
export const FORM_INDUSTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "general", label: "General" },
  { value: "healthcare", label: "Healthcare" },
  { value: "it", label: "IT / Technology" },
  { value: "retail", label: "Retail" },
  { value: "professional_services", label: "Professional services" },
];

/** Starter questions when creating a form or applying a template. */
export const INTAKE_STARTER_QUESTIONS: Record<string, IntakeQuestion[]> = {
  general: [
    { id: "first_name", type: "text", label: "First Name", required: true },
    { id: "last_name", type: "text", label: "Last Name", required: true },
    { id: "phone", type: "text", label: "Phone Number", required: true },
    { id: "address", type: "textarea", label: "Address", required: true },
  ],
  healthcare: [
    { id: "first_name", type: "text", label: "First Name", required: true },
    { id: "last_name", type: "text", label: "Last Name", required: true },
    { id: "date_of_birth", type: "date", label: "Date of Birth", required: true },
    { id: "address", type: "textarea", label: "Address", required: true },
    { id: "phone", type: "text", label: "Phone Number", required: true },
    { id: "email", type: "text", label: "Email", required: false },
    { id: "preferred_language", type: "text", label: "Preferred Language", required: false },
    { id: "employer", type: "text", label: "Employer", required: false },
    { id: "insurance_policy_holder", type: "text", label: "Insurance Policy Holder", required: false },
    { id: "insurance_carrier", type: "text", label: "Insurance Carrier", required: false },
    { id: "group_number", type: "text", label: "Group Number", required: false },
    { id: "member_id", type: "text", label: "Member ID", required: false },
    {
      id: "prior_surgeries",
      type: "textarea",
      label: "Prior Surgeries",
      required: false,
    },
    {
      id: "chronic_conditions",
      type: "textarea",
      label: "Chronic Conditions",
      required: false,
    },
    {
      id: "family_medical_history",
      type: "textarea",
      label: "Family Medical History",
      required: false,
    },
    {
      id: "current_medications",
      type: "textarea",
      label: "Current Medications",
      required: false,
    },
    {
      id: "smoking",
      type: "select",
      label: "Smoking",
      required: false,
      options: ["Never", "Former", "Current"],
    },
    { id: "alcohol_use", type: "textarea", label: "Alcohol Use", required: false },
    { id: "substance_use", type: "textarea", label: "Substance Use", required: false },
    {
      id: "reason_for_visit",
      type: "textarea",
      label: "Reason for Visit",
      required: true,
    },
    { id: "symptoms", type: "textarea", label: "Symptoms", required: false },
    {
      id: "primary_complaint",
      type: "textarea",
      label: "Primary Complaint",
      required: false,
    },
  ],
  it: [
    { id: "full_name", type: "text", label: "Full name", required: true },
    { id: "company", type: "text", label: "Company", required: false },
    { id: "email", type: "text", label: "Work email", required: true },
    { id: "phone", type: "text", label: "Phone", required: true },
    {
      id: "issue_type",
      type: "select",
      label: "Issue type",
      required: true,
      options: ["Hardware", "Software", "Network", "Account access", "Other"],
    },
    { id: "description", type: "textarea", label: "Describe the issue", required: true },
  ],
  retail: [
    { id: "full_name", type: "text", label: "Full name", required: true },
    { id: "email", type: "text", label: "Email", required: true },
    { id: "phone", type: "text", label: "Phone", required: true },
    { id: "order_number", type: "text", label: "Order number (if applicable)", required: false },
    { id: "inquiry", type: "textarea", label: "How can we help?", required: true },
  ],
  professional_services: [
    { id: "full_name", type: "text", label: "Full name", required: true },
    { id: "company", type: "text", label: "Company / organization", required: false },
    { id: "email", type: "text", label: "Email", required: true },
    { id: "phone", type: "text", label: "Phone", required: true },
    { id: "service_interest", type: "text", label: "What service are you interested in?", required: true },
  ],
};

export function getStarterQuestionsForIndustry(industry: string): IntakeQuestion[] {
  const list = INTAKE_STARTER_QUESTIONS[industry];
  if (list?.length) {
    return list.map((q) => ({ ...q }));
  }
  return INTAKE_STARTER_QUESTIONS.general.map((q) => ({ ...q }));
}

export function normalizeIndustryValue(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  const known = FORM_INDUSTRY_OPTIONS.some((o) => o.value === s);
  if (known) return s;
  return "general";
}
