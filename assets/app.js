  (function () {
  const alertsData = [
    {
      label: 'Fraud',
      headline: 'Revolut introduces new security measure aimed at impersonation scams',
      summary:
        'Revolut rolled out a new security feature to reduce impersonation scams, responding to rising fraud where criminals pose as the bank or trusted parties.',
      impact:
        'Expect the scam/fraud bar to rise fast. This directly affects member protection workflows: call center authentication, outbound communications, scam warnings, and reimbursement pressure. CU leaders should ask their vendors (core/digital banking + call center + fraud) about: real-time “scam signals,” step-up authentication triggers, verified call features, and how alerts are tuned to avoid warning fatigue. This also impacts examiner posture—scams are becoming a controls + governance issue, not just fraud losses.',
      sourceName: 'Finextra',
      sourceUrl: 'https://www.finextra.com/newsarticle/47134/revolut-to-tackle-impersonation-scams',
      date: 'Jan 13, 2026',
      slug: 'revolut-security-measure-impersonation-scams'
    },
    {
      label: 'Payments',
      headline: 'FIS launches AI transaction platform for “agentic commerce” with Mastercard + Visa',
      summary:
        'FIS announced an AI transaction platform designed to let banks participate in “agentic commerce,” where AI agents initiate and complete purchases. FIS says the offering will help issuers stay “top of wallet” while adding fraud protections, and is being developed in partnership with Mastercard and Visa.',
      impact:
        'This is a vendor roadmap signal that agent-driven transactions are moving from concept to packaging. CU execs should expect card and digital banking vendors to introduce new add-ons (and pricing tiers) around AI-mediated checkout, plus new risk controls for “non-human initiated” transactions. Start pushing vendors now on: liability model, dispute handling, tokenization defaults, and how agent transactions will be labeled in authorization + statements (this will hit member trust + Reg E workflows).',
      sourceName: 'FIS',
      sourceUrl:
        'https://www.fisglobal.com/about-us/media-room/press-release/2026/fis-launches-industry-first-ai-transaction-platform-to-help-banks-lead',
      date: 'Jan 12, 2026',
      slug: 'fis-agentic-commerce-transaction-platform'
    },
    {
      label: 'AI Governance',
      headline: 'NIST asks for public input on securing AI agents',
      summary:
        'NIST is seeking public input on how to better secure agentic AI systems, citing expanding use and risk. The focus is on managing security gaps as AI agents begin acting autonomously in sensitive environments.',
      impact:
        'This is a regulatory-expectations early warning. Within 6–18 months, examiners will increasingly ask: “What controls do you have for agent-like behavior in vendor tools?” If your contact center, digital banking, fraud case management, or employee copilots can take actions (not just suggest), you’ll need policy + model risk treatment: access control boundaries, audit logging, human-in-the-loop requirements, incident response playbooks, and third-party risk language that explicitly covers “AI agents.”',
      sourceName: 'BankInfoSecurity (reporting on NIST)',
      sourceUrl:
        'https://www.bankinfosecurity.com/nist-calls-for-public-to-help-better-secure-ai-agents-a-30500',
      date: 'Jan 12, 2026',
      slug: 'nist-public-input-securing-ai-agents'
    },
    {
      label: 'AI Strategy',
      headline: 'UK Financial Services Hiring Rises on AI and Data Demand',
      summary:
        'Financial institutions in the UK increased hiring for AI, data, and compliance roles as firms accelerate technology adoption despite broader economic uncertainty.',
      impact:
        'Rising competition for AI and data talent will push credit unions toward greater reliance on vendors, managed services, and automation, increasing the importance of third-party risk management and clear ownership of AI-enabled processes.',
      sourceName: 'Reuters',
      sourceUrl:
        'https://www.reuters.com/sustainability/boards-policy-regulation/demand-ai-tech-experts-pushes-uk-financial-sector-vacancies-up-12-recruiter-says-2026-01-12/',
      date: 'Jan 12, 2026',
      slug: 'uk-financial-services-ai-data-hiring-demand'
    },
    {
      label: 'AI Strategy',
      headline: 'TCS Revenue Beat Signals Continued Enterprise AI Spend',
      summary:
        'Tata Consultancy Services reported slightly stronger-than-expected quarterly revenue, driven in part by sustained enterprise demand for AI and digital transformation projects.',
      impact:
        'Continued AI investment by large service providers signals that core processors and systems integrators will increasingly bundle AI capabilities into standard offerings, affecting pricing, contract structures, and expectations around AI governance.',
      sourceName: 'Reuters',
      sourceUrl:
        'https://www.reuters.com/world/india/indias-tcs-beats-quarterly-revenue-estimate-2026-01-12/',
      date: 'Jan 12, 2026',
      slug: 'tcs-revenue-beat-enterprise-ai-spend'
    },
    {
      label: 'Fraud',
      headline: 'Financial Regulators Highlight AI as Key Tool in Fraud Prevention',
      summary:
        'Financial authorities emphasized the growing role of artificial intelligence in detecting mule accounts and complex digital fraud patterns at a major banking technology forum.',
      impact:
        'Regulatory emphasis on AI-driven fraud controls raises expectations that credit unions can explain how AI is used in fraud detection, how outcomes are monitored, and how models are governed within existing compliance frameworks.',
      sourceName: 'The Economic Times',
      sourceUrl:
        'https://m.economictimes.com/news/economy/policy/financial-services-secretary-flags-digital-risks-says-ai-key-to-tackling-mule-accounts/articleshow/126442892.cms',
      date: 'Jan 11, 2026',
      slug: 'regulators-ai-fraud-prevention-tool'
    },
    {
      label: 'Fraud',
      headline: 'FBI Warns AI Is Helping Criminals Circumvent Identity Verification Systems',
      summary:
        'The FBI’s Internet Crime Complaint Center reports that sophisticated fraud rings are using AI to generate realistic fake IDs, social-media personas, and manipulated video content that can fool customer identification programs (CIP) and biometric systems.',
      impact:
        'This alert highlights a rapidly evolving threat vector. Credit unions must consider whether current CIP and identity-proofing tools are resilient against AI-assisted impersonation and fraudulent documentation.',
      sourceName: 'The Financial Brand',
      sourceUrl:
        'https://thefinancialbrand.com/news/banking-technology/ai-id-fraud-bank-194966',
      date: 'Jan 9, 2026',
      slug: 'fbi-ai-identity-verification-circumvention'
    },
    {
      label: 'AI Governance',
      headline: 'NCUA Expands AI Resource Hub to Support Member Services and Fraud Tools',
      summary:
        'The National Credit Union Administration (NCUA) has released an expanded AI Resource Hub providing guidance for credit unions considering or using AI for member services, fraud detection, and operational automation. The hub includes tools and recommended practices to help institutions evaluate AI use cases and governance.',
      impact:
        'The NCUA’s updated hub signals that regulators are actively supporting AI awareness and readiness, making governance and risk frameworks around AI even more critical.',
      sourceName: 'Consumer Financial Services Law Monitor (based on NCUA update)',
      sourceUrl:
        'https://www.consumerfinancialserviceslawmonitor.com/2026/01/ncua-issues-updated-ai-resource-hub/',
      date: 'Jan 7, 2026',
      slug: 'ncua-ai-resource-hub-expanded'
    },
    {
      label: 'AI Governance',
      headline: 'JPMorgan Chase to Replace External Proxy Advisors With In-House AI Voting Tool',
      summary:
        'JPMorgan Chase’s asset and wealth management division will stop using external proxy advisory firms and instead roll out an AI-powered internal voting platform called Proxy IQ in the U.S. beginning April 1, 2026.',
      impact:
        'For credit unions, the shift shows how large institutions are embedding AI into governance decisions, raising expectations for oversight, auditability, and benchmark standards that community institutions may need to meet as they adopt similar tools.',
      sourceName: 'Business Insider',
      sourceUrl:
        'https://www.businessinsider.com/jpmorgan-ditches-proxy-adivsory-firms-for-ai-shareholder-votes-memo-2026-1',
      date: 'Jan 7, 2026',
      slug: 'jpmorgan-ai-proxy-voting-tool'
    },
    {
      label: 'AI Strategy',
      headline: 'Bridgewater’s Ray Dalio Says AI Boom Has Entered Early Bubble Phase',
      summary:
        'Bridgewater Associates founder Ray Dalio warned that the rapid growth of AI-related stocks may represent an early bubble phase, with valuations driven more by speculation than sustainable fundamentals. His commentary highlights broader concerns about AI investment excess even as markets price in continued AI-led growth.',
      impact:
        'Rising enthusiasm and capital flows into AI may drive expectations around adoption and performance. Credit unions should benchmark investment decisions against value creation rather than hype, ensuring governance and risk frameworks keep pace with strategic AI spending.',
      sourceName: 'Reuters',
      sourceUrl:
        'https://www.reuters.com/business/ai-boom-is-early-bubble-phase-bridgewater-founder-ray-dalio-says-2026-01-05/',
      date: 'Jan 5, 2026',
      slug: 'ray-dalio-ai-bubble-phase'
    },
    {
      label: 'Payments',
      headline: 'Fintech Vendors Use CES to Signal Next Phase of AI-Driven Payments and Authentication',
      summary:
        'At CES this week, major payments and fintech vendors highlighted AI-enabled authentication, real-time risk scoring, and agent-assisted transaction flows as near-term capabilities rather than long-range concepts. The focus shifted away from consumer novelty toward institutional-grade controls around authorization, fraud prevention, and payment integrity.',
      impact:
        'For credit unions, this underscores that AI-enhanced payment security is becoming table stakes. Governance, fraud controls, and member protections need to advance in lockstep with vendor roadmaps to meet rising expectations for authentication and transaction integrity.',
      sourceName: 'CES 2026 vendor briefings',
      sourceUrl: 'https://www.ces.tech/',
      date: 'Jan 6, 2026',
      slug: 'ces-fintech-ai-payments-authentication'
    },
    {
      label: 'Payments',
      headline: 'Visa Signals AI Checkout Could Soon Go Mainstream',
      summary:
        'Visa says autonomous, AI-initiated payment transactions have been completed successfully in hundreds of secure tests across its network, indicating a shift toward AI agent-enabled commerce at checkout that could reshape procurement flows.',
      impact:
        'As autonomous AI payment capabilities emerge, credit unions should anticipate new authentication and fraud risk vectors and consider how these capabilities might affect member transactions, risk controls, and digital product strategies.',
      sourceName: 'Digital Commerce 360 (reporting on Visa)',
      sourceUrl: 'https://www.digitalcommerce360.com/2025/12/29/visa-signals-ai-checkout-could-soon-go-mainstream/',
      date: 'Dec 29, 2025',
      slug: 'visa-ai-checkout-mainstream'
    },
    {
      label: 'AI Governance',
      headline: 'FCA Warns Banks as Agentic AI Nears Consumer Rollout',
      summary:
        'Britain’s Financial Conduct Authority cautions that the rapid adoption of agentic AI—which can act autonomously—poses new risks as banks prepare to launch customer-facing pilots, and it plans to extend oversight using existing compliance frameworks.',
      impact:
        'Credit unions evaluating or piloting advanced AI should watch evolving regulatory expectations around autonomous AI, especially for consumer-facing use cases, governance, and consumer protection obligations.',
      sourceName: 'CeFPro (based on FCA commentary)',
      sourceUrl: 'https://connect.cefpro.com/article/view/fca-warns-banks-as-agentic-ai-nears-consumer-rollout',
      date: 'Dec 23, 2025',
      slug: 'fca-agentic-ai-consumer-rollout-warning'
    },
    {
      label: 'Fraud',
      headline: 'ANZ, Westpac Shift AI Focus to Cybersecurity and Scam Detection',
      summary:
        'Leading Australian banks including ANZ and Westpac are redirecting AI investments toward real-time behavioral biometrics and risk scoring to detect scams and fraud before transactions complete, treating AI as a proactive defense layer.',
      impact:
        'Credit unions should consider similar risk-centric AI deployments—not just efficiency projects—to strengthen fraud defenses and protect members as attackers increasingly use sophisticated tools.',
      sourceName: 'The Australian',
      sourceUrl:
        'https://www.theaustralian.com.au/business/technology/inside-the-highstakes-race-to-use-artificial-intelligence-for-combating-australias-fraud-crisis/news-story/82ea858653749bcecc78690aca454ecb',
      date: 'Dec 26, 2025',
      slug: 'anz-westpac-ai-cybersecurity-scam-detection'
    },
    {
      label: 'Payments',
      headline: 'Fed seeks feedback on limited “payment accounts” for some firms',
      summary:
        'The Federal Reserve is seeking public comment on a proposal to create limited “payment accounts” for select non-bank financial firms, offering access to Fed payment services for clearing and settling transactions without full bank privileges.',
      impact:
        'Expanded access to core Fed payment infrastructure may influence how credit unions partner with fintechs for settlement and payments workflows, necessitating operational and compliance evaluations.',
      sourceName: 'Reuters',
      sourceUrl:
        'https://www.reuters.com/sustainability/boards-policy-regulation/fed-seeks-feedback-limited-payment-accounts-some-firms-2025-12-19/',
      date: 'Dec 19, 2025',
      slug: 'fed-feedback-limited-payment-accounts'
    },
    {
      label: 'Agentic AI',
      headline: 'AWS and Microsoft present agentic AI’s business case for banking tech',
      summary:
        'Commentary from AWS and Microsoft highlights how agentic AI — systems that coordinate multiple AI components — is advancing practical use in financial services to accelerate risk, compliance, and analytic workflows at scale.',
      impact:
        'As agentic AI gains traction in regulated settings, credit unions should prepare governance and risk frameworks to evaluate similar technologies for member-facing and internal operations.',
      sourceName: 'PYMNTS',
      sourceUrl:
        'https://www.pymnts.com/artificial-intelligence-2/2025/aws-and-microsoft-present-agentic-ais-banking-business-case/',
      date: 'Dec 22, 2025',
      slug: 'aws-microsoft-agentic-ai-banking-business-case'
    },
    {
      label: 'Agentic AI',
      headline: 'Major banks prepare customer-facing agentic AI trials amid regulatory scrutiny',
      summary:
        'Reuters reports that British banks such as NatWest, Lloyds and Starling are working with the Financial Conduct Authority (FCA) to pilot agentic AI systems capable of planning and acting autonomously — a shift from back-office use that raises new governance and stability concerns.',
      impact:
        'As autonomous AI moves closer to consumer finance applications, credit unions should monitor evolving governance expectations and risk frameworks emerging from regulator-bank dialogues.',
      sourceName: 'Reuters',
      sourceUrl: 'https://www.reuters.com/markets/funds/agentic-ai-race-by-british-banks-raises-new-risks-regulator-2025-12-17/',
      date: 'Dec 17, 2025',
      slug: 'agentic-ai-customer-facing-trials-fca',
      link: 'https://www.reuters.com/markets/funds/agentic-ai-race-by-british-banks-raises-new-risks-regulator-2025-12-17/'
    },
    {
      label: 'Fraud',
      headline: 'AI fraud detection firm Informed.IQ secures $63M investment to expand services',
      summary:
        'Invictus Growth Partners has invested $63 million in Informed.IQ, a provider of AI-powered fraud detection and loan verification services used by major lenders; the funding will support expansion into mortgage and consumer lending fraud markets.',
      impact:
        'Advanced AI for fraud prevention affects risk models and vendor decisions for credit unions evaluating next-gen detection tools in lending and compliance workflows.',
      sourceName: 'AInvest/Reuters',
      sourceUrl:
        'https://www.tradingview.com/news/reuters.com%2C2025%3Anewsml_FWN3XM0BP%3A0-informed-iq-secures-63-million-from-invictus-growth-partners/',
      date: 'Dec 16, 2025',
      slug: 'informed-iq-63m-funding-fraud-expansion',
      link:
        'https://www.tradingview.com/news/reuters.com%2C2025%3Anewsml_FWN3XM0BP%3A0-informed-iq-secures-63-million-from-invictus-growth-partners/'
    },
    {
      label: 'Infrastructure',
      headline: 'AI infrastructure services become foundational for financial services computing',
      summary:
        'Recent industry analysis highlights that AI infrastructure services — spanning data orchestration, accelerators and lifecycle management platforms — are evolving from niche add-ons to central components of enterprise computing stacks in banking and financial services.',
      impact:
        'As financial institutions deepen AI use, infrastructure choices increasingly influence cost, scalability and governance decisions for all AI initiatives credit unions may consider.',
      sourceName: 'RTInsights',
      sourceUrl: 'https://www.rtinsights.com/ai-infrastructure-services-banking-and-financial-services-new-foundation-for-computing/',
      date: 'Dec 16, 2025',
      slug: 'ai-infrastructure-foundational-financial-services',
      link: 'https://www.rtinsights.com/ai-infrastructure-services-banking-and-financial-services-new-foundation-for-computing/'
    },
    {
      label: 'AI Governance',
      headline: 'Trump signs executive order aiming to limit state AI regulations',
      summary:
        'President Donald Trump signed an executive order directing federal agencies to challenge certain state AI laws and reduce a patchwork of state regulation.',
      impact:
        'Credit unions operating across multiple states may need to adjust AI governance and vendor oversight as the federal and state regulatory environment shifts.',
      sourceName: 'AP News',
      sourceUrl: 'https://apnews.com/article/9cb4dd1bc249e404260b3dc233217388',
      date: 'Dec 16, 2025',
      slug: 'trump-executive-order-ai-regulation',
      link: 'https://apnews.com/article/9cb4dd1bc249e404260b3dc233217388'
    },
    {
      label: 'Lending',
      headline: 'Banks face pressure from fintechs and agentic AI as credit products evolve',
      summary:
        'PYMNTS reports growing pressure on banks from fintechs and new agentic AI capabilities as consumers expect flexible credit delivered in real time.',
      impact:
        'Credit unions should watch how agentic AI changes underwriting, repayment flexibility, and servicing expectations, and stress test risk controls before adopting similar models.',
      sourceName: 'PYMNTS',
      sourceUrl: 'https://www.pymnts.com/news/payment-methods/2025/credit-is-being-rewritten-and-banks-are-running-out-of-time-says-thredd-ceo/',
      date: 'Dec 17, 2025',
      slug: 'agentic-ai-credit-product-pressure',
      link: 'https://www.pymnts.com/news/payment-methods/2025/credit-is-being-rewritten-and-banks-are-running-out-of-time-says-thredd-ceo/'
    },
    {
      label: 'Member Experience',
      headline: 'Member Loyalty Group launches AI tool to help credit unions respond to member feedback faster',
      summary:
        'Member Loyalty Group announced an AI powered feature that helps credit unions generate faster, more consistent replies to member feedback.',
      impact:
        'This is a practical near term automation use case for member experience teams, but it should be paired with clear tone guidelines, approvals, and auditability.',
      sourceName: 'Business Wire',
      sourceUrl:
        'https://www.businesswire.com/news/home/20251216488272/en/Member-Loyalty-Group-Introduces-AI-Powered-Solution-to-Help-Credit-Unions-Close-the-Feedback-Loop-Faster-More-Effectively',
      date: 'Dec 16, 2025',
      slug: 'member-loyalty-group-ai-feedback-tool',
      link:
        'https://www.businesswire.com/news/home/20251216488272/en/Member-Loyalty-Group-Introduces-AI-Powered-Solution-to-Help-Credit-Unions-Close-the-Feedback-Loop-Faster-More-Effectively'
    },
    {
      label: 'AI Governance',
      headline: 'NCUA publishes AI resource center for credit unions',
      summary: 'NCUA launched examiner guidance covering model validation, vendor oversight, and documentation expectations.',
      impact: 'Clarifies the governance and evidence examiners expect for AI deployments.',
      sourceName: 'NCUA',
      sourceUrl: 'https://ncua.gov/newsroom',
      date: 'Jan 9, 2025',
      slug: 'ncua-ai-resource-center',
      link: '/news/ncua-ai-resource-center.html'
    },
    {
      label: 'Fraud',
      headline: 'Visa and Mastercard sync AI fraud defenses across issuers',
      summary: 'Network providers are coordinating AI-driven risk signals to cut false positives and stop coordinated card fraud faster.',
      impact: 'Expect higher fraud-blocking accuracy without adding friction for members.',
      sourceName: 'PaymentsDive',
      sourceUrl: 'https://www.paymentsdive.com/',
      date: 'Jan 7, 2025',
      slug: 'visa-mastercard-ai-fraud-network',
      link: '/news/visa-mastercard-ai-fraud.html'
    },
    {
      label: 'Operations',
      headline: 'Jack Henry adds AI agent handoffs to digital banking suite',
      summary: 'The core provider is rolling out AI copilots for frontline staff and member chat with automated CRM summaries.',
      impact: 'Smoother support workflows with less manual note-taking and shorter handle times.',
      sourceName: 'Jack Henry',
      sourceUrl: 'https://jackhenry.com/',
      date: 'Jan 6, 2025',
      slug: 'jack-henry-ai-agent-suite',
      link: '/news/jack-henry-ai-features.html'
    },
    {
      label: 'Member Experience',
      headline: 'Fintechs raise expectations for AI-first service journeys',
      summary: 'New entrants are marketing AI-led onboarding, proactive nudges, and multilingual support as default experiences.',
      impact: 'Raises the bar for self-service speed and personalization to retain digital-first members.',
      sourceName: 'Finextra',
      sourceUrl: 'https://www.finextra.com/',
      date: 'Jan 3, 2025',
      slug: 'fintechs-raise-ai-support',
      link: '/news/fintechs-raise-expectations.html'
    },
    {
      label: 'Payments',
      headline: 'FedNow real-time growth pressures staffing and alerts',
      summary: 'Rising instant-payment volume is driving demand for automated fraud holds and 24/7 exception handling.',
      impact: 'Teams need AI-assisted monitoring and member notifications to meet round-the-clock expectations.',
      sourceName: 'Federal Reserve',
      sourceUrl: 'https://www.frbservices.org/',
      date: 'Dec 20, 2024',
      slug: 'fednow-instant-payments-growth',
      link: '/news/fednow-instant-payments-growth.html'
    },
    {
      label: 'OpenAI',
      headline: 'OpenAI board withdraws lawsuit; no GPT-5 release timeline yet',
      summary: 'The board signaled a reset by dropping litigation while safety reviews continue.',
      impact: 'Signals a pause on major model releases while oversight questions are resolved.',
      sourceName: 'OpenAI',
      sourceUrl: 'https://openai.com/',
      date: 'Dec 19, 2024',
      slug: 'openai-board-withdraws-lawsuit',
      link: '/news/ai-governance-board-expectations.html'
    },
    {
      label: 'Member Insights',
      headline: 'Search data shows members want AI for tailored support and budgeting',
      summary: 'Members increasingly search for AI-driven financial coaching, budgeting help, and tailored advice.',
      impact: 'Credit unions need personalized nudges and guidance to stay competitive with AI-native experiences.',
      sourceName: 'Google Trends',
      sourceUrl: 'https://trends.google.com/',
      date: 'Dec 18, 2024',
      slug: 'ai-member-tailored-support',
      link: '/news/ai-personalization-digital-banking.html'
    },
    {
      label: 'Fraud',
      headline: 'Members say AI fraud protection is a must-have benefit',
      summary: 'Heightened scams are raising expectations for real-time anomaly detection, proactive alerts, and frictionless remediation.',
      impact: 'Strong AI fraud controls are becoming table stakes for member trust.',
      sourceName: 'CU Today',
      sourceUrl: 'https://www.cutoday.info/',
      date: 'Dec 12, 2024',
      slug: 'ai-fraud-protection-necessity',
      link: '/news/ai-powered-fraud-tools.html'
    }
  ];

  const parseAlertDate = (entry) => {
    const raw = entry?.date || entry?.published || entry?.timestamp || '';
    if (!raw) return null;

    const normalized = typeof raw === 'string' ? raw.trim() : raw;
    const parsed = new Date(normalized);

    if (!Number.isNaN(parsed.getTime())) return parsed;

    if (typeof normalized === 'string') {
      const fallback = new Date(normalized.replace(/-/g, '/'));
      if (!Number.isNaN(fallback.getTime())) return fallback;
    }

    return null;
  };

  const getRecentAlerts = (alerts, days = 60) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const seenUrls = new Set();
    const seenHeadlines = new Set();

    return alerts
      .map((alert) => ({ ...alert, parsedDate: parseAlertDate(alert) }))
      .filter(({ parsedDate }) => parsedDate && parsedDate.getTime() >= cutoff.getTime())
      .sort((a, b) => b.parsedDate - a.parsedDate)
      .filter((alert) => {
        const urlKey = alert.sourceUrl?.trim().toLowerCase();
        const headlineKey = alert.headline?.trim().toLowerCase();
        const isDuplicate = (urlKey && seenUrls.has(urlKey)) || (headlineKey && seenHeadlines.has(headlineKey));

        if (isDuplicate) return false;

        if (urlKey) seenUrls.add(urlKey);
        if (headlineKey) seenHeadlines.add(headlineKey);
        return true;
      })
      .map(({ parsedDate, ...rest }) => rest);
  };

  // Prepare alerts once for all consumers: freshest-first, deduped, and within the defined window
  const preparedAlerts = getRecentAlerts(alertsData);
  const tickerAlerts = preparedAlerts.slice(0, 3);

  const normalizePath = (path) => path.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';

  // Predefined fallback images for cards that do not declare their own artwork.
  // Tries user-provided PNG/JPG first; if missing, falls back to bundled SVGs.
  const fallbackImageSets = [
    {
      candidates: [
        '/assets/Articalimage1.png',
        '/assets/Articalimage1.jpg',
        '/assets/Articalimage1.jpeg',
        '/assets/Articleimage1.png',
        '/assets/Articleimage1.jpg',
        '/assets/Articleimage1.jpeg'
      ],
      fallback: '/assets/Articalimage1.svg'
    },
    {
      candidates: [
        '/assets/Articalimage2.png',
        '/assets/Articalimage2.jpg',
        '/assets/Articalimage2.jpeg',
        '/assets/Articleimage2.png',
        '/assets/Articleimage2.jpg',
        '/assets/Articleimage2.jpeg'
      ],
      fallback: '/assets/Articalimage2.svg'
    },
    {
      candidates: [
        '/assets/Articalimage3.png',
        '/assets/Articalimage3.jpg',
        '/assets/Articalimage3.jpeg',
        '/assets/Articleimage3.png',
        '/assets/Articleimage3.jpg',
        '/assets/Articleimage3.jpeg'
      ],
      fallback: '/assets/Articalimage3.svg'
    },
    {
      candidates: [
        '/assets/Articalimage4.png',
        '/assets/Articalimage4.jpg',
        '/assets/Articalimage4.jpeg',
        '/assets/Articleimage4.png',
        '/assets/Articleimage4.jpg',
        '/assets/Articleimage4.jpeg'
      ],
      fallback: '/assets/Articalimage4.svg'
    },
    {
      candidates: [
        '/assets/Articalimage5.png',
        '/assets/Articalimage5.jpg',
        '/assets/Articalimage5.jpeg',
        '/assets/Articleimage5.png',
        '/assets/Articleimage5.jpg',
        '/assets/Articleimage5.jpeg'
      ],
      fallback: '/assets/Articalimage5.svg'
    },
    {
      candidates: [
        '/assets/Articalimage6.png',
        '/assets/Articalimage6.jpg',
        '/assets/Articalimage6.jpeg',
        '/assets/Articleimage6.png',
        '/assets/Articleimage6.jpg',
        '/assets/Articleimage6.jpeg'
      ],
      fallback: '/assets/Articalimage1.svg'
    },
    {
      candidates: [
        '/assets/Articalimage7.png',
        '/assets/Articalimage7.jpg',
        '/assets/Articalimage7.jpeg',
        '/assets/Articleimage7.png',
        '/assets/Articleimage7.jpg',
        '/assets/Articleimage7.jpeg'
      ],
      fallback: '/assets/Articalimage2.svg'
    },
    {
      candidates: [
        '/assets/Articalimage8.png',
        '/assets/Articalimage8.jpg',
        '/assets/Articalimage8.jpeg',
        '/assets/Articleimage8.png',
        '/assets/Articleimage8.jpg',
        '/assets/Articleimage8.jpeg'
      ],
      fallback: '/assets/Articalimage3.svg'
    },
    {
      candidates: [
        '/assets/Articalimage9.png',
        '/assets/Articalimage9.jpg',
        '/assets/Articalimage9.jpeg',
        '/assets/Articleimage9.png',
        '/assets/Articleimage9.jpg',
        '/assets/Articleimage9.jpeg'
      ],
      fallback: '/assets/Articalimage4.svg'
    },
    {
      candidates: [
        '/assets/Articalimage10.png',
        '/assets/Articalimage10.jpg',
        '/assets/Articalimage10.jpeg',
        '/assets/Articleimage10.png',
        '/assets/Articleimage10.jpg',
        '/assets/Articleimage10.jpeg'
      ],
      fallback: '/assets/Articalimage5.svg'
    },
    {
      candidates: [
        '/assets/Articalimage11.png',
        '/assets/Articalimage11.jpg',
        '/assets/Articalimage11.jpeg',
        '/assets/Articleimage11.png',
        '/assets/Articleimage11.jpg',
        '/assets/Articleimage11.jpeg'
      ],
      fallback: '/assets/Articalimage1.svg'
    },
    {
      candidates: [
        '/assets/Articalimage12.png',
        '/assets/Articalimage12.jpg',
        '/assets/Articalimage12.jpeg',
        '/assets/Articleimage12.png',
        '/assets/Articleimage12.jpg',
        '/assets/Articleimage12.jpeg'
      ],
      fallback: '/assets/Articalimage2.svg'
    },
    {
      candidates: [
        '/assets/Articalimage13.png',
        '/assets/Articalimage13.jpg',
        '/assets/Articalimage13.jpeg',
        '/assets/Articleimage13.png',
        '/assets/Articleimage13.jpg',
        '/assets/Articleimage13.jpeg'
      ],
      fallback: '/assets/Articalimage3.svg'
    },
    {
      candidates: [
        '/assets/Articalimage14.png',
        '/assets/Articalimage14.jpg',
        '/assets/Articalimage14.jpeg',
        '/assets/Articleimage14.png',
        '/assets/Articleimage14.jpg',
        '/assets/Articleimage14.jpeg'
      ],
      fallback: '/assets/Articalimage4.svg'
    },
    {
      candidates: [
        '/assets/Articalimage15.png',
        '/assets/Articalimage15.jpg',
        '/assets/Articalimage15.jpeg',
        '/assets/Articleimage15.png',
        '/assets/Articleimage15.jpg',
        '/assets/Articleimage15.jpeg'
      ],
      fallback: '/assets/Articalimage5.svg'
    },
    {
      candidates: [
        '/assets/Articalimage16.png',
        '/assets/Articalimage16.jpg',
        '/assets/Articalimage16.jpeg',
        '/assets/Articleimage16.png',
        '/assets/Articleimage16.jpg',
        '/assets/Articleimage16.jpeg'
      ],
      fallback: '/assets/Articalimage1.svg'
    }
  ];

  const applyFallbackImages = () => {
    const cards = document.querySelectorAll('.grid.cards-3 .card');
    if (!cards.length) return;

    cards.forEach((card, index) => {
      if (card.querySelector('.card-image') || card.querySelector('img')) return;
      const imageSet = fallbackImageSets[index % fallbackImageSets.length];
      const wrapper = document.createElement('div');
      wrapper.className = 'card-image';
      const img = document.createElement('img');
      const trySources = [...imageSet.candidates, imageSet.fallback];
      let sourceIndex = 0;

      const tryNext = () => {
        if (sourceIndex >= trySources.length) return;
        const nextSrc = trySources[sourceIndex++];
        img.src = nextSrc;
      };

      img.onerror = () => {
        if (sourceIndex >= trySources.length) return;
        tryNext();
      };

      img.addEventListener('load', () => {
        // If the loaded source is the last (fallback), signal in the console to help debugging missing assets.
        if (img.src.endsWith(imageSet.fallback)) {
          // eslint-disable-next-line no-console
          console.info(`Card fallback image used default asset: ${imageSet.fallback}`);
        }
      });

      tryNext();
      const heading = card.querySelector('h3');
      img.alt = heading?.textContent?.trim() || 'Article illustration';
      wrapper.appendChild(img);
      card.insertBefore(wrapper, card.firstChild);
    });
  };

  applyFallbackImages();

  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });

    const existingAlertsLink = navLinks.querySelector('a[href$="/alerts/"]');
    if (existingAlertsLink) {
      existingAlertsLink.textContent = 'AI Newsroom Alerts';
    } else {
      const alertsLink = document.createElement('a');
      alertsLink.href = '/alerts/';
      alertsLink.textContent = 'AI Newsroom Alerts';
      alertsLink.addEventListener('click', () => navLinks.classList.remove('open'));
      const firstNav = navLinks.querySelector('a');
      if (firstNav) {
        firstNav.insertAdjacentElement('afterend', alertsLink);
      } else {
        navLinks.appendChild(alertsLink);
      }
    }

    const sponsorshipAnchors = Array.from(navLinks.querySelectorAll('a')).filter((link) => {
      const href = link.getAttribute('href') || '';
      const normalizedHref = normalizePath(new URL(href, window.location.href).pathname);
      return normalizedHref === '/sponsorships';
    });

    if (!sponsorshipAnchors.length) {
      const sponsorAnchor = document.createElement('a');
      sponsorAnchor.href = '/sponsorships/';
      sponsorAnchor.textContent = 'Sponsorships';
      sponsorAnchor.addEventListener('click', () => navLinks.classList.remove('open'));
      const aboutLink = navLinks.querySelector('a[href*="about"]');
      if (aboutLink) {
        aboutLink.insertAdjacentElement('beforebegin', sponsorAnchor);
      } else {
        navLinks.appendChild(sponsorAnchor);
      }
    } else if (sponsorshipAnchors.length > 1) {
      sponsorshipAnchors.slice(1).forEach((duplicate) => duplicate.remove());
    }
  }

  document.querySelectorAll('.footer .footer-links').forEach((links) => {
    if (!links) return;

    const existingFooterLink = links.querySelector('a[href$="/alerts/"]');
    if (existingFooterLink) {
      existingFooterLink.textContent = 'AI Newsroom Alerts';
      existingFooterLink.href = '/alerts/';
      return;
    }

    const alertsFooterLink = document.createElement('a');
    alertsFooterLink.href = '/alerts/';
    alertsFooterLink.textContent = 'AI Newsroom Alerts';

    const firstFooterLink = links.querySelector('a');
    if (firstFooterLink) {
      firstFooterLink.insertAdjacentElement('beforebegin', alertsFooterLink);
    } else {
      links.appendChild(alertsFooterLink);
    }
  });

  document.querySelectorAll('.footer .footer-links').forEach((links) => {
    if (!links) return;

    const sponsorshipLink = links.querySelector(
      'a[href$="/sponsorships/"], a[href$="sponsorships.html"], a[href$="/sponsorships"]'
    );

    if (sponsorshipLink) return;

    const sponsorAnchor = document.createElement('a');
    sponsorAnchor.href = '/sponsorships/';
    sponsorAnchor.textContent = 'Sponsorships';

    const aboutLink = links.querySelector('a[href*="about"]');
    if (aboutLink) {
      aboutLink.insertAdjacentElement('beforebegin', sponsorAnchor);
    } else {
      links.appendChild(sponsorAnchor);
    }
  });

  const currentPath = normalizePath(window.location.pathname);

  document.querySelectorAll('.nav-links a').forEach((link) => {
    const linkPath = normalizePath(new URL(link.getAttribute('href'), window.location.origin).pathname);
    if (linkPath === currentPath || (currentPath === '/' && linkPath === '/index.html')) {
      link.classList.add('active');
    }
  });

  const newsletterForm = document.querySelector('#newsletter-form');
  const signupTableBody = document.querySelector('#signup-table-body');
  const signupEmptyState = document.querySelector('#signup-empty');
  const exportSignupsBtn = document.querySelector('#export-signups');
  const clearSignupsBtn = document.querySelector('#clear-signups');
  const SIGNUP_KEY = 'cuai_newsletter_signups';

  const loadSignups = () => {
    try {
      const raw = localStorage.getItem(SIGNUP_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Unable to read newsletter signups from localStorage', err);
      return [];
    }
  };

  const saveSignups = (entries) => {
    try {
      localStorage.setItem(SIGNUP_KEY, JSON.stringify(entries));
    } catch (err) {
      console.error('Unable to store newsletter signups', err);
    }
  };

  const addSignup = (entry) => {
    const current = loadSignups();
    current.push(entry);
    saveSignups(current);
  };

  const clearSignups = () => {
    localStorage.removeItem(SIGNUP_KEY);
  };

  const formatTimestamp = (date) => {
    try {
      return new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    } catch (err) {
      return date.toISOString();
    }
  };

  const renderSignupTable = () => {
    if (!signupTableBody) return;
    const entries = loadSignups().sort((a, b) => {
      const aDate = new Date(a.isoTimestamp || a.timestamp || 0);
      const bDate = new Date(b.isoTimestamp || b.timestamp || 0);
      return bDate - aDate;
    });

    if (signupEmptyState) {
      signupEmptyState.style.display = entries.length ? 'none' : 'block';
    }

    if (!entries.length) {
      signupTableBody.innerHTML = '';
      return;
    }

    signupTableBody.innerHTML = entries
      .map(
        (entry) => `
          <tr>
            <td>${entry.email}</td>
            <td>${entry.firstName || ''}</td>
            <td>${entry.timestamp || ''}</td>
          </tr>
        `
      )
      .join('');
  };

  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector('#email')?.value?.trim() || '';
      const firstName = newsletterForm.querySelector('#firstName')?.value?.trim() || '';
      const status = newsletterForm.querySelector('.status');

      const now = new Date();
      addSignup({
        email,
        firstName,
        timestamp: formatTimestamp(now),
        isoTimestamp: now.toISOString()
      });

      if (status) {
        status.textContent = 'Thanks for subscribing.';
        status.style.display = 'block';
      }

      const subject = 'Subscribe to Weekly AI Briefing';
      const bodyLines = ['Please add me to the CreditUnionAI News Weekly AI Briefing list.'];

      const mailtoHref = `mailto:info@creditunionainews.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        bodyLines.join('\n')
      )}`;

      window.location.href = mailtoHref;

      newsletterForm.reset();
    });
  }

  const sponsorshipForm = document.querySelector('#sponsorship-form');

  if (sponsorshipForm) {
    sponsorshipForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(sponsorshipForm);
      const name = (formData.get('name') || '').toString().trim();
      const organization = (formData.get('organization') || '').toString().trim();
      const role = (formData.get('role') || '').toString().trim();
      const email = (formData.get('email') || '').toString().trim();
      const interest = (formData.get('interest') || '').toString().trim();
      const message = (formData.get('message') || '').toString().trim();

      const bodyLines = [
        'Sponsorship inquiry for CreditUnionAI News',
        name ? `Name: ${name}` : '',
        organization ? `Organization: ${organization}` : '',
        role ? `Role: ${role}` : '',
        email ? `Email: ${email}` : '',
        interest ? `Partnership interest: ${interest}` : '',
        message ? `Message / goals: ${message}` : ''
      ].filter(Boolean);

      const mailtoHref = `mailto:info@creditunionainews.com?subject=${encodeURIComponent(
        'Sponsorship inquiry'
      )}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

      window.location.href = mailtoHref;
    });
  }

  if (signupTableBody) {
    renderSignupTable();
  }

  if (exportSignupsBtn) {
    exportSignupsBtn.addEventListener('click', () => {
      const entries = loadSignups();
      if (!entries.length) return;
      const header = 'Email,First Name,Subscribed At\n';
      const rows = entries
        .map((entry) => `${entry.email},${entry.firstName || ''},${entry.timestamp || ''}`)
        .join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'creditunionai-newsletter-signups.csv';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  if (clearSignupsBtn) {
    clearSignupsBtn.addEventListener('click', () => {
      clearSignups();
      renderSignupTable();
    });
  }

  const header = document.querySelector('header');
  const buildTicker = () => {
    if (!header || !tickerAlerts.length) return;

    const tickerBar = document.createElement('div');
    tickerBar.className = 'ticker-bar';
    tickerBar.innerHTML = `
      <div class="container ticker-track" aria-label="Latest updates">
        <a class="ticker-label" href="/alerts/">AI Newsroom Alerts</a>
        <div class="ticker-window">
          <div class="ticker-strip" role="list"></div>
        </div>
      </div>
    `;

    header.appendChild(tickerBar);

    const strip = tickerBar.querySelector('.ticker-strip');
    if (!strip) return;

    const renderItems = () =>
      tickerAlerts
        .map(
          (item) => `
            <a class="ticker-item" href="/alerts/#${item.slug}" role="listitem">
              <span class="ticker-pill">${item.label}</span>
              <span class="ticker-text">${item.headline}</span>
            </a>
          `
        )
        .join('');

    strip.innerHTML = `${renderItems()}${renderItems()}`;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const toggleAnimation = () => {
      strip.style.animationPlayState = prefersReducedMotion.matches ? 'paused' : 'running';
    };

    toggleAnimation();
    prefersReducedMotion.addEventListener('change', toggleAnimation);
  };

  buildTicker();

  const alertsList = document.querySelector('#alerts-list');

  const renderAlerts = () => {
    if (!alertsList) return;

    if (!preparedAlerts.length) {
      alertsList.innerHTML = `
        <article class="card alert-card" aria-live="polite">
          <div class="alert-content">
            <h3>No alerts in the last 60 days. Check back soon.</h3>
          </div>
        </article>
      `;
      return;
    }

    alertsList.innerHTML = preparedAlerts
      .map(
        (item) => `
          <article class="card alert-card" id="${item.slug}">
            <div class="meta"><span class="tag">${item.label}</span><span class="tag tag-secondary">Alert</span></div>
            <div class="alert-content">
              <h3>${item.headline}</h3>
              <p class="alert-summary">${item.summary}</p>
              <p class="alert-impact"><span class="muted-label">Credit union impact:</span> ${item.impact || ''}</p>
              <p class="alert-meta"><span class="alert-date">${item.date || ''}</span> · <span class="alert-source"><span class="muted-label">Source:</span> <a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">${item.sourceName}</a></span></p>
            </div>
          </article>
        `
      )
      .join('');
  };

  renderAlerts();
})();
