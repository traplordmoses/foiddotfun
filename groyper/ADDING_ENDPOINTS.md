# Adding New Endpoints to the UI

This guide shows how to add new API endpoints to both the server and UI.

## Step 1: Add Endpoint to Server (`server.js`)

### Example: Adding a `/api/health` endpoint

```javascript
// Add to server.js
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### Example: Adding a POST endpoint with body validation

```javascript
app.post('/api/my-endpoint', async (req, res) => {
  try {
    const { field1, field2 } = req.body;
    
    if (!field1) {
      return res.status(400).json({ error: 'field1 is required' });
    }
    
    // Your logic here
    const result = { success: true, data: 'some data' };
    
    res.json(result);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});
```

## Step 2: Add UI Function to Call Endpoint (`public/index.html`)

### Option A: Simple Fetch Function

Add this in the `<script>` section:

```javascript
// Fetch health status
async function fetchHealth() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    console.log('Health:', data);
    return data;
  } catch (error) {
    console.error('Failed to fetch health:', error);
    updateStatus('✗ Failed to fetch health', 'error');
  }
}

// Call on page load or button click
fetchHealth();
```

### Option B: POST with Body

```javascript
async function callMyEndpoint(field1, field2) {
  try {
    const response = await fetch('/api/my-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        field1: field1,
        field2: field2
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      updateStatus('✓ Success!', 'success');
      return data;
    } else {
      throw new Error(data.error || 'Request failed');
    }
  } catch (error) {
    updateStatus('✗ Error: ' + error.message, 'error');
    console.error('Error:', error);
  }
}
```

## Step 3: Add UI Elements (Optional)

### Add a Button

In the HTML section, add:

```html
<button type="button" id="myButton" style="width: auto; padding: 10px 20px;">
  My Action
</button>
```

### Add Event Listener

In the `<script>` section:

```javascript
document.getElementById('myButton').addEventListener('click', async () => {
  const result = await callMyEndpoint('value1', 'value2');
  if (result) {
    // Handle success
    console.log('Result:', result);
  }
});
```

### Display Result

Add a div to show results:

```html
<div id="myResult" class="result" style="margin-top: 15px;"></div>
```

Update it in your function:

```javascript
const resultEl = document.getElementById('myResult');
resultEl.className = 'result success';
resultEl.innerHTML = `
  <strong>✓ Success!</strong><br>
  <strong>Data:</strong> ${escapeHtml(JSON.stringify(data))}
`;
resultEl.style.display = 'block';
```

## Complete Example: Adding a Stats Endpoint

### Server (`server.js`)

```javascript
app.get('/api/stats', (req, res) => {
  try {
    const totalDeposits = db.prepare('SELECT COUNT(*) as count FROM deposits').get().count;
    const totalClaimed = db.prepare('SELECT COUNT(*) as count FROM deposits WHERE claimed = 1').get().count;
    const totalAmount = db.prepare('SELECT SUM(amount) as total FROM deposits').get().total || 0;
    
    res.json({
      success: true,
      stats: {
        totalDeposits,
        totalClaimed,
        totalPending: totalDeposits - totalClaimed,
        totalAmount: totalAmount.toFixed(4)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});
```

### Frontend (`public/index.html`)

Add to HTML:
```html
<div class="messages-section">
  <div class="messages-header">
    <h2>📊 Statistics</h2>
    <button type="button" id="refreshStatsBtn" style="width: auto; padding: 8px 16px; font-size: 14px;">
      Refresh Stats
    </button>
  </div>
  <div id="statsDisplay" style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
    <div style="text-align: center; color: #999;">Click Refresh Stats to load</div>
  </div>
</div>
```

Add to JavaScript:
```javascript
async function fetchStats() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();
    
    if (data.success) {
      const statsEl = document.getElementById('statsDisplay');
      statsEl.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
          <div>
            <strong>Total Deposits:</strong> ${data.stats.totalDeposits}
          </div>
          <div>
            <strong>Claimed:</strong> ${data.stats.totalClaimed}
          </div>
          <div>
            <strong>Pending:</strong> ${data.stats.totalPending}
          </div>
          <div>
            <strong>Total Amount:</strong> ${data.stats.totalAmount} ETH
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
}

document.getElementById('refreshStatsBtn').addEventListener('click', fetchStats);

// Load stats on page load
fetchStats();
```

## Pattern Summary

1. **Server**: Add route handler with validation
2. **Frontend**: Create async function to fetch/call endpoint
3. **UI**: Add button/trigger element (optional)
4. **Display**: Show results using existing CSS classes (`.result`, `.status`)

Use the existing patterns in `server.js` and `index.html` as templates!

