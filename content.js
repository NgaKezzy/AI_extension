(() => {
  if (globalThis.__aiStudyHelperLoaded) return;
  globalThis.__aiStudyHelperLoaded = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "START_ANALYSIS") return;

    const questions = extractQuestions();
    if (!questions.length) {
      showPanel("Không tìm thấy câu hỏi", "Hãy mở trang có câu hỏi và thử lại.", false);
      sendResponse({ ok: false, error: "Không tìm thấy câu hỏi trên trang." });
      return;
    }

    showPanel("AI đang phân tích…", `Đã tìm thấy ${questions.length} câu hỏi.`, true);
    chrome.runtime.sendMessage({ type: "ANALYZE_QUESTIONS", questions }, (response) => {
      if (chrome.runtime.lastError) {
        showPanel("Có lỗi xảy ra", chrome.runtime.lastError.message, false);
        return;
      }
      if (!response?.ok) {
        showPanel("Có lỗi xảy ra", response?.error || "Không nhận được phản hồi.", false);
        return;
      }
      showPanel("Gợi ý từ AI", response.result, false);
    });

    sendResponse({ ok: true, count: questions.length });
  });

  function extractQuestions() {
    const canvas = extractCanvasQuestions();
    if (canvas.length) return canvas;
    return extractGenericQuestions();
  }

  function extractCanvasQuestions() {
    const nodes = document.querySelectorAll(".question, [data-question-id], .quiz_sortable");
    return uniqueQuestions([...nodes].map((node, index) => {
      const promptNode = node.querySelector(".question_text, .question-text, legend, h2, h3");
      const choices = [...node.querySelectorAll(".answer, .answer_label, label")]
        .map(cleanText)
        .filter(Boolean);
      const prompt = cleanText(promptNode) || cleanText(node);
      return { number: index + 1, prompt: stripChoices(prompt, choices), choices };
    }));
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
