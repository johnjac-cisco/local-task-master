/**
 * ai-client-factory.js
 * Factory for creating AI client instances
 */

import { OpenAI } from 'openai';
import { configManager } from './config-manager.js';
import { log } from './utils.js';
import { OpenAICompatibleClient } from './openai-compatible-client.js';

/**
 * Factory class for creating AI client instances
 */
export class AIClientFactory {
  constructor() {
    this.clients = new Map();
  }

  /**
   * Create an AI client instance based on configuration
   * @param {Object} [options] - Additional client options
   * @returns {BaseAIClient} AI client instance
   */
  createClient({ session, mcpLog, modelConfig } = {}) {
    const env = session?.env || process.env;
    const provider = env.AI_PROVIDER || 'ollama';

    // Create a unique key for this client configuration
    const key = JSON.stringify({
      provider,
      baseUrl: env.AI_BASE_URL,
      model: env.MODEL,
      maxTokens: env.MAX_TOKENS,
      temperature: env.TEMPERATURE
    });

    // Return cached client if it exists
    if (this.clients.has(key)) {
      return this.clients.get(key);
    }

    // Create a new client based on provider
    let client;
    switch (provider.toLowerCase()) {
      case 'ollama':
        client = this.createOllamaClient(env, mcpLog);
        break;
      case 'openai':
        client = this.createOpenAIClient(env, mcpLog);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    // Cache the client
    this.clients.set(key, client);
    return client;
  }

  createOllamaClient(env, mcpLog) {
    const baseURL = env.AI_BASE_URL || 'http://localhost:11434';
    const apiKey = 'none'; // Ollama doesn't require an API key

    if (!baseURL) {
      throw new Error('AI_BASE_URL is required for Ollama');
    }

    // Create OpenAI-compatible client for Ollama
    return new OpenAICompatibleClient('ollama', {
      apiKey,
      baseURL,
      model: env.MODEL || 'qwen3',
      maxTokens: parseInt(env.MAX_TOKENS || '40960', 10),
      temperature: parseFloat(env.TEMPERATURE || '0.7'),
      defaultHeaders: {
        'Content-Type': 'application/json'
      }
    });
  }

  createOpenAIClient(env, mcpLog) {
    const apiKey = env.OPENAI_API_KEY;
    const baseURL = env.AI_BASE_URL;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAI provider');
    }

    return new OpenAICompatibleClient('openai', {
      apiKey,
      baseURL,
      model: env.MODEL || 'gpt-4',
      maxTokens: parseInt(env.MAX_TOKENS || '8192', 10),
      temperature: parseFloat(env.TEMPERATURE || '0.7')
    });
  }

  /**
   * Get the default provider based on configuration
   * @returns {string} Provider name
   */
  static getDefaultProvider() {
    return process.env.AI_PROVIDER || 'ollama';
  }

  /**
   * Check if a provider is supported
   * @param {string} provider - Provider name to check
   * @returns {boolean} Whether the provider is supported
   */
  static isProviderSupported(provider) {
    return ['ollama', 'openai'].includes(provider.toLowerCase());
  }
} 