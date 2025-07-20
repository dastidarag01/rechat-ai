class ConversationFormatter {
  /**
   * Format conversation for transfer with enhanced objectivity and intelligent response handling
   * @param {Array} messages - Array of conversation messages
   * @param {string} sourceLLM - Source LLM platform name
   * @param {string} targetLLM - Target LLM platform name
   * @returns {Object} Formatted conversation object
   */
  formatConversation(messages, sourceLLM, targetLLM) {
    const timestamp = new Date().toISOString();
    const date = new Date(timestamp).toLocaleString();
    
    const header = this._generateHeader(sourceLLM, targetLLM, date);
    const formattedMessages = this._formatMessages(messages);
    const footer = this._generateFooter(targetLLM);

    return {
      formatted: header + formattedMessages + footer,
      messageCount: messages.length,
      transferInfo: {
        source: sourceLLM,
        target: targetLLM,
        timestamp: timestamp
      }
    };
  }

  /**
   * Generate the header section with metadata and system context
   * @private
   */
  _generateHeader(sourceLLM, targetLLM, date) {
    return `# 🔄 Conversation Transfer from ${sourceLLM}

**📅 Transfer Date:** ${date}  
**🔀 Source:** ${sourceLLM} → ${targetLLM}

---

## 🎯 System Context

This conversation was initiated on **${sourceLLM}**. Please conduct an objective analysis of the preceding conversation. While maintaining awareness of the established context, you are expected to provide independent evaluation and reasoning. 

**Key Instructions:**
- When your analysis aligns with previous responses, acknowledge this alignment
- When your assessment differs from or corrects previous information, clearly indicate the discrepancy and provide your reasoning
- Your primary obligation is to accuracy and helpfulness, not consistency with prior responses

---

## 💬 Conversation History

`;
  }

  /**
   * Format individual messages with improved structure and readability
   * @private
   */
  _formatMessages(messages) {
    let formattedMessages = '';
    let exchangeNum = 1;
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : '';
      
      if (message.role === 'user') {
        // Start new exchange for user messages
        formattedMessages += `### 🔸 Exchange ${exchangeNum}\n\n`;
        formattedMessages += `**👤 User** ${timestamp ? `*(${timestamp})*` : ''}\n`;
        formattedMessages += `> ${this._formatMessageContent(message.content)}\n\n`;
      } else if (message.role === 'assistant') {
        // Assistant response in same exchange
        formattedMessages += `**🤖 Assistant** ${timestamp ? `*(${timestamp})*` : ''}\n`;
        formattedMessages += `${this._formatMessageContent(message.content)}\n\n`;
        formattedMessages += `---\n\n`;
        exchangeNum++;
      }
    }
    
    return formattedMessages;
  }

  /**
   * Format message content with proper line breaks and structure
   * @private
   */
  _formatMessageContent(content) {
    if (!content) return '';
    
    // Handle multi-line content properly
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n\n');
  }

  /**
   * Generate the footer with transition instructions
   * @private
   */
  _generateFooter(targetLLM) {
    return `## 🚀 Transition Point
**${targetLLM} Assistant Taking Over**

Please analyze the user's most recent message in the conversation above and respond appropriately:

- **If it's a question or request:** Provide a comprehensive answer
- **If it's a statement or comment:** Acknowledge it and provide relevant follow-up or insights as needed

Base your response on the full conversation context while applying your independent judgment and analysis.

---

*Ready to continue the conversation...*`;
  }
}

// Make available globally
if (typeof globalThis !== 'undefined') {
  globalThis.ConversationFormatter = ConversationFormatter;
}
