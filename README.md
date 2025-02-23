# GitHub Tracker Integration for Telex

Monitor your GitHub repositories in real-time and receive notifications about issues, pull requests, and commits directly in your Telex channels.

## Features

- Real-time notifications for GitHub repository events
- Configurable event monitoring (issues, pull requests, commits)
- Periodic polling for repository updates
- Webhook support for instant notifications
- Organization-level settings management
- Comprehensive error handling and logging

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- GitHub Personal Access Token
- A webhook-enabled endpoint to receive notifications

## Installation

1. Clone the repository:
```bash
git clone https://github.com/telexintegrations/hngx-stage3-Github-Tracker.git
cd https://github.com/telexintegrations/hngx-stage3-Github-Tracker.git
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
PORT=3000
GITHUB_TOKEN=your_github_token
```

## Configuration

The service can be configured through the `integrations.json` file, which includes:

- Integration metadata
- Application settings
- Event monitoring preferences
- Webhook configurations

### Required Settings

- `interval`: Cron expression for polling frequency (default: "*/5 * * * *")
- `repository_url`: GitHub repository URL in format "owner/repo"
- `events_to_monitor`: Comma-separated list of events to track
- `github_token`: GitHub Personal Access Token
- `webhook_url`: Endpoint URL to receive notifications

## API Endpoints

### Register Organization
```http
POST /register-org
Content-Type: application/json

{
  "org_id": "string",
  "webhook_url": "string",
  "github_token": "string",
  "repository_url": "string",
  "events_to_monitor": "string"
}
```

### GitHub Webhook
```http
POST /github-webhook
X-GitHub-Event: [event_type]
Content-Type: application/json

{
  "repository": {
    "full_name": "string"
  },
  // Event-specific payload
}
```

### Polling Endpoint
```http
POST /github/tick
Content-Type: application/json

{
  "settings": [
    {
      "label": "string",
      "default": "string"
    }
  ]
}
```

## Testing

### Unit Testing

1. Install dev dependencies:
```bash
npm install --save-dev jest @types/jest supertest
```

2. Run the test suite:
```bash
npm test
```

3. Run specific test files:
```bash
npm test github-integration.test.ts
```

4. Run tests with coverage:
```bash
npm run test:coverage
```

### Local Testing with Postman/cURL

1. Start the local server:
```bash
npm start
```

2. Start the test webhook server:
```bash
node test-webhook.js
```

3. Test webhook endpoint using cURL:
```bash
curl -X POST http://localhost:3000/github-webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{
    "repository": {
      "full_name": "test/repo"
    },
    "pusher": {
      "name": "testuser"
    },
    "commits": [
      {
        "message": "Test commit"
      }
    ]
  }'
```

4. Test tick endpoint using cURL:
```bash
curl -X POST http://localhost:3000/github/tick \
  -H "Content-Type: application/json" \
  -d '{
    "settings": [
      {
        "label": "webhook_url",
        "default": "http://localhost:3001/webhook"
      },
      {
        "label": "github_token",
        "default": "your_github_token"
      },
      {
        "label": "repository_url",
        "default": "owner/repo"
      },
      {
        "label": "events_to_monitor",
        "default": "issues,pull_request,push"
      }
    ]
  }'
```

### Testing with Telex

1. Configure the Integration:
   - Log into your Telex dashboard
   - Navigate to Integrations
   - Select "Add New Integration"
   - Choose "GitHub Integration"
     
2. Add Webhook Configuration to github:
   - Open webhook settings in GitHub repository
   - Add webhook URL (https://hngx-stage3-github-tracker-production.up.railway.app/github-webhook)
   - Review webhook delivery history in GitHub

3. Set up Integration Settings:
   - Enter your GitHub repository URL (owner/repo format)
   - Paste your GitHub Personal Access Token
   - Select events to monitor
   - Configure polling interval
   - Save the integration settings

4. Test Real-time Updates:
   - Make changes in your GitHub repository:
     - Create a new issue
     - Open a pull request
     - Push a commit
   - Monitor the Telex activity feed for notifications

## Event Formatting

The service formats different GitHub events into consistent messages:

- Push events: Include repository name, number of commits, and latest commit message
- Pull request events: Include PR title, author, and URL
- Issue events: Include issue title, author, and URL

## Error Handling

The service implements robust error handling for:
- Invalid webhook URLs
- Missing required parameters
- GitHub API failures
- Malformed repository URLs
- Event processing errors

## Development

### Directory Structure
```
├── index.js           # Main application file
├── integrations.json  # Configuration file
├── test/
│   ├── github-integration.test.ts
│   └── local-test.js
└── test-webhook.js    # Test webhook server
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
