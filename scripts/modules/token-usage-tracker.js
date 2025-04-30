/**
 * token-usage-tracker.js
 * Token usage tracking for AI operations
 */

import { log } from './utils.js';

/**
 * Token usage tracking utility
 */
export class TokenUsageTracker {
  constructor() {
    this.usage = new Map();
    this.totalUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    };
  }

  /**
   * Record token usage for an operation
   * @param {Object} usage - Token usage data
   * @param {string} provider - Provider name
   * @param {string} [operation='chat'] - Operation type
   */
  recordUsage(usage, provider, operation = 'chat') {
    try {
      // Get provider usage map
      let providerUsage = this.usage.get(provider);
      if (!providerUsage) {
        providerUsage = new Map();
        this.usage.set(provider, providerUsage);
      }

      // Get operation usage
      let operationUsage = providerUsage.get(operation);
      if (!operationUsage) {
        operationUsage = {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          count: 0
        };
        providerUsage.set(operation, operationUsage);
      }

      // Update usage statistics
      operationUsage.prompt_tokens += usage.prompt_tokens || 0;
      operationUsage.completion_tokens += usage.completion_tokens || 0;
      operationUsage.total_tokens += usage.total_tokens || 0;
      operationUsage.count += 1;

      // Update total usage
      this.totalUsage.prompt_tokens += usage.prompt_tokens || 0;
      this.totalUsage.completion_tokens += usage.completion_tokens || 0;
      this.totalUsage.total_tokens += usage.total_tokens || 0;

      // Log usage
      log('debug', `Recorded token usage for ${provider}/${operation}: ${usage.total_tokens} tokens`);
    } catch (error) {
      log('error', `Failed to record token usage: ${error.message}`);
    }
  }

  /**
   * Get usage statistics for a provider
   * @param {string} provider - Provider name
   * @returns {Object} Provider usage statistics
   */
  getProviderUsage(provider) {
    const providerUsage = this.usage.get(provider);
    if (!providerUsage) {
      return null;
    }

    const stats = {
      total: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        count: 0
      },
      operations: {}
    };

    // Aggregate operation statistics
    for (const [operation, usage] of providerUsage.entries()) {
      stats.operations[operation] = { ...usage };
      stats.total.prompt_tokens += usage.prompt_tokens;
      stats.total.completion_tokens += usage.completion_tokens;
      stats.total.total_tokens += usage.total_tokens;
      stats.total.count += usage.count;
    }

    return stats;
  }

  /**
   * Get total usage statistics
   * @returns {Object} Total usage statistics
   */
  getTotalUsage() {
    return { ...this.totalUsage };
  }

  /**
   * Get usage report
   * @returns {Object} Usage report
   */
  getUsageReport() {
    const report = {
      total: this.getTotalUsage(),
      providers: {}
    };

    // Add provider statistics
    for (const [provider] of this.usage.entries()) {
      report.providers[provider] = this.getProviderUsage(provider);
    }

    return report;
  }

  /**
   * Reset usage statistics
   */
  reset() {
    this.usage.clear();
    this.totalUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    };
  }

  /**
   * Estimate token count for text
   * @param {string} text - Text to estimate tokens for
   * @returns {number} Estimated token count
   */
  static estimateTokenCount(text) {
    // Simple estimation based on word count
    // This is a rough approximation, for accurate counts use a tokenizer
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  /**
   * Create a usage monitor for streaming responses
   * @returns {Object} Usage monitor
   */
  createStreamingMonitor() {
    let tokens = 0;
    let startTime = Date.now();

    return {
      onToken: (token) => {
        tokens += TokenUsageTracker.estimateTokenCount(token);
      },
      getStats: () => ({
        tokens,
        duration: Date.now() - startTime,
        tokensPerSecond: tokens / ((Date.now() - startTime) / 1000)
      })
    };
  }
}

// Export singleton instance
export const tokenUsageTracker = new TokenUsageTracker(); 