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
   * @param {string} provider - Provider name ('openai', 'ollama', 'localLLM')
   * @param {Object} [options] - Additional client options
   */
  constructor(provider, options = {}) {
    super(provider, options);

    this.config = {
      apiKey: options.apiKey || this.config.apiKey,
      baseURL: options.baseURL || this.config.baseURL,
      model: options.model || this.config.model,
      maxTokens: options.maxTokens || this.config.maxTokens,
      temperature: options.temperature || this.config.temperature,
      defaultHeaders: this.config.defaultHeaders || {}
    };

    // Initialize OpenAI client for non-Ollama providers
    if (provider !== 'ollama') {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        defaultHeaders: this.config.defaultHeaders
      });
    }
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
      if (this.provider === 'ollama') {
        return await this._createOllamaChatCompletion(messages, options);
      }

      const formattedMessages = this.formatMessages(messages);
      const response = await retry(
        async () => {
          return await this.client.chat.completions.create({
            model: this.config.model,
            messages: formattedMessages,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            ...options
          });
        },
        this._createRetryOptions(options)
      );

      return {
        choices: [{
          message: response.choices[0].message,
          finish_reason: response.choices[0].finish_reason
        }],
        usage: response.usage
      };
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
      if (this.provider === 'ollama') {
        yield* this._createOllamaStreamingChatCompletion(messages, options, onToken);
        return;
      }

      const formattedMessages = this.formatMessages(messages);
      const stream = await retry(
        async () => {
          return await this.client.chat.completions.create({
            model: this.config.model,
            messages: formattedMessages,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            stream: true,
            ...options
          });
        },
        this._createRetryOptions(options)
      );

      for await (const chunk of stream) {
        if (onToken) {
          onToken(chunk.choices[0]?.delta?.content || '');
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
      if (this.provider === 'ollama') {
        return await this._createOllamaEmbeddings(input, options);
      }

      const response = await retry(
        async () => {
          return await this.client.embeddings.create({
            model: this.config.model,
            input,
            ...options
          });
        },
        this._createRetryOptions(options)
      );

      return {
        data: response.data,
        usage: response.usage
      };
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
   * Format messages for the provider's API
   * @param {Array<Object>} messages - Messages to format
   * @returns {Array<Object>} Formatted messages
   */
  formatMessages(messages) {
    if (this.provider === 'ollama') {
      // Ollama expects a single string with all messages concatenated
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    }

    // Standard OpenAI format
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Create chat completion using Ollama's API
   * @private
   */
  async _createOllamaChatCompletion(messages, options = {}) {
    const formattedMessages = this.formatMessages(messages);
    const lastMessage = formattedMessages[formattedMessages.length - 1].content;

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.defaultHeaders
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: formattedMessages,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
          ...options
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: data.choices[0].message.content
        },
        finish_reason: data.choices[0].finish_reason
      }],
      usage: data.usage
    };
  }

  /**
   * Create streaming chat completion using Ollama's API
   * @private
   */
  async *_createOllamaStreamingChatCompletion(messages, options = {}, onToken) {
    const formattedMessages = this.formatMessages(messages);
    const lastMessage = formattedMessages[formattedMessages.length - 1].content;

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.defaultHeaders
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: formattedMessages,
        stream: true,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
          ...options
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data = JSON.parse(line);
            if (onToken) {
              onToken(data.choices[0]?.delta?.content || '');
            }
            yield data;
          } catch (e) {
            log('warn', `Failed to parse Ollama stream chunk: ${e.message}`);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Create embeddings using Ollama's API
   * @private
   */
  async _createOllamaEmbeddings(input, options = {}) {
    const texts = Array.isArray(input) ? input : [input];
    const embeddings = [];

    for (const text of texts) {
      const response = await fetch(`${this.config.baseURL}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.defaultHeaders
        },
        body: JSON.stringify({
          model: this.config.model,
          input: text,
          ...options
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      embeddings.push({
        embedding: data.embedding,
        index: embeddings.length
      });
    }

    return {
      data: embeddings,
      usage: {
        prompt_tokens: texts.join(' ').split(/\s+/).length,
        total_tokens: texts.join(' ').split(/\s+/).length
      }
    };
  }

  /**
   * Handle provider-specific errors
   * @protected
   * @param {Error} error - Error to handle
   * @throws {Error} Processed error
   */
  _handleError(error) {
    if (this.provider === 'ollama') {
      if (error.message.includes('connect ECONNREFUSED')) {
        error.message = 'Failed to connect to Ollama server. Make sure Ollama is running.';
      } else if (error.response?.status === 404) {
        error.message = 'Model not found. Make sure to pull the model first using: ollama pull qwen3';
      }
    } else if (error.response?.status === 401) {
      error.message = `Authentication failed for ${this.provider}. Check your API key configuration.`;
    } else if (error.response?.status === 404) {
      error.message = `Model or endpoint not found for ${this.provider}. Check your configuration.`;
    }

    // Call parent error handler
    super._handleError(error);
  }

  /**
   * Create retry options
   * @private
   * @param {Object} [retryOptions] - Custom retry options
   * @returns {Object} Retry options
   */
  _createRetryOptions(retryOptions = {}) {
    return {
      retries: retryOptions.retries || 3,
      factor: retryOptions.factor || 2,
      minTimeout: retryOptions.minTimeout || 1000,
      maxTimeout: retryOptions.maxTimeout || 5000,
      randomize: true,
      onRetry: (error, attempt) => {
        log('warn', `Retry attempt ${attempt} for ${this.provider}: ${error.message}`);
      }
    };
  }
} 