# OS-Dino-Drill

Example-driven operating systems study deck based on OS Concepts exercises.
Built for structured recall, explanation practice, and flashcard-style mastery of core OS principles.

## Study Flow

- Choose a chapter and drill only that chapter's cards.
- Reveal explanations with the button, `Space`, or `Enter`.
- Move with `ArrowLeft` and `ArrowRight`.
- Star important cards with `S`.
- Mark recall status as `Again`, `Unsure`, or `Known`.
- Filter the current chapter by starred cards or recall status.

Progress is stored locally in the browser, so the app can be deployed as a static Vercel site without authentication.

## Data

The app reads generated card data from `data/cards.json`.

To rebuild it from the master Markdown file:

```powershell
node scripts/build-data.js "C:\path\to\OS_Anki_Master_Final_Ch01_Ch21.md"
```

If no path is passed, the script uses `source/OS_Anki_Master_Final_Ch01_Ch21.md`.
