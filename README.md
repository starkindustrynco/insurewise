# InsureWise

Families find out what their health policy covers only when a claim is rejected. InsureWise reads the policy first, in plain words.

Upload your policy and in about a minute you get:

- **A verdict:** a score out of 100 and a checklist of 7 must-haves, 5 good-to-haves and the cover amount (based on [Ditto's health insurance checklist](https://joinditto.in/health-insurance/checklist/)), with the page every answer came from.
- **What's missing:** the AI tells you if you uploaded only the schedule or only the wording, and asks for the one or two facts it couldn't find.
- **Ask:** questions answered from your own policy pages, by voice or text, in English, Hindi, Tamil, Telugu or Kannada.
- **Estimate:** pick a treatment and see what you may pay under each policy you own, and which one to use.
- **Claim help:** upload a rejection or deduction letter (PDF or photo). Each deduction is checked against your policy and a reply is drafted for you.
- **Hospital-ready card:** one card per family member with the room limit, co-payment and waiting periods, shareable on WhatsApp. Its QR code opens the hospital desk view.

Hackathon MVP. There's no real login or database: everything is saved in your browser. The hospital and advisor portals are mock screens.

## Run it locally

Needs Node 22.13 or later.

```bash
npm install
cp .env.example .env.local   # then add your Gemini key
npm run dev                  # http://localhost:3000
```

Without a key the app still works end to end with the built-in **sample policy** and **sample letter** (look for "Try a sample policy" and "Try a sample letter"). Real uploads need a key.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | For live AI | Gemini API key from Google AI Studio. Read only on the server. `GEMINI_API_KEY` also works. |
| `AI_MODEL` | No | Gemini model. Default `gemini-flash-latest`. |
| `AI_READ_THINKING` | No | `minimal`, `low` (default), `medium` or `high` for policy reading. |
| `AI_ENABLED` | No | `false` forces the sample engine. |
| `AI_RATE_LIMIT_PER_MINUTE` | No | AI requests per browser per minute. Default 20. |

**Free-tier limits.** Google's free tier is small (for example 5 requests a minute and 20 a day on `gemini-flash-latest` in October 2026). Each policy read, question and decoded letter is one request. Before a demo, enable billing on the key or set `AI_MODEL` to a model with its own quota, such as `gemini-3.5-flash`.

## How it works

| Piece | Where |
| --- | --- |
| PDF text is read in the browser (pdf.js) | `src/lib/pdf/extract-text.ts` |
| Gemini reads the policy into a fixed checklist with quotes | `src/server/ai/services.ts`, `src/domain/policy/read.ts` |
| Every quote is matched against the uploaded text; unmatched ones are flagged | `src/domain/ai/grounding.ts` |
| Score, red flags, next steps (rules, not AI) | `src/domain/policy/framework.ts` |
| Waiting-period countdown | `src/domain/policy/waiting.ts` |
| Cost estimate and best policy (rules, not AI) | `src/domain/estimate.ts` |
| Assistant: picks the relevant policy pages, then asks Gemini | `src/lib/assistant.ts`, `/api/ai/ask` |
| Letter decoder (text, scanned PDF or photo) | `/api/ai/decode` |
| Hospital-ready card and QR | `src/domain/card.ts`, `/app/card`, `/hospital` |

Safety rules in every prompt and in code: never promise approval or cover; "not found in your documents" is never shown as "not covered"; citations must be found on the pages sent; promise-like wording is softened.

API routes: `GET /api/health`, `GET /api/ai/status`, `POST /api/ai/read-policy`, `POST /api/ai/ask`, `POST /api/ai/decode`.

## Deploy on Render

1. Push the repo to GitHub.
2. In Render: New → Blueprint → pick the repo (it uses `render.yaml`).
3. Set `GOOGLE_GENERATIVE_AI_API_KEY` when prompted.

Health check: `/api/health`. Any Node 22.13+ host works: `npm ci && npm run build && npm start`.

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Known limits

- The verdict reflects what the uploaded documents state. AI can misread; every row links to the clause so it can be checked.
- Typical treatment costs are rough ranges for private hospitals in large cities. A hospital's own estimate makes the calculator accurate.
- Translations and voice depend on the browser (voice input works in Chrome, Edge and Safari).
- Scanned policy PDFs (images) aren't read; letters and bills can be photos.
