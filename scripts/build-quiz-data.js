const fs = require("fs");
const path = require("path");

const defaultSource = path.join(process.cwd(), "source", "OS_Quiz_Master_Ch01-Ch21_객관식합본.md");
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSource;
const outputFile = path.join(process.cwd(), "data", "quiz.json");

const LABELS = {
  answer: ["정답", "Answer"],
  correct: ["정답 해설", "Why correct"],
  wrong: ["오답 해설", "Why wrong"],
  oneLine: ["한 줄 설명", "One-line"],
};

function markerPattern(labels) {
  return labels.map(escapeRegex).join("|");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clean(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function stripQuote(value) {
  return clean(value).replace(/^["“]|["”]$/g, "").trim();
}

function parseSections(block) {
  const markers = [];
  Object.entries(LABELS).forEach(([key, labels]) => {
    const regex = new RegExp(`^\\[(?:${markerPattern(labels)})\\]\\s*`, "gm");
    for (const match of block.matchAll(regex)) {
      markers.push({ key, index: match.index, end: match.index + match[0].length });
    }
  });
  markers.sort((a, b) => a.index - b.index);

  const sections = {};
  markers.forEach((marker, index) => {
    const end = markers[index + 1]?.index ?? block.length;
    sections[marker.key] = clean(block.slice(marker.end, end));
  });
  return { sections, firstMarker: markers[0]?.index ?? block.length };
}

function parseChoices(promptBlock) {
  const choicePattern = /^([①②③④])\s+(.+)$/gm;
  const matches = Array.from(promptBlock.matchAll(choicePattern));
  if (matches.length !== 4) return null;

  const prompt = clean(promptBlock.slice(0, matches[0].index));
  const choices = matches.map((match, index) => ({
    symbol: match[1],
    text: clean(
      promptBlock.slice(
        match.index + match[0].indexOf(match[2]),
        matches[index + 1]?.index ?? promptBlock.length,
      ),
    ),
  }));
  return { prompt, choices };
}

function parseWrongExplanations(value) {
  const result = {};
  const pattern = /^([①②③④])\s+(.+)$/gm;
  const matches = Array.from(clean(value).matchAll(pattern));
  matches.forEach((match, index) => {
    result[match[1]] = clean(
      value.slice(
        match.index + match[0].indexOf(match[2]),
        matches[index + 1]?.index ?? value.length,
      ),
    );
  });
  return result;
}

function topicForPosition(chapterBody, position) {
  const headings = Array.from(chapterBody.slice(0, position).matchAll(/^###\s+(.+)$/gm));
  const heading = headings.at(-1)?.[1]?.trim() || "General";
  const difficulty = (heading.match(/(★{1,3})/)?.[1] || "").length;
  return {
    title: heading.replace(/\s*\(★{1,3}\)\s*$/, "").trim(),
    difficulty,
  };
}

function parseQuestion(chapterNumber, chapterBody, match, nextMatch) {
  const type = match[1] === "C" ? "code" : "concept";
  const questionNumber = match[2];
  const raw = clean(
    chapterBody.slice(
      match.index + match[0].length,
      nextMatch?.index ?? chapterBody.length,
    ),
  );
  const { sections, firstMarker } = parseSections(raw);
  const parsed = parseChoices(raw.slice(0, firstMarker));
  if (!parsed) {
    throw new Error(`Expected four choices at Chapter ${chapterNumber} ${match[1]}${questionNumber}.`);
  }

  const correctSymbol = clean(sections.answer).match(/[①②③④]/)?.[0];
  if (!correctSymbol) {
    throw new Error(`Missing answer at Chapter ${chapterNumber} ${match[1]}${questionNumber}.`);
  }

  const wrongExplanations = parseWrongExplanations(sections.wrong || "");
  const topic =
    type === "code"
      ? { title: "Code Practice", difficulty: 0 }
      : topicForPosition(chapterBody, match.index);
  const prefix = type === "code" ? "c" : "q";

  return {
    id: `ch${String(chapterNumber).padStart(2, "0")}-${prefix}${String(questionNumber).padStart(2, "0")}`,
    number: `${type === "code" ? "C" : "Q"}${questionNumber}`,
    type,
    topic: topic.title,
    difficulty: topic.difficulty,
    prompt: parsed.prompt,
    choices: parsed.choices.map((choice, index) => ({
      id: `choice-${index + 1}`,
      text: choice.text,
      explanation:
        choice.symbol === correctSymbol
          ? clean(sections.correct)
          : clean(wrongExplanations[choice.symbol]),
    })),
    correctChoiceId: `choice-${parsed.choices.findIndex((choice) => choice.symbol === correctSymbol) + 1}`,
    summary: stripQuote(sections.oneLine),
  };
}

function parseChapter(text, heading, nextHeading) {
  const number = Number(heading[1]);
  const title = heading[2].trim();
  const body = text.slice(heading.index + heading[0].length, nextHeading?.index ?? text.length);
  const questionPattern = /^\*\*([QC])(\d+)\.\*\*\s*/gm;
  const matches = Array.from(body.matchAll(questionPattern));
  const questions = matches.map((match, index) =>
    parseQuestion(number, body, match, matches[index + 1]),
  );

  return {
    id: `ch${String(number).padStart(2, "0")}`,
    number,
    title,
    questions,
  };
}

function main() {
  if (!fs.existsSync(sourcePath)) throw new Error(`Source not found: ${sourcePath}`);
  const text = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
  const headingPattern = /^# Chapter\s+(\d+)\s+[—-]\s+(.+)$/gm;
  const headings = Array.from(text.matchAll(headingPattern));
  const chapters = headings.map((heading, index) => parseChapter(text, heading, headings[index + 1]));
  const totalQuestions = chapters.reduce((sum, chapter) => sum + chapter.questions.length, 0);

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(
    outputFile,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceFile: path.basename(sourcePath),
        chapters,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Generated ${chapters.length} chapters and ${totalQuestions} questions.`);
  console.log(outputFile);
}

main();
