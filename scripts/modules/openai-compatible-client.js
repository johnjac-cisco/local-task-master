/**
 * openai-compatible-client.js
 * OpenAI-compatible client implementation for both cloud and local endpoints
 */

import OpenAI from 'openai';
import { BaseAIClient } from './base-ai-client.js';
import { log } from './utils.js';
import retry from 'async-retry';

/**
 * OpenAI-compatible client implementation
 * Works with both cloud OpenAI and local LLM endpoints
 */
export class OpenAICompatibleClient extends BaseAIClient {
  /**
   * Create a new OpenAI-compatible client
   * @param {string} provider - Provider name ('openai' or 'localLLM')
   * @param {Object} [options] - Additional client options
   */
  constructor(provider, options = {}) {
    super(provider, options);

    // Initialize OpenAI client with provider configuration
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      defaultHeaders: options.defaultHeaders || {},
      defaultQuery: options.defaultQuery || {}
    });

    log('info', `Initialized ${provider} client with endpoint: ${this.config.baseURL}`);
  }

  /**
   * Create a chat completion
   * @param {Object} params - Chat completion parameters
   * @param {Array<Object>} params.messages - Array of message objects
   * @param {Object} [params.options] - Additional options
   * @returns {Promise<Object>} Chat completion response
   */
  async createChatCompletion(params) {
    const { messages, options = {} } = params;

    try {
      // Format messages for OpenAI API
      const formattedMessages = this.formatMessages(messages);

      // Create retry options
      const retryOptions = this._createRetryOptions(options.retry);

      // Make API call with retry
      return await retry(async () => {
        const response = await this.client.chat.completions.create({
          model: options.model || this.config.model,
          messages: formattedMessages,
          temperature: options.temperature ?? this.config.temperature,
          max_tokens: options.maxTokens || this.config.maxTokens,
          stream: false,
          ...options
        });

        return response;
      }, retryOptions);
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Create a streaming chat completion
   * @param {Object} params - Chat completion parameters
   * @param {Array<Object>} params.messages - Array of message objects
   * @param {Object} [params.options] - Additional options
   * @param {function} [params.onToken] - Callback for each token
   * @returns {AsyncGenerator<Object>} Stream of completion chunks
   */
  async *createStreamingChatCompletion(params) {
    const { messages, options = {}, onToken } = params;

    try {
      // Format messages for OpenAI API
      const formattedMessages = this.formatMessages(messages);

      // Create the stream
      const stream = await this.client.chat.completions.create({
        model: options.model || this.config.model,
        messages: formattedMessages,
        temperature: options.temperature ?? this.config.temperature,
        max_tokens: options.maxTokens || this.config.maxTokens,
        stream: true,
        ...options
      });

      // Process the stream
      for await (const chunk of stream) {
        // Extract the token from the chunk
        const token = chunk.choices[0]?.delta?.content || '';
        
        // Call the onToken callback if provided
        if (onToken && token) {
          onToken(token);
        }

        yield chunk;
      }
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Create embeddings for text
   * @param {Object} params - Embedding parameters
   * @param {string|Array<string>} params.input - Text to embed
   * @param {Object} [params.options] - Additional options
   * @returns {Promise<Object>} Embedding response
   */
  async createEmbeddings(params) {
    const { input, options = {} } = params;

    try {
      // Create retry options
      const retryOptions = this._createRetryOptions(options.retry);

      // Make API call with retry
      return await retry(async () => {
        const response = await this.client.embeddings.create({
          model: options.model || 'text-embedding-ada-002', // Default OpenAI embedding model
          input: Array.isArray(input) ? input : [input],
          ...options
        });

        return response;
      }, retryOptions);
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Count tokens in text
   * @param {string} text - Text to count tokens in
   * @returns {Promise<number>} Token count
   */
  async countTokens(text) {
    // For now, use a simple approximation
    // In the future, we could use tiktoken or a similar library
    return Math.ceil(text.length / 4);
  }

  /**
   * Format messages for the OpenAI API
   * @param {Array<Object>} messages - Messages to format
   * @returns {Array<Object>} Formatted messages
   */
  formatMessages(messages) {
    return messages.map(msg => {
      // Ensure message has required fields
      if (!msg.role || !msg.content) {
        throw new Error('Invalid message format: missing role or content');
      }

      // Convert Anthropic roles to OpenAI roles if needed
      const role = msg.role === 'assistant' ? 'assistant' :
                   msg.role === 'user' ? 'user' :
                   msg.role === 'system' ? 'system' :
                   msg.role;

      return {
        role,
        content: msg.content,
        ...(msg.name && { name: msg.name })
      };
    });
  }

  /**
   * Handle provider-specific errors
   * @protected
   * @param {Error} error - Error to handle
   * @throws {Error} Processed error
   */
  _handleError(error) {
    // Add provider-specific error handling here
    if (error.response?.status === 401) {
      error.message = `Authentication failed for ${this.provider}. Check your API key configuration.`;
    } else if (error.response?.status === 404) {
      error.message = `Model or endpoint not found for ${this.provider}. Check your configuration.`;
    }

    // Call parent error handler
    super._handleError(error);
  }
} 