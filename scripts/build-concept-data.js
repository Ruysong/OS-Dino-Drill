const fs = require("fs");
const path = require("path");

const defaultSource = path.join(process.cwd(), "source", "OS_개념_학습노트_Ch7-Ch21 개념글.md");
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSource;
const outputFile = path.join(process.cwd(), "data", "concepts.json");

function clean(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function parseConceptNotes(text) {
  const headingPattern = /^# Chapter\s+(\d+)\s+[—-]\s+(.+)$/gm;
  const headings = Array.from(text.matchAll(headingPattern));

  return headings.map((heading, index) => {
    const number = Number(heading[1]);
    const title = heading[2].trim();
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? text.length;
    return {
      id: `ch${String(number).padStart(2, "0")}`,
      number,
      title,
      markdown: clean(text.slice(start, end)),
    };
  });
}

function main() {
  if (!fs.existsSync(sourcePath)) throw new Error(`Source not found: ${sourcePath}`);
  const text = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
  const notes = parseConceptNotes(text);

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(
    outputFile,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceFile: path.basename(sourcePath),
        notes,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Generated ${notes.length} concept notes.`);
  console.log(outputFile);
}

main();
