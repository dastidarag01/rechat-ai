// Simplified reChat AI Popup
class PopupController {
  constructor() {
    this.currentLLM = null;
    this.currentTab = null;
    this.formatter = new ConversationFormatter();
    this.isProcessing = false;
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.initializeUI();
  }

  setupEventListeners() {
    // Copy conversation button
    document.getElementById('copyConversationBtn').addEventListener('click', () => {
      this.handleCopyConversation();
    });

    // Move conversation button
    document.getElementById('moveConversationBtn').addEventListener('click', () => {
      this.toggleMoveDropdown();
    });

    // LLM selection options
    document.querySelectorAll('.llm-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const targetLLM = e.currentTarget.dataset.llm;
        this.handleMoveConversation(targetLLM);
      });
    });

    // Click outside to close dropdowns
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.move-section')) {
        this.closeMoveDropdown();
      }
    });
  }

  async initializeUI() {
    try {
      const tabInfo = await this.getCurrentTab();
      this.currentTab = tabInfo;
      
      if (tabInfo && tabInfo.llm) {
        this.currentLLM = tabInfo.llm;
        this.updateLLMIndicator(tabInfo.llm);
        this.enableActions();
      } else {
        this.updateLLMIndicator(null);
        this.disableActions();
      }
    } catch (error) {
      this.showNotification('Error initializing extension', 'error');
    }
  }

  async getCurrentTab() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getActiveTab' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          resolve(null);
        }
      });
    });
  }

  updateLLMIndicator(llm) {
    const indicator = document.getElementById('llmIndicator');
    const name = document.getElementById('llmName');
    
    if (llm) {
      const config = {
        'Claude': { icon: 'CL', class: 'claude', name: 'Claude' },
        'ChatGPT': { icon: 'GP', class: 'chatgpt', name: 'ChatGPT' },
        'Gemini': { icon: 'GM', class: 'gemini', name: 'Gemini' }
      };
      
      const llmConfig = config[llm];
      if (llmConfig) {
        indicator.textContent = llmConfig.icon;
        indicator.className = `llm-indicator ${llmConfig.class}`;
        name.textContent = llmConfig.name;
      }
    } else {
      indicator.textContent = '?';
      indicator.className = 'llm-indicator';
      name.textContent = 'No LLM detected';
    }
  }

  enableActions() {
    document.getElementById('copyConversationBtn').classList.remove('disabled');
    document.getElementById('moveConversationBtn').classList.remove('disabled');
    
    // Update LLM options to disable current LLM
    document.querySelectorAll('.llm-option').forEach(option => {
      const llm = option.dataset.llm;
      if (llm === this.currentLLM) {
        option.classList.add('disabled');
      } else {
        option.classList.remove('disabled');
      }
    });
  }

  disableActions() {
    document.getElementById('copyConversationBtn').classList.add('disabled');
    document.getElementById('moveConversationBtn').classList.add('disabled');
  }

  async handleCopyConversation() {
    if (this.isProcessing || !this.currentLLM) return;
    
    try {
      this.isProcessing = true;
      this.showLoading('Extracting conversation...');
      
      const conversationData = await this.extractConversation();
      
      if (!conversationData || !conversationData.messages || conversationData.messages.length === 0) {
        throw new Error('No conversation found on this page');
      }

      // Format and copy to clipboard
      const formatted = this.formatter.formatConversation(
        conversationData.messages,
        conversationData.source,
        'Clipboard'
      );
      
      await navigator.clipboard.writeText(formatted.formatted);
      this.showNotification(`Conversation copied! (${conversationData.messages.length} messages)`, 'success');
      
    } catch (error) {
      this.showNotification(error.message || 'Failed to copy conversation', 'error');
    } finally {
      this.isProcessing = false;
      this.hideLoading();
    }
  }

  async handleMoveConversation(targetLLM) {
    if (this.isProcessing || !this.currentLLM || targetLLM === this.currentLLM) return;
    
    try {
      this.isProcessing = true;
      this.showLoading('Moving conversation...');
      this.closeMoveDropdown();
      
      const conversationData = await this.extractConversation();
      
      if (!conversationData || !conversationData.messages || conversationData.messages.length === 0) {
        throw new Error('No conversation found on this page');
      }

      // Transfer conversation
      await this.transferConversation({
        sourceTab: this.currentTab.tabId,
        targetLLM,
        conversationData
      });

      this.showNotification(`Conversation moved to ${targetLLM}! (${conversationData.messages.length} messages)`, 'success');
      
      // Close popup after successful transfer
      setTimeout(() => window.close(), 2000);
      
    } catch (error) {
      this.showNotification(error.message || 'Failed to move conversation', 'error');
    } finally {
      this.isProcessing = false;
      this.hideLoading();
    }
  }

  async extractConversation() {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(this.currentTab.tabId, {
        action: 'extractConversation'
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Failed to extract conversation'));
        }
      });
    });
  }

  async transferConversation(data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'transferConversation',
        data
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Failed to transfer conversation'));
        }
      });
    });
  }

  toggleMoveDropdown() {
    const moveSection = document.querySelector('.move-section');
    moveSection.classList.toggle('expanded');
  }

  closeMoveDropdown() {
    const moveSection = document.querySelector('.move-section');
    moveSection.classList.remove('expanded');
  }

  showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('.loading-text');
    text.textContent = message;
    overlay.classList.add('visible');
  }

  hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('visible');
  }

  showNotification(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const icon = document.getElementById('toastIcon');
    const messageEl = document.getElementById('toastMessage');
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    icon.textContent = icons[type] || icons.info;
    messageEl.textContent = message;
    
    toast.className = `notification-toast toast-${type} visible`;
    
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
