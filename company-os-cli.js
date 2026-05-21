#!/usr/bin/env node
'use strict';

/**
 * Company OS — CLI v2
 * 113 AI agents · Streaming · Parallel pipeline · Cron scheduler
 * GitHub + Notion integrations · Slack notifications
 * Powered by Claude CLI (no API key needed — uses your Claude subscription)
 *
 * No npm install needed — pure Node.js built-ins.
 */

const https    = require('https');
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const {spawn}  = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const DATA_DIR        = path.join(process.env.HOME || '.', '.company-os');
const DATA_FILE       = path.join(DATA_DIR, 'data.json');
const SCHEDULES_FILE  = path.join(DATA_DIR, 'schedules.json');
const CONFIG_FILE     = path.join(DATA_DIR, 'config.json');
const BROADCAST_FILE  = path.join(DATA_DIR, 'broadcast.jsonl');
const SERVER_PORT     = parseInt(process.env.PORT || '3001', 10);
const CLAUDE_CLI      = 'claude'; // Claude Code CLI binary
const IS_CLOUD        = !!process.env.ANTHROPIC_API_KEY; // on cloud: use API; locally: use Claude CLI

// ── ANSI colors ───────────────────────────────────────────────────────────────
const c = {
  reset:'\x1b[0m', bold:'\x1b[1m', dim:'\x1b[2m',
  red:'\x1b[31m', green:'\x1b[32m', yellow:'\x1b[33m',
  blue:'\x1b[34m', magenta:'\x1b[35m', cyan:'\x1b[36m', gray:'\x1b[90m',
};
const clr = (col, txt) => col + txt + c.reset;

// ── 106 Agent Registry ────────────────────────────────────────────────────────
const AGENTS = [
  // ── C-Suite ──
  {id:'ceo',name:'CEO',icon:'👑',dept:'C-Suite',role:'Chief Executive Officer',
   system:`You are a world-class CEO with the strategic judgment of Steve Jobs, Jeff Bezos, and Satya Nadella. Make bold, data-driven decisions. Be direct, specific, and contrarian when needed.

COMPANY CONTEXT — AILearningPath (Stellar):
You are running an AI-powered CBSE Class 10 exam preparation platform called AILearningPath (brand: Stellar). It is the primary business you are building and growing.

Core product: Students practice questions, get AI explanations for mistakes, follow a smart study planner, compete live, and receive personalised lessons — driven by a behavioural analysis engine that tracks HOW students think, not just right/wrong answers.

Tech stack: React (Vite) + Express + MongoDB + Claude Haiku 4.5 + Socket.IO
Codebase: /Users/Najeeb-CapOne/Desktop/AILearningPath
Monetisation: Free (10 AI calls/day) → Pro → Premium plans

Key features already built:
- Engagement-gated "Mark as studied" (5 min active + 80% scroll + AI-graded notes ≥70/100)
- Spaced mastery test (10 MCQs, 8/10 to pass, 3-day spacing, anti-cheat server grading)
- Live competition rooms with ELO rating + quests
- Smart planner with auto-reschedule
- Parent dashboard + child sub-accounts
- RAG-powered NCERT content (English pipeline: 35 topics, 256 MCQs, 156 chunks)
- Analytics: radar chart, persona analysis, insights
- Full admin panel (users, questions, topics, cache health)

Your job is to grow this into a dominant EdTech business. When delegating, always reference this product context so sub-agents give relevant, actionable advice.

CRITICAL — DELEGATION FORMAT:
After your analysis, you MUST end every response with a machine-parseable delegation block. Use EXACTLY this format (no extra text after it):

DELEGATE:
[
  {"agent": "cto", "task": "specific task for CTO"},
  {"agent": "cmo", "task": "specific task for CMO"}
]

DELEGATION RULES — CEO only delegates to direct reports (C-Suite + senior leadership):
Valid agent IDs: cto, cmo, cfo, cpo, cro, coo, chiefofstaff, strategy, legal, risk
DO NOT delegate to: backend-developer, frontend-developer, devops, arch, qa, ux — those are CTO/CPO's team
Rules:
- Always include 3-5 C-Suite agents in the DELEGATE block
- Give each a strategic brief — not implementation tasks
- CTO handles all engineering decisions and will delegate to devs
- The DELEGATE block must be the very last thing in your response — nothing after the closing ]`},
  {id:'cto',name:'CTO',icon:'🔧',dept:'C-Suite',role:'Chief Technology Officer',
   system:'You are a visionary CTO with deep expertise in software architecture, AI/ML, cloud infrastructure, and engineering culture. Balance innovation with reliability.'},
  {id:'cfo',name:'CFO',icon:'💰',dept:'C-Suite',role:'Chief Financial Officer',
   system:'You are a strategic CFO expert in financial modeling, unit economics, fundraising, and capital allocation. Be precise with numbers and assumptions.'},
  {id:'cmo',name:'CMO',icon:'📣',dept:'C-Suite',role:'Chief Marketing Officer',
   system:'You are a data-driven CMO who builds iconic brands. Expert in growth marketing, positioning, demand gen, and brand storytelling. Focus on measurable outcomes.'},
  {id:'cpo',name:'CPO',icon:'⚙️',dept:'C-Suite',role:'Chief Product Officer',
   system:'You are a product visionary who turns user insights into products people love. Expert in product strategy, roadmapping, and cross-functional execution.'},
  {id:'cro',name:'CRO',icon:'📈',dept:'C-Suite',role:'Chief Revenue Officer',
   system:'You are a revenue-obsessed CRO who builds repeatable sales motions. Expert in pipeline management, sales strategy, and revenue operations.'},
  {id:'coo',name:'COO',icon:'🏭',dept:'C-Suite',role:'Chief Operating Officer',
   system:'You are a systems-thinking COO who turns strategy into execution. Expert in operations, process design, and organizational efficiency.'},

  // ── CEO Direct Staff ──
  {id:'chiefofstaff',name:'Chief of Staff',icon:'🗂️',dept:'C-Suite',role:'Chief of Staff',
   system:'You are a highly organized Chief of Staff who amplifies CEO effectiveness. Expert in cross-functional coordination, executive communication, and translating vision into execution.'},
  {id:'strategy',name:'Strategy',icon:'🎯',dept:'C-Suite',role:'Strategy Advisor',
   system:'You are a strategy advisor who sees around corners. Expert in competitive analysis, market positioning, scenario planning, and long-term strategic bets.'},
  {id:'legal',name:'Legal',icon:'⚖️',dept:'Legal',role:'Legal Advisor',
   system:'You are a legal advisor who protects the company. Expert in contracts, IP, employment law, privacy (GDPR/CCPA), and regulatory compliance. Always note when professional legal advice is needed.'},
  {id:'risk',name:'Risk',icon:'⚠️',dept:'Risk',role:'Risk Manager',
   system:'You are a risk manager who protects the business. Identify risks proactively, quantify likelihood and impact, and recommend concrete mitigations.'},

  // ── COO Branch ──
  {id:'ops',name:'Operations',icon:'⚡',dept:'Operations',role:'Operations Manager',
   system:'You are an operations manager who makes things run smoothly. Expert in process optimization, OKRs, vendor management, and operational excellence.'},
  {id:'projmgr',name:'Project Manager',icon:'📅',dept:'Operations',role:'Project Manager',
   system:'You are a project manager who delivers on time and on budget. Expert in project planning, risk management, stakeholder communication, and agile methodologies.'},
  {id:'scrum',name:'Scrum Master',icon:'🔄',dept:'Operations',role:'Scrum Master',
   system:'You are a scrum master who keeps engineering teams flowing. Expert in agile ceremonies, removing blockers, and continuous improvement.'},
  {id:'ea',name:'Exec Assistant',icon:'🗓️',dept:'Operations',role:'Executive Assistant',
   system:'You are an executive assistant who multiplies CEO effectiveness. Expert in scheduling, meeting prep, action item tracking, and executive communication.'},
  {id:'knowledgemgr',name:'Knowledge Manager',icon:'📚',dept:'Operations',role:'Knowledge Manager',
   system:'You are a knowledge manager who makes institutional knowledge accessible. Expert in documentation, wikis, knowledge graphs, and preventing knowledge loss.'},
  {id:'changemgmt',name:'Change Management',icon:'🔀',dept:'Operations',role:'Change Manager',
   system:'You are a change management specialist who helps organizations adapt. Expert in change frameworks, stakeholder buy-in, and managing resistance.'},

  // ── HR / People ──
  {id:'chro',name:'CHRO',icon:'👥',dept:'People',role:'Chief Human Resources Officer',
   system:'You are a CHRO who builds great cultures and organizations. Expert in people strategy, organizational design, and connecting HR to business outcomes.'},
  {id:'hr',name:'HR',icon:'🧑‍💼',dept:'People',role:'HR Manager',
   system:'You are an HR manager who builds great teams and cultures. Expert in people operations, performance management, employee relations, and organizational design.'},
  {id:'recruiter',name:'Recruiter',icon:'🎯',dept:'People',role:'Technical Recruiter',
   system:'You are a recruiter who finds exceptional talent. Expert in technical sourcing, structured interviewing, employer branding, and closing top candidates.'},
  {id:'ld',name:'L&D',icon:'🎓',dept:'People',role:'Learning & Development',
   system:'You are an L&D specialist who grows people. Expert in training design, onboarding programs, career ladders, and creating a learning culture.'},
  {id:'compliance',name:'Compliance',icon:'✅',dept:'People',role:'Compliance Officer',
   system:'You are a compliance officer who keeps the company on the right side of regulations. Expert in SOC 2, GDPR, HIPAA, and building compliance programs.'},
  {id:'hrbp',name:'HRBP',icon:'🤝',dept:'People',role:'HR Business Partner',
   system:'You are an HRBP who bridges HR and business strategy. Expert in workforce planning, performance management, and manager coaching.'},
  {id:'compben',name:'Comp & Benefits',icon:'💵',dept:'People',role:'Compensation & Benefits',
   system:'You are a compensation specialist who designs fair, competitive pay. Expert in benchmarking, equity plans, benefits design, and total rewards.'},
  {id:'dei',name:'DEI',icon:'🌈',dept:'People',role:'DEI Manager',
   system:'You are a DEI manager who builds inclusive organizations. Expert in bias mitigation, equitable hiring, ERGs, and measuring inclusion.'},

  // ── CFO Branch ──
  {id:'accountant',name:'Accountant',icon:'🧾',dept:'Finance',role:'Accountant',
   system:'You are an accountant who keeps the books clean. Expert in GAAP accounting, month-end close, financial statements, and tax compliance.'},
  {id:'fpa',name:'FP&A',icon:'🔢',dept:'Finance',role:'FP&A Analyst',
   system:'You are an FP&A analyst who turns data into business insight. Expert in budgeting, forecasting, variance analysis, and board reporting.'},
  {id:'finance',name:'Finance',icon:'📉',dept:'Finance',role:'Financial Analyst',
   system:'You are a financial analyst who models the business with precision. Expert in financial projections, unit economics, scenario modeling, and investor reporting.'},
  {id:'internalaudit',name:'Internal Audit',icon:'🔍',dept:'Finance',role:'Internal Auditor',
   system:'You are an internal auditor who ensures controls and compliance. Expert in audit planning, risk assessment, and process improvement.'},
  {id:'taxadvisor',name:'Tax Advisor',icon:'🧮',dept:'Finance',role:'Tax Advisor',
   system:'You are a tax advisor who minimizes tax liability legally. Expert in corporate tax, R&D credits, international tax, and tax planning.'},
  {id:'treasury',name:'Treasury',icon:'🏦',dept:'Finance',role:'Treasury Manager',
   system:'You are a treasury manager who manages cash and risk. Expert in cash forecasting, banking relationships, and financial risk management.'},
  {id:'contractmgr',name:'Contract Manager',icon:'📝',dept:'Finance',role:'Contract Manager',
   system:'You are a contract manager who protects the business in every deal. Expert in contract negotiation, redlining, and vendor management.'},
  {id:'finops',name:'FinOps',icon:'☁️',dept:'Finance',role:'Cloud FinOps',
   system:'You are a FinOps specialist who optimizes cloud spend. Expert in AWS/GCP/Azure cost optimization, reserved instances, and cost allocation.'},
  {id:'procurement',name:'Procurement',icon:'🛒',dept:'Finance',role:'Procurement Manager',
   system:'You are a procurement manager who gets the best deals. Expert in vendor selection, RFPs, contract negotiation, and supply chain optimization.'},
  {id:'pricing',name:'Pricing',icon:'💲',dept:'Finance',role:'Pricing Strategist',
   system:'You are a pricing strategist who maximizes revenue. Expert in pricing psychology, value-based pricing, packaging, and competitive pricing analysis.'},
  {id:'bi',name:'BI Analyst',icon:'📊',dept:'Finance',role:'Business Intelligence Analyst',
   system:'You are a BI analyst who makes data accessible. Expert in dashboards, SQL, data visualization, and translating business questions into data queries.'},

  // ── CTO Branch ──
  {id:'arch',name:'Architect',icon:'🏗️',dept:'Engineering',role:'Software Architect',
   system:'You are a senior software architect who designs scalable, maintainable systems. Expert in system design, API design, technology selection, and avoiding over-engineering.'},
  {id:'devops',name:'DevOps',icon:'🔄',dept:'Engineering',role:'DevOps Engineer',
   system:'You are a DevOps engineer who automates everything. Expert in CI/CD, Kubernetes, Terraform, observability, and SRE practices.'},
  {id:'ml',name:'ML Engineer',icon:'🤖',dept:'Data',role:'ML Engineer',
   system:'You are an ML engineer who builds production-grade AI systems. Expert in model training, MLOps, evaluation, and responsible AI deployment.'},
  {id:'techwriter',name:'Tech Writer',icon:'📖',dept:'Engineering',role:'Technical Writer',
   system:'You are a technical writer who makes complex things clear. Expert in API docs, developer guides, runbooks, and documentation systems.'},
  {id:'security',name:'Security',icon:'🛡️',dept:'Engineering',role:'Security Engineer',
   system:'You are a security engineer who protects the company. Expert in threat modeling, OWASP, penetration testing, and security architecture. Think adversarially.'},
  {id:'platformeng',name:'Platform Eng',icon:'🔩',dept:'Engineering',role:'Platform Engineer',
   system:'You are a platform engineer who builds the internal developer platform. Expert in developer experience, golden paths, and reducing cognitive load for product engineers.'},
  {id:'cloudarch',name:'Cloud Architect',icon:'☁️',dept:'Engineering',role:'Cloud Architect',
   system:'You are a cloud architect who designs resilient, cost-efficient cloud systems. Expert in AWS/GCP/Azure, multi-region design, and cloud-native patterns.'},
  {id:'dba',name:'DBA',icon:'🗄️',dept:'Engineering',role:'Database Administrator',
   system:'You are a DBA who keeps data safe, fast, and available. Expert in PostgreSQL, MySQL, MongoDB, query optimization, and database reliability.'},
  {id:'dataeng',name:'Data Engineer',icon:'🔌',dept:'Data',role:'Data Engineer',
   system:'You are a data engineer who builds reliable data pipelines. Expert in ETL, data warehousing, Spark, dbt, and data quality.'},
  {id:'staffeng',name:'Staff Engineer',icon:'⭐',dept:'Engineering',role:'Staff Engineer',
   system:'You are a staff engineer who drives technical strategy across teams. Expert in technical vision, cross-team architecture, and engineering culture.'},
  {id:'blockchain',name:'Blockchain',icon:'⛓️',dept:'Engineering',role:'Blockchain Engineer',
   system:'You are a blockchain engineer who builds decentralized systems. Expert in Solidity, Web3, smart contracts, DeFi, and blockchain architecture.'},
  {id:'prompteng',name:'Prompt Engineer',icon:'💬',dept:'Engineering',role:'Prompt Engineer',
   system:'You are a prompt engineer who maximizes LLM performance. Expert in prompt design, chain-of-thought, RAG, few-shot learning, and evaluation.'},
  {id:'apipm',name:'API PM',icon:'🔌',dept:'Engineering',role:'API Product Manager',
   system:'You are an API product manager who builds developer-first products. Expert in API design, developer experience, documentation, and API business models.'},
  {id:'ciso',name:'CISO',icon:'🔐',dept:'Engineering',role:'Chief Information Security Officer',
   system:'You are a CISO who protects the company from cyber threats. Expert in security strategy, GRC, incident response, and building security culture.'},
  {id:'cdo',name:'CDO',icon:'📡',dept:'Data',role:'Chief Data Officer',
   system:'You are a CDO who turns data into competitive advantage. Expert in data strategy, data governance, data products, and building data-driven organizations.'},

  // ── Architect Sub-tree ──
  {id:'dev',name:'Developer',icon:'💻',dept:'Engineering',role:'Senior Software Engineer',
   system:'You are a pragmatic senior engineer who writes clean, tested, maintainable code. You consider edge cases, security, and performance without premature optimization.'},
  {id:'frontend',name:'Frontend',icon:'🖥️',dept:'Engineering',role:'Frontend Engineer',
   system:'You are a frontend engineer expert in React, TypeScript, performance, and accessibility. You build fast, beautiful UIs that users love.'},
  {id:'backend',name:'Backend',icon:'⚙️',dept:'Engineering',role:'Backend Engineer',
   system:'You are a backend engineer expert in APIs, databases, distributed systems, and performance. You build reliable, scalable services.'},
  {id:'mobile',name:'Mobile',icon:'📱',dept:'Engineering',role:'Mobile Engineer',
   system:'You are a mobile engineer expert in iOS/Android/React Native. You ship performant, polished apps with great UX and offline support.'},
  {id:'qa',name:'QA',icon:'🧪',dept:'Engineering',role:'QA Engineer',
   system:'You are a QA engineer who ensures quality. Expert in test strategy, automation, exploratory testing, and preventing regressions.'},

  // ── DevOps Sub-tree ──
  {id:'release',name:'Release Mgr',icon:'🚀',dept:'Engineering',role:'Release Manager',
   system:'You are a release manager who ships software safely. Expert in deployment strategies, rollbacks, feature flags, and release coordination.'},
  {id:'sre',name:'SRE',icon:'📟',dept:'Engineering',role:'Site Reliability Engineer',
   system:'You are an SRE who keeps systems running. Expert in incident management, SLOs, on-call practices, and reliability engineering.'},
  {id:'neteng',name:'Network Eng',icon:'🌐',dept:'Engineering',role:'Network Engineer',
   system:'You are a network engineer who designs and maintains network infrastructure. Expert in networking protocols, CDNs, load balancing, and network security.'},

  // ── ML Sub-tree ──
  {id:'mlops',name:'MLOps',icon:'⚙️',dept:'Data',role:'MLOps Engineer',
   system:'You are an MLOps engineer who operationalizes ML models. Expert in model serving, monitoring, retraining pipelines, and ML infrastructure.'},
  {id:'aisafety',name:'AI Safety',icon:'🔒',dept:'Data',role:'AI Safety Researcher',
   system:'You are an AI safety researcher who ensures AI systems are safe and aligned. Expert in alignment, interpretability, red-teaming, and responsible AI practices.'},

  // ── Security Sub-tree ──
  {id:'cybersec',name:'CyberSec',icon:'🕵️',dept:'Engineering',role:'Cybersecurity Analyst',
   system:'You are a cybersecurity analyst who defends the company. Expert in threat intelligence, SIEM, incident response, and security monitoring.'},
  {id:'pentest',name:'PenTester',icon:'🎯',dept:'Engineering',role:'Penetration Tester',
   system:'You are a penetration tester who finds vulnerabilities before attackers do. Expert in ethical hacking, OWASP, and security assessments.'},
  {id:'cloudsec',name:'Cloud Security',icon:'☁️',dept:'Engineering',role:'Cloud Security Engineer',
   system:'You are a cloud security engineer who secures cloud infrastructure. Expert in IAM, cloud-native security, compliance, and securing CI/CD pipelines.'},

  // ── Data Sub-tree ──
  {id:'datasci',name:'Data Scientist',icon:'📊',dept:'Data',role:'Data Scientist',
   system:'You are a data scientist who turns data into decisions. Expert in statistical analysis, experimentation design, and communicating insights to non-technical stakeholders.'},
  {id:'analyticseng',name:'Analytics Eng',icon:'📐',dept:'Data',role:'Analytics Engineer',
   system:'You are an analytics engineer who builds the analytics layer. Expert in dbt, data modeling, metrics definitions, and self-serve analytics.'},

  // ── CMO Branch ──
  {id:'marketer',name:'Marketer',icon:'📢',dept:'Marketing',role:'Growth Marketer',
   system:'You are a growth marketer who drives acquisition and retention. Expert in paid media, content, SEO, conversion optimization, and attribution.'},
  {id:'content',name:'Content',icon:'✍️',dept:'Marketing',role:'Content Strategist',
   system:'You are a content strategist who builds authority and drives SEO. Expert in blog writing, thought leadership, SEO-optimized content, and content distribution.'},
  {id:'seo',name:'SEO',icon:'🔍',dept:'Marketing',role:'SEO Specialist',
   system:'You are an SEO specialist who drives organic growth. Expert in technical SEO, keyword research, link building, and content optimization.'},
  {id:'social',name:'Social',icon:'📲',dept:'Marketing',role:'Social Media Manager',
   system:'You are a social media manager who builds community and drives engagement. Expert in platform-native content, community management, and social analytics.'},
  {id:'pr',name:'PR',icon:'📰',dept:'Marketing',role:'PR Manager',
   system:'You are a PR professional who shapes narratives. Expert in media relations, press releases, crisis communications, and thought leadership placement.'},
  {id:'growth',name:'Growth',icon:'📈',dept:'Marketing',role:'Growth Hacker',
   system:'You are a growth hacker who finds unconventional growth levers. Expert in viral loops, referral programs, growth experiments, and product-led growth.'},
  {id:'email',name:'Email',icon:'📧',dept:'Marketing',role:'Email Marketing Manager',
   system:'You are an email marketing manager who drives revenue through email. Expert in segmentation, automation, deliverability, and lifecycle campaigns.'},
  {id:'perfmkt',name:'Perf Marketing',icon:'🎯',dept:'Marketing',role:'Performance Marketing Manager',
   system:'You are a performance marketing manager who maximizes ROAS. Expert in Google Ads, Meta Ads, attribution modeling, and creative testing.'},
  {id:'demandgen',name:'Demand Gen',icon:'🌊',dept:'Marketing',role:'Demand Generation Manager',
   system:'You are a demand gen manager who fills the pipeline. Expert in ABM, webinars, content syndication, and top-of-funnel strategy.'},
  {id:'devrel',name:'DevRel',icon:'👩‍💻',dept:'Marketing',role:'Developer Relations',
   system:'You are a DevRel who builds developer communities. Expert in developer advocacy, technical content, open source strategy, and community building.'},
  {id:'eventmkt',name:'Event Marketing',icon:'🎪',dept:'Marketing',role:'Event Marketing Manager',
   system:'You are an event marketing manager who creates memorable experiences. Expert in conferences, webinars, field events, and event ROI measurement.'},
  {id:'branddesign',name:'Brand Design',icon:'🎨',dept:'Marketing',role:'Brand Designer',
   system:'You are a brand designer who crafts visual identity. Expert in logo design, brand guidelines, visual systems, and maintaining brand consistency.'},

  // ── CPO Branch ──
  {id:'pm',name:'Product Manager',icon:'📋',dept:'Product',role:'Product Manager',
   system:'You are a product manager who ships. Expert in requirements gathering, prioritization frameworks (RICE, ICE), user stories, and cross-functional coordination.'},
  {id:'aipm',name:'AI PM',icon:'🧠',dept:'Product',role:'AI Product Manager',
   system:'You are an AI product manager who builds AI-native products. You understand LLM capabilities and limitations, evaluation, and how to design responsible AI features.'},
  {id:'ux',name:'UX Designer',icon:'🎨',dept:'Product',role:'UX Designer',
   system:'You are a UX designer who creates intuitive experiences. Expert in user research, wireframing, design systems, and reducing friction.'},
  {id:'uxr',name:'UX Researcher',icon:'🔬',dept:'Product',role:'UX Researcher',
   system:'You are a UX researcher who understands users deeply. Expert in qualitative and quantitative research, usability testing, and turning insights into product decisions.'},
  {id:'designsys',name:'Design Systems',icon:'🧩',dept:'Product',role:'Design Systems Engineer',
   system:'You are a design systems engineer who builds the component library. Expert in Figma, Storybook, design tokens, and keeping design and code in sync.'},
  {id:'motiondesign',name:'Motion Design',icon:'✨',dept:'Product',role:'Motion Designer',
   system:'You are a motion designer who brings interfaces to life. Expert in animation principles, Lottie, CSS animations, and microinteractions.'},
  {id:'a11y',name:'Accessibility',icon:'♿',dept:'Product',role:'Accessibility Engineer',
   system:'You are an accessibility engineer who makes products usable by everyone. Expert in WCAG, screen readers, keyboard navigation, and inclusive design.'},
  {id:'nocode',name:'No-Code',icon:'🔧',dept:'Product',role:'No-Code Developer',
   system:'You are a no-code developer who builds fast without traditional coding. Expert in Webflow, Bubble, Zapier, Airtable, and rapid prototyping.'},
  {id:'aiethics',name:'AI Ethics',icon:'⚖️',dept:'Product',role:'AI Ethics Officer',
   system:'You are an AI ethics officer who ensures responsible AI deployment. Expert in fairness, bias detection, model transparency, and AI governance frameworks.'},

  // ── CRO Branch ──
  {id:'sales',name:'Sales',icon:'🤝',dept:'Sales',role:'Account Executive',
   system:'You are an elite account executive who closes deals. Expert in consultative selling, objection handling, deal strategy, and building champion relationships.'},
  {id:'leadgen',name:'Lead Gen',icon:'🎣',dept:'Sales',role:'Lead Generation Specialist',
   system:'You are a lead gen specialist who fills the top of the funnel. Expert in outbound prospecting, intent data, lead scoring, and ICP definition.'},
  {id:'sdr',name:'SDR',icon:'📞',dept:'Sales',role:'Sales Development Rep',
   system:'You are an SDR who books qualified meetings. Expert in prospecting, cold outreach, personalized messaging, and multi-touch sequences.'},
  {id:'bd',name:'Biz Dev',icon:'🌐',dept:'Sales',role:'Business Development',
   system:'You are a business development professional who builds strategic partnerships. Expert in partner identification, deal structuring, and co-sell motions.'},
  {id:'revops',name:'RevOps',icon:'⚡',dept:'Sales',role:'Revenue Operations',
   system:'You are a RevOps professional who optimizes the revenue engine. Expert in CRM setup, pipeline hygiene, forecasting, and sales/marketing alignment.'},
  {id:'accountmgr',name:'Account Manager',icon:'💼',dept:'Sales',role:'Account Manager',
   system:'You are an account manager who protects and grows existing revenue. Expert in relationship management, expansion selling, and renewal strategy.'},
  {id:'enablement',name:'Enablement',icon:'🎓',dept:'Sales',role:'Sales Enablement',
   system:'You are a sales enablement specialist who makes reps more effective. Expert in playbooks, training, sales tools, and win/loss analysis.'},
  {id:'solutions',name:'Solutions Eng',icon:'🔧',dept:'Sales',role:'Solutions Engineer',
   system:'You are a solutions engineer who bridges sales and product. Expert in technical demos, POCs, RFP responses, and translating customer needs into product requirements.'},
  {id:'tam',name:'TAM',icon:'🗺️',dept:'Sales',role:'Technical Account Manager',
   system:'You are a TAM who ensures enterprise customers succeed technically. Expert in implementation, integration support, technical escalations, and customer health.'},
  {id:'tpm',name:'TPM',icon:'📐',dept:'Sales',role:'Technical Program Manager',
   system:'You are a TPM who delivers complex technical programs. Expert in cross-functional coordination, dependency management, and program governance.'},
  {id:'ir',name:'Investor Relations',icon:'📊',dept:'Sales',role:'Investor Relations Manager',
   system:'You are an IR manager who manages relationships with investors. Expert in investor communications, board reporting, cap table management, and fundraising support.'},

  // ── Customer Success ──
  {id:'cs',name:'Customer Success',icon:'💚',dept:'Customer',role:'Customer Success Manager',
   system:'You are a CSM who drives retention and expansion. Expert in onboarding, QBRs, health scoring, and turning customers into advocates.'},
  {id:'support',name:'Support',icon:'🎧',dept:'Customer',role:'Support Engineer',
   system:'You are a support engineer who resolves issues fast and builds self-service. Expert in troubleshooting, documentation, and reducing ticket volume.'},
  {id:'community',name:'Community',icon:'🏘️',dept:'Customer',role:'Community Manager',
   system:'You are a community manager who builds engaged user communities. Expert in Discord/Slack communities, ambassador programs, and user-generated content.'},
  {id:'onboarding',name:'Onboarding',icon:'🚀',dept:'Customer',role:'Onboarding Specialist',
   system:'You are an onboarding specialist who gets customers to value fast. Expert in onboarding flows, activation metrics, time-to-value, and success milestones.'},
  {id:'voc',name:'Voice of Customer',icon:'🗣️',dept:'Customer',role:'VoC Analyst',
   system:'You are a VoC analyst who captures and synthesizes customer feedback. Expert in NPS, CSAT, customer interviews, and closing the feedback loop with product.'},

  // ── Legal Sub-tree ──
  {id:'dpo',name:'DPO',icon:'🔒',dept:'Legal',role:'Data Protection Officer',
   system:'You are a DPO who ensures data privacy compliance. Expert in GDPR, CCPA, data subject rights, privacy impact assessments, and privacy-by-design.'},
  {id:'ipatty',name:'IP Attorney',icon:'®️',dept:'Legal',role:'IP Attorney',
   system:'You are an IP attorney who protects company intellectual property. Expert in patents, trademarks, copyrights, trade secrets, and IP strategy.'},

  // ── Chief of Staff Sub-tree ──
  {id:'boardrelations',name:'Board Relations',icon:'🏛️',dept:'Operations',role:'Board Relations Manager',
   system:'You are a board relations manager who manages investor and board relationships. Expert in board packages, meeting facilitation, and governance best practices.'},
  {id:'execscheduler',name:'Exec Scheduler',icon:'📆',dept:'Operations',role:'Executive Scheduler',
   system:'You are an executive scheduler who optimizes the CEO calendar. Expert in time blocking, meeting prioritization, travel coordination, and protecting deep work time.'},
  {id:'kpitracker',name:'KPI Tracker',icon:'📏',dept:'Operations',role:'KPI Analyst',
   system:'You are a KPI tracker who keeps the company accountable to its metrics. Expert in KPI frameworks, dashboarding, weekly reporting, and metric trees.'},

  // ── Risk Sub-tree ──
  {id:'complianceanalyst',name:'Compliance Analyst',icon:'📋',dept:'Risk',role:'Compliance Analyst',
   system:'You are a compliance analyst who monitors regulatory requirements. Expert in compliance monitoring, policy writing, audit preparation, and regulatory change management.'},
  {id:'insuranceadvisor',name:'Insurance Advisor',icon:'🛡️',dept:'Risk',role:'Insurance Advisor',
   system:'You are an insurance advisor who manages business risk through insurance. Expert in D&O, E&O, cyber insurance, and business continuity planning.'},

  // ── Strategy Sub-tree ──
  {id:'marketresearch',name:'Market Research',icon:'🔭',dept:'Strategy',role:'Market Research Analyst',
   system:'You are a market researcher who maps the competitive landscape. Expert in market sizing, TAM/SAM/SOM, competitive intelligence, and industry trends.'},
  {id:'competitive',name:'Competitive Intel',icon:'🕵️',dept:'Strategy',role:'Competitive Intelligence Analyst',
   system:'You are a competitive intelligence analyst who tracks the competition. Expert in competitor analysis, win/loss analysis, and strategic positioning.'},

  // ── Core Development ──
  {id:'api-designer',name:'API Designer',icon:'🔌',dept:'Engineering Specialists',role:'API Design Specialist',
   system:'You are an expert API designer. You design clean, versioned, well-documented REST and GraphQL APIs. You follow OpenAPI spec, enforce consistent naming conventions, design for backwards compatibility, and always think about developer experience. Produce concrete endpoint schemas, request/response examples, and error handling patterns.'},
  {id:'backend-developer',name:'Backend Developer',icon:'⚙️',dept:'Engineering Specialists',role:'Senior Backend Engineer',
   system:'You are a senior backend engineer. Expert in Node.js, Python, Go, databases (SQL and NoSQL), caching, message queues, and microservices patterns. Write production-quality code with error handling, logging, and tests. Always consider scalability, security, and maintainability.'},
  {id:'frontend-developer',name:'Frontend Developer',icon:'🖥️',dept:'Engineering Specialists',role:'Senior Frontend Engineer',
   system:'You are a senior frontend engineer. Expert in React, TypeScript, CSS, accessibility, performance optimisation, and modern build tooling. Write clean component code, think in design systems, and always consider mobile responsiveness and Core Web Vitals.'},
  {id:'fullstack-developer',name:'Fullstack Developer',icon:'🔄',dept:'Engineering Specialists',role:'Senior Fullstack Engineer',
   system:'You are a senior fullstack engineer comfortable across the entire stack — from database schema to UI polish. Expert in React, Node.js, PostgreSQL, REST/GraphQL APIs, auth, and deployment. You bridge frontend and backend concerns pragmatically and ship fast without cutting corners on quality.'},
  {id:'graphql-architect',name:'GraphQL Architect',icon:'🕸️',dept:'Engineering Specialists',role:'GraphQL Architecture Specialist',
   system:'You are a GraphQL specialist. You design schemas, resolvers, federation setups, and data loaders. Expert in Apollo Server/Client, subscriptions, persisted queries, schema stitching, and performance optimisation (N+1 problem, query depth limits). Always design schemas from the consumer\'s perspective.'},
  {id:'microservices-architect',name:'Microservices Architect',icon:'🧩',dept:'Engineering Specialists',role:'Microservices Architecture Lead',
   system:'You are a microservices architecture expert. You design service boundaries using domain-driven design, define communication patterns (sync REST/gRPC vs async events), handle distributed system challenges (sagas, eventual consistency, circuit breakers), and set up service meshes. Always weigh microservices complexity against the team\'s actual scale.'},
  {id:'mobile-developer',name:'Mobile Developer',icon:'📱',dept:'Engineering Specialists',role:'Senior Mobile Engineer',
   system:'You are a senior mobile engineer expert in React Native and Swift/Kotlin. You build performant, accessible mobile apps with offline support, push notifications, and smooth animations. You understand App Store/Play Store submission, deep linking, and mobile-specific UX patterns.'},
  {id:'websocket-engineer',name:'WebSocket Engineer',icon:'⚡',dept:'Engineering Specialists',role:'Real-time Systems Engineer',
   system:'You are a real-time systems engineer specialising in WebSockets, SSE, and event-driven architectures. Expert in Socket.io, native WebSocket APIs, connection management, heartbeats, reconnection logic, horizontal scaling with Redis pub/sub, and building collaborative/live features.'},

  // ── Infrastructure & DevOps ──
  {id:'cloud-architect',name:'Cloud Architect',icon:'☁️',dept:'Platform & Infra',role:'Cloud Architecture Specialist',
   system:'You are a cloud architect expert in AWS, GCP, and Azure. You design scalable, cost-efficient cloud infrastructures — VPCs, IAM, auto-scaling, managed databases, CDNs, and multi-region setups. You produce architecture diagrams in prose, cost estimates, and IaC recommendations. Always consider security, HA, and cost optimisation.'},
  {id:'docker-specialist',name:'Docker Specialist',icon:'🐳',dept:'Platform & Infra',role:'Containerisation Expert',
   system:'You are a Docker and containerisation expert. You write optimised multi-stage Dockerfiles, set up Docker Compose for local development, design container networking, implement health checks, and minimise image sizes. You understand container security best practices and registry management.'},
  {id:'kubernetes-engineer',name:'Kubernetes Engineer',icon:'☸️',dept:'Platform & Infra',role:'Kubernetes Infrastructure Engineer',
   system:'You are a Kubernetes engineer. You design cluster architectures, write Helm charts and Kubernetes manifests, configure HPA/VPA, set up ingress controllers, manage secrets, and implement GitOps workflows with ArgoCD or Flux. You understand multi-tenancy, RBAC, network policies, and production hardening.'},
  {id:'terraform-expert',name:'Terraform Expert',icon:'🏗️',dept:'Platform & Infra',role:'Infrastructure as Code Specialist',
   system:'You are a Terraform expert. You write modular, reusable Terraform for multi-environment cloud infrastructure. Expert in state management, remote backends, workspace strategies, Terragrunt, and CI/CD integration. You write clean, well-documented HCL and always plan before apply.'},

  // ── Security ──
  {id:'security-auditor',name:'Security Auditor',icon:'🔍',dept:'Security & Web3',role:'Security Audit Specialist',
   system:'You are a security auditor who finds vulnerabilities before attackers do. You review code, architecture, and configurations for OWASP Top 10, misconfigurations, secrets in code, over-privileged IAM roles, and missing controls. You produce structured audit reports with severity ratings, evidence, and remediation steps.'},
  {id:'penetration-tester',name:'Penetration Tester',icon:'🔐',dept:'Security & Web3',role:'Ethical Hacking Specialist',
   system:'You are an ethical penetration tester. You think like an attacker to identify exploitable vulnerabilities in web apps, APIs, mobile apps, and infrastructure. You model attack paths, suggest payloads for authorised testing, and write pentest reports with CVSS scores. You always operate within authorised scope and recommend remediations.'},
  {id:'auth-specialist',name:'Auth Specialist',icon:'🛡️',dept:'Security & Web3',role:'Authentication & Authorisation Expert',
   system:'You are an authentication and authorisation specialist. Expert in OAuth 2.0, OIDC, SAML, JWT, session management, MFA, SSO, and RBAC/ABAC patterns. You design secure auth flows, identify token vulnerabilities, and implement least-privilege access controls. You know the security trade-offs of every auth pattern.'},

  // ── Meta-orchestration ──
  {id:'task-decomposer',name:'Task Decomposer',icon:'🗂️',dept:'Coordination',role:'Task Decomposition Specialist',
   system:'You are a task decomposition specialist. Given any complex goal, you break it into concrete, parallelisable subtasks and assign each to the best-fit agent. You output structured plans with dependencies, priorities, estimated effort, and success criteria. Think like a staff engineer decomposing a large project into sprint-sized tickets.'},
  {id:'agent-selector',name:'Agent Selector',icon:'🎯',dept:'Coordination',role:'Agent Routing Intelligence',
   system:'You are an agent routing intelligence. Given a task description, you identify which agents from the Company OS roster should handle it, in what order, and with what inputs. You reason about agent capabilities, task requirements, and optimal sequencing. Output a structured routing plan with justification for each agent chosen.'},
  {id:'workflow-coordinator',name:'Workflow Coordinator',icon:'🔀',dept:'Coordination',role:'Multi-agent Workflow Orchestrator',
   system:'You are a multi-agent workflow orchestrator. You coordinate complex workflows involving multiple agents, manage handoffs between them, resolve conflicts in their outputs, and synthesise final deliverables. You ensure nothing falls through the cracks and maintain a coherent thread across all agent outputs.'},
];

// ── Pipeline phases ───────────────────────────────────────────────────────────
const PIPELINE = [
  {id:'p1', label:'1. Discovery',     agents:['ceo','strategy','marketresearch'],  desc:'Strategic framing, market sizing & opportunity'},
  {id:'p2', label:'2. Product',       agents:['cpo','pm','ux','aipm'],             desc:'Product definition, UX & roadmap'},
  {id:'p3', label:'3. Technology',    agents:['cto','arch','security'],            desc:'Technical architecture & security model'},
  {id:'p4', label:'4. Go-to-Market',  agents:['cmo','marketer','sales','growth'],  desc:'GTM strategy, positioning & sales motion'},
  {id:'p5', label:'5. Finance',       agents:['cfo','fpa','pricing'],              desc:'Financial model, unit economics & pricing'},
  {id:'p6', label:'6. Operations',    agents:['coo','hr','risk','competitive'],    desc:'Ops, hiring plan & risk mitigation'},
];

// ── Persistence ───────────────────────────────────────────────────────────────
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
}
function loadData() {
  try {
    ensureDir();
    const d = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE,'utf8')) : {profile:{},outputs:{},memories:[],history:[]};
    // Auto-inject AILearningPath business context if profile not set
    if (!d.profile) d.profile = {};
    if (!d.profile.name) d.profile.name = 'Stellar / AILearningPath';
    if (!d.profile.idea) d.profile.idea = 'AI-powered CBSE Class 10 exam preparation platform. Students practice questions, get AI explanations for mistakes, follow a smart planner, compete live, and receive personalised lessons — driven by a behavioural analysis engine.';
    if (!d.profile.industry) d.profile.industry = 'EdTech / AI Education';
    if (!d.profile.stage) d.profile.stage = 'Early growth — product built, scaling users';
    const defaultCodebase = path.join(path.dirname(process.cwd()), 'AILearningPath');
    if (!d.profile.codebase) d.profile.codebase = fs.existsSync(defaultCodebase) ? defaultCodebase : process.cwd();
    return d;
  }
  catch(_) { return {profile:{name:'Stellar / AILearningPath', idea:'AI-powered CBSE Class 10 exam prep platform', industry:'EdTech', stage:'Early growth'},outputs:{},memories:[],history:[]}; }
}
function saveData(d) {
  try { ensureDir(); fs.writeFileSync(DATA_FILE, JSON.stringify(d,null,2)); } catch(e) { console.error(clr(c.red,'✗ Save: '+e.message)); }
}
function loadConfig() {
  try { return fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8')) : {}; } catch(_) { return {}; }
}
function saveConfig(cfg) {
  try { ensureDir(); fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg,null,2)); } catch(e) { console.error(clr(c.red,'✗ Config: '+e.message)); }
}
function loadSchedules() {
  try { return fs.existsSync(SCHEDULES_FILE) ? JSON.parse(fs.readFileSync(SCHEDULES_FILE,'utf8')) : []; } catch(_) { return []; }
}
function saveSchedules(s) {
  try { ensureDir(); fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(s,null,2)); } catch(e) { console.error(clr(c.red,'✗ Schedules: '+e.message)); }
}

// ── Claude CLI runner (no API key — uses your Claude subscription) ────────────
function callClaudeCLI(systemPrompt, userPrompt, onToken) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', userPrompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--no-session-persistence',
      '--add-dir', process.cwd(),
    ];
    if (systemPrompt) args.push('--system-prompt', systemPrompt);

    // Strip ANTHROPIC_API_KEY so claude.ai session token is used exclusively
    const spawnEnv = {...process.env};
    delete spawnEnv.ANTHROPIC_API_KEY;
    const proc = spawn(CLAUDE_CLI, args, {env: spawnEnv});
    let fullText = '';
    let lastText = '';
    let buf = '';

    proc.stdout.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          // stream partial text deltas
          if (evt.type === 'assistant' && evt.message?.content?.[0]?.text) {
            const currentText = evt.message.content[0].text;
            const delta = currentText.slice(lastText.length);
            if (delta && onToken) onToken(delta);
            lastText = currentText;
            fullText = currentText;
          }
          // final result
          if (evt.type === 'result' && evt.result) {
            fullText = evt.result;
          }
        } catch(_) {}
      }
    });

    proc.stderr.on('data', () => {}); // suppress stderr noise
    proc.on('error', e => reject(new Error('Claude CLI not found: ' + e.message)));
    proc.on('close', code => {
      if (code !== 0 && !fullText) reject(new Error(`Claude CLI exited with code ${code}`));
      else resolve(fullText);
    });
    setTimeout(() => { proc.kill(); reject(new Error('Claude CLI timeout (1200s)')); }, 1200000);
  });
}

// ── Tool integrations ─────────────────────────────────────────────────────────
function fetchGitHub(token, repo) {
  return new Promise((resolve) => {
    if (!token || !repo) { resolve(''); return; }
    const parts = [];
    let done = 0;
    const finish = () => { if (++done === 2) resolve(parts.filter(Boolean).join('\n')); };

    const ghReq = (path, label) => {
      const r = https.request({
        hostname:'api.github.com', path, method:'GET',
        headers:{'Authorization':'token '+token,'User-Agent':'company-os-cli','Accept':'application/vnd.github.v3+json'},
      }, res => {
        let d=''; res.on('data',c=>d+=c);
        res.on('end', () => {
          try {
            const items = JSON.parse(d);
            if (Array.isArray(items) && items.length) {
              parts.push(`\n## GitHub ${label} (${repo}):\n` + items.slice(0,5).map(i=>`- #${i.number||''} ${i.title||i.name||''}${i.state?' ['+i.state+']':''}`).join('\n'));
            }
          } catch(_) {}
          finish();
        });
      });
      r.on('error', ()=>finish());
      r.setTimeout(8000, ()=>{ r.destroy(); finish(); });
      r.end();
    };

    ghReq(`/repos/${repo}/issues?state=open&per_page=5`, 'Open Issues');
    ghReq(`/repos/${repo}/pulls?state=open&per_page=5`,  'Open PRs');
  });
}

function fetchNotion(token, databaseId) {
  return new Promise((resolve) => {
    if (!token || !databaseId) { resolve(''); return; }
    const body = JSON.stringify({page_size:5});
    const req = https.request({
      hostname:'api.notion.com',
      path:`/v1/databases/${databaseId}/query`,
      method:'POST',
      headers:{
        'Authorization':'Bearer '+token, 'Notion-Version':'2022-06-28',
        'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body),
      },
    }, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end', () => {
        try {
          const data = JSON.parse(d);
          const pages = (data.results||[]).map(p => {
            const title = Object.values(p.properties||{}).find(v=>v.type==='title');
            return title?.title?.[0]?.plain_text || 'Untitled';
          });
          if (pages.length) resolve(`\n## Notion Pages:\n` + pages.map(t=>`- ${t}`).join('\n'));
          else resolve('');
        } catch(_) { resolve(''); }
      });
    });
    req.on('error', ()=>resolve(''));
    req.setTimeout(8000,()=>{ req.destroy(); resolve(''); });
    req.write(body); req.end();
  });
}

// ── Slack notifications ───────────────────────────────────────────────────────
function sendSlack(webhookUrl, text) {
  if (!webhookUrl) return;
  try {
    const url  = new URL(webhookUrl);
    const body = JSON.stringify({text});
    const isHttps = url.protocol === 'https:';
    const mod  = isHttps ? https : http;
    const req  = mod.request({
      hostname:url.hostname, path:url.pathname+url.search, method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},
    }, ()=>{});
    req.on('error',()=>{});
    req.setTimeout(5000,()=>req.destroy());
    req.write(body); req.end();
  } catch(_) {}
}

// ── Backend router ────────────────────────────────────────────────────────────
async function runAgent(agent, messages, opts) {
  const {onToken} = opts;
  const sysMsg = messages.find(m => m.role === 'system');
  const userMsg = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n');
  const text = await callClaudeCLI(sysMsg?.content, userMsg, onToken);
  return {text, backend:'claude-cli'};
}

// ── Context builders ──────────────────────────────────────────────────────────
function backendLabel() {
  return clr(c.cyan,'[Claude CLI]');
}

function buildMessages(agent, prompt) {
  let sys = agent.system;
  try {
    const data = loadData();
    const codebasePath = data.profile?.codebase;
    if (codebasePath && sys.includes('/Users/Najeeb-CapOne/Desktop/AILearningPath')) {
      sys = sys.replace(/\/Users\/Najeeb\-CapOne\/Desktop\/AILearningPath/g, codebasePath);
    }
  } catch(_) {}
  return [{role:'system',content:sys},{role:'user',content:prompt}];
}

async function buildToolContext(cfg, opts) {
  const parts = [];
  const ghToken  = opts.githubToken  || cfg.githubToken;
  const ghRepo   = opts.githubRepo   || cfg.githubRepo;
  const nToken   = opts.notionToken  || cfg.notionToken;
  const nDb      = opts.notionDb     || cfg.notionDb;
  const [ghCtx, nCtx] = await Promise.all([
    fetchGitHub(ghToken, ghRepo),
    fetchNotion(nToken, nDb),
  ]);
  if (ghCtx) parts.push(ghCtx);
  if (nCtx)  parts.push(nCtx);
  return parts.join('\n');
}

// Load AILearningPath blueprint once (cached)
let _blueprintCache = null;
function loadBlueprint(codebasePath) {
  if (_blueprintCache !== null) return _blueprintCache;
  const paths = [
    codebasePath ? path.join(codebasePath, 'BLUEPRINT.md') : null,
    path.join(process.cwd(), 'BLUEPRINT.md'),
    '/Users/Najeeb-CapOne/Desktop/AILearningPath/BLUEPRINT.md'
  ].filter(Boolean);

  for (const bpPath of paths) {
    try {
      if (fs.existsSync(bpPath)) {
        const raw = fs.readFileSync(bpPath, 'utf8');
        _blueprintCache = raw.slice(0, 4000);
        break;
      }
    } catch(_) {}
  }
  if (_blueprintCache === null) _blueprintCache = '';
  return _blueprintCache;
}

function buildPrompt(task, data, toolCtx, upstreamOutputs) {
  const p = data.profile || {};
  const profileCtx = p.idea ? [
    p.name     ? `Company: ${p.name}` : '',
    `Idea: ${p.idea}`,
    p.industry ? `Industry: ${p.industry}` : '',
    p.stage    ? `Stage: ${p.stage}` : '',
    p.teamsize ? `Team: ${p.teamsize}` : '',
  ].filter(Boolean).join('\n') + '\n\n' : '';

  const upCtx = upstreamOutputs && Object.keys(upstreamOutputs).length
    ? 'PREVIOUS AGENT OUTPUTS:\n' + Object.entries(upstreamOutputs).slice(-3).map(([id,o])=>`[${id.toUpperCase()}]: ${o.slice(0,400)}`).join('\n') + '\n\n'
    : '';

  const bp = loadBlueprint(p.codebase);
  const bpCtx = bp ? `CODEBASE BLUEPRINT:\n${bp}\n\n` : '';
  return [profileCtx, bpCtx, upCtx, toolCtx ? toolCtx+'\n\n' : '', task || 'Provide your strategic analysis and recommendations.'].join('');
}

// ── Spinner ───────────────────────────────────────────────────────────────────
let _spin = null;
function spinStart(msg) {
  const f = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']; let i=0;
  _spin = setInterval(()=>process.stdout.write(`\r${clr(c.cyan,f[i++%f.length])} ${msg}   `), 80);
}
function spinStop() { if(_spin){clearInterval(_spin);_spin=null;} process.stdout.write('\r\x1b[K'); }

// ── Banner & Usage ────────────────────────────────────────────────────────────
function banner() {
  console.log(clr(c.magenta, c.bold+`
╔══════════════════════════════════════════════╗
║        🏢  Company OS  —  CLI  v2            ║
║  ${AGENTS.length} agents · Streaming · Parallel · Cron  ║
╚══════════════════════════════════════════════╝`));
}

function usage() {
  console.log(`
${clr(c.bold,'COMMANDS')}
  ${clr(c.cyan,'list')}                     List all ${AGENTS.length} agents
  ${clr(c.cyan,'run')} <agent>              Run a single agent (streaming output)
  ${clr(c.cyan,'pipeline')}                 Run full 6-phase pipeline (parallel within phases)
  ${clr(c.cyan,'chat')} <agent>             Interactive streaming chat session
  ${clr(c.cyan,'profile')}                  View / set company profile
  ${clr(c.cyan,'tools')}                    Configure integrations (GitHub, Notion, Slack)
  ${clr(c.cyan,'schedule')}                 Manage scheduled / recurring agent runs
  ${clr(c.cyan,'ceo')} "<goal>"              Autonomous: CEO reads goal → decomposes → delegates → synthesises (no args needed)
  ${clr(c.cyan,'chain')} [lead-agent]        Recursive: CEO → delegates → sub-delegates → … (--depth N, --exec)
  ${clr(c.cyan,'server')}                   Start live bridge server (port ${SERVER_PORT}) — HTML auto-connects
  ${clr(c.cyan,'sync')} [import|export]      Sync data between CLI and browser
  ${clr(c.cyan,'status')}                   Show saved data & system status
  ${clr(c.cyan,'clear')}                    Wipe all saved data

${clr(c.bold,'OPTIONS')}
  --task <text>             Task or prompt (quote multi-word)
  --api-key <key>           Anthropic key (or ANTHROPIC_API_KEY env var)
  --output <file>           Save output to file
  --set "k=v,k=v"           Set profile/config fields
  --github-token <tok>      GitHub personal access token
  --github-repo <owner/repo> GitHub repo to pull context from
  --notion-token <tok>      Notion integration token
  --notion-db <id>          Notion database ID
  --slack-webhook <url>     Slack incoming webhook URL

${clr(c.bold,'BACKEND LOGIC')}
  ${clr(c.yellow,'★ Critical')} (ceo,cto,cfo,cmo,cpo,cro,coo,legal,strategy,risk,arch,security,ciso,chiefofstaff)
    → Always Claude API
  All agents powered by Claude API

${clr(c.bold,'EXAMPLES')}
  node company-os-cli.js chain --task "Improve our EdTech platform" --depth 3
  node company-os-cli.js chain --task "Fix and improve our platform" --exec --exec-dir ~/Desktop/AILearningPath
  node company-os-cli.js chain cto --task "Design new architecture" --depth 2 --exec --exec-dir ~/Desktop/AILearningPath
  node company-os-cli.js run ceo --task "Q3 priorities for our AI SaaS"
  node company-os-cli.js pipeline --task "AI legal doc review" --output report.md
  node company-os-cli.js chat pm
  node company-os-cli.js profile --set "name=Acme,idea=AI SaaS,stage=MVP,industry=FinTech"
  node company-os-cli.js tools --set "githubToken=ghp_xxx,githubRepo=owner/repo,slackWebhook=https://..."
  node company-os-cli.js schedule add --task "Daily CEO brief" --agent ceo --cron "08:00"
  node company-os-cli.js schedule list
  node company-os-cli.js schedule run          # start the scheduler daemon
`);
}

// ── COMMAND: list ─────────────────────────────────────────────────────────────
function cmdList(opts) {
  const filter = opts.task ? opts.task.toLowerCase() : null;
  const depts  = [...new Set(AGENTS.map(a=>a.dept))];
  console.log(`\n${clr(c.bold,`All Agents (${AGENTS.length})`)}  ${clr(c.dim,'All powered by Claude API')}\n`);
  for (const dept of depts) {
    let agents = AGENTS.filter(a=>a.dept===dept);
    if (filter) agents = agents.filter(a=>a.name.toLowerCase().includes(filter)||a.id.toLowerCase().includes(filter)||a.role.toLowerCase().includes(filter));
    if (!agents.length) continue;
    console.log(clr(c.cyan+c.bold,'  '+dept));
    for (const a of agents) {
      const mark = CRITICAL_IDS.has(a.id) ? clr(c.yellow,'★') : clr(c.green,'◆');
      console.log(`    ${mark} ${a.icon} ${clr(c.bold,a.id.padEnd(16))} ${a.name.padEnd(20)} ${clr(c.dim,a.role)}`);
    }
    console.log();
  }
}

// ── COMMAND: run ──────────────────────────────────────────────────────────────
async function cmdRun(agentId, task, opts) {
  const agent = AGENTS.find(a=>a.id===agentId);
  if (!agent) { console.error(clr(c.red,`✗ Unknown agent: "${agentId}" — run 'list' to see all IDs`)); process.exit(1); }

  const data    = loadData();
  const cfg     = loadConfig();
  const toolCtx = await buildToolContext(cfg, opts);
  const prompt  = buildPrompt(task, data, toolCtx, data.outputs);
  const msgs    = buildMessages(agent, prompt);
  const slackWh = opts.slackWebhook || cfg.slackWebhook;

  console.log(`\n${agent.icon} ${clr(c.bold,agent.name)} ${clr(c.dim,'— '+agent.role)}`);
  console.log(clr(c.dim,'─'.repeat(55)));

  let fullText = '';
  const streaming = process.stdout.isTTY !== false;

  try {
    if (streaming) {
      // Stream tokens directly to stdout
      const {text, backend} = await runAgent(agent, msgs, {
        ...opts, onToken: tok => { process.stdout.write(tok); fullText = text; }
      });
      fullText = text;
      process.stdout.write('\n');
      console.log(clr(c.dim,`\n${backendLabel(backend)}`));
    } else {
      spinStart(`${agent.name} thinking…`);
      const {text, backend} = await runAgent(agent, msgs, opts);
      spinStop();
      fullText = text;
      console.log(`${backendLabel(backend)}\n`);
      console.log(fullText);
    }

    // Persist
    data.outputs[agentId] = fullText;
    data.history = data.history || [];
    data.history.push({agent:agentId, task:(task||'').slice(0,120), ts:new Date().toISOString()});
    if (data.history.length > 500) data.history = data.history.slice(-500);
    saveData(data);
    appendBroadcast({type:'agent_complete', agent:agentId, name:agent.name, icon:agent.icon, text:fullText, ts:new Date().toISOString()});

    if (opts.outputFile) { fs.writeFileSync(opts.outputFile, fullText); console.log(clr(c.green,`\n✓ Saved to ${opts.outputFile}`)); }
    if (slackWh) { sendSlack(slackWh, `*${agent.icon} ${agent.name}* completed:\n${fullText.slice(0,500)}`); console.log(clr(c.green,'✓ Sent to Slack')); }
    return fullText;
  } catch(e) {
    spinStop();
    console.error(clr(c.red,`\n✗ ${agent.name}: ${e.message}`));
    process.exit(1);
  }
}

// ── COMMAND: pipeline (parallel within phases) ────────────────────────────────
async function cmdPipeline(task, opts) {
  if (!task) { console.error(clr(c.red,'✗ --task required.  Example: --task "AI SaaS for legal teams"')); process.exit(1); }

  const data    = loadData();
  const cfg     = loadConfig();
  const slackWh = opts.slackWebhook || cfg.slackWebhook;

  if (!data.profile.idea) { data.profile.idea = task; saveData(data); }

  console.log(`\n${clr(c.bold+c.magenta,'🔗 Company OS Pipeline — 6 Phases (parallel)')}`);
  console.log(clr(c.dim,'Task: ')+task+'\n');
  appendBroadcast({type:'pipeline_start', task, ts:new Date().toISOString()});

  spinStart('Fetching tool context…');
  const toolCtx = await buildToolContext(cfg, opts);
  spinStop();
  if (toolCtx) console.log(clr(c.green,'✓ Tool context loaded (GitHub/Notion)'));

  const allOutputs = {};

  for (const phase of PIPELINE) {
    console.log(`\n${clr(c.bold+c.magenta,`━━━ ${phase.label} `)}`);
    console.log(clr(c.dim, phase.desc));

    // All agents run in parallel via Claude API
    const runPhaseAgent = async (agentId) => {
      const agent = AGENTS.find(a=>a.id===agentId);
      if (!agent) return;

      const upstream = Object.entries(allOutputs).slice(-3)
        .map(([id,r])=>`[${id.toUpperCase()}]: ${r.slice(0,350)}`).join('\n');
      const prompt = [
        data.profile.name ? `Company: ${data.profile.name}\n` : '',
        `Company idea: ${task}\n`,
        upstream ? `\nUpstream outputs:\n${upstream}\n` : '',
        toolCtx ? toolCtx+'\n' : '',
        `\nAs ${agent.role}, provide specific, actionable analysis. Be concrete and quantitative where possible.`,
      ].join('');

      const msgs = buildMessages(agent, prompt);
      const prefix = `  ${agent.icon} ${clr(c.bold,agent.name.padEnd(18))} `;

      let buf = '';
      try {
        process.stdout.write(prefix);
        const {text, backend} = await runAgent(agent, msgs, {
          ...opts, silent:true,
          onToken: tok => {
            buf += tok;
            if (!buf.includes('\n')) process.stdout.write(tok);
          }
        });
        process.stdout.write(clr(c.dim,' … ') + backendLabel(backend) + '\n');
        const preview = text.split('\n').filter(l=>l.trim()).slice(0,3).join('\n');
        console.log(preview.split('\n').map(l=>'      '+clr(c.dim,l)).join('\n'));
        allOutputs[agentId] = text;
        data.outputs[agentId] = text;
        data.history.push({agent:agentId, phase:phase.label, task:task.slice(0,100), ts:new Date().toISOString()});
        appendBroadcast({type:'agent_complete', agent:agentId, name:agent.name, icon:agent.icon, phase:phase.label, text, ts:new Date().toISOString()});
      } catch(e) {
        process.stdout.write(clr(c.red,' ✗ '+e.message.split('\n')[0])+'\n');
      }
    };

    await Promise.all(phase.agents.map(id => runPhaseAgent(id)));

    saveData(data);
  }

  const count = Object.keys(allOutputs).length;
  console.log(`\n${clr(c.green+c.bold,`✓ Pipeline complete — ${count} agents ran in parallel`)}`);
  appendBroadcast({type:'pipeline_complete', task, agentCount:count, ts:new Date().toISOString()});

  if (opts.outputFile) {
    const report = [
      `# Company OS Pipeline Report`,
      `**Task:** ${task}`,
      `**Date:** ${new Date().toLocaleString()}`,
      `**Agents:** ${count}\n`,
      ...PIPELINE.map(ph => {
        const outs = ph.agents.filter(id=>allOutputs[id]).map(id => {
          const a = AGENTS.find(a=>a.id===id);
          return `### ${a?.icon||''} ${a?.name||id}\n${allOutputs[id]}`;
        }).join('\n\n');
        return outs ? `## ${ph.label}\n${outs}` : null;
      }).filter(Boolean),
    ].join('\n\n');
    fs.writeFileSync(opts.outputFile, report);
    console.log(clr(c.green,`✓ Report saved to ${opts.outputFile}`));
  }

  if (slackWh) {
    const summary = PIPELINE.map(ph =>
      ph.agents.filter(id=>allOutputs[id]).map(id => {
        const a = AGENTS.find(a=>a.id===id);
        return `*${a?.icon} ${a?.name}:* ${allOutputs[id].slice(0,120).replace(/\n/g,' ')}…`;
      }).join('\n')
    ).filter(Boolean).join('\n\n');
    sendSlack(slackWh, `*🔗 Pipeline complete* — ${count} agents\n*Task:* ${task}\n\n${summary.slice(0,2000)}`);
    console.log(clr(c.green,'✓ Pipeline summary sent to Slack'));
  }
}

// ── COMMAND: chat (streaming) ─────────────────────────────────────────────────
async function cmdChat(agentId, opts) {
  const agent = AGENTS.find(a=>a.id===agentId);
  if (!agent) { console.error(clr(c.red,`✗ Unknown agent: "${agentId}"`)); process.exit(1); }

  const data    = loadData();
  const cfg     = loadConfig();
  const history = [{role:'system', content:agent.system}];

  // Prime with company context if available
  const p = data.profile;
  if (p.idea) {
    history.push({role:'user', content:`Company context: ${p.name?p.name+' — ':''}${p.idea}`});
    history.push({role:'assistant', content:`Understood. Briefed on the company context. Ready as your ${agent.role}.`});
  }

  console.log(`\n${agent.icon} ${clr(c.bold,'Chat with '+agent.name)} ${backendLabel()}`);
  console.log(clr(c.dim,`Role: ${agent.role}`));
  console.log(clr(c.dim,'Commands: exit | clear | /save <file>') + '\n');

  const rl = readline.createInterface({input:process.stdin, output:process.stdout});

  const ask = () => {
    rl.question(clr(c.cyan,'You: '), async input => {
      input = input.trim();
      if (!input) { ask(); return; }
      if (['exit','quit'].includes(input.toLowerCase())) { console.log(clr(c.dim,'Goodbye.')); rl.close(); return; }
      if (input.toLowerCase()==='clear') {
        history.splice(1);
        console.log(clr(c.dim,'History cleared.\n'));
        ask(); return;
      }
      if (input.startsWith('/save ')) {
        const fname = input.slice(6).trim();
        const txt = history.filter(m=>m.role!=='system').map(m=>`${m.role==='user'?'You':agent.name}: ${m.content}`).join('\n\n');
        fs.writeFileSync(fname, txt);
        console.log(clr(c.green,`✓ Saved to ${fname}\n`));
        ask(); return;
      }

      history.push({role:'user', content:input});
      process.stdout.write(`\n${agent.icon} ${clr(c.bold,agent.name)}: `);

      try {
        const {text} = await runAgent(agent, history, {...opts, onToken: tok=>process.stdout.write(tok)});
        history.push({role:'assistant', content:text});
        process.stdout.write('\n\n');

        data.history = data.history||[];
        data.history.push({agent:agentId, role:'user',      content:input.slice(0,300), ts:new Date().toISOString()});
        data.history.push({agent:agentId, role:'assistant', content:text.slice(0,300),  ts:new Date().toISOString()});
        if (data.history.length>500) data.history=data.history.slice(-500);
        saveData(data);
      } catch(e) { console.error('\n'+clr(c.red,'✗ '+e.message)+'\n'); }
      ask();
    });
  };
  ask();
}

// ── COMMAND: profile ──────────────────────────────────────────────────────────
function cmdProfile(opts) {
  const data = loadData();
  if (opts.set) {
    opts.set.split(',').forEach(pair => {
      const idx=pair.indexOf('='); if(idx>0) data.profile[pair.slice(0,idx).trim()]=pair.slice(idx+1).trim();
    });
    saveData(data);
    console.log(clr(c.green,'✓ Profile updated'));
  }
  console.log(`\n${clr(c.bold,'Company Profile')}`);
  const p = data.profile;
  if (!Object.keys(p).length) {
    console.log(clr(c.dim,'  No profile. Use: node company-os-cli.js profile --set "name=Acme,idea=...,stage=MVP"'));
  } else {
    ['name','idea','industry','stage','teamsize'].forEach(k=>{ if(p[k]) console.log(`  ${clr(c.cyan,k.padEnd(12))} ${p[k]}`); });
    Object.entries(p).forEach(([k,v])=>{ if(!['name','idea','industry','stage','teamsize'].includes(k)) console.log(`  ${clr(c.cyan,k.padEnd(12))} ${v}`); });
  }
}

// ── COMMAND: tools ────────────────────────────────────────────────────────────
function cmdTools(opts) {
  const cfg = loadConfig();
  if (opts.set) {
    opts.set.split(',').forEach(pair => {
      const idx=pair.indexOf('='); if(idx>0) cfg[pair.slice(0,idx).trim()]=pair.slice(idx+1).trim();
    });
    saveConfig(cfg);
    console.log(clr(c.green,'✓ Config saved to '+CONFIG_FILE));
  }
  console.log(`\n${clr(c.bold,'Integrations Config')} ${clr(c.dim,'('+CONFIG_FILE+')')}`);
  const keys = ['githubToken','githubRepo','notionToken','notionDb','slackWebhook'];
  const labels = {githubToken:'GitHub Token',githubRepo:'GitHub Repo',notionToken:'Notion Token',notionDb:'Notion DB ID',slackWebhook:'Slack Webhook'};
  for (const k of keys) {
    const v = cfg[k];
    const display = v ? (k.toLowerCase().includes('token')||k.toLowerCase().includes('webhook') ? v.slice(0,12)+'…' : v) : clr(c.dim,'not set');
    console.log(`  ${clr(c.cyan,(labels[k]||k).padEnd(16))} ${display}`);
  }
  console.log(`\n${clr(c.dim,'Set with: node company-os-cli.js tools --set "githubToken=ghp_xxx,githubRepo=owner/repo,slackWebhook=https://hooks.slack.com/..."')}`);
  console.log(clr(c.dim,'Test GitHub:  node company-os-cli.js run ceo --task "Review our GitHub issues and prioritize"'));
  console.log(clr(c.dim,'Test Slack:   node company-os-cli.js run ceo --task "Quick status" --slack-webhook <url>'));
}

// ── COMMAND: schedule ─────────────────────────────────────────────────────────
function parseTime(cronStr) {
  // Supports: "08:00" (daily at 8am), "every 30m", "every 2h"
  if (cronStr.startsWith('every ')) {
    const m = cronStr.match(/every\s+(\d+)(m|h)/i);
    if (m) return {type:'interval', ms: parseInt(m[1]) * (m[2].toLowerCase()==='h' ? 3600000 : 60000)};
  }
  const m = cronStr.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return {type:'daily', hour:parseInt(m[1]), minute:parseInt(m[2])};
  return null;
}

function msUntilNext(hour, minute) {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate()+1);
  return next-now;
}

function cmdSchedule(subCmd, opts) {
  const schedules = loadSchedules();

  if (subCmd === 'list' || !subCmd) {
    console.log(`\n${clr(c.bold,'Scheduled Jobs')} (${schedules.length})\n`);
    if (!schedules.length) {
      console.log(clr(c.dim,'  No schedules. Add one:'));
      console.log(clr(c.dim,'  node company-os-cli.js schedule add --agent ceo --task "Daily brief" --cron "08:00"'));
    }
    schedules.forEach((s,i) => {
      const agentInfo = AGENTS.find(a=>a.id===s.agent);
      console.log(`  ${clr(c.bold,`#${i+1}`)} ${agentInfo?.icon||'🤖'} ${clr(c.cyan,s.agent)} — ${s.task}`);
      console.log(`       ⏰ ${s.cron}  ${s.lastRun ? clr(c.dim,'last: '+new Date(s.lastRun).toLocaleString()) : clr(c.dim,'never run')}`);
    });
    return;
  }

  if (subCmd === 'add') {
    if (!opts.target && !opts.agent) { console.error(clr(c.red,'✗ --agent required')); return; }
    if (!opts.task)    { console.error(clr(c.red,'✗ --task required'));  return; }
    if (!opts.cron)    { console.error(clr(c.red,'✗ --cron required (e.g. "08:00" or "every 30m")')); return; }
    const agentId = opts.target || opts.agent;
    if (!AGENTS.find(a=>a.id===agentId)) { console.error(clr(c.red,`✗ Unknown agent: ${agentId}`)); return; }
    const parsed = parseTime(opts.cron);
    if (!parsed) { console.error(clr(c.red,'✗ Invalid cron format. Use "08:00" or "every 30m" or "every 2h"')); return; }
    schedules.push({id:Date.now().toString(), agent:agentId, task:opts.task, cron:opts.cron, lastRun:null});
    saveSchedules(schedules);
    console.log(clr(c.green,`✓ Schedule added: ${agentId} — "${opts.task}" at ${opts.cron}`));
    console.log(clr(c.dim,'Run daemon with: node company-os-cli.js schedule run'));
    return;
  }

  if (subCmd === 'remove') {
    const idx = parseInt(opts.task||opts.target) - 1;
    if (isNaN(idx) || idx<0 || idx>=schedules.length) { console.error(clr(c.red,'✗ Invalid schedule number')); return; }
    const removed = schedules.splice(idx, 1)[0];
    saveSchedules(schedules);
    console.log(clr(c.green,`✓ Removed: ${removed.agent} — ${removed.task}`));
    return;
  }

  if (subCmd === 'run') {
    const schedList = loadSchedules();
    if (!schedList.length) { console.log(clr(c.yellow,'No schedules configured. Add one first.')); return; }
    console.log(clr(c.green+c.bold,`\n🕐 Scheduler daemon started — ${schedList.length} jobs\n`));
    schedList.forEach(s => console.log(`  ⏰ ${s.agent}: ${s.task} @ ${s.cron}`));
    console.log(clr(c.dim,'\nCtrl+C to stop\n'));

    const setupJob = (s) => {
      const parsed = parseTime(s.cron);
      if (!parsed) return;

      const execute = async () => {
        console.log(`\n${clr(c.cyan,'⏰')} Running scheduled: ${s.agent} — ${s.task}`);
        const schedCurr = loadSchedules();
        const idx = schedCurr.findIndex(x=>x.id===s.id);
        try {
          await cmdRun(s.agent, s.task, {
            ...opts, silent:true,
            onToken: tok => process.stdout.write(tok)
          });
          if (idx>=0) { schedCurr[idx].lastRun = new Date().toISOString(); saveSchedules(schedCurr); }
        } catch(e) { console.error(clr(c.red,'Scheduled job failed: '+e.message)); }
      };

      if (parsed.type === 'interval') {
        execute(); // run immediately
        setInterval(execute, parsed.ms);
      } else {
        const runAndReschedule = () => { execute(); setTimeout(runAndReschedule, 24*60*60*1000); };
        setTimeout(runAndReschedule, msUntilNext(parsed.hour, parsed.minute));
        console.log(clr(c.dim,`  ${s.agent} next run in ${Math.round(msUntilNext(parsed.hour,parsed.minute)/60000)} minutes`));
      }
    };

    schedList.forEach(setupJob);
    // Keep process alive
    process.stdin.resume();
    return;
  }

  console.error(clr(c.red,`✗ Unknown schedule subcommand: ${subCmd}`));
  console.log(clr(c.dim,'Usage: schedule [list|add|remove|run]'));
}

// ── COMMAND: status ───────────────────────────────────────────────────────────
function cmdStatus() {
  const data = loadData();
  const cfg  = loadConfig();
  const scheds = loadSchedules();

  console.log(`\n${clr(c.bold,'System Status')}\n`);
  console.log(`  ${clr(c.cyan,'Data:')}        ${DATA_FILE}`);
  console.log(`  ${clr(c.cyan,'Agents run:')} ${Object.keys(data.outputs||{}).length}/${AGENTS.length}`);
  console.log(`  ${clr(c.cyan,'History:')}    ${(data.history||[]).length} entries`);
  console.log(`  ${clr(c.cyan,'Schedules:')} ${scheds.length} jobs`);

  const p = data.profile||{};
  if (Object.keys(p).length) {
    console.log(`\n${clr(c.bold,'Profile:')}`);
    Object.entries(p).forEach(([k,v])=>console.log(`  ${clr(c.cyan,k.padEnd(12))} ${v.slice?v.slice(0,80):v}`));
  }

  const intgs = ['githubRepo','notionDb','slackWebhook'].filter(k=>cfg[k]);
  if (intgs.length) {
    console.log(`\n${clr(c.bold,'Active integrations:')} ${intgs.map(k=>k.replace(/([A-Z])/g,' $1').trim()).join(', ')}`);
  }

  if (Object.keys(data.outputs||{}).length) {
    console.log(`\n${clr(c.bold,'Recent outputs:')}`);
    Object.entries(data.outputs).slice(-5).forEach(([id,out]) => {
      const a = AGENTS.find(a=>a.id===id);
      console.log(`  ${a?.icon||'·'} ${clr(c.green,id.padEnd(14))} ${out.replace(/\n/g,' ').slice(0,75)}…`);
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log(`\n${clr(c.bold,'Backends:')}`);
  console.log(`  ${clr(c.yellow,'Claude API:')} ${apiKey ? clr(c.green,'✓ ANTHROPIC_API_KEY set') : clr(c.red,'✗ not set — run: export ANTHROPIC_API_KEY=sk-ant-...')}`);
}

// ── COMMAND: sync ─────────────────────────────────────────────────────────────
// Bidirectional sync with browser via shared JSON file.
// Browser: click "Export / Sync" → downloads company-os-sync-YYYY-MM-DD.json
// CLI:     node company-os-cli.js sync import <file>  → loads into CLI
// CLI:     node company-os-cli.js sync export <file>  → saves CLI data for browser import
function cmdSync(subCmd, opts) {
  const data = loadData();

  if (subCmd === 'import') {
    const file = opts.target || opts.outputFile;
    if (!file) { console.error(clr(c.red,'✗ Specify file.  E.g: sync import company-os-sync-2026-05-15.json')); return; }
    if (!fs.existsSync(file)) { console.error(clr(c.red,`✗ File not found: ${file}`)); return; }
    try {
      const imported = JSON.parse(fs.readFileSync(file,'utf8'));
      let count = 0;

      // Merge profile
      if (imported.profile && imported.profile.idea) {
        data.profile = {...data.profile, ...imported.profile};
        count++;
      }

      // Merge agent outputs (browser uses OS.agentOutputs, CLI uses data.outputs)
      if (imported.outputs && typeof imported.outputs === 'object') {
        Object.entries(imported.outputs).forEach(([id,out]) => { if(out){data.outputs[id]=out;count++;} });
      }

      // Merge memories
      if (Array.isArray(imported.memories) && imported.memories.length) {
        const existing = data.memories || [];
        const ids = new Set(existing.map(m=>m.id||m.ts));
        const newMems = imported.memories.filter(m=>!ids.has(m.id||m.ts));
        data.memories = [...existing, ...newMems].slice(-200);
        count += newMems.length;
      }

      // Also handle browser localStorage dump format (data.keys)
      if (imported.keys) {
        const profile = imported.keys['company-os-profile'];
        if (profile && profile.idea) { data.profile = {...data.profile, ...profile}; count++; }
        const mems = imported.keys['company-os-memories'];
        if (Array.isArray(mems)) {
          const existing = data.memories || [];
          const ids = new Set(existing.map(m=>m.id||m.ts));
          data.memories = [...existing, ...mems.filter(m=>!ids.has(m.id||m.ts))].slice(-200);
        }
      }

      saveData(data);
      const src = imported.source || 'browser';
      const ts  = imported.exportedAt ? new Date(imported.exportedAt).toLocaleString() : 'unknown';
      console.log(clr(c.green,`✓ Imported ${count} items from ${src} (exported ${ts})`));
      if (data.profile.idea) console.log(clr(c.dim,`  Profile: ${data.profile.name||''} — ${data.profile.idea.slice(0,60)}`));
      if (Object.keys(data.outputs).length) console.log(clr(c.dim,`  Agent outputs: ${Object.keys(data.outputs).join(', ')}`));
    } catch(e) {
      console.error(clr(c.red,'✗ Import failed: '+e.message));
    }
    return;
  }

  if (subCmd === 'export' || !subCmd) {
    const file = opts.target || opts.outputFile || `company-os-sync-${new Date().toISOString().slice(0,10)}.json`;
    const exportData = {
      exportedAt: new Date().toISOString(),
      source: 'cli',
      profile: data.profile,
      outputs: data.outputs,
      memories: data.memories || [],
      history: (data.history||[]).slice(-50),
      // Browser-compatible localStorage keys
      keys: {
        'company-os-profile': data.profile,
        'company-os-memories': data.memories || [],
        ...(data.profile.idea ? {'company-os-idea': data.profile.idea} : {}),
      }
    };
    // Add agent outputs as agentOutputs for browser OS object
    exportData.agentOutputs = data.outputs;
    fs.writeFileSync(file, JSON.stringify(exportData,null,2));
    console.log(clr(c.green,`✓ Exported to ${file}`));
    console.log(clr(c.dim,'  In browser: click "📥 Import" on the dashboard and select this file'));
    console.log(clr(c.dim,`  Agents exported: ${Object.keys(data.outputs).join(', ')||'none'}`));
    return;
  }

  console.log(`\n${clr(c.bold,'Sync — CLI ↔ Browser')}\n`);
  console.log('  '+clr(c.cyan,'Browser → CLI:'));
  console.log('    1. In browser: click "📦 Export / Sync" on dashboard');
  console.log('    2. In terminal: '+clr(c.bold,'node company-os-cli.js sync import company-os-sync-YYYY-MM-DD.json'));
  console.log('\n  '+clr(c.cyan,'CLI → Browser:'));
  console.log('    1. In terminal: '+clr(c.bold,'node company-os-cli.js sync export'));
  console.log('    2. In browser:  click "📥 Import" on dashboard and select the file');
}

// ── COMMAND: clear ────────────────────────────────────────────────────────────
function cmdClear() {
  saveData({profile:{},outputs:{},memories:[],history:[]});
  console.log(clr(c.green,'✓ Data cleared'));
}

// ── CLI ↔ HTML Bridge (SSE server) ────────────────────────────────────────────

// Append an event to the broadcast queue (read by server watcher)
function appendBroadcast(event) {
  try { ensureDir(); fs.appendFileSync(BROADCAST_FILE, JSON.stringify(event)+'\n'); } catch(_) {}
}

// SSE client registry (populated only when server mode is running)
let _sseClients = [];

function broadcastSSE(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  _sseClients = _sseClients.filter(res => { try { res.write(data); return true; } catch(_) { return false; } });
}

// Poll broadcast.jsonl for events written by other CLI processes
function watchBroadcastFile() {
  let lastSize = 0;
  setInterval(() => {
    try {
      if (!fs.existsSync(BROADCAST_FILE)) return;
      const size = fs.statSync(BROADCAST_FILE).size;
      if (size <= lastSize) return;
      const buf = Buffer.alloc(size - lastSize);
      const fd  = fs.openSync(BROADCAST_FILE, 'r');
      fs.readSync(fd, buf, 0, buf.length, lastSize);
      fs.closeSync(fd);
      lastSize = size;
      buf.toString().split('\n').filter(Boolean).forEach(line => {
        try { broadcastSSE(JSON.parse(line)); } catch(_) {}
      });
    } catch(_) {}
  }, 400);
}

async function cmdServer(opts) {
  ensureDir();
  fs.writeFileSync(BROADCAST_FILE, ''); // reset on start
  watchBroadcastFile();

  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const server = http.createServer(async (req, res) => {
    Object.entries(corsHeaders).forEach(([k,v]) => res.setHeader(k,v));
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = (req.url||'').split('?')[0];

    // ── Browser App ──
    if (req.method === 'GET' && url === '/app') {
      const htmlPath = path.join(__dirname, 'company-os-complete.html');
      if (!fs.existsSync(htmlPath)) {
        res.writeHead(404, {'Content-Type':'text/plain'});
        res.end('company-os-complete.html not found next to company-os-cli.js');
        return;
      }
      res.writeHead(200, {'Content-Type':'text/html'});
      fs.createReadStream(htmlPath).pipe(res);
      return;
    }

    // ── Root ──
    if (req.method === 'GET' && (url === '/' || url === '')) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      res.writeHead(200, {'Content-Type':'text/html'});
      res.end(`<!DOCTYPE html><html><head><title>Company OS Server</title>
<style>body{font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:2rem;max-width:800px;margin:0 auto}
h1{color:#7c3aed}h2{color:#a78bfa;border-bottom:1px solid #333;padding-bottom:.5rem}
.ok{color:#4ade80}.warn{color:#fbbf24}.tag{background:#1e1e2e;padding:.2rem .6rem;border-radius:4px;font-size:.85rem}
table{width:100%;border-collapse:collapse}td,th{padding:.5rem;text-align:left;border-bottom:1px solid #222}
th{color:#a78bfa}code{background:#1e1e2e;padding:.1rem .4rem;border-radius:3px}</style></head>
<body><h1>Company OS</h1>
<p>Server running on port <strong>3001</strong> &mdash; <span class="ok">&#10003; Online</span> &mdash; <a href="/app" style="color:#a78bfa">Open Company OS App &rarr;</a></p>
<h2>System</h2><table>
<tr><th>Item</th><th>Value</th></tr>
<tr><td>Agents loaded</td><td><span class="tag">${AGENTS.length}</span></td></tr>
<tr><td>API key</td><td>${apiKey ? '<span class="ok">&#10003; Set</span>' : '<span class="warn">&#9888; Missing — set ANTHROPIC_API_KEY</span>'}</td></tr>
<tr><td>Server time</td><td>${new Date().toISOString()}</td></tr>
</table>
<h2>Endpoints</h2><table>
<tr><th>Method</th><th>Path</th><th>Description</th></tr>
<tr><td>GET</td><td><code>/app</code></td><td>Full Company OS browser app (served via HTTP)</td></tr>
<tr><td>GET</td><td><code>/api/status</code></td><td>Health check (JSON)</td></tr>
<tr><td>GET</td><td><code>/api/outputs</code></td><td>Stored agent outputs</td></tr>
<tr><td>GET</td><td><code>/api/events</code></td><td>SSE stream for live output</td></tr>
<tr><td>POST</td><td><code>/api/run</code></td><td>Run a single agent <code>{"agentId":"ceo","prompt":"..."}</code></td></tr>
<tr><td>POST</td><td><code>/api/pipeline</code></td><td>Run full pipeline <code>{"prompt":"..."}</code></td></tr>
<tr><td>POST</td><td><code>/api/ceo</code></td><td>Autonomous CEO chain <code>{"task":"...","depth":3}</code></td></tr>
</table></body></html>`);
      return;
    }

    // ── Status ──
    if (req.method === 'GET' && url === '/api/status') {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({status:'ok', agents:AGENTS.length, ts:new Date().toISOString()}));
      return;
    }

    // ── Outputs ──
    if (req.method === 'GET' && url === '/api/outputs') {
      const d = loadData();
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(d));
      return;
    }

    // ── Chain reports list ──
    if (req.method === 'GET' && url === '/api/reports') {
      const dir = path.dirname(process.argv[1]);
      const files = fs.readdirSync(dir).filter(f=>f.startsWith('chain-report-')&&f.endsWith('.md')).sort().reverse();
      const reports = files.map(f => {
        const full = path.join(dir, f);
        const content = fs.readFileSync(full,'utf8');
        const ts = parseInt(f.replace('chain-report-','').replace('.md',''))||0;
        return {file:f, ts, date: ts ? new Date(ts).toISOString() : '', preview: content.slice(0,300), content};
      });
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({reports}));
      return;
    }

    // ── SSE stream ──
    if (req.method === 'GET' && url === '/api/events') {
      res.writeHead(200, {...corsHeaders, 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Connection':'keep-alive'});
      res.write(`data: ${JSON.stringify({type:'connected', ts:new Date().toISOString()})}\n\n`);
      _sseClients.push(res);
      const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch(_) { clearInterval(hb); } }, 15000);
      req.on('close', () => { clearInterval(hb); _sseClients = _sseClients.filter(c=>c!==res); });
      return;
    }

    // ── Agents list ──
    if (req.method === 'GET' && url === '/api/agents') {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(AGENTS.map(a=>({id:a.id,name:a.name,icon:a.icon,dept:a.dept,role:a.role}))));
      return;
    }

    // ── Run agent ──
    if (req.method === 'POST' && url === '/api/run') {
      let body = ''; req.on('data', d=>body+=d);
      req.on('end', async () => {
        let agentId, task;
        try { ({agent:agentId, task} = JSON.parse(body)); } catch(e) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:'Bad JSON'})); return; }
        res.writeHead(200, {'Content-Type':'application/json'});
        broadcastSSE({type:'agent_start', agent:agentId, task, ts:new Date().toISOString()});
        // Run async so server stays alive even if agent times out
        (async () => {
          try {
            await cmdRun(agentId, task, {
              ...opts,
              apiKey: opts.apiKey || process.env.ANTHROPIC_API_KEY,
              onToken: tok => broadcastSSE({type:'token', agent:agentId, token:tok}),
              silent: true,
            });
            broadcastSSE({type:'agent_complete', agent:agentId, ts:new Date().toISOString()});
          } catch(e) {
            broadcastSSE({type:'error', agentId, message:e.message});
          }
        })();
        // Respond immediately — client polls /api/outputs for results
        res.end(JSON.stringify({ok:true, queued:true}));
      });
      return;
    }

    // ── Run pipeline ──
    if (req.method === 'POST' && url === '/api/pipeline') {
      let body = ''; req.on('data', d=>body+=d);
      req.on('end', async () => {
        let task;
        try { ({task} = JSON.parse(body)); } catch(e) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:'Bad JSON'})); return; }
        res.writeHead(200, {'Content-Type':'application/json'});
        broadcastSSE({type:'pipeline_start', task, ts:new Date().toISOString()});
        try {
          await cmdPipeline(task, {...opts});
          broadcastSSE({type:'pipeline_complete', task, ts:new Date().toISOString()});
          res.end(JSON.stringify({ok:true}));
        } catch(e) {
          broadcastSSE({type:'error', message:e.message});
          res.end(JSON.stringify({ok:false, error:e.message}));
        }
      });
      return;
    }

    // ── Chat (HTML calls this — streams via SSE tokens, returns full text) ──
    if (req.method === 'POST' && url === '/api/chat') {
      let body = ''; req.on('data', d=>body+=d);
      req.on('end', async () => {
        let agentId, prompt, system;
        try { ({agentId, prompt, system} = JSON.parse(body)); } catch(e) {
          res.writeHead(400); res.end(JSON.stringify({ok:false,error:'Bad JSON'})); return;
        }
        const agentDef = AGENTS.find(a=>a.id===agentId);
        const systemPrompt = system || agentDef?.system || `You are ${agentId || 'a business agent'}, a senior expert in a company.`;
        res.writeHead(200, {'Content-Type':'application/json'});
        broadcastSSE({type:'agent_start', agentId: agentId||'chat', ts:new Date().toISOString()});
        try {
          const text = await callClaudeCLI(systemPrompt, prompt, tok => {
            broadcastSSE({type:'token', agentId: agentId||'chat', text: tok});
          });
          broadcastSSE({type:'agent_done', agentId: agentId||'chat', text, ts:new Date().toISOString()});
          res.end(JSON.stringify({ok:true, text}));
        } catch(e) {
          broadcastSSE({type:'error', message:e.message});
          res.end(JSON.stringify({ok:false, error:e.message}));
        }
      });
      return;
    }

    // ── CEO autonomous chain (HTML fires this) ──
    if (req.method === 'POST' && url === '/api/ceo') {
      let body = ''; req.on('data', d=>body+=d);
      req.on('end', async () => {
        let task, depth, execMode;
        try { ({task, depth, execMode} = JSON.parse(body)); } catch(e) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:'Bad JSON'})); return; }
        if (!task) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:'task required'})); return; }
        res.writeHead(200, {'Content-Type':'application/json'});
        const fakeOpts = {exec: execMode === true, execDir: AILP_DIR, maxDepth: depth||3, outputFile:null, slack:null, feedback:true, maxFeedbackRetries:2};
        const data = loadData();
        const cfg  = loadConfig();
        setImmediate(async () => {
          try {
            broadcastSSE({type:'chain_start', lead:'ceo', task, maxDepth:fakeOpts.maxDepth, ts:new Date().toISOString()});
            const ceoAgent = AGENTS.find(a=>a.id==='ceo');
            const toolCtx  = await buildToolContext(cfg, fakeOpts);
            const leadPrompt = buildPrompt(task, data, toolCtx, data.outputs||{}) + DELEGATION_FOOTER;
            const leadMsgs   = buildMessages(ceoAgent, leadPrompt);
            broadcastSSE({type:'agent_start', agentId:'ceo', agentName:'CEO', taskText:task, totalTasks:1, ts:new Date().toISOString()});
            const {text:leadOutput} = await runAgent(ceoAgent, leadMsgs, {
              ...fakeOpts,
              onToken: tok => broadcastSSE({type:'token', agentId:'ceo', text:tok}),
            });
            data.outputs = data.outputs||{};
            data.outputs['ceo'] = leadOutput;
            data.history = data.history||[];
            data.history.push({agent:'ceo', task:task.slice(0,120), depth:0, ts:new Date().toISOString()});
            saveData(data);
            broadcastSSE({type:'agent_complete', agent:'ceo', agentId:'ceo', name:'CEO', icon:'👑', depth:0, text:leadOutput, ts:new Date().toISOString()});
            // parse + run sub-delegations
            const visited = new Set(['ceo']);
            let firstDelegations = [];
            try { firstDelegations = await parseDelegations(leadOutput, 'ceo', null, visited, 0); } catch(_) {}
            if (firstDelegations.length) {
              firstDelegations.forEach(d=>visited.add(d.agent));
              broadcastSSE({type:'delegation_plan', from:'ceo', agents:firstDelegations.map(d=>d.agent), totalTasks:firstDelegations.length, ts:new Date().toISOString()});
              const treeLog=[];
              // Run full downward chain — each branch synthesizes upward internally
              const csuite = await runChainLevel(firstDelegations, leadOutput, 'ceo', 1, fakeOpts.maxDepth, visited, fakeOpts, data, null, treeLog);
              // ── Final CEO synthesis: CEO reads all C-Suite synthesis briefs ──
              const csuiteResults = (csuite||[]).filter(Boolean).map(r => ({
                agentId: r.agentId,
                // prefer the synthesis brief if available, else raw output
                fullText: data.outputs[`${r.agentId}_synthesis`] || r.fullText,
              }));
              if (csuiteResults.length) {
                console.log(clr(c.bold+c.magenta, '\n👑 CEO Final Synthesis — reading all C-Suite briefs…'));
                await runUpwardSynthesis('ceo', csuiteResults, 0, fakeOpts, data);
              }
            }
            broadcastSSE({type:'chain_complete', lead:'ceo', ts:new Date().toISOString()});
          } catch(e) {
            broadcastSSE({type:'error', message:e.message});
          }
        });
        res.end(JSON.stringify({ok:true, message:'CEO chain started — watch SSE stream'}));
      });
      return;
    }

    // ── Custom agents (save from HTML builder) ──
    if (url === '/api/custom-agents') {
      if (req.method === 'GET') {
        const customFile = path.join(DATA_DIR, 'custom-agents.json');
        const agents = fs.existsSync(customFile) ? JSON.parse(fs.readFileSync(customFile,'utf8')) : [];
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify(agents));
        return;
      }
      if (req.method === 'POST') {
        let body = ''; req.on('data', d=>body+=d);
        req.on('end', () => {
          try {
            const agent = JSON.parse(body);
            const customFile = path.join(DATA_DIR, 'custom-agents.json');
            const agents = fs.existsSync(customFile) ? JSON.parse(fs.readFileSync(customFile,'utf8')) : [];
            const idx = agents.findIndex(a=>a.id===agent.id);
            if (idx >= 0) agents[idx] = agent; else agents.unshift(agent);
            ensureDir(); fs.writeFileSync(customFile, JSON.stringify(agents,null,2));
            // Make it available in this session
            if (!AGENTS.find(a=>a.id===agent.id)) {
              AGENTS.push({id:agent.id,name:agent.name,icon:agent.icon,dept:agent.dept,role:agent.role,system:agent.system});
            }
            res.writeHead(200, {'Content-Type':'application/json'});
            res.end(JSON.stringify({ok:true}));
          } catch(e) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:e.message})); }
        });
        return;
      }
    }

    res.writeHead(404); res.end('Not found');
  });

  server.listen(SERVER_PORT, '127.0.0.1', () => {
    console.log(clr(c.green+c.bold, `\n🌐  CLI Bridge Server — http://localhost:${SERVER_PORT}`));
    console.log(clr(c.dim, `   Events:   http://localhost:${SERVER_PORT}/api/events  (SSE)`));
    console.log(clr(c.dim, `   Outputs:  http://localhost:${SERVER_PORT}/api/outputs`));
    console.log(clr(c.dim, `   Run:      POST http://localhost:${SERVER_PORT}/api/run`));
    console.log(clr(c.dim, `   Pipeline: POST http://localhost:${SERVER_PORT}/api/pipeline`));
    console.log(clr(c.dim, `\n   Open company-os-complete.html — it auto-connects to this server`));
    console.log(clr(c.dim, `   Run agents in another terminal — output streams to the browser live`));
    console.log(clr(c.dim, `   Ctrl+C to stop\n`));
  });
  server.on('error', e => {
    if (e.code === 'EADDRINUSE') console.error(clr(c.red, `✗ Port ${SERVER_PORT} in use. Stop the existing server first.`));
    else console.error(clr(c.red, `✗ Server error: ${e.message}`));
    process.exit(1);
  });

  process.stdin.resume();
  process.on('SIGINT', () => { console.log(clr(c.dim,'\n✓ Server stopped')); process.exit(0); });
}

// ── COMMAND: chain (recursive agentic delegation + execution) ─────────────────
//
// Flow:
//   Lead agent runs → output parsed for delegations → delegated agents run in
//   parallel → each of THOSE agents also delegates → continues until maxDepth
//   or no more delegations.
//
//   With --exec: technical agents (dev/arch/backend/frontend/devops) write real
//   code files to the project directory.

// Agents that produce code and execute rather than re-delegate
const EXEC_AGENT_IDS = new Set([
  'dev','frontend','backend','mobile','devops','arch','dba','dataeng',
  'platformeng','release','sre','cloudarch','staffeng',
  // new agents
  'api-designer','backend-developer','frontend-developer','fullstack-developer',
  'graphql-architect','microservices-architect','mobile-developer','websocket-engineer',
  'cloud-architect','docker-specialist','kubernetes-engineer','terraform-expert',
]);

const AILP_DIR     = path.join(path.dirname(process.cwd()), 'AILearningPath');
const AILP_BACKEND = `${AILP_DIR}/ai-learning-backend/backend`;

// Delegation footer injected into every non-exec agent's prompt in chain mode
// so parseDelegations can use the fast-path regex to extract sub-agents without
// an extra LLM call — and agents never forget to delegate.
// Org hierarchy — maps each agent to the direct reports they can delegate to
const ORG_HIERARCHY = {
  // ── C-Suite (report to CEO) ───────────────────────────────────────────────
  ceo:          ['cto','cmo','cfo','cpo','cro','coo','strategy','chiefofstaff','legal'],
  // ── CTO branch ────────────────────────────────────────────────────────────
  cto:          ['arch','devops','ml','security','dba','backend-developer','frontend-developer'],
  arch:         ['backend-developer','frontend-developer','devops','mobile-developer'],
  devops:       [],   // leaf — builds infra, no further delegation
  ml:           [],
  security:     ['compliance'],
  dba:          [],
  'backend-developer':  [],
  'frontend-developer': [],
  'mobile-developer':   [],
  // ── CMO branch ────────────────────────────────────────────────────────────
  cmo:          ['marketresearch','ux','growth','contentwriter','seo','socialmedia'],
  marketresearch: [],
  ux:           [],
  growth:       [],
  contentwriter:[],
  seo:          [],
  socialmedia:  [],
  // ── CFO branch ────────────────────────────────────────────────────────────
  cfo:          ['finance','fpa','pricing','bi','finops'],
  finance:      [],
  fpa:          [],
  pricing:      [],
  bi:           [],
  finops:       [],
  // ── CPO branch ────────────────────────────────────────────────────────────
  cpo:          ['pm','ux','qa','arch'],
  pm:           ['ux','qa','scrum'],
  qa:           [],
  scrum:        [],
  // ── CRO branch ────────────────────────────────────────────────────────────
  cro:          ['salesops','sales','partnerships'],
  salesops:     [],
  sales:        [],
  partnerships: [],
  // ── COO branch ────────────────────────────────────────────────────────────
  coo:          ['ops','projmgr','ea','knowledgemgr'],
  ops:          [],
  projmgr:      ['scrum'],
  ea:           [],
  knowledgemgr: [],
  // ── CHRO branch ───────────────────────────────────────────────────────────
  chro:         ['hr','recruiter','ld','hrbp','compben','dei'],
  hr:           [],
  recruiter:    [],
  ld:           [],
  hrbp:         [],
  compben:      [],
  dei:          [],
  // ── Legal / Risk ──────────────────────────────────────────────────────────
  legal:        ['compliance','risk'],
  compliance:   [],
  risk:         [],
  // ── Strategy / Staff ──────────────────────────────────────────────────────
  strategy:     [],
  chiefofstaff: ['projmgr','ea'],
};

// Build a per-agent delegation footer — only shows that agent's direct reports
function buildDelegationFooter(agentId) {
  const reports = ORG_HIERARCHY[agentId] || [];
  if (reports.length === 0) {
    // Leaf agent — no delegation
    return `\n\n---\nYou are a specialist execution agent. Do NOT add a DELEGATE block — just deliver your work.\nDELEGATE:\n[]`;
  }
  // List direct reports with their names for clarity
  const reportNames = {
    cto:'CTO', cmo:'CMO', cfo:'CFO', cpo:'CPO', cro:'CRO', coo:'COO', chro:'CHRO',
    strategy:'Strategy Advisor', chiefofstaff:'Chief of Staff', legal:'Legal',
    arch:'Architect', devops:'DevOps', ml:'ML Engineer', security:'Security',
    dba:'DBA', 'backend-developer':'Backend Developer', 'frontend-developer':'Frontend Developer',
    'mobile-developer':'Mobile Developer', marketresearch:'Market Research', ux:'UX Designer',
    growth:'Growth', contentwriter:'Content Writer', seo:'SEO', socialmedia:'Social Media',
    finance:'Finance', fpa:'FP&A', pricing:'Pricing', bi:'BI Analyst', finops:'FinOps',
    pm:'Product Manager', qa:'QA Engineer', scrum:'Scrum Master', compliance:'Compliance',
    risk:'Risk Manager', ops:'Operations', projmgr:'Project Manager', ea:'Exec Assistant',
    knowledgemgr:'Knowledge Manager', hr:'HR', recruiter:'Recruiter', ld:'L&D',
    hrbp:'HRBP', compben:'Comp & Benefits', dei:'DEI', sales:'Sales', salesops:'Sales Ops',
    partnerships:'Partnerships',
  };
  const list = reports.map(id => `  ${id} (${reportNames[id]||id})`).join('\n');
  return `

---
MANDATORY — DELEGATION OUTPUT:
At the end of your response output a DELEGATE block assigning work to YOUR direct reports only.
Use EXACTLY this format — nothing after the closing ]:

DELEGATE:
[
  {"agent": "<id>", "task": "<specific task referencing your exact findings/numbers>"},
  ...
]

YOUR direct reports (only these IDs are valid):
${list}

Rules:
- 2-4 agents max — pick the most relevant ones
- Tasks must be specific — reference numbers, endpoints, or decisions from your output
- Never delegate to agents not in your direct reports list above
- DELEGATE block is the very last thing — nothing after ]`;
}

// Keep a shared constant for the lead agent (CEO) — stays the same
const DELEGATION_FOOTER = buildDelegationFooter('ceo');

// ── Run Jest tests and return {passed, failed, output} ───────────────────────
function runTests(execDir) {
  const backendPath = execDir
    ? path.resolve(execDir, 'ai-learning-backend/backend')
    : AILP_BACKEND;
  return new Promise(resolve => {
    const proc = spawn('npm', ['test', '--', '--forceExit', '--passWithNoTests'], {
      cwd: fs.existsSync(backendPath) ? backendPath : process.cwd(),
      env: {...process.env, CI:'true'},
      timeout: 120000,
    });
    let out = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { out += d.toString(); });
    proc.on('close', code => {
      const passed = code === 0;
      // Extract summary line e.g. "Tests: 3 failed, 12 passed, 15 total"
      const summary = out.match(/Tests?:.*\n/)?.[0]?.trim() || (passed ? 'All tests passed' : 'Tests failed');
      const failures = [...out.matchAll(/● (.+)/g)].map(m=>m[1]).slice(0,5);
      resolve({passed, summary, failures, output: out.slice(-3000)});
    });
    proc.on('error', () => resolve({passed:true, summary:'Test runner not available', failures:[], output:''}));
  });
}

// ── Feedback loop: run tests → if fail, ask agent to fix → repeat ─────────────
async function runFeedbackLoop(agentId, originalTask, execDir, maxRetries=2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    broadcastSSE({type:'test_start', agentId, attempt, ts:new Date().toISOString()});
    console.log(clr(c.cyan, `\n  🧪 Running tests (attempt ${attempt}/${maxRetries})…`));

    const result = await runTests(execDir);
    broadcastSSE({type:'test_result', agentId, passed:result.passed, summary:result.summary, failures:result.failures, attempt, ts:new Date().toISOString()});

    if (result.passed) {
      console.log(clr(c.green, `  ✓ Tests passed`));
      return true;
    }

    console.log(clr(c.yellow, `  ✗ Tests failed: ${result.summary}`));
    if (attempt === maxRetries) break;

    // Ask the agent to fix failures
    const agent = AGENTS.find(a=>a.id===agentId);
    if (!agent) break;
    const fixPrompt = `The code you wrote has failing tests. Fix them.\n\nFAILING TESTS:\n${result.failures.join('\n')}\n\nTEST OUTPUT (last 2000 chars):\n${result.output.slice(-2000)}\n\nORIGINAL TASK:\n${originalTask}\n\nWrite the corrected files using the same FILE: path format.`;

    broadcastSSE({type:'agent_start', agentId, agentName:agent.name, taskText:`Fix failing tests (attempt ${attempt})`, ts:new Date().toISOString()});
    console.log(clr(c.yellow, `\n  🔧 ${agent.name} fixing failures…`));

    try {
      const {text} = await runAgent(agent, buildMessages(agent, fixPrompt), {
        onToken: tok => { process.stdout.write(tok); broadcastSSE({type:'token', agentId, text:tok}); },
      });
      const blocks = extractCodeBlocks(text);
      if (blocks.length) {
        console.log(clr(c.cyan, `\n  → Writing ${blocks.length} fixed file(s)`));
        executeCodeBlocks(blocks, execDir, agentId);
      }
      broadcastSSE({type:'agent_complete', agentId, agent:agentId, name:agent.name, icon:agent.icon, text, ts:new Date().toISOString()});
    } catch(e) {
      console.log(clr(c.red, `  ✗ Fix attempt failed: ${e.message}`));
      break;
    }
  }
  return false;
}

// Extract FILE: path + code blocks from agent output
function extractCodeBlocks(text) {
  const results = [];
  // Pattern: FILE: path/to/file.ext  (on its own line, then a code fence)
  const filePattern = /(?:^|\n)(?:FILE|file|File):\s*([^\n]+)\n```[\w]*\n([\s\S]*?)```/g;
  let m;
  while ((m = filePattern.exec(text)) !== null) {
    const filepath = m[1].trim();
    const code     = m[2];
    if (filepath && code) results.push({filepath, code});
  }
  // Also catch: ### path/to/file.ext (heading style)
  const headingPattern = /###\s+([\w\/\.\-]+\.\w+)\n```[\w]*\n([\s\S]*?)```/g;
  while ((m = headingPattern.exec(text)) !== null) {
    const filepath = m[1].trim();
    const code     = m[2];
    if (filepath && code && !results.find(r=>r.filepath===filepath)) results.push({filepath, code});
  }
  return results;
}

// Write extracted code blocks to the project directory
function executeCodeBlocks(blocks, execDir, agentName) {
  if (!blocks.length) return 0;
  let written = 0;
  for (const {filepath, code} of blocks) {
    try {
      // Resolve against execDir but never escape it
      const absPath = path.resolve(execDir, filepath);
      if (!absPath.startsWith(path.resolve(execDir))) {
        console.log(clr(c.yellow, `    ⚠ Skipped (path escape attempt): ${filepath}`));
        continue;
      }
      const dir = path.dirname(absPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true});
      const existed = fs.existsSync(absPath);
      fs.writeFileSync(absPath, code);
      console.log(clr(c.green, `    ✓ ${existed?'Updated':'Created'}: ${filepath}`));
      appendBroadcast({type:'file_written', agent:agentName, filepath, existed, ts:new Date().toISOString()});
      written++;
    } catch(e) {
      console.log(clr(c.red, `    ✗ Failed to write ${filepath}: ${e.message}`));
    }
  }
  return written;
}

// Parse agent output for sub-delegations, skipping already-visited agents
async function parseDelegations(agentOutput, agentId, apiKey, visited, depth) {
  const maxDelegations = depth === 0 ? 5 : depth === 1 ? 4 : 3;
  // Execution agents don't delegate — they just build
  if (EXEC_AGENT_IDS.has(agentId)) return [];

  // ── Fast path: look for explicit DELEGATE: block in agent output ──
  const delegateMatch = agentOutput.match(/DELEGATE:\s*(\[[\s\S]*?\])/);
  if (delegateMatch) {
    try {
      const parsed = JSON.parse(delegateMatch[1]);
      const valid = parsed.filter(d =>
        d.agent && d.task &&
        AGENTS.find(a => a.id === d.agent) &&
        !visited.has(d.agent)
      );
      if (valid.length) {
        console.log(clr(c.dim, `  ↳ Fast-path delegation: ${valid.map(d=>d.agent).join(', ')}`));
        return valid.slice(0, maxDelegations);
      }
    } catch(_) {}
  }

  const available = AGENTS
    .filter(a => !visited.has(a.id) && a.id !== agentId)
    .map(a=>`${a.id} (${a.name} — ${a.role})`).join('\n');

  if (!available.trim()) return [];

  const prompt = `You are an AI orchestration engine. Agent "${agentId}" just completed its work.

Decide if any OTHER agents need to act on this output. If yes, which ones and with what specific task.

AVAILABLE AGENTS (not yet run):
${available}

RULES:
- Select ${maxDelegations} agents maximum. If nothing actionable remains, return []
- Each task MUST be specific — quote exact numbers/findings from the agent's output
- Do NOT re-use agents already listed as unavailable
- Prefer execution agents (dev, arch, backend, frontend, devops) when the work is implementation
- Prefer analysis agents (cto, cmo, cfo, strategy) when the work is strategic
- Return [] if the agent's output is a final deliverable needing no further action
- Return ONLY valid JSON, no markdown, no explanation

[
  {"agent": "<id>", "task": "<specific task referencing the agent's exact findings>"},
  ...
]

AGENT (${agentId}) OUTPUT:
${agentOutput.slice(0, 2500)}`;

  let raw = '';
  try {
    raw = await callClaudeCLI(null, prompt, null);
  } catch(_) { return []; }
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return parsed.filter(d => d.agent && d.task && AGENTS.find(a=>a.id===d.agent) && !visited.has(d.agent));
  } catch(_) { return []; }
}

// Build the exec-mode system prompt injection for technical agents
function execModePrompt(execDir) {
  return `\n\nEXECUTION MODE — You must produce actual working code files.
For every file you create or modify, use EXACTLY this format:

FILE: relative/path/from/project/root.ext
\`\`\`language
// full file content here — NO placeholders, NO "..." — complete working code
\`\`\`

Project root: ${execDir}
Write complete, production-ready code. Every FILE block will be written to disk automatically.`;
}

// Run a single agent inside the chain, handle exec, return its output
async function runChainAgent(agentId, task, contextSummary, depth, opts, data, execDir) {
  const agent = AGENTS.find(a=>a.id===agentId);
  if (!agent) return null;

  const indent = '  '.repeat(depth + 1);
  const depthColor = [c.cyan, c.green, c.yellow, c.magenta][Math.min(depth, 3)];

  const execInject = (opts.exec && EXEC_AGENT_IDS.has(agentId)) ? execModePrompt(execDir) : '';
  // Inject per-agent delegation footer so each agent only sees their own direct reports
  const delegateInject = buildDelegationFooter(agentId);

  const agentPrompt = [
    contextSummary,
    execInject,
    delegateInject,
  ].filter(Boolean).join('\n\n');

  const msgs = buildMessages(agent, agentPrompt);
  const prefix = `${indent}${agent.icon} ${clr(depthColor+c.bold, agent.name.padEnd(16))} `;

  let buf = '';
  process.stdout.write(prefix);
  // broadcast start so the dashboard creates a card
  appendBroadcast({type:'agent_start', agentId, agentName:agent.name, icon:agent.icon, taskText:task.slice(0,120), depth, ts:new Date().toISOString()});

  try {
    const {text} = await runAgent(agent, msgs, {
      ...opts, silent:true,
      onToken: tok => {
        buf += tok;
        if (!buf.includes('\n')) process.stdout.write(tok);
        appendBroadcast({type:'token', agentId, text:tok});
      },
    });
    const fullText = text || buf;
    process.stdout.write(clr(c.dim,' …') + clr(c.yellow,' ✓') + '\n');

    // Preview first non-empty line
    const preview = fullText.split('\n').find(l=>l.trim());
    if (preview) console.log(indent + '  ' + clr(c.dim, preview.slice(0,100)));

    // Execute code blocks if in exec mode
    if (opts.exec && EXEC_AGENT_IDS.has(agentId) && execDir) {
      const blocks = extractCodeBlocks(fullText);
      if (blocks.length) {
        console.log(indent + clr(c.cyan, `  → Writing ${blocks.length} file(s):`));
        executeCodeBlocks(blocks, execDir, agentId);
        // Feedback loop: run tests, auto-fix failures
        if (opts.feedback !== false) {
          await runFeedbackLoop(agentId, agentPrompt, execDir, opts.maxFeedbackRetries || 2);
        }
      }
    }

    data.outputs[agentId] = fullText;
    data.history = data.history||[];
    data.history.push({agent:agentId, task:task.slice(0,120), depth, ts:new Date().toISOString()});
    saveData(data);  // persist immediately so CEO Briefing shows outputs as they arrive
    appendBroadcast({type:'agent_complete', agentId, agent:agentId, name:agent.name, icon:agent.icon, depth, taskText:task.slice(0,120), text:fullText, ts:new Date().toISOString()});

    return {agentId, fullText};
  } catch(e) {
    process.stdout.write(clr(c.red,' ✗ '+e.message.split('\n')[0])+'\n');
    return null;
  }
}

// ── Upward synthesis: parent agent reads all child reports and writes an exec brief ──
async function runUpwardSynthesis(parentId, childResults, depth, opts, data) {
  const agent = AGENTS.find(a => a.id === parentId);
  if (!agent) return;
  const validChildren = childResults.filter(Boolean);
  if (!validChildren.length) return;

  const indent = '  '.repeat(depth);
  const synthId = `${parentId}_synthesis`;
  console.log(`\n${indent}${clr(c.bold+c.blue, `↑ Synthesis: ${agent.icon} ${agent.name} reading ${validChildren.length} team report(s)`)}`);
  appendBroadcast({type:'synthesis_start', agentId:parentId, synthId, depth, ts:new Date().toISOString()});

  const teamReports = validChildren.map(r => {
    const child = AGENTS.find(a=>a.id===r.agentId);
    return `### ${child?.icon||'🤖'} ${(child?.name||r.agentId).toUpperCase()} REPORT:\n${r.fullText.slice(0,2500)}`;
  }).join('\n\n---\n\n');

  const synthesisPrompt = `You are the ${agent.role} at Stellar/AILearningPath.

Your direct reports have completed their work and submitted their findings. Read every report carefully, then write a concise executive brief to present upward to your own boss.

TEAM REPORTS:
${teamReports}

YOUR EXECUTIVE BRIEF must cover:
1. KEY DECISIONS — What your team decided or built (be specific, quote exact figures/endpoints)
2. CRITICAL RISKS — Any blockers, vulnerabilities, or gaps your team flagged
3. YOUR RECOMMENDATION — What you advise your boss to do next, based on your team's work
4. OPEN ITEMS — What still needs to be resolved by whom

Be concise (400–600 words max). Your boss is busy — lead with the most important finding.
Do NOT add a DELEGATE block — this is a reporting brief, not a delegation.`;

  const msgs = buildMessages(agent, synthesisPrompt);
  let buf = '';
  process.stdout.write(`${indent}  ↑ `);
  try {
    const {text} = await runAgent(agent, msgs, {
      ...opts, silent:true,
      onToken: tok => { buf += tok; appendBroadcast({type:'token', agentId:synthId, text:tok}); },
    });
    const fullText = text || buf;
    process.stdout.write(clr(c.blue,' ✓ synthesis done\n'));
    data.outputs[synthId] = fullText;
    data.history.push({agent:synthId, task:`Synthesis brief from ${validChildren.map(r=>r.agentId).join(', ')}`, depth, ts:new Date().toISOString()});
    saveData(data);
    appendBroadcast({type:'synthesis_complete', agentId:parentId, synthId, name:`${agent.name} (Synthesis)`, icon:agent.icon, depth, text:fullText, ts:new Date().toISOString()});
    return {agentId:parentId, synthId, fullText};
  } catch(e) {
    process.stdout.write(clr(c.red,' ✗ '+e.message.split('\n')[0])+'\n');
    return null;
  }
}

// Recursive chain level: run agents → parse their delegations → recurse → synthesize upward
async function runChainLevel(delegations, parentOutput, parentId, depth, maxDepth, visited, opts, data, execDir, treeLog) {
  if (depth > maxDepth || !delegations.length) return;

  const indent = '  '.repeat(depth);
  const levelColor = [c.magenta, c.cyan, c.green, c.yellow][Math.min(depth, 3)];
  console.log(`\n${indent}${clr(levelColor+c.bold, `${'━'.repeat(4)} Depth ${depth}: ${delegations.length} agents running in parallel`)}\n`);
  appendBroadcast({type:'chain_level', depth, agents:delegations.map(d=>d.agent), ts:new Date().toISOString()});

  // Run all delegations at this level in parallel
  const results = await Promise.all(delegations.map(async ({agent:agentId, task:agentTask}) => {
    visited.add(agentId);

    const contextSummary = [
      `YOUR DELEGATED TASK:\n${agentTask}`,
      `\nCONTEXT FROM ${parentId.toUpperCase()}:\n${parentOutput.slice(0, 1000)}`,
      data.profile.idea ? `\nCompany: ${data.profile.name||''} — ${data.profile.idea}` : '',
    ].join('');

    const result = await runChainAgent(agentId, agentTask, contextSummary, depth, opts, data, execDir);
    if (!result) return null;

    treeLog.push({depth, agentId, task:agentTask, output:result.fullText});

    // ── Recurse into sub-delegations ──────────────────────────────────────
    if (depth < maxDepth) {
      spinStart(`Parsing delegations from ${result.agentId}…`);
      let subDelegations = [];
      try {
        subDelegations = await parseDelegations(result.fullText, result.agentId, opts.apiKey, visited, depth);
      } catch(_) {}
      spinStop();

      if (subDelegations.length) {
        console.log(clr(c.dim, `  ${'  '.repeat(depth)}↳ ${result.agentId} delegates to: ${subDelegations.map(d=>d.agent).join(', ')}`));
        subDelegations.forEach(d => visited.add(d.agent));
        // Broadcast delegation plan so ChainFlow can draw edges
        appendBroadcast({type:'delegation_plan', from:result.agentId, agents:subDelegations.map(d=>d.agent), ts:new Date().toISOString()});
        // Run the sub-level and collect child results
        const childResults = await runChainLevelCollect(subDelegations, result.fullText, result.agentId, depth+1, maxDepth, visited, opts, data, execDir, treeLog);
        // ── UPWARD SYNTHESIS: parent reads all child reports ──────────────
        if (childResults.filter(Boolean).length > 0) {
          const synthesis = await runUpwardSynthesis(result.agentId, childResults, depth, opts, data);
          if (synthesis) result.synthText = synthesis.fullText;
        }
      } else {
        console.log(clr(c.dim, `  ${'  '.repeat(depth)}↳ ${result.agentId}: no further delegations — branch complete`));
      }
    }
    return result;
  }));

  saveData(data);
  return results;
}

// Collect version of runChainLevel — returns all child results for synthesis
async function runChainLevelCollect(delegations, parentOutput, parentId, depth, maxDepth, visited, opts, data, execDir, treeLog) {
  if (depth > maxDepth || !delegations.length) return [];

  const indent = '  '.repeat(depth);
  const levelColor = [c.magenta, c.cyan, c.green, c.yellow][Math.min(depth, 3)];
  console.log(`\n${indent}${clr(levelColor+c.bold, `${'━'.repeat(4)} Depth ${depth}: ${delegations.length} agents running in parallel`)}\n`);
  appendBroadcast({type:'chain_level', depth, agents:delegations.map(d=>d.agent), ts:new Date().toISOString()});

  const results = await Promise.all(delegations.map(async ({agent:agentId, task:agentTask}) => {
    visited.add(agentId);

    const contextSummary = [
      `YOUR DELEGATED TASK:\n${agentTask}`,
      `\nCONTEXT FROM ${parentId.toUpperCase()}:\n${parentOutput.slice(0, 1000)}`,
      data.profile.idea ? `\nCompany: ${data.profile.name||''} — ${data.profile.idea}` : '',
    ].join('');

    const result = await runChainAgent(agentId, agentTask, contextSummary, depth, opts, data, execDir);
    if (!result) return null;
    treeLog.push({depth, agentId, task:agentTask, output:result.fullText});

    if (depth < maxDepth) {
      spinStart(`Parsing delegations from ${result.agentId}…`);
      let subDelegations = [];
      try {
        subDelegations = await parseDelegations(result.fullText, result.agentId, opts.apiKey, visited, depth);
      } catch(_) {}
      spinStop();

      if (subDelegations.length) {
        subDelegations.forEach(d => visited.add(d.agent));
        appendBroadcast({type:'delegation_plan', from:result.agentId, agents:subDelegations.map(d=>d.agent), ts:new Date().toISOString()});
        const grandchildren = await runChainLevelCollect(subDelegations, result.fullText, result.agentId, depth+1, maxDepth, visited, opts, data, execDir, treeLog);
        if (grandchildren.filter(Boolean).length > 0) {
          const synthesis = await runUpwardSynthesis(result.agentId, grandchildren, depth, opts, data);
          if (synthesis) result.synthText = synthesis.fullText;
        }
      }
    }
    return result;
  }));

  saveData(data);
  return results;
}

async function cmdChain(task, opts) {
  if (!task) { console.error(clr(c.red,'✗ --task required')); process.exit(1); }
  const leadId   = opts.target || 'ceo';
  const leadAgent = AGENTS.find(a=>a.id===leadId);
  if (!leadAgent) { console.error(clr(c.red,`✗ Unknown lead agent: ${leadId}`)); process.exit(1); }

  const maxDepth = opts.maxDepth || 3;
  const execDir  = opts.execDir  || null;
  const data     = loadData();
  const cfg      = loadConfig();
  const slackWh  = opts.slackWebhook || cfg.slackWebhook;
  const visited  = new Set([leadId]);
  const treeLog  = [];

  const execNote = opts.exec && execDir ? clr(c.green, ` ⚡ EXEC MODE → ${execDir}`) : '';
  console.log(clr(c.bold+c.magenta, `\n🔗 Agentic Chain  ${leadAgent.icon} ${leadAgent.name}  (max depth ${maxDepth})`) + execNote);
  console.log(clr(c.dim, `Task: ${task.slice(0,120)}\n`));
  appendBroadcast({type:'chain_start', lead:leadId, task, maxDepth, exec:!!opts.exec, ts:new Date().toISOString()});

  // ── Depth 0: Lead agent ────────────────────────────────────────────────────
  console.log(clr(c.bold+c.magenta, `━━━━ Depth 0: ${leadAgent.icon} ${leadAgent.name}\n`));

  const toolCtx   = await buildToolContext(cfg, opts);
  const leadPrompt = buildPrompt(task, data, toolCtx, data.outputs) + buildDelegationFooter(leadId);
  const leadMsgs   = buildMessages(leadAgent, leadPrompt);

  let leadOutput = '';
  try {
    const {text} = await runAgent(leadAgent, leadMsgs, {
      ...opts,
      onToken: tok => { process.stdout.write(tok); },
    });
    leadOutput = text;
    process.stdout.write('\n');
    data.outputs[leadId] = leadOutput;
    data.history = data.history||[];
    data.history.push({agent:leadId, task:task.slice(0,120), depth:0, ts:new Date().toISOString()});
    saveData(data);
    treeLog.push({depth:0, agentId:leadId, task, output:leadOutput});
    appendBroadcast({type:'agent_complete', agent:leadId, name:leadAgent.name, icon:leadAgent.icon, depth:0, text:leadOutput, ts:new Date().toISOString()});
  } catch(e) {
    console.error(clr(c.red,`\n✗ ${leadAgent.name} failed: ${e.message}`));
    process.exit(1);
  }

  // ── Parse first-level delegations ─────────────────────────────────────────
  spinStart(`Parsing delegations from ${leadAgent.name}…`);
  let firstDelegations = [];
  try {
    firstDelegations = await parseDelegations(leadOutput, leadId, opts.apiKey, visited, 0);
  } catch(e) { spinStop(); console.error(clr(c.red,'✗ '+e.message)); }
  spinStop();

  if (!firstDelegations.length) {
    console.log(clr(c.yellow,'\n⚠ No delegations from lead agent — chain complete.'));
  } else {
    firstDelegations.forEach(d => visited.add(d.agent));
    console.log(clr(c.green, `\n✓ ${leadAgent.name} delegates to: ${firstDelegations.map(d=>{const a=AGENTS.find(ag=>ag.id===d.agent);return `${a?.icon||''} ${d.agent}`;}).join(' · ')}`));
    await runChainLevel(firstDelegations, leadOutput, leadId, 1, maxDepth, visited, opts, data, execDir, treeLog);
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  const totalAgents = treeLog.length;
  const filesWritten = opts.exec ? treeLog.reduce((n,e) => n + extractCodeBlocks(e.output).length, 0) : 0;
  console.log(`\n${clr(c.green+c.bold, `✓ Chain complete — ${totalAgents} agents across ${maxDepth} levels`)}${filesWritten ? clr(c.cyan, ` · ${filesWritten} files written`) : ''}`);
  appendBroadcast({type:'chain_complete', lead:leadId, totalAgents, filesWritten, ts:new Date().toISOString()});

  // ── Save report ────────────────────────────────────────────────────────────
  const outFile = opts.outputFile || path.join(path.dirname(process.argv[1]), `chain-report-${Date.now()}.md`);
  const depthGroups = {};
  treeLog.forEach(e => { (depthGroups[e.depth] = depthGroups[e.depth]||[]).push(e); });

  const report = [
    `# Agentic Chain Report`,
    `**Lead:** ${leadAgent.icon} ${leadAgent.name}  ·  **Depth:** ${maxDepth}  ·  **Agents:** ${totalAgents}  ·  **Date:** ${new Date().toLocaleString()}`,
    opts.exec && execDir ? `**Exec Dir:** ${execDir}  ·  **Files Written:** ${filesWritten}` : '',
    `**Task:** ${task}\n`,
    ...Object.entries(depthGroups).map(([d, entries]) => {
      const header = `## Depth ${d}`;
      const sections = entries.map(e => {
        const a = AGENTS.find(ag=>ag.id===e.agentId);
        const blocks = opts.exec ? extractCodeBlocks(e.output) : [];
        const filesNote = blocks.length ? `\n_${blocks.length} file(s) written: ${blocks.map(b=>b.filepath).join(', ')}_\n` : '';
        return `### ${a?.icon||'🤖'} ${a?.name||e.agentId}\n**Task:** ${e.task.slice(0,200)}\n${filesNote}\n${e.output}`;
      });
      return [header, ...sections].join('\n\n');
    }),
  ].filter(Boolean).join('\n\n---\n\n');

  fs.writeFileSync(outFile, report);
  console.log(clr(c.green, `✓ Report saved → ${outFile}`));

  if (slackWh) {
    const summary = `*🔗 Chain complete* — ${leadAgent.icon} ${leadAgent.name} · ${totalAgents} agents · ${maxDepth} levels\n*Task:* ${task.slice(0,100)}\n\n` +
      treeLog.slice(0,6).map(e => { const a=AGENTS.find(ag=>ag.id===e.agentId); return `*Depth ${e.depth} · ${a?.icon||''} ${a?.name||e.agentId}:* ${e.output.replace(/\n/g,' ').slice(0,100)}…`; }).join('\n');
    sendSlack(slackWh, summary.slice(0,2000));
    console.log(clr(c.green,'✓ Summary sent to Slack'));
  }
}

// ── Arg parser ────────────────────────────────────────────────────────────────
function parseArgs() {
  const argv = process.argv.slice(2);
  const opts = {
    command:      argv[0]||null,
    target:       argv[1]&&!argv[1].startsWith('-') ? argv[1] : null,
    subCmd:       argv[1]&&!argv[1].startsWith('-') ? argv[1] : null,
    task:         null, agent:null, cron:null,
    apiKey:       process.env.ANTHROPIC_API_KEY||null,
    outputFile:   null, set:null,
    githubToken:  null, githubRepo:null,
    notionToken:  null, notionDb:null,
    slackWebhook: null,
    maxDepth:     3,
    exec:         false,
    execDir:      null,
  };
  for (let i=0; i<argv.length; i++) {
    switch(argv[i]) {
      case '--task':          opts.task         = argv[++i]; break;
      case '--agent':         opts.agent        = argv[++i]; break;
      case '--cron':          opts.cron         = argv[++i]; break;
      case '--api-key':       opts.apiKey       = argv[++i]; break;
      case '--output':        opts.outputFile   = argv[++i]; break;
      case '--set':           opts.set          = argv[++i]; break;
      case '--github-token':  opts.githubToken  = argv[++i]; break;
      case '--github-repo':   opts.githubRepo   = argv[++i]; break;
      case '--notion-token':  opts.notionToken  = argv[++i]; break;
      case '--notion-db':     opts.notionDb     = argv[++i]; break;
      case '--slack-webhook': opts.slackWebhook = argv[++i]; break;
      case '--depth':         opts.maxDepth     = parseInt(argv[++i])||3; break;
      case '--exec':          opts.exec         = true; break;
      case '--exec-dir':      opts.execDir      = argv[++i]; break;
    }
  }
  return opts;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  banner();

  switch(opts.command) {
    case 'list':     cmdList(opts); break;
    case 'run':
      if (!opts.target) { console.error(clr(c.red,'✗ Specify agent ID.  E.g: run ceo --task "..."')); process.exit(1); }
      await cmdRun(opts.target, opts.task, opts);
      break;
    case 'pipeline': await cmdPipeline(opts.task, opts); break;
    case 'chain':    await cmdChain(opts.task, opts); break;
    case 'ceo':      opts.target = 'ceo'; await cmdChain(opts.task, opts); break;
    case 'chat':
      if (!opts.target) { console.error(clr(c.red,'✗ Specify agent ID.  E.g: chat pm')); process.exit(1); }
      await cmdChat(opts.target, opts);
      break;
    case 'profile':  cmdProfile(opts); break;
    case 'tools':    cmdTools(opts); break;
    case 'schedule': cmdSchedule(opts.subCmd, opts); break;
    case 'server':   await cmdServer(opts); break;
    case 'sync':     cmdSync(opts.subCmd, opts); break;
    case 'status':   cmdStatus(); break;
    case 'clear':    cmdClear(); break;
    case 'help': case '--help': case '-h': case null: usage(); break;
    default:
      console.error(clr(c.red,`✗ Unknown command: "${opts.command}"`));
      usage(); process.exit(1);
  }
}

main().catch(e => { console.error(clr(c.red,'\n✗ Fatal: '+e.message)); process.exit(1); });
