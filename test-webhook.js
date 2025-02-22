const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  console.log('Received webhook:', req.body);
  res.json({ success: true });
});

app.listen(3001, () => console.log('Test webhook server running on port 3001'));