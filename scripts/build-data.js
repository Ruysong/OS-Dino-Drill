const fs = require("fs");
const path = require("path");

const defaultSource = path.join(process.cwd(), "source", "os_concepts_level4_all");
const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : defaultSource;
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

function main() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  const chapters = readMarkdownFiles(sourceDir).map(parseChapter);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputFile,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceDir,
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
