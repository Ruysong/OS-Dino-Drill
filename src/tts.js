const STORAGE_KEY = "os-dino-drill-tts-v1";

const DEFAULT_SETTINGS = {
  voiceURI: "",
  rate: 0.95,
  pitch: 1,
  volume: 1,
  autoRead: false,
};

const TEST_TEXT =
  "Operating systems manage resources and provide a convenient environment for programs.";

export function createTtsController({ getCurrentQuestion, getOrderedChoices }) {
  const elements = Object.fromEntries(
    [
      "readQuestionButton",
      "readChoicesButton",
      "voiceSettingsButton",
      "voiceModal",
      "voiceCloseButton",
      "voiceDoneButton",
      "voiceSelect",
      "rateInput",
      "pitchInput",
      "volumeInput",
      "rateValue",
      "pitchValue",
      "volumeValue",
      "autoReadInput",
      "testVoiceButton",
      "ttsSupportMessage",
    ].map((id) => [id, document.querySelector(`#${id}`)]),
  );

  const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  let settings = loadSettings();
  let voices = [];
  let speaking = false;
  let lastMode = "question";

  function initialize() {
    bindEvents();
    renderSettings();
    setSupportState();
    loadVoices();
    if (supported) window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
  }

  function bindEvents() {
    elements.readQuestionButton?.addEventListener("click", () => toggleQuestion());
    elements.readChoicesButton?.addEventListener("click", () => speakCurrent(true));
    elements.voiceSettingsButton?.addEventListener("click", () => openSettings());
    elements.voiceCloseButton?.addEventListener("click", () => closeSettings());
    elements.voiceDoneButton?.addEventListener("click", () => closeSettings());
    elements.voiceModal?.addEventListener("click", (event) => {
      if (event.target === elements.voiceModal) closeSettings();
    });
    elements.testVoiceButton?.addEventListener("click", () => speakText(TEST_TEXT, "test"));

    elements.voiceSelect?.addEventListener("change", () => {
      settings.voiceURI = elements.voiceSelect.value;
      saveSettings();
    });
    elements.rateInput?.addEventListener("input", () => updateNumberSetting("rate"));
    elements.pitchInput?.addEventListener("input", () => updateNumberSetting("pitch"));
    elements.volumeInput?.addEventListener("input", () => updateNumberSetting("volume"));
    elements.autoReadInput?.addEventListener("change", () => {
      settings.autoRead = elements.autoReadInput.checked;
      saveSettings();
    });
  }

  function toggleQuestion() {
    if (speaking) {
      stop();
      return;
    }
    speakCurrent(false);
  }

  function speakCurrent(includeChoices = false) {
    const question = getCurrentQuestion();
    if (!question) return;
    const text = composeQuestionText(question, includeChoices);
    speakText(text, includeChoices ? "choices" : "question");
  }

  function speakText(text, mode = "question") {
    if (!supported || !text.trim()) return;
    stop();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = selectedVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || "en-US";
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    utterance.onstart = () => {
      speaking = true;
      lastMode = mode;
      renderButtons();
    };
    utterance.onend = clearSpeaking;
    utterance.onerror = clearSpeaking;
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    clearSpeaking();
  }

  function clearSpeaking() {
    speaking = false;
    renderButtons();
  }

  function handleQuestionChange() {
    stop();
    if (settings.autoRead) window.setTimeout(() => speakCurrent(false), 120);
  }

  function handleKeyboard(event) {
    if (event.key.toLowerCase() !== "r") return false;
    if (event.shiftKey) speakCurrent(true);
    else toggleQuestion();
    return true;
  }

  function composeQuestionText(question, includeChoices) {
    const parts = [`${question.number}.`, textForSpeech(question.prompt)];
    if (includeChoices) {
      getOrderedChoices(question).forEach((choice, index) => {
        parts.push(`Option ${index + 1}. ${textForSpeech(choice.text)}`);
      });
    }
    return parts.filter(Boolean).join("\n\n");
  }

  function textForSpeech(value) {
    return String(value || "")
      .replace(/```[\s\S]*?```/g, " Code block. ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/[①②③④]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function loadVoices() {
    if (!supported) return;
    voices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
      .sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name));
    if (!settings.voiceURI && voices[0]) {
      settings.voiceURI = voices[0].voiceURI;
      saveSettings();
    }
    renderVoiceOptions();
  }

  function scoreVoice(voice) {
    const name = voice.name.toLowerCase();
    let score = 0;
    if (name.includes("online") || name.includes("natural")) score += 3;
    if (name.includes("microsoft")) score += 2;
    if (voice.lang.toLowerCase() === "en-us") score += 1;
    return score;
  }

  function selectedVoice() {
    return voices.find((voice) => voice.voiceURI === settings.voiceURI) || voices[0] || null;
  }

  function openSettings() {
    if (!elements.voiceModal) return;
    elements.voiceModal.hidden = false;
    elements.voiceSelect?.focus();
  }

  function closeSettings() {
    if (elements.voiceModal) elements.voiceModal.hidden = true;
  }

  function updateNumberSetting(key) {
    const input = elements[`${key}Input`];
    settings[key] = Number(input.value);
    saveSettings();
    renderSettings();
  }

  function renderSettings() {
    if (elements.rateInput) elements.rateInput.value = settings.rate;
    if (elements.pitchInput) elements.pitchInput.value = settings.pitch;
    if (elements.volumeInput) elements.volumeInput.value = settings.volume;
    if (elements.rateValue) elements.rateValue.textContent = settings.rate.toFixed(2);
    if (elements.pitchValue) elements.pitchValue.textContent = settings.pitch.toFixed(2);
    if (elements.volumeValue) elements.volumeValue.textContent = `${Math.round(settings.volume * 100)}%`;
    if (elements.autoReadInput) elements.autoReadInput.checked = settings.autoRead;
    renderButtons();
  }

  function renderVoiceOptions() {
    if (!elements.voiceSelect) return;
    if (!supported) {
      elements.voiceSelect.innerHTML = `<option>Speech is not supported</option>`;
      return;
    }
    if (!voices.length) {
      elements.voiceSelect.innerHTML = `<option>Loading English voices...</option>`;
      return;
    }
    elements.voiceSelect.innerHTML = voices
      .map(
        (voice) =>
          `<option value="${escapeAttribute(voice.voiceURI)}" ${voice.voiceURI === settings.voiceURI ? "selected" : ""}>` +
          `${escapeHtml(voice.name)} (${escapeHtml(voice.lang)})</option>`,
      )
      .join("");
  }

  function renderButtons() {
    if (elements.readQuestionButton) {
      elements.readQuestionButton.textContent = speaking ? "Stop" : "Read";
      elements.readQuestionButton.classList.toggle("active", speaking && lastMode !== "choices");
      elements.readQuestionButton.disabled = !supported;
    }
    if (elements.readChoicesButton) {
      elements.readChoicesButton.classList.toggle("active", speaking && lastMode === "choices");
      elements.readChoicesButton.disabled = !supported;
    }
    if (elements.testVoiceButton) elements.testVoiceButton.disabled = !supported;
  }

  function setSupportState() {
    if (!elements.ttsSupportMessage) return;
    elements.ttsSupportMessage.textContent = supported
      ? "Choose an English voice, then test speed, pitch, and volume."
      : "This browser does not expose text-to-speech voices.";
  }

  function loadSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
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

  return {
    initialize,
    stop,
    handleQuestionChange,
    handleKeyboard,
  };
}
