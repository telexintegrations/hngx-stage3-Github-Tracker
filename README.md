# GitHub Integration for Telex

Monitor your GitHub repositories in real-time and receive notifications about issues, pull requests, and commits directly in your Telex channels.

## Features

- Real-time webhook notifications for:
  - New issues and issue updates
  - Pull request activities
  - Repository pushes and commits
- Periodic checks for repository updates
- Customizable monitoring settings
- Secure GitHub token authentication
- Formatted messages with relevant links and details

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- A GitHub account with repository access
- A Telex account with admin privileges

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd github-integration
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
PORT=3000
TELEX_WEBHOOK_URL=your_telex_webhook_url
```

4. Generate a GitHub Personal Access Token:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Click "Generate new token"
   - Select scopes: `repo` and `admin:repo_hook`
   - Copy the token for later use

## Local Development

1. Start the server:
```bash
node server.js
```

2. Install and run ngrok for webhook testing:
```bash
npm install -g ngrok
ngrok http 3000
```

3. Configure GitHub webhook:
   - Go to your repository → Settings → Webhooks
   - Add webhook
   - Payload URL: Your ngrok URL + `/github-webhook`
   - Content type: `application/json`
   - Select events: Issues, Pull requests, Pushes

## Configuration

The integration requires the following settings in Telex:

| Setting | Description | Example |
|---------|-------------|---------|
| interval | Cron expression for check frequency | */5 * * * * |
| repository_url | GitHub repository path | owner/repo |
| events_to_monitor | Events to track | issues,pull_request,push |
| github_token | GitHub Personal Access Token | ghp_xxxxxxxxxxxx |

## Deployment

1. Host your integration code (e.g., on Heroku, Railway, or your preferred platform)
2. Host your `integrations.json` file (can be on GitHub Pages or any static file host)
3. Update the URLs in `integrations.json`:
```json
{
  "tick_url": "https://server/github/tick",
  "target_url": "https://server/github-webhook"
}
```
4. Configure environment variables on your hosting platform
5. Update GitHub webhook to point to your production URL

## Testing

To test the integration:

1. Create a test issue in your GitHub repository
2. Make a test commit and push
3. Create a test pull request
4. Verify that notifications appear in your Telex channel
5. Check server logs for any errors

For testing the tick endpoint manually:
```bash
curl -X POST http://localhost:3000/github/tick \
  -H "Content-Type: application/json" \
  -d '{
    "return_url": "your_telex_webhook_url",
    "settings": {
      "github_token": "your_token",
      "repository_url": "owner/repo",
      "events_to_monitor": "issues,pull_request,push"
    }
  }'
```

## Troubleshooting

Common issues and solutions:

1. No messages in Telex:
   - Verify GitHub webhook is properly configured
   - Check server logs for webhook receipt
   - Ensure TELEX_WEBHOOK_URL is correct
   - Validate GitHub token permissions

2. Webhook errors:
   - Confirm ngrok is running (for local testing)
   - Verify webhook URL is accessible
   - Check GitHub webhook delivery logs

3. Integration not working:
   - Verify all required settings are filled
   - Check server logs for errors
   - Ensure GitHub token hasn't expired
   - Validate repository URL format