// LLM Configuration and Constants
const LLM_CONFIG = {
  CLAUDE: {
    name: 'Claude',
    urls: ['claude.ai'],
    selectors: {
      messageContainer: '[data-testid="conversation"] > div, .conversation-turn',
      userMessage: '[data-is-author="true"], .human-turn',
      assistantMessage: '[data-is-author="false"], .assistant-turn',
      messageContent: '.font-claude-message, .prose, .whitespace-pre-wrap',
      inputField: 'div[contenteditable="true"][data-testid="basic-text-input"]',
      sendButton: 'button[aria-label="Send Message"], button[data-testid="send-button"]'
    },
    targetUrl: 'https://claude.ai/chat'
  },
  
  CHATGPT: {
    name: 'ChatGPT',
    urls: ['chatgpt.com', 'chat.openai.com'],
    selectors: {
      messageContainer: '[data-message-author-role], .group.w-full',
      userMessage: '[data-message-author-role="user"]',
      assistantMessage: '[data-message-author-role="assistant"]',
      messageContent: '.prose, .markdown, .whitespace-pre-wrap, .text-message',
      inputField: '#prompt-textarea, textarea[data-id="root"]',
      sendButton: 'button[data-testid="send-button"], button[aria-label="Send prompt"]'
    },
    targetUrl: 'https://chatgpt.com'
  },
  
  GEMINI: {
    name: 'Gemini',
    urls: ['gemini.google.com', 'bard.google.com'],
    selectors: {
      messageContainer: '.conversation-container .message, .chat-history .message-container',
      userMessage: '.user-message, [data-role="user"]',
      assistantMessage: '.model-message, [data-role="model"]',
      messageContent: '.message-content, .markdown-content, .response-content',
      inputField: '.ql-editor, textarea[aria-label*="message"], .input-area textarea',
      sendButton: 'button[aria-label*="Send"], .send-button'
    },
    targetUrl: 'https://gemini.google.com/app'
  }
};

// Message types
const MESSAGE_TYPES = {
  USER: 'user',
  ASSISTANT: 'assistant'
};

// Make constants available globally
if (typeof globalThis !== 'undefined') {
  globalThis.LLM_CONFIG = LLM_CONFIG;
  globalThis.MESSAGE_TYPES = MESSAGE_TYPES;
}
