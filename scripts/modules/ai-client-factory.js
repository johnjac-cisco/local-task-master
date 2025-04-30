/**
 * ai-client-factory.js
 * Factory for creating AI client instances
 */

import { OpenAI } from 'openai';
import { configManager } from './config-manager.js';
import { log } from './utils.js';

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
    const useLocalLLM = env.USE_LOCAL_LLM === 'true';

    // Create a unique key for this client configuration
    const key = JSON.stringify({
      useLocalLLM,
      baseUrl: env.LOCAL_LLM_BASE_URL,
      model: env.LOCAL_LLM_MODEL,
      maxTokens: env.LOCAL_LLM_MAX_TOKENS,
      temperature: env.LOCAL_LLM_TEMPERATURE
    });

    // Return cached client if it exists
    if (this.clients.has(key)) {
      return this.clients.get(key);
    }

    // Create a new client
    let client;
    if (useLocalLLM) {
      client = this.createLocalLLMClient(env, mcpLog);
    } else {
      throw new Error('Only local LLM support is implemented');
    }

    // Cache the client
    this.clients.set(key, client);
    return client;
  }

  createLocalLLMClient(env, mcpLog) {
    const baseURL = env.LOCAL_LLM_BASE_URL;
    const apiKey = env.LOCAL_LLM_API_KEY || 'none';

    if (!baseURL) {
      throw new Error('LOCAL_LLM_BASE_URL is required when USE_LOCAL_LLM is true');
    }

    const client = new OpenAI({
      apiKey,
      baseURL,
      dangerouslyAllowBrowser: true
    });

    // Wrap the client with our streaming interface
    return {
      async createStreamingChatCompletion({ messages, options, onToken }) {
        const { model, max_tokens, temperature } = options;

        try {
          const stream = await client.chat.completions.create({
            model: model || 'qwen3',
            messages,
            max_tokens: max_tokens || 40960,
            temperature: temperature || 0.7,
            stream: true
          });

          let fullResponse = '';
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || '';
            fullResponse += token;
            if (onToken) {
              onToken(token);
            }
          }

          return fullResponse;
        } catch (error) {
          const errorMessage = `Error calling local LLM: ${error.message}`;
          if (mcpLog) {
            mcpLog.error(errorMessage);
          } else {
            log('error', errorMessage);
          }
          throw error;
        }
      }
    };
  }

  /**
   * Create an AI client instance for a specific provider
   * @param {string} provider - Provider name ('openai' or 'localLLM')
   * @param {Object} [options] - Additional client options
   * @returns {BaseAIClient} AI client instance
   */
  static createClientForProvider(provider, options = {}) {
    try {
      // Validate provider
      if (!['openai', 'localLLM'].includes(provider)) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Create the client instance
      const client = new OpenAICompatibleClient(provider, options);
      
      log('info', `Created AI client for provider: ${provider}`);
      return client;
    } catch (error) {
      log('error', `Failed to create AI client for provider ${provider}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the default provider based on configuration
   * @returns {string} Provider name
   */
  static getDefaultProvider() {
    return configManager.getConfig('localLLM.enabled') ? 'localLLM' : 'openai';
  }

  /**
   * Check if a provider is supported
   * @param {string} provider - Provider name to check
   * @returns {boolean} Whether the provider is supported
   */
  static isProviderSupported(provider) {
    return ['openai', 'localLLM'].includes(provider);
  }
} 