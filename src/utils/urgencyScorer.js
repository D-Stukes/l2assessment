/**
 * Urgency Scorer - Rule-based urgency calculation
 *
 * Urgency is driven by what the message says (impact keywords), not by
 * length, punctuation count, or the time it was received.
 */

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

export function calculateUrgency(message) {
  // Normalize curly apostrophes so "can’t" matches "can't"
  const text = message.toLowerCase().replace(/[‘’]/g, "'")

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
