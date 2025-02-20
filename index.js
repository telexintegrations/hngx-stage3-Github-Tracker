require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const app = express();
const PORT = process.env.PORT;

app.use(bodyParser.json());

const createOctokit = (token) => new Octokit({ auth: token });

app.post('/github-webhook', async (req, res) => {
  console.log('Received webhook:', {
    headers: req.headers,
    body: req.body
  });
  try {
    const eventType = req.headers['x-github-event'];
    const payload = req.body;
    
    const telexPayload = {
      event_name: `GitHub ${eventType}`,
      message: formatGitHubMessage(eventType, payload),
      status: "success",
      username: "GitHub"
    };
    
    await axios.post(process.env.TELEX_WEBHOOK_URL, telexPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Event processed:', telexPayload);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

app.post('/github/tick', async (req, res) => {
  console.log('Received tick:', {
    body: req.body
  });
  try {
    const { return_url, settings } = req.body;
    
    if (!settings.github_token || !settings.repository_url) {
      throw new Error('Missing required settings');
    }
    
    const githubData = await fetchGitHubUpdates(settings);
    
    if (githubData.length > 0) {
      await axios.post(return_url, {
        event_name: "GitHub Update",
        message: formatUpdateMessage(githubData),
        status: "success",
        username: "GitHub"
      });
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing tick:', error);
    res.status(500).json({ error: 'Tick processing failed' });
  }
});

async function fetchGitHubUpdates(settings) {
  const octokit = createOctokit(settings.github_token);
  const [owner, repo] = settings.repository_url.split('/').slice(-2);
  const updates = [];
  
  const eventsToMonitor = settings.events_to_monitor.split(',');
  
  try {
    if (eventsToMonitor.includes('issues')) {
      const { data: issues } = await octokit.issues.listForRepo({
        owner,
        repo,
        state: 'all',
        per_page: 5,
        sort: 'updated'
      });
      updates.push(...issues.map(issue => ({
        type: 'issue',
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        updated_at: issue.updated_at
      })));
    }
    
    if (eventsToMonitor.includes('pull_request')) {
      const { data: prs } = await octokit.pulls.list({
        owner,
        repo,
        state: 'all',
        per_page: 5,
        sort: 'updated'
      });
      updates.push(...prs.map(pr => ({
        type: 'pull_request',
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        updated_at: pr.updated_at
      })));
    }
    
    if (eventsToMonitor.includes('push')) {
      const { data: commits } = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: 5
      });
      updates.push(...commits.map(commit => ({
        type: 'commit',
        message: commit.commit.message,
        author: commit.commit.author.name,
        url: commit.html_url,
        updated_at: commit.commit.author.date
      })));
    }
    
    return updates.sort((a, b) => 
      new Date(b.updated_at) - new Date(a.updated_at)
    ).slice(0, 5);
    
  } catch (error) {
    console.error('Error fetching GitHub updates:', error);
    return [];
  }
}

function formatGitHubMessage(eventType, payload) {
  switch(eventType) {
    case 'push':
      return ` New push to ${payload.repository.full_name}\n` +
             `${payload.commits.length} commits by ${payload.pusher.name}\n` +
             `Latest commit: ${payload.commits[0].message}`;
    
    case 'pull_request':
      return `PR ${payload.action}: ${payload.pull_request.title}\n` +
             `By: ${payload.pull_request.user.login}\n` +
             `URL: ${payload.pull_request.html_url}`;
    
    case 'issues':
      return ` Issue ${payload.action}: ${payload.issue.title}\n` +
             `By: ${payload.issue.user.login}\n` +
             `URL: ${payload.issue.html_url}`;
    
    default:
      return `New ${eventType} event in ${payload.repository?.full_name}`;
  }
}

function formatUpdateMessage(updates) {
  if (updates.length === 0) return "No recent GitHub activity";
  
  const messages = updates.map(update => {
    switch(update.type) {
      case 'issue':
        return `Issue: ${update.title}\nState: ${update.state}\nURL: ${update.url}`;
      case 'pull_request':
        return `PR: ${update.title}\nState: ${update.state}\nURL: ${update.url}`;
      case 'commit':
        return `Commit by ${update.author}\nMessage: ${update.message}\nURL: ${update.url}`;
      default:
        return null;
    }
  }).filter(Boolean);
  
  return "Recent GitHub Activity:\n\n" + messages.join('\n\n');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});