class ClaudeExtractor {
  constructor() {
    this.config = LLM_CONFIG.CLAUDE;
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
        source: 'Claude',
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
    
    console.log(`[Claude] Found ${messageContainers.length} message containers`);
    
    if (messageContainers.length === 0) {
      console.log('[Claude] No message containers found, trying fallback selectors');
      // Try fallback approach
      const fallbackContainers = document.querySelectorAll('div[data-test-render-count] > div');
      console.log(`[Claude] Fallback found ${fallbackContainers.length} containers`);
      return messages;
    }

    messageContainers.forEach((container, index) => {
      try {
        const message = this.parseMessageContainer(container, index);
        if (message) {
          messages.push(message);
          console.log(`[Claude] Parsed message ${index + 1}: ${message.role} - ${message.content.substring(0, 50)}...`);
        }
      } catch (error) {
        console.log(`[Claude] Error parsing message ${index}:`, error);
      }
    });

    return messages;
  }

  findMessageContainers() {
    const containers = [];
    
    // Find all message containers with data-test-render-count
    const renderContainers = document.querySelectorAll('div[data-test-render-count]');
    
    renderContainers.forEach(container => {
      // Check if it contains a user message
      const userMessage = container.querySelector('[data-testid="user-message"]');
      if (userMessage) {
        containers.push({ element: container, type: 'user', content: userMessage });
        return;
      }
      
      // Check if it contains a Claude message
      const claudeMessage = container.querySelector('.font-claude-message');
      if (claudeMessage) {
        containers.push({ element: container, type: 'assistant', content: claudeMessage });
        return;
      }
    });
    
    console.log(`[Claude] Found ${containers.length} message containers`);
    return containers;
  }

  parseMessageContainer(containerInfo, index) {
    if (!containerInfo || !containerInfo.content) return null;
    
    const text = containerInfo.content.textContent?.trim();
    if (!text || text.length < 5) return null;

    const role = containerInfo.type === 'user' ? MESSAGE_TYPES.USER : MESSAGE_TYPES.ASSISTANT;
    const content = this.extractMessageContent(containerInfo.content);

    return {
      role,
      content,
      timestamp: new Date().toISOString(),
      index
    };
  }

  determineMessageRole(container, index) {
    // Check for user message indicators
    if (container.hasAttribute('data-testid') && 
        container.getAttribute('data-testid') === 'user-message') {
      return MESSAGE_TYPES.USER;
    }
    
    if (container.querySelector('[data-testid="user-message"]')) {
      return MESSAGE_TYPES.USER;
    }

    // Check for Claude message indicators
    if (container.classList.contains('font-claude-message') ||
        container.querySelector('.font-claude-message')) {
      return MESSAGE_TYPES.ASSISTANT;
    }

    const classList = container.className.toLowerCase();
    if (classList.includes('human') || classList.includes('user')) {
      return MESSAGE_TYPES.USER;
    }
    if (classList.includes('assistant') || classList.includes('claude')) {
      return MESSAGE_TYPES.ASSISTANT;
    }

    return index % 2 === 0 ? MESSAGE_TYPES.USER : MESSAGE_TYPES.ASSISTANT;
  }

  extractMessageContent(container) {
    // For Claude messages, look for paragraphs with whitespace-normal break-words
    const claudeParagraphs = container.querySelectorAll('p.whitespace-normal.break-words');
    if (claudeParagraphs.length > 0) {
      let content = '';
      claudeParagraphs.forEach(p => {
        content += this.preserveFormatting(p) + '\n\n';
      });
      return content.trim();
    }
    
    // For user messages or fallback
    const userMessage = container.querySelector('[data-testid="user-message"]');
    if (userMessage) {
      return this.preserveFormatting(userMessage);
    }
    
    // Fallback to container content
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

    return 'Claude Conversation';
  }

  async pasteConversation(conversationData) {
    try {
      const inputField = await this.findInputField();
      if (!inputField) {
        throw new Error('Could not find Claude input field');
      }

      const formatted = this.formatter.formatConversation(
        conversationData.messages,
        conversationData.source,
        'Claude'
      );

      await this.insertText(inputField, formatted.formatted);
      
      return { success: true, messageCount: conversationData.messages.length };
    } catch (error) {
      throw error;
    }
  }

  async findInputField() {
    const selectors = [
      'div[contenteditable="true"][role="textbox"][aria-label="Write your prompt to Claude"]',
      '.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ];

    for (const selector of selectors) {
      const field = document.querySelector(selector);
      if (field) {
        console.log(`[Claude] Found input field with selector: ${selector}`);
        return field;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    
    for (const selector of selectors) {
      const field = document.querySelector(selector);
      if (field) {
        console.log(`[Claude] Found input field with selector (retry): ${selector}`);
        return field;
      }
    }

    console.log('[Claude] No input field found');
    return null;
  }

  async insertText(inputField, text) {
    console.log(`[Claude] Starting clipboard paste simulation (${text.length} characters)`);
    
    try {
      // Focus the input field first
      inputField.focus();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Write text to clipboard
      await navigator.clipboard.writeText(text);
      console.log('[Claude] Text written to clipboard');
      
      // Simulate paste event
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer()
      });
      
      // Add the text data to clipboard event
      pasteEvent.clipboardData.setData('text/plain', text);
      
      // Dispatch the paste event
      inputField.dispatchEvent(pasteEvent);
      
      console.log('[Claude] Paste event dispatched');
      
    } catch (error) {
      console.log('[Claude] Clipboard paste failed, trying fallback:', error);
      
      // Fallback: Use execCommand paste
      try {
        await navigator.clipboard.writeText(text);
        document.execCommand('paste');
        console.log('[Claude] execCommand paste completed');
      } catch (fallbackError) {
        console.log('[Claude] All paste methods failed:', fallbackError);
        throw new Error('Could not paste text into Claude');
      }
    }
    
    // Give Claude time to process the paste
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('[Claude] Text insertion completed');
  }

  async waitForContent() {
    return new Promise((resolve) => {
      const checkContent = () => {
        const messages = document.querySelectorAll('[data-testid="user-message"], .font-claude-message, [data-test-render-count] > div');
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
    const extractor = new ClaudeExtractor();
    extractor.init();
  });
} else {
  const extractor = new ClaudeExtractor();
  extractor.init();
}
