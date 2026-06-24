const STORAGE_KEY = "os-dino-drill-quiz-v1";
const SYMBOLS = ["①", "②", "③", "④"];

const state = {
  chapters: [],
  chapterId: "",
  questionId: "",
  selectedChoiceId: "",
  submitted: false,
  order: "ordered",
  type: "all",
  filter: "all",
  search: "",
  progress: loadProgress(),
};

const elements = Object.fromEntries(
  [
    "chapterSelect",
    "orderSelect",
    "typeSelect",
    "searchInput",
    "chapterProgress",
    "visibleCount",
    "topicList",
    "questionIndex",
    "openIndexButton",
    "closeIndexButton",
    "indexBackdrop",
    "quizStage",
    "emptyState",
    "questionView",
    "questionPosition",
    "questionType",
    "difficultyBadge",
    "starButton",
    "topicTitle",
    "promptContent",
    "choiceList",
    "previousButton",
    "submitButton",
    "nextButton",
    "explanationPanel",
    "resultBanner",
    "selectedExplanation",
    "correctExplanationBlock",
    "correctExplanation",
    "otherExplanations",
    "summaryNote",
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

initialize();

async function initialize() {
  try {
    const response = await fetch("./data/quiz.json");
    if (!response.ok) throw new Error(`Quiz data could not be loaded (${response.status}).`);
    const data = await response.json();
    state.chapters = data.chapters || [];
    state.chapterId =
      state.progress.lastChapterId && state.chapters.some((chapter) => chapter.id === state.progress.lastChapterId)
        ? state.progress.lastChapterId
        : state.chapters[0]?.id || "";
    state.questionId =
      state.progress.lastByChapter[state.chapterId] || currentChapter()?.questions[0]?.id || "";
    bindEvents();
    render();
  } catch (error) {
    document.querySelector("#app").innerHTML = `
      <main class="fatal-error">
        <h1>객관식 데이터를 불러오지 못했습니다</h1>
        <p>${escapeHtml(error.message)}</p>
      </main>`;
  }
}

function bindEvents() {
  elements.chapterSelect.addEventListener("change", (event) => {
    state.chapterId = event.target.value;
    state.questionId =
      state.progress.lastByChapter[state.chapterId] || filteredQuestions()[0]?.id || "";
    resetQuestionView();
    persistLocation();
    render();
  });
  elements.orderSelect.addEventListener("change", (event) => {
    state.order = event.target.value;
    ensureCurrentQuestion();
    render();
  });
  elements.typeSelect.addEventListener("change", (event) => {
    state.type = event.target.value;
    ensureCurrentQuestion();
    render();
  });
  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    ensureCurrentQuestion();
    render();
  });
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      ensureCurrentQuestion();
      render();
    });
  });
  document.querySelectorAll("[data-topic-status]").forEach((button) => {
    button.addEventListener("click", () => setTopicStatus(button.dataset.topicStatus));
  });
  document.querySelectorAll("[data-mastery]").forEach((button) => {
    button.addEventListener("click", () => setMastery(button.dataset.mastery));
  });
  elements.starButton.addEventListener("click", toggleStar);
  elements.submitButton.addEventListener("click", submitAnswer);
  elements.previousButton.addEventListener("click", () => moveQuestion(-1));
  elements.nextButton.addEventListener("click", () => moveQuestion(1));
  elements.openIndexButton.addEventListener("click", () => toggleIndex(true));
  elements.closeIndexButton.addEventListener("click", () => toggleIndex(false));
  elements.indexBackdrop.addEventListener("click", () => toggleIndex(false));
  window.addEventListener("keydown", handleKeyboard, { capture: true });
  document.addEventListener("pointerup", clearPointerFocus);
}

function render() {
  renderControls();
  renderProgress();
  renderIndex();
  renderQuestion();
}

function renderControls() {
  elements.chapterSelect.innerHTML = state.chapters
    .map(
      (chapter) =>
        `<option value="${chapter.id}" ${chapter.id === state.chapterId ? "selected" : ""}>` +
        `${chapter.number}. ${escapeHtml(chapter.title)} (${chapter.questions.length})</option>`,
    )
    .join("");
  elements.orderSelect.value = state.order;
  elements.typeSelect.value = state.type;
  elements.searchInput.value = state.search;
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function renderProgress() {
  const questions = currentChapter()?.questions || [];
  const answered = questions.filter((question) => questionProgress(question.id).answered).length;
  const correct = questions.filter((question) => questionProgress(question.id).correct).length;
  const rate = answered ? Math.round((correct / answered) * 100) : 0;
  elements.chapterProgress.innerHTML = `
    <strong>${answered}<span> / ${questions.length}</span></strong>
    <small>정답률 ${rate}%</small>`;
}

function renderIndex() {
  const visible = filteredQuestions();
  const grouped = groupByTopic(visible);
  elements.visibleCount.textContent = `${visible.length}문항`;

  if (!visible.length) {
    elements.topicList.innerHTML = `<p class="index-empty">표시할 문제가 없습니다.</p>`;
    return;
  }

  elements.topicList.innerHTML = Array.from(grouped.entries())
    .map(([topic, questions]) => {
      const topicStatus = getTopicStatus(topic);
      return `
        <section class="topic-group topic-${topicStatus || "new"}">
          <button class="topic-heading" data-topic-jump="${escapeAttribute(questions[0].id)}" type="button">
            <span>${escapeHtml(topic)}</span>
            <small>${topicStatusLabel(topicStatus)}</small>
          </button>
          <div class="question-grid">
            ${questions.map(renderIndexButton).join("")}
          </div>
        </section>`;
    })
    .join("");

  elements.topicList.querySelectorAll("[data-question-id]").forEach((button) => {
    button.addEventListener("click", () => selectQuestion(button.dataset.questionId));
  });
  elements.topicList.querySelectorAll("[data-topic-jump]").forEach((button) => {
    button.addEventListener("click", () => selectQuestion(button.dataset.topicJump));
  });
}

function renderIndexButton(question) {
  const progress = questionProgress(question.id);
  const status = progress.answered ? (progress.correct ? "correct" : "wrong") : "new";
  const active = question.id === state.questionId ? "active" : "";
  const starred = progress.starred ? "starred" : "";
  return `
    <button class="question-index-button ${status} ${active} ${starred}"
      data-question-id="${question.id}" type="button" title="${escapeAttribute(question.number)}">
      ${escapeHtml(question.number.replace(/^Q/, ""))}
    </button>`;
}

function renderQuestion() {
  const question = currentQuestion();
  const hasQuestion = Boolean(question);
  elements.emptyState.hidden = hasQuestion;
  elements.questionView.hidden = !hasQuestion;
  if (!question) return;

  const questions = filteredQuestions();
  const questionIndex = questions.findIndex((item) => item.id === question.id);
  const positionLabel = questionIndex >= 0 ? `${questionIndex + 1}/${questions.length}` : "풀이 완료";
  const progress = questionProgress(question.id);
  const shuffled = orderedChoices(question);

  elements.questionPosition.textContent =
    `Chapter ${currentChapter().number} · ${question.number} · ${positionLabel}`;
  elements.questionType.textContent = question.type === "code" ? "CODE" : "CONCEPT";
  elements.questionType.dataset.type = question.type;
  elements.difficultyBadge.textContent = question.difficulty ? "★".repeat(question.difficulty) : "";
  elements.topicTitle.textContent = question.topic;
  elements.promptContent.innerHTML = renderMarkdown(question.prompt);
  elements.starButton.textContent = progress.starred ? "★" : "☆";
  elements.starButton.classList.toggle("active", Boolean(progress.starred));

  elements.choiceList.innerHTML = shuffled
    .map((choice, index) => renderChoice(question, choice, index))
    .join("");
  elements.choiceList.querySelectorAll("[data-choice-id]").forEach((button) => {
    button.addEventListener("click", () => chooseAnswer(button.dataset.choiceId));
  });

  elements.submitButton.disabled = !state.selectedChoiceId || state.submitted;
  elements.submitButton.textContent = state.submitted ? "채점 완료" : "정답 확인";
  elements.explanationPanel.hidden = !state.submitted;
  document.querySelectorAll("[data-topic-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.topicStatus === getTopicStatus(question.topic));
  });

  if (state.submitted) renderExplanation(question);
}

function renderChoice(question, choice, index) {
  const isSelected = choice.id === state.selectedChoiceId;
  const isCorrect = choice.id === question.correctChoiceId;
  let resultClass = "";
  if (state.submitted && isCorrect) resultClass = "correct";
  if (state.submitted && isSelected && !isCorrect) resultClass = "wrong";
  return `
    <button class="choice ${isSelected ? "selected" : ""} ${resultClass}"
      data-choice-id="${choice.id}" type="button" ${state.submitted ? "disabled" : ""}>
      <span class="choice-symbol">${SYMBOLS[index]}</span>
      <span class="choice-text">${renderInlineMarkdown(choice.text)}</span>
    </button>`;
}

function renderExplanation(question) {
  const selected = question.choices.find((choice) => choice.id === state.selectedChoiceId);
  const correct = question.choices.find((choice) => choice.id === question.correctChoiceId);
  const isCorrect = selected?.id === correct?.id;
  elements.resultBanner.className = `result-banner ${isCorrect ? "correct" : "wrong"}`;
  elements.resultBanner.innerHTML = isCorrect
    ? `<strong>정답입니다.</strong><span>핵심 설명까지 확인하고 다음 문제로 넘어가세요.</span>`
    : `<strong>오답입니다.</strong><span>선택한 답과 정답의 차이를 비교해보세요.</span>`;
  elements.selectedExplanation.innerHTML = renderMarkdown(selected?.explanation || "");
  elements.correctExplanationBlock.hidden = isCorrect;
  elements.correctExplanation.innerHTML = renderMarkdown(correct?.explanation || "");
  elements.otherExplanations.innerHTML = orderedChoices(question)
    .filter((choice) => choice.id !== selected?.id && choice.id !== correct?.id)
    .map(
      (choice) => `
        <div class="other-explanation">
          <strong>${escapeHtml(choice.text)}</strong>
          <div class="markdown-content">${renderMarkdown(choice.explanation)}</div>
        </div>`,
    )
    .join("");
  elements.summaryNote.innerHTML = `<span>한 줄 정리</span>${renderInlineMarkdown(question.summary)}`;
  const mastery = questionProgress(question.id).mastery || "";
  document.querySelectorAll("[data-mastery]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mastery === mastery);
  });
}

function chooseAnswer(choiceId) {
  if (state.submitted) return;
  state.selectedChoiceId = choiceId;
  renderQuestion();
}

function submitAnswer() {
  const question = currentQuestion();
  if (!question || !state.selectedChoiceId || state.submitted) return;
  state.submitted = true;
  const progress = questionProgress(question.id);
  progress.answered = true;
  progress.correct = state.selectedChoiceId === question.correctChoiceId;
  progress.attempts = (progress.attempts || 0) + 1;
  progress.lastChoiceId = state.selectedChoiceId;
  saveProgress();
  render();
  requestAnimationFrame(() => {
    elements.explanationPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function moveQuestion(direction) {
  const questions = filteredQuestions();
  if (!questions.length) return;
  const index = questions.findIndex((question) => question.id === state.questionId);
  let nextIndex;
  if (state.order === "random" && questions.length > 1 && direction > 0) {
    do nextIndex = Math.floor(Math.random() * questions.length);
    while (nextIndex === index);
  } else if (index < 0) {
    nextIndex = direction > 0 ? 0 : questions.length - 1;
  } else {
    nextIndex = (index + direction + questions.length) % questions.length;
  }
  selectQuestion(questions[nextIndex].id);
}

function selectQuestion(questionId) {
  state.questionId = questionId;
  resetQuestionView();
  persistLocation();
  render();
  toggleIndex(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetQuestionView() {
  state.selectedChoiceId = "";
  state.submitted = false;
}

function toggleStar() {
  const question = currentQuestion();
  if (!question) return;
  const progress = questionProgress(question.id);
  progress.starred = !progress.starred;
  saveProgress();
  render();
}

function setMastery(mastery) {
  const question = currentQuestion();
  if (!question || !state.submitted) return;
  questionProgress(question.id).mastery = mastery;
  saveProgress();
  render();
}

function setTopicStatus(status) {
  const question = currentQuestion();
  if (!question) return;
  const key = topicKey(question.topic);
  if (status) state.progress.topics[key] = status;
  else delete state.progress.topics[key];
  saveProgress();
  render();
}

function handleKeyboard(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;

  const handledKeys = [" ", "Spacebar", "Enter", "ArrowLeft", "ArrowRight"];
  if (handledKeys.includes(event.key) || /^[1-4]$/.test(event.key) || event.key.toLowerCase() === "s") {
    event.preventDefault();
    event.stopPropagation();
  }

  if (/^[1-4]$/.test(event.key) && !state.submitted) {
    const choice = orderedChoices(currentQuestion())[Number(event.key) - 1];
    if (choice) chooseAnswer(choice.id);
    return;
  }

  if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
    if (state.submitted) moveQuestion(1);
    else submitAnswer();
    return;
  }

  if (event.key === "ArrowLeft") {
    moveQuestion(-1);
    return;
  }
  if (event.key === "ArrowRight") {
    moveQuestion(1);
    return;
  }
  if (event.key.toLowerCase() === "s") toggleStar();
}

function isTypingTarget(target) {
  return target instanceof HTMLElement &&
    (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable);
}

function clearPointerFocus(event) {
  if (event.pointerType !== "mouse") return;
  const target = event.target;
  if (target instanceof HTMLButtonElement && document.activeElement === target) {
    target.blur();
  }
}

function filteredQuestions() {
  let questions = [...(currentChapter()?.questions || [])];
  if (state.type !== "all") questions = questions.filter((question) => question.type === state.type);
  if (state.filter === "unanswered") questions = questions.filter((question) => !questionProgress(question.id).answered);
  if (state.filter === "wrong") questions = questions.filter((question) => questionProgress(question.id).answered && !questionProgress(question.id).correct);
  if (state.filter === "starred") questions = questions.filter((question) => questionProgress(question.id).starred);
  if (state.search) {
    questions = questions.filter((question) =>
      `${question.prompt} ${question.topic} ${question.choices.map((choice) => choice.text).join(" ")}`
        .toLowerCase()
        .includes(state.search),
    );
  }
  if (state.order === "wrong-first") {
    questions.sort((a, b) => {
      const aProgress = questionProgress(a.id);
      const bProgress = questionProgress(b.id);
      const score = (progress) => (!progress.answered ? 1 : progress.correct ? 2 : 0);
      return score(aProgress) - score(bProgress);
    });
  }
  return questions;
}

function ensureCurrentQuestion() {
  const questions = filteredQuestions();
  if (!questions.some((question) => question.id === state.questionId)) {
    state.questionId = questions[0]?.id || "";
    resetQuestionView();
  }
}

function orderedChoices(question) {
  if (!question) return [];
  let order = state.progress.choiceOrders[question.id];
  const ids = question.choices.map((choice) => choice.id);
  if (!Array.isArray(order) || order.length !== ids.length || order.some((id) => !ids.includes(id))) {
    order = shuffle(ids);
    state.progress.choiceOrders[question.id] = order;
    saveProgress();
  }
  return order.map((id) => question.choices.find((choice) => choice.id === id));
}

function groupByTopic(questions) {
  const groups = new Map();
  questions.forEach((question) => {
    if (!groups.has(question.topic)) groups.set(question.topic, []);
    groups.get(question.topic).push(question);
  });
  return groups;
}

function currentChapter() {
  return state.chapters.find((chapter) => chapter.id === state.chapterId);
}

function currentQuestion() {
  return currentChapter()?.questions.find((question) => question.id === state.questionId);
}

function questionProgress(questionId) {
  if (!state.progress.questions[questionId]) state.progress.questions[questionId] = {};
  return state.progress.questions[questionId];
}

function topicKey(topic) {
  return `${state.chapterId}::${topic}`;
}

function getTopicStatus(topic) {
  return state.progress.topics[topicKey(topic)] || "";
}

function topicStatusLabel(status) {
  if (status === "done") return "완료";
  if (status === "review") return "복습";
  return "";
}

function persistLocation() {
  state.progress.lastChapterId = state.chapterId;
  state.progress.lastByChapter[state.chapterId] = state.questionId;
  saveProgress();
}

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      questions: parsed?.questions || {},
      topics: parsed?.topics || {},
      choiceOrders: parsed?.choiceOrders || {},
      lastByChapter: parsed?.lastByChapter || {},
      lastChapterId: parsed?.lastChapterId || "",
    };
  } catch {
    return { questions: {}, topics: {}, choiceOrders: {}, lastByChapter: {}, lastChapterId: "" };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function toggleIndex(open) {
  elements.questionIndex.classList.toggle("open", open);
  elements.indexBackdrop.classList.toggle("open", open);
}

function renderMarkdown(markdown) {
  const source = cleanText(markdown);
  const codeBlocks = [];
  let html = source.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, language, code) => {
    const token = `@@CODE${codeBlocks.length}@@`;
    codeBlocks.push(
      `<pre><div class="code-label">${escapeHtml(language.trim() || "code")}</div><code>${escapeHtml(code.trimEnd())}</code></pre>`,
    );
    return token;
  });
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      if (/^@@CODE\d+@@$/.test(block.trim())) return block.trim();
      return `<p>${renderInlineMarkdown(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
  codeBlocks.forEach((block, index) => {
    html = html.replace(`@@CODE${index}@@`, block);
  });
  return html;
}

function renderInlineMarkdown(value) {
  let html = escapeHtml(cleanText(value));
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

function cleanText(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
