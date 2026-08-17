const analyzeButton = document.querySelector("#analyze");
const settingsButton = document.querySelector("#settings");
const status = document.querySelector("#status");

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
