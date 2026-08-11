// The curated signal_ghost history — shared between backend/scripts/seed.ts
// (full DB bootstrap) and handlers/restoreSignalGhost.ts (re-seed just this
// persona after drift from real usage over the Judging Period). Uses
// upsertNewsItem (dedup-by-url) rather than a raw INSERT, so re-running this
// is idempotent — it won't bloat news_items with duplicate historical rows
// no matter how many times it's called.
import { randomUUID as uuid } from "node:crypto";
import { pool } from "./db.js";
import { embedText } from "./bedrock.js";
import { recordEditAndUpdateStyle } from "./memory.js";
import { upsertNewsItem, type NewsInput } from "./news.js";

interface HistoryEntry {
  news: NewsInput;
  linkedin: string;
  x: string;
}

export const SIGNAL_GHOST_HISTORY: HistoryEntry[] = [
  {
    news: {
      source: "ThreatPost",
      url: "https://example.com/exfil-only-extortion",
      headline: "Ransomware crews increasingly skip encryption, go straight to extortion",
      summary: "Multiple groups now threaten to leak stolen data without deploying a ransomware payload at all.",
      severity: "notable",
      publishedAt: "2026-07-10T09:00:00Z",
    },
    linkedin:
      "Ransomware crews are shifting from encrypt-and-extort to pure exfiltration-and-extort — no encryption payload, just the threat of the leak site. If your incident response plan still assumes 'no encryption = no incident,' it's time to update it. What's your team's read?",
    x: "No ransomware payload. Just 'pay or we leak it.' Exfil-only extortion is quietly becoming the default. 🔐",
  },
  {
    news: {
      source: "CVE Feed",
      url: "https://example.com/auth-bypass-poc",
      headline: "Critical auth-bypass CVE gets public PoC within 48 hours of disclosure",
      summary: "Security researchers published working exploit code for a critical authentication bypass less than two days after the advisory dropped.",
      severity: "critical",
      publishedAt: "2026-07-14T09:00:00Z",
    },
    linkedin:
      "Another week, another critical auth-bypass CVE with a public PoC within 48 hours. Patch velocity is now a security control, not an IT chore. What's your team's read?",
    x: "Public PoC in 48hrs. Your patch window just got shorter. #infosec",
  },
  {
    news: {
      source: "Krebs-style wire",
      url: "https://example.com/supply-chain-npm",
      headline: "Compromised npm package caught exfiltrating env variables from CI pipelines",
      summary: "A popular utility package was hijacked to siphon environment secrets from continuous-integration runs before being pulled.",
      severity: "critical",
      publishedAt: "2026-07-20T09:00:00Z",
    },
    linkedin:
      "A single hijacked npm package quietly read CI secrets across who-knows-how-many pipelines before it was caught. Your dependency tree is your attack surface — treat it like one. What's your team's read?",
    x: "Your CI secrets are only as safe as your weakest transitive dependency. Another one just proved it. 📦",
  },
  {
    news: {
      source: "ThreatPost",
      url: "https://example.com/mfa-fatigue",
      headline: "MFA-fatigue attacks account for a growing share of initial access incidents",
      summary: "Attackers are increasingly bombarding users with push notifications until one gets approved by accident or fatigue.",
      severity: "notable",
      publishedAt: "2026-07-28T09:00:00Z",
    },
    linkedin:
      "MFA fatigue isn't a users problem, it's a design problem. If your MFA can be defeated by spamming a push notification at 2am, the control isn't doing its job. Number-matching and rate limits aren't optional anymore. What's your team's read?",
    x: "MFA fatigue attacks: annoy the user until they tap approve by accident. Number-matching fixes this. Turn it on. 📱",
  },
  {
    news: {
      source: "ThreatPost",
      url: "https://example.com/ai-coding-assistant-prompt-injection",
      headline: "Researchers show prompt-injection attack that hijacks AI coding assistants into leaking source code",
      summary: "A malicious comment embedded in a public repo can manipulate an AI coding assistant into exfiltrating proprietary code when a developer asks it to review the file.",
      severity: "critical",
      publishedAt: "2026-08-01T09:00:00Z",
    },
    linkedin:
      "An AI coding assistant doesn't need to be 'hacked' in the traditional sense — it just needs to read something it trusts. Prompt injection through a code comment is the same lesson as SQL injection, just with a probabilistic parser instead of a deterministic one. If your AI tooling has write access to your repo or your credentials, treat every file it reads as untrusted input. What's your team's read?",
    x: "Your AI coding assistant will believe whatever's in the file it just read. A comment is now an attack surface. 🤖",
  },
  {
    news: {
      source: "Krebs-style wire",
      url: "https://example.com/malicious-pypi-ml-package",
      headline: "Malicious PyPI package impersonating a popular ML library steals Hugging Face and AWS tokens",
      summary: "A typosquatted package uploaded to PyPI mimicked a widely-used machine learning library and exfiltrated API tokens and cloud credentials from developers' environments during install.",
      severity: "critical",
      publishedAt: "2026-08-04T09:00:00Z",
    },
    linkedin:
      "Typosquatting isn't new, but the target has shifted — this one specifically went after ML tooling, harvesting Hugging Face and AWS tokens on install. Your AI supply chain has the exact same trust problem your regular software supply chain does, except the blast radius now includes your model weights and training data. Pin your dependencies, verify your sources. What's your team's read?",
    x: "Fake ML package on PyPI, real token theft on install. Your AI supply chain is still a supply chain. 📦",
  },
  {
    news: {
      source: "ThreatPost",
      url: "https://example.com/llm-fine-tuning-data-poisoning",
      headline: "Data poisoning attack shown to reliably backdoor open-source language models during fine-tuning",
      summary: "Researchers demonstrated that injecting a small number of poisoned examples into a fine-tuning dataset can implant a reliable backdoor trigger in an open-source LLM, activated only by a specific phrase.",
      severity: "notable",
      publishedAt: "2026-08-06T09:00:00Z",
    },
    linkedin:
      "A few poisoned examples in a fine-tuning set, and now the model does something specific only when it sees a trigger phrase — otherwise behaves completely normally. If you fine-tune on data you didn't fully vet, you've extended your attack surface to your training pipeline, not just your inference endpoint. What's your team's read?",
    x: "A handful of poisoned examples in your fine-tuning data can plant a silent backdoor. Vet your training data like you'd vet a dependency. 🧬",
  },
];

export const BREAKING_SEED_ITEMS: NewsInput[] = [
  {
    source: "Wire",
    url: "https://example.com/breaking-edge-rce",
    headline: "Actively exploited RCE in widely deployed edge-router firmware",
    summary: "CISA adds a remote code execution flaw in a common edge-router firmware line to its known-exploited list, citing active attacks.",
    severity: "critical",
    publishedAt: new Date().toISOString(),
  },
  {
    source: "Wire",
    url: "https://example.com/breaking-cloud-storage-leak",
    headline: "Misconfigured cloud storage bucket exposes millions of customer records",
    summary: "A publicly accessible storage bucket left unsecured for months is now confirmed to have exposed customer PII at a mid-size retailer.",
    severity: "notable",
    publishedAt: new Date().toISOString(),
  },
];

export async function seedSignalGhostHistory(userId: string): Promise<void> {
  for (const item of SIGNAL_GHOST_HISTORY) {
    const { id: newsItemId } = await upsertNewsItem(item.news);
    await pool.query(
      `INSERT INTO user_engagement (user_id, news_item_id, action) VALUES ($1, $2, 'drafted')
       ON CONFLICT (user_id, news_item_id) DO UPDATE SET action = 'drafted'`,
      [userId, newsItemId]
    );

    for (const [platform, text] of [["linkedin", item.linkedin], ["x", item.x]] as const) {
      const { rows: draftRows } = await pool.query(
        `INSERT INTO drafts (id, user_id, news_item_id, platform, generated_text, used_style_sample_count)
         VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
        [uuid(), userId, newsItemId, platform, `[seed placeholder draft for ${platform}]`]
      );
      const editVector = await embedText(text);
      await recordEditAndUpdateStyle({
        draftId: draftRows[0].id,
        userId,
        platform,
        editedText: text,
        editVector,
      });
    }
  }
}
