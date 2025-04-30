/**
 * ai-error-handler.js
 * Error handling and retry mechanisms for AI operations
 */

import retry from 'async-retry';
import { log } from './utils.js';

/**
 * Custom error class for AI operations
 */
export class AIError extends Error {
  constructor(message, { provider, code, status, retryable = true }) {
    super(message);
    this.name = 'AIError';
    this.provider = provider;
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Error handler for AI operations
 */
export class AIErrorHandler {
  /**
   * Default retry options
   */
  static DEFAULT_RETRY_OPTIONS = {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10000,
    randomize: true
  };

  /**
   * Create retry options
   * @param {Object} [options] - Custom retry options
   * @returns {Object} Retry options
   */
  static createRetryOptions(options = {}) {
    return {
      ...this.DEFAULT_RETRY_OPTIONS,
      ...options,
      onRetry: (error, attempt) => {
        log('warn', `Retry attempt ${attempt} after error: ${error.message}`);
        if (options.onRetry) {
          options.onRetry(error, attempt);
        }
      }
    };
  }

  /**
   * Execute an operation with retries
   * @param {Function} operation - Operation to execute
   * @param {Object} [options] - Retry options
   * @returns {Promise<any>} Operation result
   */
  static async withRetries(operation, options = {}) {
    const retryOptions = this.createRetryOptions(options);

    return retry(async (bail, attempt) => {
      try {
        return await operation(attempt);
      } catch (error) {
        // Convert to AIError if it's not already
        const aiError = this._convertToAIError(error);

        // If the error is not retryable, bail immediately
        if (!aiError.retryable) {
          bail(aiError);
          return;
        }

        // Throw the error to trigger a retry
        throw aiError;
      }
    }, retryOptions);
  }

  /**
   * Handle an AI provider error
   * @param {Error} error - Error to handle
   * @param {string} provider - Provider name
   * @returns {AIError} Processed error
   */
  static handleError(error, provider) {
    // Convert to AIError if needed
    const aiError = this._convertToAIError(error, provider);

    // Log the error
    log('error', `${provider} error: ${aiError.message} (Code: ${aiError.code}, Status: ${aiError.status})`);

    return aiError;
  }

  /**
   * Convert an error to AIError
   * @private
   * @param {Error} error - Error to convert
   * @param {string} [provider] - Provider name
   * @returns {AIError} Converted error
   */
  static _convertToAIError(error, provider = 'unknown') {
    if (error instanceof AIError) {
      return error;
    }

    // Extract error details
    const status = error.response?.status || error.status;
    let code = error.code || 'UNKNOWN_ERROR';
    let message = error.message;
    let retryable = true;

    // Handle specific error types
    if (error.response) {
      // API error response
      const response = error.response;
      code = response.data?.error?.code || response.data?.error?.type || code;
      message = response.data?.error?.message || message;

      // Determine if the error is retryable
      retryable = ![401, 403, 404].includes(response.status);
    } else if (error.code === 'ECONNREFUSED') {
      // Connection error
      code = 'CONNECTION_ERROR';
      message = 'Failed to connect to AI provider';
      retryable = true;
    } else if (error.code === 'ETIMEDOUT') {
      // Timeout error
      code = 'TIMEOUT_ERROR';
      message = 'Request to AI provider timed out';
      retryable = true;
    }

    return new AIError(message, {
      provider,
      code,
      status,
      retryable
    });
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} Whether the error is retryable
   */
  static isRetryableError(error) {
    const aiError = this._convertToAIError(error);
    return aiError.retryable;
  }

  /**
   * Create a circuit breaker for AI operations
   * @param {Object} options - Circuit breaker options
   * @returns {Object} Circuit breaker instance
   */
  static createCircuitBreaker(options = {}) {
    const defaults = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitorInterval: 5000
    };

    const config = { ...defaults, ...options };
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    return {
      async execute(operation) {
        // Check if circuit is open
        if (isOpen) {
          const now = Date.now();
          if (now - lastFailureTime >= config.resetTimeout) {
            // Reset circuit
            isOpen = false;
            failures = 0;
          } else {
            throw new AIError('Circuit breaker is open', {
              provider: 'circuit-breaker',
              code: 'CIRCUIT_OPEN',
              status: 503,
              retryable: false
            });
          }
        }

        try {
          const result = await operation();
          // Success - reset failures
          failures = 0;
          return result;
        } catch (error) {
          failures++;
          lastFailureTime = Date.now();

          // Check if circuit should open
          if (failures >= config.failureThreshold) {
            isOpen = true;
            log('warn', 'Circuit breaker opened due to consecutive failures');
          }

          throw error;
        }
      },

      isOpen() {
        return isOpen;
      },

      reset() {
        failures = 0;
        isOpen = false;
        lastFailureTime = 0;
      }
    };
  }
} 