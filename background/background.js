// Background service worker for reChat AI extension
class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    this.setupMessageHandlers();
    this.setupTabHandlers();
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'getActiveTab':
          this.getActiveTab()
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

        case 'transferConversation':
          this.transferConversation(request.data)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
  }

  setupTabHandlers() {
    // Tab handlers removed - no longer needed since we don't show badges
  }

  detectLLMFromURL(url) {
    if (!url) return null;

    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('claude.ai')) {
      return 'Claude';
    } else if (urlLower.includes('chatgpt.com') || urlLower.includes('chat.openai.com')) {
      return 'ChatGPT';
    } else if (urlLower.includes('gemini.google.com') || urlLower.includes('bard.google.com')) {
      return 'Gemini';
    }
    
    return null;
  }

  async getActiveTab() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (tabs.length > 0) {
          const tab = tabs[0];
          const llmType = this.detectLLMFromURL(tab.url);
          resolve({
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            llm: llmType
          });
        } else {
          reject(new Error('No active tab found'));
        }
      });
    });
  }

  async transferConversation(data) {
    const { targetLLM, conversationData } = data;

    try {
      const newTab = await this.openLLMTab(targetLLM);
      await this.waitForTabLoad(newTab.tabId);
      await this.injectConversation(newTab.tabId, {
        ...conversationData,
        target: targetLLM
      });

      return {
        success: true,
        targetTab: newTab.tabId,
        targetLLM,
        messageCount: conversationData.messages?.length || 0
      };
    } catch (error) {
      throw error;
    }
  }

  async openLLMTab(targetLLM) {
    const urls = {
      'Claude': 'https://claude.ai/chat',
      'ChatGPT': 'https://chatgpt.com',
      'Gemini': 'https://gemini.google.com/app'
    };
    
    const targetUrl = urls[targetLLM];
    if (!targetUrl) {
      throw new Error(`Unknown target LLM: ${targetLLM}`);
    }

    const tab = await chrome.tabs.create({
      url: targetUrl,
      active: true
    });

    return {
      tabId: tab.id,
      url: tab.url,
      targetLLM
    };
  }

  async waitForTabLoad(tabId, maxWait = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkTab = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (tab.status === 'complete') {
            setTimeout(resolve, 1000);
          } else if (Date.now() - startTime > maxWait) {
            reject(new Error('Tab load timeout'));
          } else {
            setTimeout(checkTab, 100);
          }
        });
      };

      checkTab();
    });
  }

  async injectConversation(tabId, conversationData) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, {
        action: 'pasteConversation',
        data: conversationData
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Failed to inject conversation'));
        }
      });
    });
  }

}

// Initialize background service
new BackgroundService();
