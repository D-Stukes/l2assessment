# Testing Notes

## Groq Model Fix

### Before the fix
- **Every Groq request returned `404 model_not_found`** for `llama-3.3-70b-versatile` (model retired by Groq in August 2026).
- The app **silently fell back to keyword-based mock results** — no error was shown to the user, so mock output looked identical to real AI output.

**Test message:** checkout outage message

| Field | Result (before fix) |
| --- | --- |
| Category | Technical Problem |
| Urgency | Medium |
| Recommended action | "restart their browser" |

### After the fix
- Switched the model to `openai/gpt-oss-120b`.
- **Groq now returns `200`** and real AI categorization works.

**Test message:** checkout outage message (same as above)

| Field | Result (after fix) |
| --- | --- |
| Category | Technical Problem (from AI) |
| Urgency | Medium — **still wrong** |
| Recommended action | "restart their browser" — **still wrong** |

### Remaining issue
Even with the AI call working, **urgency and recommended action are unchanged** (still `Medium` and "restart their browser"). These values do not come from the AI response — they are likely produced by:

- `src/utils/urgencyScorer.js` — urgency scoring
- `src/utils/templates.js` — recommended-action templates

These need to be investigated next.

## "Copy Results" button

- **Sometimes fails silently:** the UI shows "Results copied to clipboard!" but nothing is actually copied — the clipboard keeps its old content.
- **When it does work:** the copied text does **not** include the original customer message.

### Fixed
- The copy handler now **awaits** `navigator.clipboard.writeText` and only shows the success message if the write actually succeeds; on failure it logs the error and tells the user to copy manually (no more false "copied!").
- A **textarea + `execCommand('copy')` fallback** covers insecure contexts and older browsers.
- The copied text now **includes the original customer message**, plus a "needs human review" note when the result came from the keyword fallback.
