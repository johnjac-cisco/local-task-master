/**
 * base-ai-client.js
 * Abstract base class for AI client implementations
 */

import { configManager } from './config-manager.js';
import { log } from './utils.js';

/**
 * Base class for AI client implementations
 * @abstract
 */
export class BaseAIClient {
  /**
   * Create a new AI client
   * @param {string} provider - Provider name ('openai', 'localLLM', 'anthropic', 'perplexity')
   * @param {Object} [options] - Additional client options
   */
  constructor(provider, options = {}) {
    if (new.target === BaseAIClient) {
      throw new Error('BaseAIClient is abstract and cannot be instantiated directly');
    }

    this.provider = provider;
    this.config = configManager.getProviderConfig(provider);
    this.options = options;
    this._validateConfig();
  }

  /**
   * Create a chat completion
   * @abstract
   * @param {Object} params - Chat completion parameters
   * @param {Array<Object>} params.messages - Array of message objects
   * @param {Object} [params.options] - Additional options
   * @returns {Promise<Object>} Chat completion response
   */
  async createChatCompletion(params) {
    throw new Error('createChatCompletion must be implemented by subclass');
  }

  /**
   * Create a streaming chat completion
   * @abstract
   * @param {Object} params - Chat completion parameters
   * @param {Array<Object>} params.messages - Array of message objects
   * @param {Object} [params.options] - Additional options
   * @param {function} [params.onToken] - Callback for each token
   * @returns {AsyncGenerator<Object>} Stream of completion chunks
   */
  async *createStreamingChatCompletion(params) {
    throw new Error('createStreamingChatCompletion must be implemented by subclass');
  }

  /**
   * Create embeddings for text
   * @abstract
   * @param {Object} params - Embedding parameters
   * @param {string|Array<string>} params.input - Text to embed
   * @param {Object} [params.options] - Additional options
   * @returns {Promise<Object>} Embedding response
   */
  async createEmbeddings(params) {
    throw new Error('createEmbeddings must be implemented by subclass');
  }

  /**
   * Count tokens in text
   * @abstract
   * @param {string} text - Text to count tokens in
   * @returns {Promise<number>} Token count
   */
  async countTokens(text) {
    throw new Error('countTokens must be implemented by subclass');
  }

  /**
   * Get model information
   * @returns {Object} Model information
   */
  getModelInfo() {
    return {
      provider: this.provider,
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature
    };
  }

  /**
   * Format messages for the provider's API
   * @abstract
   * @param {Array<Object>} messages - Messages to format
   * @returns {Array<Object>} Formatted messages
   */
  formatMessages(messages) {
    throw new Error('formatMessages must be implemented by subclass');
  }

  /**
   * Handle API errors
   * @protected
   * @param {Error} error - Error to handle
   * @throws {Error} Processed error
   */
  _handleError(error) {
    // Log the error
    log('error', `${this.provider} API error: ${error.message}`);

    // Add provider context to error
    error.provider = this.provider;
    
    // Rethrow with additional context if needed
    throw error;
  }

  /**
   * Validate client configuration
   * @protected
   */
  _validateConfig() {
    const config = this.config;

    if (!config) {
      throw new Error(`Missing configuration for provider: ${this.provider}`);
    }

    if (!config.model) {
      throw new Error(`Missing model configuration for provider: ${this.provider}`);
    }

    if (!config.maxTokens || typeof config.maxTokens !== 'number') {
      throw new Error(`Invalid maxTokens configuration for provider: ${this.provider}`);
    }

    if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 1) {
      throw new Error(`Invalid temperature configuration for provider: ${this.provider}`);
    }
  }

  /**
   * Create retry options for API calls
   * @protected
   * @param {Object} [options] - Additional retry options
   * @returns {Object} Retry options
   */
  _createRetryOptions(options = {}) {
    return {
      retries: options.retries || 3,
      factor: options.factor || 2,
      minTimeout: options.minTimeout || 1000,
      maxTimeout: options.maxTimeout || 10000,
      randomize: true,
      ...options
    };
  }
} 