# OS-Dino-Drill

A chapter-based operating systems study app with multiple-choice quizzes and
example-driven recall cards.

## Study modes

- `/` — 696 multiple-choice questions across Chapters 1–21
- `/cards/` — the original long-form recall cards

Quiz progress, shuffled choice order, stars, and manual mastery states are kept
in the browser with `localStorage`, so the static site can be deployed directly
to Vercel.

## Rebuild quiz data

```powershell
node scripts/build-quiz-data.js "C:\path\to\OS_Quiz_Master_Ch01-Ch21_객관식합본.md"
```

The parser supports both Korean and English section labels. Each answer choice
is stored with its own explanation, allowing the UI to shuffle choices without
breaking grading or explanation mapping.
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
