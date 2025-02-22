require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT;

let Octokit;
let server = null;

(async () => {
  const module = await import("@octokit/rest");
  Octokit = module.Octokit; 
})();

app.use(bodyParser.json());

const orgSettings = new Map();
const createOctokit = (token) => {
  if (!Octokit) {
    throw new Error("Octokit is not initialized yet. Ensure the import has completed.");
  }
  return new Octokit({ auth: token });
};

app.post('/register-org', (req, res) => {
  const { org_id, webhook_url, github_token, repository_url, events_to_monitor } = req.body;
  
  if (!org_id || !webhook_url || !github_token || !repository_url) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  orgSettings.set(org_id, {
    webhook_url,
    github_token,
    repository_url,
    events_to_monitor: events_to_monitor || 'issues,pull_request,push'
  });
  
  res.json({ success: true });
});

app.post('/github-webhook', async (req, res) => {
  try {
    const eventType = req.headers['x-github-event'];
    const payload = req.body;

    const webhookSetting = payload.settings?.find(s => s.label === 'webhook_url');
    const webhook_url = webhookSetting?.default;
    
    if (!webhook_url) {
      console.error('No webhook URL found in settings');
      return res.status(400).json({ error: 'Webhook URL not configured' });
    }


    const telexPayload = {
      event_name: `GitHub ${eventType}`,
      message: formatGitHubMessage(eventType, payload),
      status: "success",
      username: "GitHub"
    };

    await axios.post(payload.settings.webhook_url, telexPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Full error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

app.post('/github/tick', async (req, res) => {
  try {
    const settings = req.body.settings;
    
    if (!Array.isArray(settings)) {
      throw new Error('Settings must be an array');
    }
    
    const settingsObj = {
      webhook_url: settings.find(s => s.label === 'webhook_url')?.default,
      github_token: settings.find(s => s.label === 'github_token')?.default,
      repository_url: settings.find(s => s.label === 'repository_url')?.default,
      events_to_monitor: settings.find(s => s.label === 'events_to_monitor')?.default
    };    
    
    if (!settingsObj.webhook_url || !settingsObj.github_token || !settingsObj.repository_url) {
      console.error('Missing settings:', settings);
      throw new Error('Missing required settings');
    }
    
    const githubData = await fetchGitHubUpdates(settingsObj);
    
    if (githubData.length > 0) {
      await axios.post(settingsObj.webhook_url, {
        event_name: "GitHub Update",
        message: formatUpdateMessage(githubData),
        status: "success",
        username: "GitHub"
      });
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing tick:', error);
    res.status(500).json({ error: error.message });
  }
});

async function fetchGitHubUpdates(settings) {
  if (!Octokit) {
    console.error("Octokit is not initialized yet.");
    return [];
  }
  
  const octokit = createOctokit(settings.github_token);
  let owner, repo;
  try {
    const repoUrl = settings.repository_url;
    if (repoUrl.includes('github.com')) {
      const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
      owner = urlParts[0];
      repo = urlParts[1];
    } else {
      [owner, repo] = repoUrl.split('/').filter(Boolean);
    }
    if (repoUrl.includes('.git')) {
      repoUrl = repoUrl.replace('.git', '');
  }  

    if (!owner || !repo) {
      throw new Error('Invalid repository URL format');
    }
  } catch (error) {
    console.error('Error parsing repository URL:', error);
    return [];
  }
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

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, server, formatGitHubMessage, formatUpdateMessage, fetchGitHubUpdates };