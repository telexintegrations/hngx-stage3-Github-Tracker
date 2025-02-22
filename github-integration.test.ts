const axios = require('axios');
const { app, server, formatGitHubMessage, formatUpdateMessage, fetchGitHubUpdates } = require('./index');
const request = require('supertest');

jest.mock('axios');

interface IntegrationSetting {
  label: string;
  value?: string;
}

interface IntegrationsData {
  descriptions: {
    app_name: string;
    app_url: string;
  };
  settings: IntegrationSetting[];
}

const integrations: { data: IntegrationsData } = require('./integrations.json');

const mockOctokitInstance = {
  issues: {
    listForRepo: jest.fn().mockResolvedValue({
      data: [{
        title: 'Test Issue',
        state: 'open',
        html_url: 'https://github.com/test/issue',
        updated_at: '2024-02-22T00:00:00Z'
      }]
    })
  },
  pulls: {
    list: jest.fn().mockResolvedValue({
      data: [{
        title: 'Test PR',
        state: 'open',
        html_url: 'https://github.com/test/pr',
        updated_at: '2024-02-22T00:00:00Z'
      }]
    })
  },
  repos: {
    listCommits: jest.fn().mockResolvedValue({
      data: [{
        commit: {
          message: 'Test commit',
          author: {
            name: 'testuser',
            date: '2024-02-22T00:00:00Z'
          }
        },
        html_url: 'https://github.com/test/commit'
      }]
    })
  }
};

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => mockOctokitInstance)
}));

describe('GitHub Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatGitHubMessage', () => {
    it('formats push event correctly', () => {
      const payload = {
        repository: { full_name: 'owner/repo' },
        commits: [{ message: 'test commit' }],
        pusher: { name: 'testuser' }
      };
      
      const message = formatGitHubMessage('push', payload);
      
      expect(message).toContain('New push to owner/repo');
      expect(message).toContain('commits by testuser');
      expect(message).toContain('Latest commit: test commit');
    });

    it('formats pull request event correctly', () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          user: { login: 'testuser' },
          html_url: 'https://github.com/test/url'
        }
      };
      
      const message = formatGitHubMessage('pull_request', payload);
      
      expect(message).toContain('PR opened: Test PR');
      expect(message).toContain('By: testuser');
      expect(message).toContain('URL: https://github.com/test/url');
    });
  });

  describe('formatUpdateMessage', () => {
    it('formats empty updates correctly', () => {
      const message = formatUpdateMessage([]);
      expect(message).toBe('No recent GitHub activity');
    });

    it('formats multiple updates correctly', () => {
      const updates = [
        {
          type: 'issue',
          title: 'Test Issue',
          state: 'open',
          url: 'https://github.com/test/issue'
        },
        {
          type: 'pull_request',
          title: 'Test PR',
          state: 'open',
          url: 'https://github.com/test/pr'
        }
      ];

      const message = formatUpdateMessage(updates);
      expect(message).toContain('Issue: Test Issue');
      expect(message).toContain('PR: Test PR');
    });
  });

  describe('fetchGitHubUpdates', () => {
    const mockSettings = {
      github_token: 'test-token',
      repository_url: 'owner/repo',
      events_to_monitor: 'issues,pull_request,push',
      webhook_url: 'http://test.com/webhook'
    };

    it('fetches and formats updates correctly', async () => {
      const updates = await fetchGitHubUpdates(mockSettings);
      expect(updates).toHaveLength(3);
      expect(updates[0]).toHaveProperty('type');
      expect(updates[0]).toHaveProperty('title');

      expect(mockOctokitInstance.issues.listForRepo).toHaveBeenCalled();
      expect(mockOctokitInstance.pulls.list).toHaveBeenCalled();
      expect(mockOctokitInstance.repos.listCommits).toHaveBeenCalled();
    });

    it('handles API errors gracefully', async () => {
      mockOctokitInstance.issues.listForRepo.mockRejectedValue(new Error('API Error'));
      mockOctokitInstance.pulls.list.mockRejectedValue(new Error('API Error'));
      mockOctokitInstance.repos.listCommits.mockRejectedValue(new Error('API Error'));

      const updates = await fetchGitHubUpdates(mockSettings);
      expect(updates).toEqual([]);
    });
  });

  describe('GitHub Webhook - Push Event', () => {
    it('should process a valid push event', async () => {
      const pushPayload = {
        repository: { full_name: 'test/repo' },
        pusher: { name: 'testuser' },
        commits: [{ message: 'Initial commit' }]
      };
  
      const response = await request(app)
        .post('/github-webhook')
        .set('x-github-event', 'push')
        .send({ settings: { webhook_url: 'http://localhost:3001/webhook' }, ...pushPayload });
  
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });
  
  describe('GitHub Webhook - Pull Request Events', () => {
    const prPayload = {
      action: 'opened',
      pull_request: {
        title: 'New Feature',
        user: { login: 'testuser' },
        html_url: 'https://github.com/test/pr'
      }
    };
  
    it('should process a PR open event', async () => {
      const response = await request(app)
        .post('/github-webhook')
        .set('x-github-event', 'pull_request')
        .send({ settings: { webhook_url: 'http://localhost:3001/webhook' }, ...prPayload });
  
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  
    it('should process a PR close event', async () => {
      prPayload.action = 'closed';
      const response = await request(app)
        .post('/github-webhook')
        .set('x-github-event', 'pull_request')
        .send({ settings: { webhook_url: 'http://localhost:3001/webhook' }, ...prPayload });
  
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  
    it('should process a PR merge event', async () => {
      prPayload.action = 'merged';
      const response = await request(app)
        .post('/github-webhook')
        .set('x-github-event', 'pull_request')
        .send({ settings: { webhook_url: 'http://localhost:3001/webhook' }, ...prPayload });
  
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });
  
  describe('GitHub Webhook - Issue Events', () => {
    const issuePayload = {
      action: 'opened',
      issue: {
        title: 'Bug Report',
        user: { login: 'testuser' },
        html_url: 'https://github.com/test/issue'
      }
    };
  
    it('should process an issue open event', async () => {
      const response = await request(app)
        .post('/github-webhook')
        .set('x-github-event', 'issues')
        .send({ settings: { webhook_url: 'http://localhost:3001/webhook' }, ...issuePayload });
  
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  
    it('should process an issue close event', async () => {
      issuePayload.action = 'closed';
      const response = await request(app)
        .post('/github-webhook')
        .set('x-github-event', 'issues')
        .send({ settings: { webhook_url: 'http://localhost:3001/webhook' }, ...issuePayload });
  
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });
  
});

describe('Integrations JSON', () => {
  it('should have required integration fields', () => {
    expect(integrations).toHaveProperty('data');
    expect(integrations.data).toHaveProperty('descriptions');
    expect(integrations.data).toHaveProperty('settings');
    expect(integrations.data.descriptions).toHaveProperty('app_name', 'GitHub Integration');
    expect(integrations.data.descriptions).toHaveProperty('app_url', 'https://github.com');
  });

  it('should have valid settings structure', () => {
    expect(Array.isArray(integrations.data.settings)).toBe(true);
    const requiredLabels = ['interval', 'repository_url', 'events_to_monitor', 'github_token', 'webhook_url'];

    const settingLabels = integrations.data.settings.map((setting: { label: string }) => setting.label);

    requiredLabels.forEach(label => {
      expect(settingLabels).toContain(label);
    });
  });
});

afterAll(() => {
  if (server) {
    server.close();
  }
});
