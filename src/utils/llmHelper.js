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

/**
 * Mock categorization for when API is unavailable
 */
function getMockCategorization(message) {
  const lowerMessage = message.toLowerCase();
  
  // Array of possible reasoning variations for each category
  const reasoningVariations = {
    billing: [
      "Based on keywords related to payments and billing, this appears to be a billing-related inquiry. The customer may need assistance with account charges or payment issues.",
      "This message contains billing terminology. The customer is likely experiencing issues with payments, invoices, or account charges.",
      "The message references financial matters related to the customer's account. This suggests a billing or payment concern that requires attention.",
    ],
    technical: [
      "This message describes technical difficulties or system errors. The customer is reporting functionality issues that may require engineering review.",
      "Based on error-related keywords, this appears to be a technical support issue. The customer is experiencing problems with product functionality.",
      "The message indicates a technical problem or bug. This requires investigation from the technical support team.",
      "System-related issues are mentioned in this message. The customer needs technical assistance to resolve functionality problems.",
    ],
    feature: [
      "This message suggests improvements or new functionality. The customer is providing product feedback and feature suggestions.",
      "The customer is requesting enhancements to the product. This appears to be a feature request that should be reviewed by the product team.",
      "Based on the language used, this seems to be a suggestion for product improvements rather than a support issue.",
    ],
    inquiry: [
      "This appears to be a general question about the product or service. The customer is seeking information or clarification.",
      "The message contains questions that don't indicate a specific problem. This is likely a general inquiry requiring informational support.",
      "Based on the question format, this seems to be an information request rather than a technical or billing issue.",
    ],
    positive: [
      "This message contains positive sentiment and appreciation. While not a support request, it may warrant acknowledgment.",
      "The customer is expressing satisfaction or gratitude. This doesn't appear to require immediate support action.",
    ],
    ambiguous: [
      "The message content is unclear or doesn't match standard support categories. Manual review may be needed for proper categorization.",
      "This message doesn't contain clear indicators for automatic categorization. Human review recommended.",
    ]
  };
  
  // Helper to get random reasoning
  const getRandomReasoning = (category) => {
    const reasons = reasoningVariations[category];
    return reasons[Math.floor(Math.random() * reasons.length)];
  };
  
  // Billing-related detection
  if (lowerMessage.includes('bill') || lowerMessage.includes('payment') || 
      lowerMessage.includes('charge') || lowerMessage.includes('invoice') ||
      lowerMessage.includes('credit card') || lowerMessage.includes('subscription') ||
      lowerMessage.includes('refund') || lowerMessage.includes('cancel') && lowerMessage.includes('account')) {
    return {
      category: "Billing Issue",
      reasoning: getRandomReasoning('billing')
    };
  }
  
  // Technical problem detection
  if (lowerMessage.includes('bug') || lowerMessage.includes('error') || 
      lowerMessage.includes('broken') || lowerMessage.includes('not working') ||
      lowerMessage.includes('crash') || lowerMessage.includes('down') || 
      lowerMessage.includes('server') || lowerMessage.includes('loading') ||
      lowerMessage.includes('slow') || lowerMessage.includes('issue') ||
      lowerMessage.includes('problem') && !lowerMessage.includes('no problem')) {
    return {
      category: "Technical Problem",
      reasoning: getRandomReasoning('technical')
    };
  }
  
  // Feature request detection
  if (lowerMessage.includes('feature') || lowerMessage.includes('add') && (lowerMessage.includes('please') || lowerMessage.includes('could')) ||
      lowerMessage.includes('improve') || lowerMessage.includes('would like to see') ||
      lowerMessage.includes('suggestion') || lowerMessage.includes('wish') ||
      lowerMessage.includes('could you') && lowerMessage.includes('add') ||
      lowerMessage.includes('enhancement') || lowerMessage.includes('would be great')) {
    return {
      category: "Feature Request",
      reasoning: getRandomReasoning('feature')
    };
  }
  
  // Positive feedback detection
  if ((lowerMessage.includes('thank') || lowerMessage.includes('thanks') || lowerMessage.includes('appreciate')) &&
      !lowerMessage.includes('but') && !lowerMessage.includes('however')) {
    return {
      category: "General Inquiry",
      reasoning: getRandomReasoning('positive')
    };
  }
  
  // Question/inquiry detection
  if (lowerMessage.includes('how') || lowerMessage.includes('what') || 
      lowerMessage.includes('when') || lowerMessage.includes('where') ||
      lowerMessage.includes('can i') || lowerMessage.includes('is there') ||
      lowerMessage.includes('?')) {
    return {
      category: "General Inquiry",
      reasoning: getRandomReasoning('inquiry')
    };
  }
  
  // Fallback for ambiguous messages
  return {
    category: "General Inquiry",
    reasoning: getRandomReasoning('ambiguous')
  };
}
