const analyzeButton = document.querySelector("#analyze");
const settingsButton = document.querySelector("#settings");
const status = document.querySelector("#status");
const apiState = document.querySelector("#apiState");

document.addEventListener("DOMContentLoaded", async () => {
  const { geminiApiKey, geminiModel } = await chrome.storage.local.get(["geminiApiKey", "geminiModel"]);
  if (geminiApiKey && geminiModel) {
    apiState.className = "api-state ready";
    apiState.lastElementChild.textContent = `Sẵn sàng · ${geminiModel}`;
    analyzeButton.disabled = false;
    return;
  }
  apiState.className = "api-state missing";
  apiState.lastElementChild.textContent = "Chưa cấu hình Gemini API";
});

settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());

analyzeButton.addEventListener("click", async () => {
  analyzeButton.disabled = true;
  status.textContent = "Đang đọc câu hỏi…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Không tìm thấy tab đang mở.");

    const response = await sendToTabWithRecovery(tab.id);

    if (!response?.ok) throw new Error(response?.error || "Không thể phân tích trang.");
    window.close();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    analyzeButton.disabled = false;
  }
});

async function sendToTabWithRecovery(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "START_ANALYSIS" });
  } catch (error) {
    const disconnected = /Receiving end does not exist|Could not establish connection/i.test(error.message);
    if (!disconnected) throw error;
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return chrome.tabs.sendMessage(tabId, { type: "START_ANALYSIS" });
  }
}
