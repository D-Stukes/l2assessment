import Groq from 'groq-sdk';

/**
 * LLM Helper for triaging customer support messages.
 *
 * Layered strategy (first success wins):
 *   1. Primary AI   — openai/gpt-oss-120b
 *   2. Retry        — same model, one more attempt
 *   3. Backup AI    — openai/gpt-oss-20b
 *   4. Keyword fallback — local, always flagged "Needs human review"
 *
 * Every AI attempt must return STRICT JSON with category, urgency,
 * recommendedAction and reasoning, or it is treated as a failure and
 * the next layer is tried.
 */

const PRIMARY_MODEL = 'openai/gpt-oss-120b';
const BACKUP_MODEL = 'openai/gpt-oss-20b';

const VALID_CATEGORIES = [
  'Billing Issue',
  'Technical Problem',
  'Feature Request',
  'General Inquiry',
];
const VALID_URGENCY = ['High', 'Medium', 'Low'];

// Initialize Groq client
const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true // Required for browser-based calls (not recommended for production!)
});

const SYSTEM_PROMPT = `You are a customer-support triage assistant.
Classify each message and respond with STRICT JSON only — no prose, no code fences.

Return exactly these fields:
{
  "category": one of ${JSON.stringify(VALID_CATEGORIES)},
  "urgency": one of ${JSON.stringify(VALID_URGENCY)},
  "recommendedAction": a specific next step for a support agent (one sentence),
  "reasoning": a brief explanation of the category and urgency
}

Urgency is defined by BUSINESS IMPACT, not tone or punctuation:
- "High": broad or revenue-blocking impact — many/all customers affected,
  payments or checkout failing, a core workflow down, login/lockout for many,
  security/data/legal exposure, or a hard deadline.
- "Medium": a real problem affecting one or a few users, with a workaround
  or no immediate revenue/security impact.
- "Low": questions, feature requests, cosmetic issues, or praise — no
  functional blockage.

Judge the actual situation. Words like "urgent" or "asap" alone do not make
something High unless there is real impact. Negations matter: "not urgent"
is not an escalation.`;

function buildUserPrompt(message) {
  return `Customer message:\n"""\n${message}\n"""\n\nRespond with the JSON object only.`;
}

/** Parse and validate a model's JSON response; throw on anything malformed. */
function parseAiResult(content) {
  if (!content) throw new Error('Empty response');

  // Tolerate accidental code fences around the JSON.
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  const data = JSON.parse(cleaned); // throws if not valid JSON

  if (!VALID_CATEGORIES.includes(data.category)) {
    throw new Error(`Invalid category: ${data.category}`);
  }
  if (!VALID_URGENCY.includes(data.urgency)) {
    throw new Error(`Invalid urgency: ${data.urgency}`);
  }
  if (!data.recommendedAction || !data.reasoning) {
    throw new Error('Missing recommendedAction or reasoning');
  }

  return {
    category: data.category,
    urgency: data.urgency,
    recommendedAction: String(data.recommendedAction).trim(),
    reasoning: String(data.reasoning).trim(),
  };
}

/** Make a single Groq call with the given model and return a validated result. */
async function callModel(model, message) {
  const response = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(message) },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  return parseAiResult(response.choices[0]?.message?.content);
}

/**
 * Triage a customer support message through the layered fallback chain.
 *
 * @param {string} message - The customer support message
 * @returns {Promise<{category: string, urgency: string, recommendedAction: string, reasoning: string, source: string, needsReview: boolean}>}
 */
export async function categorizeMessage(message) {
  const attempts = [
    { model: PRIMARY_MODEL, source: 'ai-primary' },
    { model: PRIMARY_MODEL, source: 'ai-retry' },
    { model: BACKUP_MODEL, source: 'ai-backup' },
  ];

  for (const attempt of attempts) {
    try {
      const result = await callModel(attempt.model, message);
      return { ...result, source: attempt.source, needsReview: false };
    } catch (error) {
      console.warn(
        `[categorize] ${attempt.source} (${attempt.model}) failed:`,
        error.message
      );
    }
  }

  // All AI attempts failed → local keyword fallback (upgraded in step b).
  console.warn('[categorize] all AI attempts failed, using keyword fallback');
  return getMockCategorization(message);
}

/* ------------------------------------------------------------------ *
 * Layer 4: smart keyword fallback (local, no network).
 * Only runs when every AI attempt has failed. Always returns
 * needsReview: true so these results are never mistaken for AI output.
 * ------------------------------------------------------------------ */

// Words that negate an urgency/impact cue when they appear right before it.
const NEGATORS = ['not', 'no', "isn't", "aren't", "won't", 'never', 'without'];

// Broad-scope phrases: combined with any impact cue, these escalate to High.
const BROAD_SCOPE = [
  'all customers', 'every customer', 'everyone', 'all users',
  'nobody can', 'no one can', 'multiple customers', 'widespread',
  'company-wide', 'company wide', 'entire',
];

// High-impact phrases — revenue/security/core-workflow blockage.
const HIGH_IMPACT = [
  "can't pay", 'cannot pay', 'payment failing', 'payments failing',
  "can't log in", 'cannot log in', "can't login", 'locked out',
  'outage', 'data loss', 'breach', 'charged twice', 'double charged',
];

// "checkout" only counts as High when paired with one of these failure words.
const CHECKOUT_FAILURE = ['error', 'broken', 'failing', "can't", 'cannot', 'down', 'not working'];

// Tone words: Medium on their own; High only if a real impact cue is also present.
const TONE_WORDS = ['urgent', 'asap', 'emergency', 'deadline', 'critical'];

// Medium-impact cues — a real problem, but narrow / with a workaround.
const MEDIUM_IMPACT = [
  'error', 'bug', 'broken', 'failing', 'slow', 'not working',
  'issue', 'problem', "can't access", 'down',
];

/** True if `phrase` appears in `text` with a negator immediately before it. */
function isNegated(text, phrase) {
  const idx = text.indexOf(phrase);
  if (idx === -1) return false;
  const before = text.slice(0, idx).trim().split(/\s+/);
  const prevWord = before[before.length - 1] || '';
  return NEGATORS.includes(prevWord);
}

/** Presence check: whole-word match for the bare word "down" (so it does
 * not match "download"), substring match for everything else. */
function phrasePresent(text, phrase) {
  if (phrase === 'down') return /\bdown\b/.test(text);
  return text.includes(phrase);
}

/** True if `phrase` is present AND not directly negated. */
function hasCue(text, phrase) {
  return phrasePresent(text, phrase) && !isNegated(text, phrase);
}

function scoreUrgency(text) {
  const broad = BROAD_SCOPE.some((p) => hasCue(text, p));

  // "checkout" counts as high-impact only alongside a failure word.
  const checkoutFailure =
    text.includes('checkout') && CHECKOUT_FAILURE.some((w) => hasCue(text, w));

  const hasHighImpact =
    HIGH_IMPACT.some((p) => hasCue(text, p)) || checkoutFailure;

  const hasMediumImpact = MEDIUM_IMPACT.some((p) => hasCue(text, p));
  const hasTone = TONE_WORDS.some((p) => hasCue(text, p));

  // Broad scope + any real impact → High.
  if (hasHighImpact || (broad && (hasMediumImpact || hasTone))) return 'High';
  // Tone words or a narrow real problem → Medium.
  if (hasMediumImpact || hasTone) return 'Medium';
  return 'Low';
}

function detectCategory(text) {
  if (
    text.includes('bill') || text.includes('payment') || text.includes('charge') ||
    text.includes('invoice') || text.includes('refund') || text.includes('subscription')
  ) return 'Billing Issue';

  if (
    text.includes('bug') || text.includes('error') || text.includes('broken') ||
    text.includes('not working') || text.includes('crash') ||
    text.includes('outage') || text.includes('checkout') || text.includes('login') ||
    text.includes('log in') || text.includes('locked out') ||
    text.includes('lock out') || /\bdown\b/.test(text)
  ) return 'Technical Problem';

  if (
    text.includes('feature') || text.includes('suggestion') || text.includes('would like') ||
    text.includes('request') || text.includes('wish') || text.includes('improve')
  ) return 'Feature Request';

  return 'General Inquiry';
}

const FALLBACK_ACTIONS = {
  'Billing Issue': 'Route to the billing team to verify the account and charges',
  'Technical Problem': 'Escalate to engineering to confirm scope and impact',
  'Feature Request': 'Log the request for product review',
  'General Inquiry': 'Reply with the relevant information or docs',
};

/**
 * Local keyword fallback. Negation-aware, scope-weighted, and always
 * flagged for human review.
 */
function getMockCategorization(message) {
  const text = message.toLowerCase();

  const urgency = scoreUrgency(text);
  const category = detectCategory(text);
  const recommendedAction = `${FALLBACK_ACTIONS[category]} — Needs human review`;

  return {
    category,
    urgency,
    recommendedAction,
    reasoning:
      'AI triage was unavailable, so this was classified by a local keyword ' +
      'fallback (negation- and scope-aware). Treat as a rough estimate and ' +
      'have a human confirm the category and urgency.',
    source: 'keyword-fallback',
    needsReview: true,
  };
}
