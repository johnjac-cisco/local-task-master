/**
 * config-manager.js
 * Configuration management for Task Master AI providers
 */

import dotenv from 'dotenv';
import { log } from './utils.js';

// Load environment variables
dotenv.config();

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  // OpenAI-compatible endpoints (including local LLMs)
  openai: {
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || 'none', // 'none' for local endpoints that don't require auth
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
  },
  
  // Ollama configuration
  ollama: {
    enabled: true, // Ollama is always enabled when selected
    baseURL: process.env.AI_BASE_URL || 'http://localhost:11434/v1',
    apiKey: 'none', // Ollama doesn't require authentication
    model: process.env.MODEL || 'qwen3',
    maxTokens: parseInt(process.env.MAX_TOKENS || '40960'),
    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
    defaultHeaders: {
      'Content-Type': 'application/json'
    }
  },

  // Local LLM specific settings (legacy)
  localLLM: {
    enabled: process.env.USE_LOCAL_LLM === 'true',
    baseURL: process.env.LOCAL_LLM_BASE_URL || 'http://localhost:11434/v1',
    apiKey: process.env.LOCAL_LLM_API_KEY || 'none',
    model: process.env.LOCAL_LLM_MODEL || 'mistral',
    maxTokens: parseInt(process.env.LOCAL_LLM_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.LOCAL_LLM_TEMPERATURE || '0.7')
  },

  // Anthropic (legacy/fallback)
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.MODEL || 'claude-3-opus-20240229',
    maxTokens: parseInt(process.env.MAX_TOKENS || '64000'),
    temperature: parseFloat(process.env.TEMPERATURE || '0.2')
  },

  // Perplexity (legacy/fallback)
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
    model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
    maxTokens: parseInt(process.env.MAX_TOKENS || '64000'),
    temperature: parseFloat(process.env.TEMPERATURE || '0.2')
  },

  // General application settings
  app: {
    debug: process.env.DEBUG === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
    defaultSubtasks: parseInt(process.env.DEFAULT_SUBTASKS || '5'),
    defaultPriority: process.env.DEFAULT_PRIORITY || 'medium'
  }
};

class ConfigManager {
  constructor(customConfig = {}) {
    this.config = this._mergeConfig(DEFAULT_CONFIG, customConfig);
    this._validateConfig();
  }

  /**
   * Get configuration for a specific provider
   * @param {string} provider - Provider name ('openai', 'ollama', 'localLLM', 'anthropic', 'perplexity')
   * @returns {Object} Provider configuration
   */
  getProviderConfig(provider) {
    // Handle AI_PROVIDER environment variable
    const envProvider = process.env.AI_PROVIDER;
    if (envProvider && envProvider.toLowerCase() === 'ollama' && provider !== 'ollama') {
      log('info', 'Using Ollama as configured in AI_PROVIDER');
      return this.getProviderConfig('ollama');
    }

    if (!this.config[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return { ...this.config[provider] };
  }

  /**
   * Get application configuration
   * @returns {Object} Application configuration
   */
  getAppConfig() {
    return { ...this.config.app };
  }

  /**
   * Check if a provider is available based on its configuration
   * @param {string} provider - Provider name
   * @returns {boolean} True if the provider is available
   */
  isProviderAvailable(provider) {
    // If AI_PROVIDER is set to ollama, only ollama is available
    if (process.env.AI_PROVIDER && process.env.AI_PROVIDER.toLowerCase() === 'ollama') {
      return provider === 'ollama';
    }

    const config = this.config[provider];
    if (!config) return false;

    switch (provider) {
      case 'ollama':
        // Ollama is available if the base URL is set
        return Boolean(config.baseURL);
      case 'localLLM':
        return config.enabled;
      case 'anthropic':
        return Boolean(config.apiKey);
      case 'perplexity':
        return Boolean(config.apiKey);
      case 'openai':
        // For OpenAI-compatible endpoints, we consider it available if:
        // 1. It's a local endpoint (apiKey can be 'none')
        // 2. OR it has a valid API key for cloud endpoints
        return config.apiKey === 'none' || Boolean(config.apiKey);
      default:
        return false;
    }
  }

  /**
   * Get the best available AI provider based on requirements
   * @param {Object} options - Selection options
   * @param {boolean} [options.requiresResearch=false] - Whether research capabilities are needed
   * @param {boolean} [options.preferLocal=false] - Whether to prefer local LLM if available
   * @returns {string} Provider name ('openai', 'ollama', 'localLLM', 'anthropic', 'perplexity')
   */
  getBestAvailableProvider(options = {}) {
    const { requiresResearch = false, preferLocal = false } = options;

    // If AI_PROVIDER is set to ollama, always use ollama
    if (process.env.AI_PROVIDER && process.env.AI_PROVIDER.toLowerCase() === 'ollama') {
      if (this.isProviderAvailable('ollama')) {
        return 'ollama';
      }
      throw new Error('Ollama is configured but not available');
    }

    // If local LLM is preferred and available, use it
    if (preferLocal) {
      if (this.isProviderAvailable('ollama')) {
        return 'ollama';
      }
      if (this.isProviderAvailable('localLLM')) {
        return 'localLLM';
      }
    }

    // For research tasks, prefer Perplexity
    if (requiresResearch && this.isProviderAvailable('perplexity')) {
      return 'perplexity';
    }

    // Try providers in order of preference
    const providers = ['openai', 'ollama', 'localLLM', 'anthropic'];
    for (const provider of providers) {
      if (this.isProviderAvailable(provider)) {
        return provider;
      }
    }

    throw new Error('No AI providers available');
  }

  /**
   * Update configuration values
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = this._mergeConfig(this.config, newConfig);
    this._validateConfig();
  }

  /**
   * Merge configurations with deep copy
   * @private
   */
  _mergeConfig(baseConfig, overrides) {
    const merged = { ...baseConfig };
    for (const [key, value] of Object.entries(overrides)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        merged[key] = this._mergeConfig(merged[key] || {}, value);
      } else {
        merged[key] = value;
      }
    }
    return merged;
  }

  /**
   * Validate configuration values
   * @private
   */
  _validateConfig() {
    // Validate required fields
    if (!this.config.app) {
      throw new Error('Missing app configuration');
    }

    // Validate numeric values
    const validateNumeric = (value, fieldName) => {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(`Invalid ${fieldName}: must be a number`);
      }
    };

    // Validate each provider's configuration
    for (const [provider, config] of Object.entries(this.config)) {
      if (provider === 'app') continue;

      if (config.maxTokens) validateNumeric(config.maxTokens, `${provider}.maxTokens`);
      if (config.temperature) {
        validateNumeric(config.temperature, `${provider}.temperature`);
        if (config.temperature < 0 || config.temperature > 1) {
          throw new Error(`Invalid ${provider}.temperature: must be between 0 and 1`);
        }
      }
    }

    // Log configuration state
    const availableProviders = Object.keys(this.config)
      .filter(key => key !== 'app')
      .filter(provider => this.isProviderAvailable(provider));

    log('debug', `Available AI providers: ${availableProviders.join(', ')}`);
  }
}

// Export singleton instance
export const configManager = new ConfigManager();

// Export the class for testing and custom instances
export { ConfigManager }; 