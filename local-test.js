const axios = require('axios');
require('dotenv').config();

async function runTests() {
  try {
    console.log('Testing webhook endpoint...');
    const webhookResponse = await axios.post('http://localhost:3000/github-webhook', {
      settings: {
        webhook_url: 'http://localhost:3001/webhook'
      },
      repository: {
        full_name: 'test/repo'
      },
      pusher: {
        name: 'testuser'
      },
      commits: [
        {
          message: 'Test commit'
        }
      ]
    }, {
      headers: {
        'x-github-event': 'push'
      }
    });
    console.log('Webhook test result:', webhookResponse.data);

    console.log('\nTesting tick endpoint...');
    const tickResponse = await axios.post('http://localhost:3000/github/tick', {
      settings: {
        webhook_url: 'http://localhost:3001/webhook',
        github_token: process.env.GITHUB_TOKEN,
        repository_url: 'process.env.REPOSITORY_URL',
        events_to_monitor: 'issues,pull_request,push'
      }
    });
    console.log('Tick test result:', tickResponse.data);

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

runTests();