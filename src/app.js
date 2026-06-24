const STORAGE_KEY = "os-dino-drill-progress-v1";

const state = {
  chapters: [],
  chapterId: "",
  cardId: "",
  filter: "all",
  mode: "ordered",
  search: "",
  answerVisible: false,
  listCollapsed: false,
  progress: loadProgress(),
};

const elements = {
  chapterSelect: document.querySelector("#chapterSelect"),
  modeSelect: document.querySelector("#modeSelect"),
  searchInput: document.querySelector("#searchInput"),
  progressSummary: document.querySelector("#progressSummary"),
  cardList: document.querySelector("#cardList"),
  collapseListButton: document.querySelector("#collapseListButton"),
  cardNumber: document.querySelector("#cardNumber"),
  starButton: document.querySelector("#starButton"),
  cardTitle: document.querySelector("#cardTitle"),
  questionContent: document.querySelector("#questionContent"),
  answerCard: document.querySelector("#answerCard"),
  answerContent: document.querySelector("#answerContent"),
  keywordList: document.querySelector("#keywordList"),
  showAnswerButton: document.querySelector("#showAnswerButton"),
  hideAnswerButton: document.querySelector("#hideAnswerButton"),
  previousButton: document.querySelector("#previousButton"),
  nextButton: document.querySelector("#nextButton"),
  cardIndex: document.querySelector(".card-index"),
};

async function initialize() {
  try {
    const response = await fetch("../data/cards.json");
    if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);
    const data = await response.json();
    state.chapters = data.chapters || [];
    state.chapterId = state.chapters[0]?.id || "";
    state.cardId = getCurrentChapter().cards[0]?.id || "";
    bindEvents();
    render();
  } catch (error) {
    document.querySelector("#app").innerHTML = `
      <main class="empty-state">
        <h1>Card data is missing</h1>
        <p>Run <code>node scripts/build-data.js</code> to generate <code>data/cards.json</code>.</p>
        <pre>${escapeHtml(error.message)}</pre>
      </main>
    `;
  }
}

function bindEvents() {
  elements.chapterSelect.addEventListener("change", (event) => {
    state.chapterId = event.target.value;
    state.cardId = getFilteredCards()[0]?.id || getCurrentChapter().cards[0]?.id || "";
    state.answerVisible = false;
    render();
  });

  elements.modeSelect.addEventListener("change", (event) => {
    state.mode = event.target.value;
    renderToolbarOnly();
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    state.cardId = getFilteredCards()[0]?.id || "";
    state.answerVisible = false;
    render();
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      state.cardId = getFilteredCards()[0]?.id || "";
      state.answerVisible = false;
      render();
    });
  });

  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => {
      setStatus(button.dataset.status);
    });
  });

  elements.starButton.addEventListener("click", toggleStar);
  elements.showAnswerButton.addEventListener("click", revealOrAdvance);
  elements.hideAnswerButton.addEventListener("click", () => {
    state.answerVisible = false;
    renderCard();
  });
  elements.previousButton.addEventListener("click", previousCard);
  elements.nextButton.addEventListener("click", nextCard);
  elements.collapseListButton.addEventListener("click", () => {
    state.listCollapsed = !state.listCollapsed;
    renderLayout();
  });

  window.addEventListener("keydown", handleKeyboard);
}

function handleKeyboard(event) {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if (typing) return;

  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    revealOrAdvance();
  }
  if (event.key === "ArrowRight") nextCard();
  if (event.key === "ArrowLeft") previousCard();
  if (event.key.toLowerCase() === "s") toggleStar();
  if (event.key === "1") setStatus("again");
  if (event.key === "2") setStatus("unsure");
  if (event.key === "3") setStatus("known");
}

function render() {
  renderToolbar();
  renderLayout();
  renderList();
  renderCard();
}

function renderToolbar() {
  elements.chapterSelect.innerHTML = state.chapters
    .map(
      (chapter) =>
        `<option value="${chapter.id}" ${chapter.id === state.chapterId ? "selected" : ""}>
          ${chapter.number}. ${escapeHtml(chapter.title)}
        </option>`,
    )
    .join("");
  elements.modeSelect.value = state.mode;
  elements.searchInput.value = state.search;
  renderToolbarOnly();
}

function renderToolbarOnly() {
  const chapter = getCurrentChapter();
  const cards = chapter.cards || [];
  const filtered = getFilteredCards();
  const known = cards.filter((card) => getCardProgress(card.id).status === "known").length;
  const starred = cards.filter((card) => getCardProgress(card.id).starred).length;

  elements.progressSummary.textContent = `${filtered.length}/${cards.length} cards · ${known} known · ${starred} starred`;

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function renderLayout() {
  elements.cardIndex.classList.toggle("is-collapsed", state.listCollapsed);
  elements.collapseListButton.textContent = state.listCollapsed ? "Show" : "Hide";
}

function renderList() {
  const filtered = getFilteredCards();

  if (!filtered.length) {
    elements.cardList.innerHTML = `<div class="empty-list">No cards match this view.</div>`;
    return;
  }

  elements.cardList.innerHTML = filtered
    .map((card, index) => {
      const progress = getCardProgress(card.id);
      const active = card.id === state.cardId ? "active" : "";
      const status = progress.status || "new";
      const star = progress.starred ? "★" : "☆";
      return `
        <button class="card-list-item ${active}" data-card-id="${card.id}" type="button">
          <span class="list-number">${index + 1}</span>
          <span class="list-main">
            <span class="list-title">${escapeHtml(card.number)} ${escapeHtml(card.title)}</span>
            <span class="list-sub">${status}</span>
          </span>
          <span class="list-star">${star}</span>
        </button>
      `;
    })
    .join("");

  elements.cardList.querySelectorAll("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.cardId = button.dataset.cardId;
      state.answerVisible = false;
      renderCard();
      renderList();
    });
  });
}

function renderCard() {
  const card = getCurrentCard();
  if (!card) {
    elements.cardNumber.textContent = "";
    elements.cardTitle.textContent = "No card selected";
    elements.questionContent.innerHTML = `<p>Change the filter or search query to continue.</p>`;
    elements.answerCard.classList.add("is-hidden");
    return;
  }

  const progress = getCardProgress(card.id);
  elements.cardNumber.textContent = `Chapter ${card.chapterNumber} · ${card.number}`;
  elements.cardTitle.textContent = card.title;
  elements.questionContent.innerHTML = renderMarkdown(card.question);
  elements.answerContent.innerHTML = renderMarkdown(card.answer);
  elements.starButton.textContent = progress.starred ? "★" : "☆";
  elements.starButton.classList.toggle("is-starred", Boolean(progress.starred));
  elements.answerCard.classList.toggle("is-hidden", !state.answerVisible);
  elements.showAnswerButton.textContent = state.answerVisible ? nextLabel() : "Show Answer";

  elements.keywordList.innerHTML = (card.keywords || [])
    .map((keyword) => `<span>${escapeHtml(keyword)}</span>`)
    .join("");

  document.querySelectorAll("[data-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.status === progress.status);
  });
}

function revealOrAdvance() {
  if (!state.answerVisible) {
    state.answerVisible = true;
    renderCard();
    return;
  }
  nextCard();
}

function previousCard() {
  const filtered = getFilteredCards();
  if (!filtered.length) return;
  const index = filtered.findIndex((card) => card.id === state.cardId);
  const previousIndex = index <= 0 ? filtered.length - 1 : index - 1;
  state.cardId = filtered[previousIndex].id;
  state.answerVisible = false;
  renderList();
  renderCard();
}

function nextCard() {
  const filtered = getFilteredCards();
  if (!filtered.length) return;

  if (state.mode === "random" && filtered.length > 1) {
    const candidates = filtered.filter((card) => card.id !== state.cardId);
    state.cardId = candidates[Math.floor(Math.random() * candidates.length)].id;
  } else {
    const index = filtered.findIndex((card) => card.id === state.cardId);
    state.cardId = filtered[(index + 1) % filtered.length].id;
  }

  state.answerVisible = false;
  renderList();
  renderCard();
}

function nextLabel() {
  return state.mode === "random" ? "Next Random" : "Next Card";
}

function toggleStar() {
  const card = getCurrentCard();
  if (!card) return;
  const progress = getCardProgress(card.id);
  state.progress[card.id] = { ...progress, starred: !progress.starred };
  saveProgress();
  renderToolbarOnly();
  renderList();
  renderCard();
}

function setStatus(status) {
  const card = getCurrentCard();
  if (!card) return;
  const progress = getCardProgress(card.id);
  state.progress[card.id] = { ...progress, status };
  saveProgress();
  renderToolbarOnly();
  renderList();
  renderCard();
}

function getCurrentChapter() {
  return state.chapters.find((chapter) => chapter.id === state.chapterId) || { cards: [] };
}

function getCurrentCard() {
  return getCurrentChapter().cards.find((card) => card.id === state.cardId);
}

function getFilteredCards() {
  return getCurrentChapter().cards.filter((card) => {
    const progress = getCardProgress(card.id);
    const text = `${card.number} ${card.title} ${card.question} ${card.answer} ${(card.keywords || []).join(" ")}`.toLowerCase();
    const matchesSearch = !state.search || text.includes(state.search);
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "starred" && progress.starred) ||
      progress.status === state.filter;
    return matchesSearch && matchesFilter;
  });
}

function getCardProgress(cardId) {
  return state.progress[cardId] || { starred: false, status: "" };
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function renderMarkdown(markdown) {
  const codeBlocks = [];
  let safe = escapeHtml(markdown || "").replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, language, code) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push({ language, code });
    return token;
  });

  safe = safe
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  const blocks = safe.split(/\n{2,}/).map((block) => {
    if (block.startsWith("@@CODE_BLOCK_")) return block;
    if (/^<h[23]>/.test(block)) return block;
    if (isMarkdownTable(block)) return renderTable(block);
    if (/^- /m.test(block)) {
      const items = block
        .split("\n")
        .filter((line) => line.trim().startsWith("- "))
        .map((line) => `<li>${line.trim().slice(2)}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    }
    if (/^\d+\.\s/m.test(block)) {
      const items = block
        .split("\n")
        .filter((line) => /^\d+\.\s/.test(line.trim()))
        .map((line) => `<li>${line.trim().replace(/^\d+\.\s/, "")}</li>`)
        .join("");
      return `<ol>${items}</ol>`;
    }
    return `<p>${block.replace(/\n/g, "<br />")}</p>`;
  });

  return blocks
    .join("")
    .replace(/@@CODE_BLOCK_(\d+)@@/g, (_, index) => {
      const block = codeBlocks[Number(index)];
      const language = block.language ? `<span>${escapeHtml(block.language)}</span>` : "";
      return `<figure class="code-block"><figcaption>${language}</figcaption><pre><code>${block.code}</code></pre></figure>`;
    });
}

function isMarkdownTable(block) {
  const lines = block.split("\n").map((line) => line.trim());
  return (
    lines.length >= 2 &&
    lines[0].startsWith("|") &&
    lines[0].endsWith("|") &&
    /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[1])
  );
}

function renderTable(block) {
  const rows = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((_, index) => index !== 1)
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );

  const [header, ...body] = rows;
  const head = header.map((cell) => `<th>${cell}</th>`).join("");
  const bodyRows = body
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

initialize();
