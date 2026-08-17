const apiKeyInput = document.querySelector("#apiKey");
const modelInput = document.querySelector("#model");
const status = document.querySelector("#status");
const refreshButton = document.querySelector("#refreshModels");
const toggleKeyButton = document.querySelector("#toggleKey");
let inputTimer;
let loadSequence = 0;

toggleKeyButton.addEventListener("click", () => {
  const reveal = apiKeyInput.type === "password";
  apiKeyInput.type = reveal ? "text" : "password";
  toggleKeyButton.textContent = reveal ? "Ẩn" : "Hiện";
  toggleKeyButton.setAttribute("aria-label", reveal ? "Ẩn API key" : "Hiện API key");
  toggleKeyButton.title = reveal ? "Ẩn API key" : "Hiện API key";
});

document.addEventListener("DOMContentLoaded", async () => {
  const saved = await chrome.storage.local.get(["geminiApiKey", "geminiModel"]);
  apiKeyInput.value = saved.geminiApiKey || "";
  if (!saved.geminiApiKey) {
    resetModelPicker("Nhập API key để tải model");
    return;
  }
  await loadAndSelectBestModel(saved.geminiApiKey, true);
});

apiKeyInput.addEventListener("input", () => {
  clearTimeout(inputTimer);
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    loadSequence += 1;
    resetModelPicker("Nhập API key để tải model");
    status.textContent = "";
    return;
  }
  resetModelPicker("Đang chờ bạn nhập xong…");
  status.textContent = "Sẽ tự động kiểm tra API key và tải model…";
  inputTimer = setTimeout(() => loadAndSelectBestModel(apiKey, true), 800);
});

refreshButton.addEventListener("click", () => {
  loadAndSelectBestModel(apiKeyInput.value.trim(), true);
});

modelInput.addEventListener("change", async () => {
  const geminiApiKey = apiKeyInput.value.trim();
  const geminiModel = modelInput.value;
  if (!geminiApiKey || !geminiModel) return;
  await chrome.storage.local.set({ geminiApiKey, geminiModel });
  status.textContent = `Đã chuyển sang ${geminiModel}.`;
});

async function loadAndSelectBestModel(apiKey, autoSave) {
  if (!apiKey) {
    resetModelPicker("Nhập API key để tải model");
    status.textContent = "Hãy nhập API key.";
    return;
  }
  const sequence = ++loadSequence;
  refreshButton.disabled = true;
  modelInput.disabled = true;
  status.textContent = "Đang kiểm tra API key và tải model…";
  try {
    const response = await chrome.runtime.sendMessage({ type: "LIST_GEMINI_MODELS", apiKey });
    if (sequence !== loadSequence) return;
    if (!response?.ok) throw new Error(response?.error || "Không thể tải danh sách model.");
    const models = response.models.filter(isSuitableTextModel);
    if (!models.length) throw new Error("API key này không có model Gemini phù hợp để phân tích văn bản.");
    const best = [...models].sort((a, b) => modelScore(b) - modelScore(a))[0];
    setModels(models, best.id);
    if (autoSave) {
      await chrome.storage.local.set({ geminiApiKey: apiKey, geminiModel: best.id });
      await chrome.storage.local.remove(["openaiApiKey", "openaiModel"]);
    }
    status.textContent = `Đã tự chọn model mạnh và mới nhất: ${best.label} (${best.id}).`;
  } catch (error) {
    if (sequence !== loadSequence) return;
    resetModelPicker("Không tải được model");
    status.textContent = error.message;
  } finally {
    if (sequence === loadSequence) refreshButton.disabled = !apiKeyInput.value.trim();
  }
}

function isSuitableTextModel(model) {
  const value = `${model.id} ${model.label}`.toLowerCase();
  return value.includes("gemini") &&
    !/(embedding|embed|image|imagen|tts|audio|live|robotics|computer.use|aqa)/.test(value);
}

function modelScore(model) {
  const value = `${model.id} ${model.label}`.toLowerCase();
  let score = 0;
  if (/\bpro\b/.test(value)) score += 100000;
  else if (/flash(?![- ]lite)/.test(value)) score += 60000;
  else if (/flash[- ]lite/.test(value)) score += 40000;
  const version = value.match(/gemini[- ]?(\d+)(?:\.(\d+))?/);
  if (version) score += (Number(version[1]) * 100 + Number(version[2] || 0)) * 100;
  if (!/(preview|experimental|exp)/.test(value)) score += 1000;
  if (/latest/.test(value)) score += 100;
  return score;
}

function setModels(models, selectedId) {
  const sorted = [...models].sort((a, b) => modelScore(b) - modelScore(a));
  modelInput.replaceChildren(...sorted.map((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label === model.id ? model.id : `${model.label} — ${model.id}`;
    return option;
  }));
  modelInput.value = selectedId;
  modelInput.disabled = false;
}

function resetModelPicker(label) {
  const option = document.createElement("option");
  option.value = "";
  option.textContent = label;
  modelInput.replaceChildren(option);
  modelInput.disabled = true;
  refreshButton.disabled = !apiKeyInput.value.trim();
}

document.querySelector("#save").addEventListener("click", async () => {
  const geminiApiKey = apiKeyInput.value.trim();
  const geminiModel = modelInput.value;
  if (!geminiApiKey) {
    status.textContent = "Hãy nhập API key.";
    return;
  }
  if (!geminiModel) {
    await loadAndSelectBestModel(geminiApiKey, true);
    return;
  }
  await chrome.storage.local.set({ geminiApiKey, geminiModel });
  status.textContent = "Đã lưu API key và model.";
});

document.querySelector("#clear").addEventListener("click", async () => {
  clearTimeout(inputTimer);
  loadSequence += 1;
  await chrome.storage.local.remove(["geminiApiKey", "geminiModel"]);
  apiKeyInput.value = "";
  resetModelPicker("Nhập API key để tải model");
  status.textContent = "Đã xóa API key và model.";
});
