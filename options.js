const apiKeyInput = document.querySelector("#apiKey");
const modelInput = document.querySelector("#model");
const status = document.querySelector("#status");
let savedModel = "gemini-3.7-flash";

document.addEventListener("DOMContentLoaded", async () => {
  const saved = await chrome.storage.local.get(["geminiApiKey", "geminiModel"]);
  apiKeyInput.value = saved.geminiApiKey || "";
  savedModel = saved.geminiModel || "gemini-3.7-flash";
  setModels([], savedModel);
});

document.querySelector("#refreshModels").addEventListener("click", async () => {
  const button = document.querySelector("#refreshModels");
  button.disabled = true;
  status.textContent = "Đang tải danh sách model từ Gemini API…";
  try {
    const response = await chrome.runtime.sendMessage({
      type: "LIST_GEMINI_MODELS",
      apiKey: apiKeyInput.value.trim()
    });
    if (!response?.ok) throw new Error(response?.error || "Không thể tải danh sách model.");
    if (!response.models.length) throw new Error("API key này không có model hỗ trợ generateContent.");
    setModels(response.models, modelInput.value || savedModel);
    status.textContent = `Đã tìm thấy ${response.models.length} model khả dụng.`;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

function setModels(models, selectedId) {
  const list = [...models];
  if (selectedId && !list.some((model) => model.id === selectedId)) {
    list.unshift({ id: selectedId, label: `${selectedId} (đã lưu)` });
  }
  modelInput.replaceChildren(...list.map((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label === model.id ? model.id : `${model.label} — ${model.id}`;
    return option;
  }));
  modelInput.value = selectedId || list[0]?.id || "";
}

document.querySelector("#save").addEventListener("click", async () => {
  const geminiApiKey = apiKeyInput.value.trim();
  const geminiModel = modelInput.value.trim() || "gemini-3.7-flash";
  if (!geminiApiKey) {
    status.textContent = "Hãy nhập API key.";
    return;
  }
  await chrome.storage.local.set({ geminiApiKey, geminiModel });
  await chrome.storage.local.remove(["openaiApiKey", "openaiModel"]);
  status.textContent = "Đã lưu cài đặt.";
});

document.querySelector("#clear").addEventListener("click", async () => {
  await chrome.storage.local.remove("geminiApiKey");
  apiKeyInput.value = "";
  status.textContent = "Đã xóa API key.";
});
