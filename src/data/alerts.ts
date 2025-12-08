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
    id: "openai-enterprise-ai-2025",
    date: "2025-12-08",
    title: "OpenAI report shows enterprise AI moving from pilots to workflows",
    summary:
      "OpenAI's State of Enterprise AI 2025 report shows weekly usage in ChatGPT Enterprise up sharply year over year, with structured workflows like Projects and Custom GPTs growing much faster than casual use.",
    whyItMatters:
      "Credit unions should expect vendors and internal teams to shift from small experiments to embedded AI workflows across operations, risk, and member service, and boards will start asking what that roadmap looks like.",
    source: "OpenAI State of Enterprise AI 2025 report, Dec 2025"
  },
  {
    id: "fiserv-content-next-launch",
    date: "2025-09-29",
    title: "Fiserv launches Content Next for AI enabled content and workflow automation",
    summary:
      "Fiserv introduced Content Next, a cloud based content management and workflow platform for financial institutions, built with OpenText and designed to add AI powered search, summarization, and process automation.",
    whyItMatters:
      "For credit unions on Fiserv or evaluating them, AI enabled content management is becoming a core feature that can cut manual document handling in lending, deposits, and back office operations.",
    source: "Fiserv Content Next launch announcements, Sept 2025"
  },
  {
    id: "ncua-ai-governance-briefing",
    date: "2025-07-24",
    title: "NCUA board briefing highlights AI use and future governance expectations",
    summary:
      "In a July board briefing, NCUA outlined how credit unions and regulators are using AI today and discussed a May 2025 GAO report that recommended updated model risk management guidance for AI in financial services.",
    whyItMatters:
      "Credit unions adopting AI now need clearer documentation of model governance, vendor due diligence, and consumer protection impacts, since AI oversight is becoming a core exam topic heading into 2026.",
    source: "NCUA AI board briefing and GAO 25-107197 report, mid 2025"
  }
];
