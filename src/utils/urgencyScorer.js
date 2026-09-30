/**
 * Urgency Scorer - Rule-based urgency calculation
 *
 * Urgency is driven by what the message says (impact keywords), not by
 * length, punctuation count, or the time it was received.
 *
 * Messages are first scanned for known priority phrases (and close
 * variations of them). The highest tier that matches decides the result.
 * If no phrase matches, a keyword score is used as a fallback.
 */

// 🚨 High: total work stoppage, security risks, or significant data loss
const highPriorityPhrases = [
  // System is completely down
  /\b(system|server|site|website|app|platform|software|network|everything)( is| are|'s)? (completely |totally |entirely )?(down|offline|unreachable|inaccessible)\b/,
  /\b(no ?one|nobody|everyone|all (of )?(us|users|staff)) (can'?t|cannot|is unable to|are unable to|can not) (access|log ?in|sign in|connect|use)\b/,
  // Production outage
  /\b(production|prod|live (site|environment|system)) (is )?(outage|down|broken|offline)\b/,
  /\boutage\b/,
  // Security breach suspected
  /\bbreach(ed)?\b|\bransomware\b|\bhacked\b|\bmalware\b/,
  /\b(compromised|hijacked) (account|accounts|email|system|credentials)\b|\baccounts? (were |was |has been |have been )?compromised\b/,
  /\bdata (leak|leaked|exposed|stolen)\b/,
  // Can't process payments
  /\b(can'?t|cannot|unable to|not able to) (process|take|accept) (payments?|credit cards?|transactions?|orders?)\b/,
  /\b(payments?|billing|checkout|point[- ]of[- ]sale|pos|payment gateway) (system )?(is |are )?(down|failing|failed|not working|broken)\b/,
  // Data loss occurred
  /\bdata loss\b|\blost (all )?(our |my |the )?(data|files|database|records)\b/,
  /\b(files|data|database|records|project (files|assets)) (have |has |are |is )?(gone|vanished|disappeared|deleted|wiped)\b/,
  // Hard crash on boot
  /\b(won'?t|will not|doesn'?t|does not) (turn on|power on|boot( up)?|start up)\b|\bcrash(es|ed|ing)? on boot\b/,
  // Entire department is offline
  /\b(entire|whole) (department|team|office|company|floor)( is)? (offline|down|blocked|can'?t work|unable to work)\b/,
  /\b(multiple|several|all) (users|employees|people|staff) (are |is )?(blocked|offline|down|unable to work|can'?t work)\b/,
]

// ⚠️ Medium: work is impacted or slowed, but a workaround may exist or it's one user
const mediumPriorityPhrases = [
  // Error code when trying to...
  /\berror (code|message)\b|\b(get|getting|got|see|seeing) an error\b/,
  // VPN keeps disconnecting
  /\bvpn\b.*\b(disconnect(s|ing)?|drop(s|ping)?|keeps|unstable|won'?t connect)\b/,
  /\bkeeps? (disconnecting|dropping|crashing|freezing)\b/,
  // Cannot print presentation
  /\b(can'?t|cannot|unable to|won'?t) print\b|\bprinter\b.*\b(not working|jammed|offline|broken)\b/,
  // Software running incredibly slow
  /\b(running|is|really|very|incredibly|extremely|super) slow\b|\bslowed down\b|\bsluggish\b|\blagging\b/,
  // Account locked out
  /\blocked out\b|\baccount (is )?locked\b/,
  /\b(can'?t|cannot|unable to|not able to) (log ?in|login|sign in)\b/,
  // Missing permissions for folder
  /\b(missing|need|don'?t have|do not have) (the )?(permissions?|access) (to|for)\b|\b(access|permission) denied\b/,
  // Syncing error on database
  /\b(sync|syncing|synchroni[sz]ation) (error|issue|problem|failed|failing)\b|\bnot (syncing|updating)\b/,
]

// ℹ️ Low: minor inconveniences, information requests, or routine updates
const lowPriorityPhrases = [
  // How do I change my...?
  /\bhow (do|can|would) (i|we)\b|\bwhere (do|can) i find\b|\bdocumentation\b/,
  // Requesting software installation
  /\b(request(ing)?|need|like|want) (a |an )?(software |new )?(install(ation|ed)?|upgrade|license)\b|\binstall(ing)? (new )?software\b/,
  // Typo on the internal website
  /\btypo\b|\bspelling (mistake|error)\b|\b(cosmetic|alignment|layout|font|color) (issue|bug|change|adjustment)\b/,
  // Need a new keyboard / mouse
  /\b(new|replacement|replace (my|the)) (keyboard|mouse|monitor|headset|charger|webcam)\b/,
  // Reset password for secondary app
  /\breset (my |the )?password\b|\bpassword reset\b/,
  // Onboarding a new hire next month
  /\bonboard(ing)?\b|\bnew hire\b/,
  // Quick question about settings
  /\bquick question\b|\bquestion about\b|\b(change|update|adjust) (my |the )?(settings|preferences)\b/,
]

// Outages, lost access, data/security problems, money taken incorrectly
const criticalPatterns = [
  /\b(outage|emergency|urgent|asap|immediately|critical)\b/,
  /\b(down|offline|crash(ed|ing)?)\b/,
  /\bproduction\b/,
  /\b(connection|data) (lost|loss)\b|\blost (connection|data)\b/,
  /\b(can'?t|cannot|unable to) (log ?in|login|sign in|access)\b/,
  /\b(locked out|security|breach|hacked|compromised)\b/,
  /\b(charged twice|double charged|overcharged|unauthori[sz]ed charge)\b/,
]

// Something is broken or blocking, but not a full outage
const moderatePatterns = [
  /\b(error|bug|broken|fail(ed|ing|s)?|not working|doesn'?t work)\b/,
  /\b(won'?t|will not|doesn'?t|does not) (load|open|work|save)\b/,
  /\b(timing out|times out|timeout|loading forever|stuck|freez(es|ing))\b/,
  /\b(refund|wrong charge|payment (issue|problem))\b/,
]

// Signals the customer is not blocked (thanks, praise, suggestions)
const lowPatterns = [
  /\b(thank(s| you)?|appreciate)\b/,
  /\b(love|great|excellent|wonderful|happy|nice|helpful)\b/,
  /\b(feature|suggestion|would be (nice|great|useful)|would love|wish)\b/,
  /\b(just wanted to|feedback)\b/,
]

const countMatches = (text, patterns) =>
  patterns.filter(pattern => pattern.test(text)).length

const matchesAny = (text, patterns) => patterns.some(pattern => pattern.test(text))

export function calculateUrgency(message) {
  // Normalize curly apostrophes so "can’t" matches "can't"
  const text = message.toLowerCase().replace(/[‘’]/g, "'")

  // Known priority phrases take precedence; the highest matching tier wins
  if (matchesAny(text, highPriorityPhrases)) return "High"
  if (matchesAny(text, mediumPriorityPhrases)) return "Medium"
  if (matchesAny(text, lowPriorityPhrases)) return "Low"

  let urgencyScore = 0

  urgencyScore += countMatches(text, criticalPatterns) * 50
  urgencyScore += countMatches(text, moderatePatterns) * 20

  // Positive / non-blocking language only lowers urgency when nothing is on fire
  if (countMatches(text, criticalPatterns) === 0) {
    urgencyScore -= countMatches(text, lowPatterns) * 10
  }

  // ALL CAPS reads as shouting, which signals frustration
  const letters = message.replace(/[^a-zA-Z]/g, '')
  if (letters.length > 10 && message === message.toUpperCase()) {
    urgencyScore += 15
  }

  // Exclamation marks add a little emphasis, capped so "Thanks!!!" stays low
  const exclamationCount = (message.match(/!/g) || []).length
  urgencyScore += Math.min(exclamationCount, 3) * 5

  if (urgencyScore >= 50) return "High"
  if (urgencyScore >= 20) return "Medium"
  return "Low"
}
