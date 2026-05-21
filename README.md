# 🏢 Company OS — CLI v2 & Web Dashboard

An autonomous, multi-agent C-Suite and specialist pipeline powered by Claude. Run strategic pipelines, execute parallel workflows, set up recurring cron schedules, and sync CLI outputs to a modern Web GUI dashboard in real-time.

---

## 🚀 Key Features

- **113 AI Agents**: Specialized agents spanning C-Suite (CEO, CTO, CMO, CFO), Product, Operations, HR, Finance, Engineering, Marketing, Sales, Legal, and Risk.
- **Parallel Pipeline Execution**: Runs multi-phase analyses (Discovery, Product, Technology, GTM, Finance, Operations) parallelizing agent outputs.
- **Node.js Native**: Written using pure Node.js built-in modules—no heavy npm dependencies required.
- **Claude CLI / API Hybrid**: Defaults to using the local authenticated Claude CLI session (`claude` command-line tool) with zero API keys required, or falls back to standard Anthropic API calls.
- **CLI-HTML SSE Bridge**: Real-time events, runs, and completions sync seamlessly from the terminal to the Web GUI dashboard.
- **Schedules**: Create and run scheduled/recurring agent tasks.
- **Notion, GitHub & Slack Integrations**: Directly fetch open pull requests/issues, Notion pages, and broadcast outputs to Slack webhooks.

---

## 🛠️ Getting Started

### Prerequisites
1. **Node.js**: Version 16.0.0 or higher.
2. **Claude CLI**: Ensure that the `claude` CLI command is installed and authenticated on your system:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude login
   ```

### Installation
Clone or download the project files into your working directory, then make the CLI script executable:
```bash
chmod +x company-os-cli.js
```

---

## 💻 CLI Usage Reference

You can run the script using `node company-os-cli.js` or via the npm scripts defined in `package.json`.

| Command | Action | Example |
| :--- | :--- | :--- |
| **`list`** | List all 113 agents categorized by department | `node company-os-cli.js list` |
| **`run`** | Run a single agent with a task | `node company-os-cli.js run ceo --task "Define Q3 targets"` |
| **`pipeline`** | Run the 6-phase parallel execution pipeline | `node company-os-cli.js pipeline --task "EdTech class prep SaaS"` |
| **`chat`** | Start an interactive streaming chat session with an agent | `node company-os-cli.js chat cto` |
| **`ceo`** | Run CEO in autonomous mode (decompose, delegate, synthesize) | `node company-os-cli.js ceo "Audit our codebase structure"` |
| **`chain`** | Run recursive delegation chains down the org structure | `node company-os-cli.js chain cto --task "Design system design" --depth 2` |
| **`server`** | Start the live SSE bridge server for the Web GUI | `node company-os-cli.js server` |
| **`status`** | View saved agent data and system state | `node company-os-cli.js status` |
| **`profile`** | View or modify the active company metadata profile | `node company-os-cli.js profile --set "name=Stellar,stage=Scaling"` |
| **`tools`** | Configure third-party tokens (GitHub, Notion, Slack) | `node company-os-cli.js tools --set "slackWebhook=https://..."` |
| **`schedule`** | Manage scheduled agent runs | `node company-os-cli.js schedule list` |
| **`sync`** | Sync tasks and outputs between CLI files and browser storage | `node company-os-cli.js sync export` |
| **`clear`** | Wipe all local database cache and configurations | `node company-os-cli.js clear` |

---

## 📊 Web GUI Dashboard

To use the graphical dashboard interface:
1. Run the SSE Bridge server from your terminal:
   ```bash
   npm run server
   ```
2. Open `company-os-complete.html` (or any of the individual module HTML files) directly in your browser.
3. The pages will automatically connect to the local server at `http://127.0.0.1:3001` and receive real-time streams of agent tasks, schedules, and active runs!
4. Save your Anthropic API Key in the dashboard header to run tasks directly from the browser window.

---

## ⚙️ Configuration & Data Storage

All persistent data is stored locally in your home directory under the `.company-os` folder:
- **`data.json`**: Active company profile, agent history, and custom outputs.
- **`schedules.json`**: Configured cron-jobs/tasks.
- **`config.json`**: Notion database IDs, Slack Webhooks, and GitHub repository tokens.
- **`broadcast.jsonl`**: Real-time event streams watched by the SSE bridge server.

---

## 📝 License

This project is open-source and licensed under the [MIT License](LICENSE).
