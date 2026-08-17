(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "START_ANALYSIS") return;
    if (!chrome.runtime?.id) return;

    const questions = extractQuestions();
    if (!questions.length) {
      showPanel("Không tìm thấy câu hỏi", "Hãy mở trang có câu hỏi và thử lại.", false);
      sendResponse({ ok: false, error: "Không tìm thấy câu hỏi trên trang." });
      return;
    }

    showPanel("AI đang phân tích…", `Đã tìm thấy ${questions.length} câu hỏi.`, true);
    sendToBackgroundWithRetry({ type: "ANALYZE_QUESTIONS", questions })
      .then((response) => {
        if (!response?.ok) throw new Error(response?.error || "Không nhận được phản hồi.");
        highlightSuggestedAnswers(response.result);
        showPanel("Gợi ý từ AI", response.result, false);
      })
      .catch((error) => {
        const invalidated = /context invalidated/i.test(error.message);
        const message = invalidated
          ? "Extension vừa được cập nhật. Hãy tải lại trang một lần rồi phân tích lại."
          : error.message;
        showPanel("Có lỗi xảy ra", message, false);
      });

    sendResponse({ ok: true, count: questions.length });
  });

  async function sendToBackgroundWithRetry(message, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await chrome.runtime.sendMessage(message);
      } catch (error) {
        lastError = error;
        const retryable = /receiving end does not exist|could not establish connection/i.test(error.message);
        if (!retryable || attempt === attempts) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 150));
      }
    }
    throw lastError || new Error("Không thể kết nối với extension.");
  }

  function extractQuestions() {
    const canvas = extractCanvasQuestions();
    if (canvas.length) return canvas;
    return extractGenericQuestions();
  }

  function extractCanvasQuestions() {
    const nodes = getCanvasQuestionNodes();
    return uniqueQuestions([...nodes].map((node, index) => {
      const promptNode = node.querySelector(".question_text, .question-text, legend, h2, h3");
      const choices = [...node.querySelectorAll(".answer, .answer_label, label")]
        .map(cleanText)
        .filter(Boolean);
      const prompt = cleanText(promptNode) || cleanText(node);
      return { number: index + 1, prompt: stripChoices(prompt, choices), choices };
    }));
  }

  function getCanvasQuestionNodes() {
    const exact = document.querySelectorAll(".display_question.question");
    if (exact.length) return exact;
    return document.querySelectorAll("[data-question-id], .quiz_sortable.question_holder, .question");
  }

  function highlightSuggestedAnswers(result) {
    clearSuggestedAnswers();
    const suggestions = new Map();
    const pattern = /Câu\s*(\d+)\s*:\s*([A-E])/giu;
    for (const match of result.matchAll(pattern)) {
      suggestions.set(Number(match[1]), match[2].toUpperCase());
    }

    const nodes = [...getCanvasQuestionNodes()];
    nodes.forEach((node, index) => {
      const letter = suggestions.get(index + 1);
      if (!letter) return;

      const answerIndex = letter.charCodeAt(0) - 65;
      const answers = [...node.querySelectorAll(".answers .answer")];
      const answer = answers[answerIndex];
      if (!answer) return;

      answer.classList.add("ai-study-helper-suggested");
      const header = node.querySelector(".header") || node;
      const badge = document.createElement("span");
      badge.className = "ai-study-helper-badge";
      badge.textContent = `AI đề xuất: ${letter}`;
      header.appendChild(badge);
    });
  }

  function clearSuggestedAnswers() {
    document.querySelectorAll(".ai-study-helper-suggested")
      .forEach((node) => node.classList.remove("ai-study-helper-suggested"));
    document.querySelectorAll(".ai-study-helper-badge")
      .forEach((node) => node.remove());
  }

  function extractGenericQuestions() {
    const groups = [...document.querySelectorAll("fieldset")];
    if (groups.length) {
      return uniqueQuestions(groups.map((node, index) => {
        const choices = [...node.querySelectorAll("label")].map(cleanText).filter(Boolean);
        return {
          number: index + 1,
          prompt: cleanText(node.querySelector("legend")) || stripChoices(cleanText(node), choices),
          choices
        };
      }));
    }

    const pageText = cleanText(document.querySelector("main, [role='main'], body"));
    return pageText ? [{ number: 1, prompt: pageText.slice(0, 12000), choices: [] }] : [];
  }

  function uniqueQuestions(items) {
    const seen = new Set();
    return items.filter((item) => {
      item.prompt = item.prompt.trim().slice(0, 8000);
      item.choices = [...new Set(item.choices)].slice(0, 20);
      if (!item.prompt || seen.has(item.prompt)) return false;
      seen.add(item.prompt);
      return true;
    }).slice(0, 30).map((item, index) => ({ ...item, number: index + 1 }));
  }

  function stripChoices(prompt, choices) {
    let result = prompt;
    for (const choice of choices) result = result.replace(choice, " ");
    return result.replace(/\s+/g, " ").trim();
  }

  function cleanText(node) {
    return (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function showPanel(title, body, loading) {
    let panel = document.querySelector("#ai-study-helper-panel");
    if (!panel) {
      panel = document.createElement("aside");
      panel.id = "ai-study-helper-panel";
      panel.innerHTML = `
        <header><strong></strong><button type="button" aria-label="Đóng">×</button></header>
        <div class="ai-study-helper-body"></div>`;
      panel.querySelector("button").addEventListener("click", () => panel.remove());
      document.documentElement.appendChild(panel);
    }
    panel.querySelector("strong").textContent = title;
    const bodyNode = panel.querySelector(".ai-study-helper-body");
    bodyNode.textContent = body;
    bodyNode.classList.toggle("loading", loading);
  }
})();
