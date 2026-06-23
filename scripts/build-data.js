const fs = require("fs");
const path = require("path");

const defaultSource = path.join(process.cwd(), "source", "OS_Anki_Master_Final_Ch01_Ch21.md");
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSource;
const outputDir = path.join(process.cwd(), "data");
const outputFile = path.join(outputDir, "cards.json");

function readMarkdownFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => /^os_concepts_level4_ch\d+\.md$/i.test(file))
    .sort((a, b) => {
      const na = Number(a.match(/ch(\d+)/i)?.[1] || 0);
      const nb = Number(b.match(/ch(\d+)/i)?.[1] || 0);
      return na - nb;
    })
    .map((file) => ({
      file,
      text: fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n"),
    }));
}

function readSource(inputPath) {
  const stats = fs.statSync(inputPath);
  if (stats.isDirectory()) {
    return readMarkdownFiles(inputPath);
  }

  return [
    {
      file: path.basename(inputPath),
      text: fs.readFileSync(inputPath, "utf8").replace(/\r\n/g, "\n"),
    },
  ];
}

function extractKeywords(markdown) {
  const marker = markdown.match(/\n\*\*Keywords\*\*\n/i);
  if (!marker) {
    return { body: markdown.trim(), keywords: [] };
  }

  const body = markdown.slice(0, marker.index).trim();
  const keywordBlock = markdown.slice(marker.index + marker[0].length).trim();
  const keywords = keywordBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);

  return { body, keywords };
}

function parseChapter({ file, text }) {
  const titleLine = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || file;
  const chapterMatch =
    titleLine.match(/Chapter\s+(\d+)\.\s*(.+)$/i) || file.match(/ch(\d+)/i);
  const chapterNumber = Number(chapterMatch?.[1] || 0);
  const chapterTitle = chapterMatch?.[2]?.trim() || `Chapter ${chapterNumber}`;

  const cardHeadingPattern = /^###\s+(\d+\.\d+)\s+(.+)$/gm;
  const headings = Array.from(text.matchAll(cardHeadingPattern));

  const cards = headings
    .map((heading, index) => {
      const nextHeading = headings[index + 1];
      const start = heading.index + heading[0].length;
      const end = nextHeading ? nextHeading.index : text.length;
      const rawBody = text.slice(start, end).trim();
      const answerMarker = rawBody.match(/\*\*Answer(?:\s+-\s+Level\s+\d+)?\*\*/i);
      const questionMarker = rawBody.match(/\*\*Question\*\*/i);

      if (!answerMarker) return null;

      const questionStart = questionMarker
        ? questionMarker.index + questionMarker[0].length
        : 0;
      const question = rawBody.slice(questionStart, answerMarker.index).trim();
      const answerRaw = rawBody.slice(answerMarker.index + answerMarker[0].length).trim();
      const { body: answer, keywords } = extractKeywords(answerRaw);
      const number = heading[1];
      const title = heading[2].trim();

      return {
        id: `ch${String(chapterNumber).padStart(2, "0")}-${number}`,
        chapterNumber,
        number,
        title,
        question,
        answer,
        keywords,
      };
    })
    .filter(Boolean);

  return {
    id: `ch${String(chapterNumber).padStart(2, "0")}`,
    number: chapterNumber,
    title: chapterTitle,
    sourceFile: file,
    cards,
  };
}

function parseAnkiMaster({ file, text }) {
  const chapterHeadingPattern = /^# Chapter\s+(\d+)\s*[-:]\s+(.+)$/gm;
  const chapterHeadings = Array.from(text.matchAll(chapterHeadingPattern));

  return chapterHeadings.map((chapterHeading, chapterIndex) => {
    const chapterNumber = Number(chapterHeading[1]);
    const chapterTitle = chapterHeading[2].trim();
    const chapterStart = chapterHeading.index + chapterHeading[0].length;
    const chapterEnd = chapterHeadings[chapterIndex + 1]?.index ?? text.length;
    const chapterBody = text.slice(chapterStart, chapterEnd);
    const cardHeadingPattern = /^##\s+(?!Format\b)(.+)$/gm;
    const cardHeadings = Array.from(chapterBody.matchAll(cardHeadingPattern));

    const cards = cardHeadings
      .map((cardHeading, cardIndex) => {
        const start = cardHeading.index + cardHeading[0].length;
        const end = cardHeadings[cardIndex + 1]?.index ?? chapterBody.length;
        const rawBody = chapterBody.slice(start, end).trim();
        const sections = extractSections(rawBody);
        const question = sections.Question?.trim() || "";
        const details = (sections["Problem Details"] || sections.Extra || "").trim();
        const answer = sections.Answer?.trim() || "";
        const source = sections.Source?.trim() || file;

        if (!question || !answer) return null;

        const headingText = cardHeading[1].trim();
        const normalizedHeading = headingText.replace(/^Card\s+\d+:\s*/i, "").trim();
        const number =
          normalizedHeading.match(/^(\d+\.\d+(?:\([a-z]\))?)/i)?.[1] ||
          question.match(/^(\d+\.\d+(?:\([a-z]\))?)/i)?.[1] ||
          `${chapterNumber}.${cardIndex + 1}`;
        const titleFromHeading = normalizedHeading.replace(/^(\d+\.\d+(?:\([a-z]\))?)[:\s-]*/, "").trim();
        const title = titleFromHeading || firstLine(question);
        const questionWithDetails = details
          ? `${question}\n\n**Problem Details**\n\n${details}`
          : question;

        return {
          id: `ch${String(chapterNumber).padStart(2, "0")}-${slugify(number)}-${cardIndex + 1}`,
          chapterNumber,
          number,
          title,
          question: questionWithDetails,
          answer,
          keywords: [],
          source,
        };
      })
      .filter(Boolean);

    return {
      id: `ch${String(chapterNumber).padStart(2, "0")}`,
      number: chapterNumber,
      title: chapterTitle,
      sourceFile: file,
      cards,
    };
  });
}

function extractSections(markdown) {
  const sectionPattern = /^###\s+(.+)$/gm;
  const headings = Array.from(markdown.matchAll(sectionPattern));
  const sections = {};

  headings.forEach((heading, index) => {
    const name = heading[1].trim();
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    sections[name] = markdown.slice(start, end).trim().replace(/\n---\s*$/m, "").trim();
  });

  return sections;
}

function firstLine(markdown) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^#+\s*/, "")
    .slice(0, 120) || "Untitled card";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source not found: ${sourcePath}`);
  }

  const sources = readSource(sourcePath);
  const chapters = sources.length === 1 && /^OS_Anki_Master_Final/i.test(sources[0].file)
    ? parseAnkiMaster(sources[0])
    : sources.map(parseChapter);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputFile,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: sourcePath,
        chapters,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const totalCards = chapters.reduce((sum, chapter) => sum + chapter.cards.length, 0);
  console.log(`Generated ${chapters.length} chapters and ${totalCards} cards.`);
  console.log(outputFile);
}

main();
