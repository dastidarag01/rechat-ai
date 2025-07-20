class ChatGPTExtractor {
  constructor() {
    this.config = LLM_CONFIG.CHATGPT;
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
        source: 'ChatGPT',
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
    
    if (messageContainers.length === 0) {
      return messages;
    }

    messageContainers.forEach((container, index) => {
      try {
        const message = this.parseMessageContainer(container, index);
        if (message) {
          messages.push(message);
        }
      } catch (error) {
        // Skip invalid messages
      }
    });

    return messages;
  }

  findMessageContainers() {
    const selectors = [
      '[data-message-author-role]',
      '.group.w-full',
      '.conversation-turn'
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
    const authorRole = container.getAttribute('data-message-author-role');
    if (authorRole === 'user') {
      return MESSAGE_TYPES.USER;
    }
    if (authorRole === 'assistant') {
      return MESSAGE_TYPES.ASSISTANT;
    }

    const classList = container.className.toLowerCase();
    if (classList.includes('user')) {
      return MESSAGE_TYPES.USER;
    }
    if (classList.includes('assistant') || classList.includes('gpt')) {
      return MESSAGE_TYPES.ASSISTANT;
    }

    return index % 2 === 0 ? MESSAGE_TYPES.USER : MESSAGE_TYPES.ASSISTANT;
  }

  extractMessageContent(container) {
    const contentSelectors = [
      '.prose',
      '.markdown',
      '.whitespace-pre-wrap',
      '.text-message'
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
    const titleSelectors = ['h1', '.conversation-header'];

    for (const selector of titleSelectors) {
      const titleEl = document.querySelector(selector);
      if (titleEl && titleEl.textContent.trim()) {
        return titleEl.textContent.trim();
      }
    }

    return 'ChatGPT Conversation';
  }

  async pasteConversation(conversationData) {
    try {
      console.log('[ChatGPT] Starting paste conversation process');
      console.log('[ChatGPT] Conversation data:', conversationData);
      
      const inputField = await this.findInputField();
      if (!inputField) {
        throw new Error('Could not find ChatGPT input field');
      }

      const formatted = this.formatter.formatConversation(
        conversationData.messages,
        conversationData.source,
        'ChatGPT'
      );

      console.log('[ChatGPT] Formatted conversation length:', formatted.formatted.length);
      await this.insertText(inputField, formatted.formatted);
      
      console.log('[ChatGPT] Paste conversation completed successfully');
      return { success: true, messageCount: conversationData.messages.length };
    } catch (error) {
      console.error('[ChatGPT] Error in pasteConversation:', error);
      throw error;
    }
  }

  async findInputField() {
    const selectors = [
      '#prompt-textarea.ProseMirror',
      '.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"]#prompt-textarea',
      '#prompt-textarea',
      'textarea[data-id="root"]',
      'textarea[placeholder*="message"]'
    ];

    for (const selector of selectors) {
      const field = document.querySelector(selector);
      if (field) {
        console.log(`[ChatGPT] Found input field with selector: ${selector}`);
        return field;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    for (const selector of selectors) {
      const field = document.querySelector(selector);
      if (field) {
        console.log(`[ChatGPT] Found input field with selector (retry): ${selector}`);
        return field;
      }
    }

    console.log('[ChatGPT] Could not find input field');
    return null;
  }

  async insertText(inputField, text) {
    console.log(`[ChatGPT] Inserting text into field:`, inputField);
    console.log(`[ChatGPT] Text length: ${text.length}`);
    
    // Focus the input field
    inputField.focus();
    
    // Handle ProseMirror editor
    if (inputField.classList.contains('ProseMirror')) {
      // Clear existing content
      inputField.innerHTML = '';
      
      // Split text into paragraphs and create proper structure
      const paragraphs = text.split('\n\n');
      paragraphs.forEach((paragraph, index) => {
        const p = document.createElement('p');
        
        // Handle line breaks within paragraphs
        const lines = paragraph.split('\n');
        lines.forEach((line, lineIndex) => {
          if (lineIndex > 0) {
            p.appendChild(document.createElement('br'));
          }
          p.appendChild(document.createTextNode(line));
        });
        
        inputField.appendChild(p);
      });
      
      // Add trailing break for ProseMirror
      const lastP = inputField.lastElementChild;
      if (lastP) {
        const br = document.createElement('br');
        br.className = 'ProseMirror-trailingBreak';
        lastP.appendChild(br);
      }
    } else {
      // Fallback for regular input fields
      if (inputField.contentEditable === 'true') {
        inputField.textContent = text;
      } else {
        inputField.value = text;
      }
    }
    
    // Trigger events to notify ChatGPT of the change
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    inputField.dispatchEvent(new Event('change', { bubbles: true }));
    inputField.dispatchEvent(new Event('keyup', { bubbles: true }));
    
    // Additional ProseMirror-specific events
    if (inputField.classList.contains('ProseMirror')) {
      inputField.dispatchEvent(new Event('focus', { bubbles: true }));
      inputField.dispatchEvent(new Event('blur', { bubbles: true }));
      inputField.dispatchEvent(new Event('focus', { bubbles: true }));
    }
    
    console.log('[ChatGPT] Text insertion completed');
  }

  async waitForContent() {
    return new Promise((resolve) => {
      const checkContent = () => {
        const messages = document.querySelectorAll('[data-message-author-role], .group.w-full');
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
    const extractor = new ChatGPTExtractor();
    extractor.init();
  });
} else {
  const extractor = new ChatGPTExtractor();
  extractor.init();
}
