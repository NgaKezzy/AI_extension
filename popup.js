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

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "START_ANALYSIS" });
    } catch (error) {
      if (!String(error).includes("Receiving end does not exist")) throw error;
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      response = await chrome.tabs.sendMessage(tab.id, { type: "START_ANALYSIS" });
    }

    if (!response?.ok) throw new Error(response?.error || "Không thể phân tích trang.");
    window.close();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    analyzeButton.disabled = false;
  }
});
