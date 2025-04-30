# LOCAL Task Master - Enhanced AI Client Fork [![GitHub stars](https://img.shields.io/github/stars/eyaltoledano/claude-task-master?style=social)](https://github.com/eyaltoledano/claude-task-master/stargazers)

[![CI](https://github.com/eyaltoledano/claude-task-master/actions/workflows/ci.yml/badge.svg)](https://github.com/eyaltoledano/claude-task-master/actions/workflows/ci.yml) [![npm version](https://badge.fury.io/js/local-task-master.svg)](https://badge.fury.io/js/local-task-master) [![Discord Follow](https://dcbadge.limes.pink/api/server/https://discord.gg/2ms58QJjqp?style=flat)](https://discord.gg/2ms58QJjqp) [![License: MIT with Commons Clause](https://img.shields.io/badge/license-MIT%20with%20Commons%20Clause-blue.svg)](LICENSE)

This is an enhanced fork of the original [Task Master](https://github.com/eyaltoledano/claude-task-master) project by [@eyaltoledano](https://x.com/eyaltoledano) & [@RalphEcom](https://x.com/RalphEcom). We extend our sincere thanks to the original authors for their excellent work in creating the foundation for this project.

## What's New in This Fork?

This fork enhances Task Master with a robust, OpenAI-compatible AI client system that supports both cloud providers and local LLM endpoints. Key improvements include:

- **Flexible AI Provider Support**: Works with OpenAI, local endpoints (Ollama, LocalAI), and other OpenAI-compatible APIs
- **Advanced Configuration Management**: Environment-based configuration with support for multiple providers
- **Robust Error Handling**: Implements retry mechanisms, circuit breakers, and detailed error reporting
- **Token Usage Tracking**: Built-in monitoring and reporting of token usage across providers
- **Streaming Support**: Efficient handling of streaming responses with cancellation capabilities
- **Provider-Agnostic Interface**: Unified API for seamless switching between different AI providers

## Requirements

- Ollama installed locally (for running Qwen and other models)
- Optional: API keys for cloud providers (Anthropic, OpenAI, etc.)
- Node.js 18 or higher

## Quick Start

### Option 1 | MCP (Recommended):

MCP (Model Control Protocol) provides the easiest way to get started with Local Task Master directly in your editor.

1. **Install and Start Ollama**

```bash
# Install Ollama (if not already installed)
# Visit https://ollama.ai for installation instructions

# Pull the Qwen model
ollama pull qwen3

# Start Ollama in a separate terminal
ollama serve
```

2. **Add the MCP config to your editor** (Cursor recommended, but it works with other text editors):

```json
{
	"mcpServers": {
		"taskmaster": {
			"command": "npx",
			"args": ["-y", "--package=local-task-master", "local-task-master"],
			"env": {
				"AI_PROVIDER": "ollama",
				"AI_BASE_URL": "http://localhost:11434",
				"MODEL": "qwen3",
				"MAX_TOKENS": "40960",
				"TEMPERATURE": "0.7",
				"DEFAULT_SUBTASKS": "5",
				"DEFAULT_PRIORITY": "medium",
				"DEBUG": "false",
				"LOG_LEVEL": "info",
				"TRACK_USAGE": "true",
				"MAX_RETRIES": "3",
				"RETRY_DELAY": "1000",
				"MAX_CONCURRENT": "4"
			}
		}
	}
}
```

3. **Enable the MCP** in your editor

4. **Prompt the AI** to initialize Local Task Master:

```
Can you please initialize taskmaster into my project?
```

5. **Use common commands** directly through your AI assistant:

```txt
Can you parse my PRD at scripts/prd.txt?
What's the next task I should work on?
Can you help me implement task 3?
Can you help me expand task 4?
```

### Option 2: Using Command Line

#### Installation

```bash
# Install globally
npm install -g local-task-master

# OR install locally within your project
npm install local-task-master
```

#### Initialize a new project

```bash
# If installed globally
task-master init

# If installed locally
npx task-master-init
```

This will prompt you for project details and set up a new project with the necessary files and structure.

#### Common Commands

```bash
# Initialize a new project
task-master init

# Parse a PRD and generate tasks
task-master parse-prd your-prd.txt

# List all tasks
task-master list

# Show the next task to work on
task-master next

# Generate task files
task-master generate
```

## Environment Variables

In addition to the standard Local Task Master environment variables, this fork supports the following AI-related configurations:

- **AI Provider Configuration**:
  - `ANTHROPIC_API_KEY`: Your Anthropic API key
  - `OPENAI_API_KEY`: Your OpenAI API key
  - `AI_BASE_URL`: Base URL for custom OpenAI-compatible endpoints
  - `OPENAI_MODEL`: Default model for OpenAI requests
  - `LOCAL_MODEL`: Model name for local LLM endpoints

- **Performance Settings**:
  - `MAX_RETRIES`: Maximum retry attempts for failed API calls
  - `RETRY_DELAY`: Initial delay between retries (ms)
  - `MAX_CONCURRENT`: Maximum concurrent API requests
  - `CIRCUIT_BREAKER_THRESHOLD`: Failure threshold for circuit breaker

- **Monitoring**:
  - `TRACK_USAGE`: Enable/disable token usage tracking
  - `USAGE_LOG_PATH`: Path for token usage logs
  - `DEBUG`: Enable detailed debug logging
  - `LOG_LEVEL`: Set logging verbosity

## Documentation

For more detailed information, check out the documentation in the `docs` directory:

- [Configuration Guide](docs/configuration.md) - Set up environment variables and customize Local Task Master
- [Tutorial](docs/tutorial.md) - Step-by-step guide to getting started with Local Task Master
- [Command Reference](docs/command-reference.md) - Complete list of all available commands
- [Task Structure](docs/task-structure.md) - Understanding the task format and features
- [Example Interactions](docs/examples.md) - Common Cursor AI interaction examples
- [AI Client Guide](docs/ai-client.md) - Detailed guide for the enhanced AI client system
- [Provider Integration](docs/providers.md) - Adding support for new AI providers

## Troubleshooting

### If `task-master init` doesn't respond:

Try running it with Node directly:

```bash
node node_modules/local-task-master/scripts/init.js
```

Or clone the repository and run:

```bash
git clone https://github.com/eyaltoledano/claude-task-master.git
cd claude-task-master
node scripts/init.js
```

## Licensing

Local Task Master is licensed under the MIT License with Commons Clause. This means you can:

✅ **Allowed**:

- Use Local Task Master for any purpose (personal, commercial, academic)
- Modify the code
- Distribute copies
- Create and sell products built using Local Task Master

❌ **Not Allowed**:

- Sell Local Task Master itself
- Offer Local Task Master as a hosted service
- Create competing products based on Local Task Master

See the [LICENSE](LICENSE) file for the complete license text and [licensing details](docs/licensing.md) for more information.
