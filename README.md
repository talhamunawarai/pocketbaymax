# PocketBaymax prototype

Interactive prototype with check-in, photo stress scan, calm triage, 100 demo doctors, booking, lab translation (PDF or image) and post-visit Q&A.

## Run it in VS Code

1. Install Node.js 18 or newer (https://nodejs.org).
2. Open this folder in VS Code (File > Open Folder).
3. Pick an AI source (see below), then copy `.env.example` to `.env`.
4. Open the VS Code terminal (Ctrl+`) and run:
   ```
   npm start
   ```
5. Open http://localhost:3000 in your browser.

The terminal tells you whether the AI is reachable.

## AI source

**Free and local (Ollama).** No key, no cost, works offline.
1. Install Ollama from https://ollama.com and start it.
2. In a terminal run: `ollama pull gemma3:4b` (about 3 GB, one time).
3. Keep `PROVIDER=ollama` in `.env`, then `npm start`.

`gemma3:4b` is multilingual and can read images, so one model covers chat, lab photos and PDFs. On a weak computer it will be slow. With 16 GB RAM or more, `OLLAMA_MODEL=gemma3:12b` gives clearly better answers, especially in Urdu. Small local models are weaker than Claude at Urdu, at following the JSON format for triage and lab results, and at reading blurry photos. For a PDF with real text, the text is also sent, which helps a lot.

**Claude API (paid, best quality).** Set `PROVIDER=anthropic` and `ANTHROPIC_API_KEY=...` in `.env`. Create a key at https://console.anthropic.com. API usage is billed separately from a Claude.ai subscription.

## Photo stress scan

Open the **Stress** tab, upload a photo (or take a selfie on a phone) and Baymax returns an estimated stress level from 1 to 10 with a Low, Moderate or High band, a confidence level, the visible cues it noticed, three small things to try and a gentle follow-up question. You can add a few words about how you feel to give it context.

- It is an estimate from one moment, not a medical test. The result and the screen say so.
- The photo is sent to the AI once and is never stored. Only the score and date are kept in the browser.
- It needs a vision model: `gemma3:4b` or larger on Ollama, or Claude. If no face is clear, it asks for a better photo instead of guessing.
- A score of 8 or more shows a supportive message and emergency guidance.
- Each scan is compared with your last one, a 7-day chart shows your trend, and three high scans in a row suggest talking to a psychologist or psychiatrist. "Clear my scan history" wipes it.

## Without any AI

The UI, doctors, filters and booking all work. Triage, check-in plans, lab translation and Q&A fall back to simple built-in guidance (the sample lab report still shows a prepared result). The stress scan has no fallback, because it cannot be faked without a model. You can also open `index.html` directly or use the Live Server extension, but Claude features need `npm start`.

## Files

- `index.html` the whole app (HTML, CSS and JS in one file)
- `local-claude.js` gives the page the same Claude interface it had inside claude.ai
- `server.js` serves the page and forwards Claude requests, so your key never reaches the browser
- `doctors.json` the 100 demo doctors (the same data is already embedded in `index.html`)

## Notes

- All doctors, clinics, ratings and slots are fictional. Bookings and check-ins are saved in your browser's localStorage only.
- With the Claude API, Haiku answers quick chat replies and Sonnet everything else. Change them in `.env`.
- The server listens on localhost only. Do not commit `.env`.
- PocketBaymax gives guidance, not a diagnosis.
