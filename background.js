const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LIST_GEMINI_MODELS") {
    listGeminiModels(message.apiKey)
      .then((models) => sendResponse({ ok: true, models }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type !== "ANALYZE_QUESTIONS") return;

  analyzeQuestions(message.questions)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function listGeminiModels(providedApiKey) {
  const stored = await chrome.storage.local.get("geminiApiKey");
  const apiKey = providedApiKey?.trim() || stored.geminiApiKey;
  if (!apiKey) throw new Error("Hãy nhập Gemini API key trước.");

  const response = await fetch(`${GEMINI_BASE_URL}?pageSize=1000`, {
    headers: { "x-goog-api-key": apiKey }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || `Không thể tải danh sách model (${response.status}).`;
    throw new Error(friendlyGeminiError(detail, response.status));
  }

  return (payload.models || [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => ({
      id: String(model.name || "").replace(/^models\//, ""),
      label: model.displayName || model.name
    }))
    .filter((model) => model.id)
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function analyzeQuestions(questions, attemptedModels = new Set()) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Không tìm thấy câu hỏi nào trên trang.");
  }

  const { geminiApiKey, geminiModel } =
    await chrome.storage.local.get(["geminiApiKey", "geminiModel"]);

  if (!geminiApiKey) {
    throw new Error("Bạn chưa cấu hình Gemini API key. Hãy mở Cài đặt của extension.");
  }

  if (!geminiModel) {
    throw new Error("Chưa chọn model. Hãy mở Cài đặt để extension tự tải model phù hợp.");
  }

  const resolvedModel = await resolveModelId(geminiModel, geminiApiKey);
  attemptedModels.add(resolvedModel);
  const model = encodeURIComponent(resolvedModel);
  const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiApiKey
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: [
          "Bạn là trợ giảng tiếng Việt.",
          "Hãy giải từng câu hỏi dựa trên nội dung được cung cấp.",
          "Các lựa chọn được đánh thứ tự A, B, C, D, E theo đúng thứ tự trong mảng choices.",
          "Chỉ trả lời mỗi câu trên một dòng theo mẫu: Câu 1: B.",
          "Không chép lại đáp án, không giải thích, không dùng Markdown và không thêm lời mở đầu hay kết luận.",
          "Nếu thiếu dữ kiện hoặc không xác định được, ghi: Câu 1: Không chắc chắn."
        ].join(" ") }]
      },
      contents: [{
        role: "user",
        parts: [{ text: JSON.stringify(questions, null, 2) }]
      }],
      generationConfig: {
        temperature: 0.2
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || `Gemini API trả về lỗi ${response.status}.`;
    const quotaExceeded = response.status === 429 || /quota exceeded|rate limit/i.test(detail);
    if (quotaExceeded && attemptedModels.size < 3) {
      const models = await listGeminiModels(geminiApiKey).catch(() => []);
      const fallback = findQuotaFallback(models, attemptedModels);
      if (fallback) {
        await chrome.storage.local.set({ geminiModel: fallback.id });
        return analyzeQuestions(questions, attemptedModels);
      }
    }
    if (quotaExceeded) {
      throw new Error("Gemini đã hết quota cho các model khả dụng. Hãy chờ hết thời gian giới hạn, dùng API key khác hoặc bật thanh toán trong Google AI Studio.");
    }
    throw new Error(friendlyGeminiError(detail, response.status));
  }

  const text = extractGeminiText(payload);
  if (!text) throw new Error("API không trả về nội dung có thể hiển thị.");
  return text;
}

function friendlyGeminiError(detail, status) {
  if (/project has been denied access/i.test(detail)) {
    return "Dự án Google của API key này đã bị từ chối truy cập Gemini. Hãy tạo API key bằng tài khoản Google cá nhân trong một project mới tại Google AI Studio; nếu vẫn lỗi, chủ tài khoản cần liên hệ Google Support. Tài khoản trường học/cơ quan có thể bị quản trị viên giới hạn.";
  }
  if (/api key not valid|invalid api key/i.test(detail)) {
    return "Gemini API key không hợp lệ. Hãy tạo key mới trong Google AI Studio và dán lại toàn bộ key.";
  }
  if (status === 403 || /permission denied|permission_denied/i.test(detail)) {
    return "API key không có quyền sử dụng Gemini API. Hãy kiểm tra project, điều khoản sử dụng, giới hạn API key hoặc thử project mới trong Google AI Studio.";
  }
  return detail;
}

function findQuotaFallback(models, attemptedModels) {
  return models
    .filter((model) => {
      const value = `${model.id} ${model.label}`.toLowerCase();
      return value.includes("flash") &&
        !/(image|imagen|tts|audio|live)/.test(value) &&
        !attemptedModels.has(model.id);
    })
    .sort((a, b) => fallbackScore(b) - fallbackScore(a))[0];
}

function fallbackScore(model) {
  const value = `${model.id} ${model.label}`.toLowerCase();
  let score = /flash[- ]lite/.test(value) ? 10000 : 20000;
  const version = value.match(/gemini[- ]?(\d+)(?:\.(\d+))?/);
  if (version) score += Number(version[1]) * 100 + Number(version[2] || 0);
  if (!/(preview|experimental|exp)/.test(value)) score += 1000;
  return score;
}

async function resolveModelId(configuredModel, apiKey) {
  if (configuredModel !== "gemini-3.7-flash") return configuredModel;
  try {
    const models = await listGeminiModels(apiKey);
    const match = models.find((model) => {
      const value = `${model.id} ${model.label}`.toLowerCase();
      return value.includes("3.7") && value.includes("flash");
    });
    return match?.id || configuredModel;
  } catch {
    return configuredModel;
  }
}

function extractGeminiText(payload) {
  return (payload.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .filter((part) => typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}
