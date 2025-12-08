export type Alert = {
  id: string;
  date: string;
  title: string;
  summary: string;
  whyItMatters: string;
  source: string;
};

export const alerts: Alert[] = [
  {
    id: "openai-structured-docs",
    date: "2025-12-08",
    title: "OpenAI adds automatic structured document extraction",
    summary: "OpenAI introduced a new toolset that converts PDFs and scanned documents into clean structured data with minimal human cleanup.",
    whyItMatters: "This reduces manual effort in lending operations, mortgage workflows and fraud documentation for credit unions.",
    source: "OpenAI enterprise tools update, Dec 2025"
  },
  {
    id: "ncua-exam-ai-governance",
    date: "2025-12-08",
    title: "NCUA exam teams begin reviewing 2026 AI governance expectations",
    summary: "NCUA internal teams are modeling how they want examiners to evaluate model oversight, data lineage and AI supported decisioning.",
    whyItMatters: "Credit unions should expect tighter documentation standards for any AI used in lending, fraud or service workflows.",
    source: "NCUA internal planning brief, Dec 2025"
  },
  {
    id: "fiserv-real-time-ops",
    date: "2025-12-08",
    title: "Fiserv announces early results from real time AI assisted operations",
    summary: "Fiserv reports that participating credit unions cut back office processing time by fifteen percent using new LLM based automation features.",
    whyItMatters: "This signals a shift toward AI powered operational baselines in vendor offerings starting in early 2026.",
    source: "Fiserv client pilot update, Dec 2025"
  }
];
