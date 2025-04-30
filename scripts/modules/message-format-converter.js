/**
 * message-format-converter.js
 * Utility for converting between different AI provider message formats
 */

import { log } from './utils.js';

/**
 * Message format conversion utility
 */
export class MessageFormatConverter {
  /**
   * Convert messages to OpenAI format
   * @param {Array} messages - Array of messages to convert
   * @param {string} [fromFormat='anthropic'] - Source format ('anthropic' or 'perplexity')
   * @returns {Array} Messages in OpenAI format
   */
  static toOpenAIFormat(messages, fromFormat = 'anthropic') {
    try {
      if (fromFormat === 'anthropic') {
        return messages.map(msg => {
          // Convert Anthropic role names to OpenAI equivalents
          const roleMap = {
            'assistant': 'assistant',
            'user': 'user',
            'system': 'system'
          };

          return {
            role: roleMap[msg.role] || msg.role,
            content: msg.content
          };
        });
      } else if (fromFormat === 'perplexity') {
        return messages.map(msg => {
          // Convert Perplexity format to OpenAI format
          return {
            role: msg.role,
            content: msg.content
          };
        });
      } else {
        throw new Error(`Unsupported source format: ${fromFormat}`);
      }
    } catch (error) {
      log('error', `Failed to convert messages to OpenAI format: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert OpenAI response to unified format
   * @param {Object} response - OpenAI API response
   * @returns {Object} Unified response format
   */
  static convertOpenAIResponse(response) {
    try {
      return {
        content: response.choices[0]?.message?.content || '',
        role: response.choices[0]?.message?.role || 'assistant',
        model: response.model,
        usage: response.usage || {},
        finish_reason: response.choices[0]?.finish_reason
      };
    } catch (error) {
      log('error', `Failed to convert OpenAI response: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert streaming chunks to unified format
   * @param {Object} chunk - Streaming response chunk
   * @returns {Object} Unified chunk format
   */
  static convertStreamingChunk(chunk) {
    try {
      return {
        content: chunk.choices[0]?.delta?.content || '',
        role: chunk.choices[0]?.delta?.role || 'assistant',
        finish_reason: chunk.choices[0]?.finish_reason
      };
    } catch (error) {
      log('error', `Failed to convert streaming chunk: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert system prompt to provider format
   * @param {string} systemPrompt - System prompt to convert
   * @param {string} provider - Target provider ('openai' or 'localLLM')
   * @returns {Array} Messages array with system prompt
   */
  static convertSystemPrompt(systemPrompt, provider) {
    try {
      // Both OpenAI and local LLMs use the same format for system messages
      return [{
        role: 'system',
        content: systemPrompt
      }];
    } catch (error) {
      log('error', `Failed to convert system prompt: ${error.message}`);
      throw error;
    }
  }
} 