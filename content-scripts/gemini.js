class GeminiExtractor {
  constructor() {
    this.config = LLM_CONFIG.GEMINI;
    this.formatter = new ConversationFormatter();
    this.isInjected = false;
  }

  init() {
    if (this.isInjected) return;
    
    this.setupMessageListener();
    this.isInjected = true;
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'extractConversation') {
        this.extractConversation()
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      }
      
      if (request.action === 'pasteConversation') {
        this.pasteConversation(request.data)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      }
    });
  }

  async extractConversation() {
    try {
      const messages = await this.parseMessages();
      
      if (messages.length === 0) {
        throw new Error('No conversation found on this page');
      }

      return {
        messages,
        source: 'Gemini',
        url: window.location.href,
        title: this.getConversationTitle(),
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  async parseMessages() {
    const messages = [];
    await this.waitForContent();
    
    const messageContainers = this.findMessageContainers();
    
    console.log(`[Gemini] Found ${messageContainers.length} message containers`);
    
    if (messageContainers.length === 0) {
      console.log('[Gemini] No message containers found, trying fallback selectors');
      // Try fallback approach
      const fallbackContainers = document.querySelectorAll('div[data-test-render-count] > div');
      console.log(`[Gemini] Fallback found ${fallbackContainers.length} containers`);
      return messages;
    }

    messageContainers.forEach((container, index) => {
      try {
        const message = this.parseMessageContainer(container, index);
        if (message) {
          messages.push(message);
          console.log(`[Gemini] Parsed message ${index + 1}: ${message.role} - ${message.content.substring(0, 50)}...`);
        }
      } catch (error) {
        console.log(`[Gemini] Error parsing message ${index}:`, error);
      }
    });

    return messages;
  }

  findMessageContainers() {
    const selectors = [
      'user-query, model-response',
      '[data-test-render-count] > div',
      '.conversation-container > div'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }

    return [];
  }

  parseMessageContainer(container, index) {
    const text = container.textContent?.trim();
    if (!text || text.length < 5) return null;

    const role = this.determineMessageRole(container, index);
    const content = this.extractMessageContent(container);

    return {
      role,
      content,
      timestamp: new Date().toISOString(),
      index
    };
  }

  determineMessageRole(container, index) {
    // Check if it's a user-query component
    if (container.tagName.toLowerCase() === 'user-query' || 
        container.querySelector('[data-testid="user-message"]')) {
      return MESSAGE_TYPES.USER;
    }
    
    // Check if it's a model-response component
    if (container.tagName.toLowerCase() === 'model-response' || 
        container.querySelector('message-content') ||
        container.querySelector('.markdown')) {
      return MESSAGE_TYPES.ASSISTANT;
    }

    const classList = container.className.toLowerCase();
    if (classList.includes('user-message') || classList.includes('user')) {
      return MESSAGE_TYPES.USER;
    }
    if (classList.includes('model-message') || classList.includes('assistant') || classList.includes('gemini')) {
      return MESSAGE_TYPES.ASSISTANT;
    }

    return index % 2 === 0 ? MESSAGE_TYPES.USER : MESSAGE_TYPES.ASSISTANT;
  }

  extractMessageContent(container) {
    const contentSelectors = [
      '[data-testid="user-message"]',
      'message-content .markdown',
      '.markdown p',
      '.whitespace-pre-wrap',
      '.whitespace-normal'
    ];

    for (const selector of contentSelectors) {
      const contentEl = container.querySelector(selector);
      if (contentEl) {
        return this.preserveFormatting(contentEl);
      }
    }

    return this.preserveFormatting(container);
  }

  preserveFormatting(element) {
    let content = '';
    
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        content += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        switch (tagName) {
          case 'code':
            if (node.parentElement?.tagName.toLowerCase() === 'pre') {
              const lang = node.className.match(/language-(\w+)/)?.[1] || '';
              content += `\`\`\`${lang}\n${node.textContent}\n\`\`\``;
            } else {
              content += `\`${node.textContent}\``;
            }
            break;
          case 'pre':
            content += `\`\`\`\n${node.textContent}\n\`\`\``;
            break;
          case 'strong':
          case 'b':
            content += `**${node.textContent}**`;
            break;
          case 'em':
          case 'i':
            content += `*${node.textContent}*`;
            break;
          case 'br':
            content += '\n';
            break;
          case 'p':
            content += node.textContent + '\n\n';
            break;
          default:
            content += node.textContent;
        }
      }
    }
    
    return content.trim();
  }

  getConversationTitle() {
    const titleSelectors = ['h1', '.conversation-title'];

    for (const selector of titleSelectors) {
      const titleEl = document.querySelector(selector);
      if (titleEl && titleEl.textContent.trim()) {
        return titleEl.textContent.trim();
      }
    }

    return 'Gemini Conversation';
  }

  async pasteConversation(conversationData) {
    try {
      const inputField = await this.findInputField();
      if (!inputField) {
        throw new Error('Could not find Gemini input field');
      }

      const formatted = this.formatter.formatConversation(
        conversationData.messages,
        conversationData.source,
        'Gemini'
      );

      await this.insertText(inputField, formatted.formatted);
      
      return { success: true, messageCount: conversationData.messages.length };
    } catch (error) {
      throw error;
    }
  }

  async findInputField() {
    const selectors = [
      '.ql-editor',
      'textarea[aria-label*="message"]',
      '.input-area textarea'
    ];

    for (const selector of selectors) {
      const field = document.querySelector(selector);
      if (field) {
        return field;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    for (const selector of selectors) {
      const field = document.querySelector(selector);
      if (field) {
        return field;
      }
    }

    return null;
  }

  async insertText(inputField, text) {
    inputField.focus();
    
    if (inputField.contentEditable === 'true') {
      inputField.textContent = text;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      inputField.value = text;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  async waitForContent() {
    return new Promise((resolve) => {
      const checkContent = () => {
        const messages = document.querySelectorAll('user-query, model-response, [data-test-render-count] > div');
        if (messages.length > 0) {
          resolve();
        } else {
          setTimeout(checkContent, 500);
        }
      };
      
      checkContent();
      setTimeout(resolve, 10000);
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const extractor = new GeminiExtractor();
    extractor.init();
  });
} else {
  const extractor = new GeminiExtractor();
  extractor.init();
}
