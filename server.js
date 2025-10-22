import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory state (demo)
let config = {
  wheelTitle: 'Roulette Thưởng/Phạt',
  entries: [
    { label: 'Thưởng: Quay 1 vòng', type: 'reward', weight: 2 },
    { label: 'Phạt: Nhảy lò cò',   type: 'penalty', weight: 1 },
    { label: 'Thưởng: Chụp ảnh vui', type: 'reward', weight: 2 },
    { label: 'Phạt: Hít đất 5 cái',  type: 'penalty', weight: 1 },
    { label: 'Thưởng: Gọi tên fan',  type: 'reward', weight: 2 },
    { label: 'Phạt: Uống nước chanh', type: 'penalty', weight: 1 },
    { label: 'Thưởng: Bật nhạc hype', type: 'reward', weight: 2 },
    { label: 'Phạt: Đội nón ngộ nghĩnh', type: 'penalty', weight: 1 }
  ],
  spin: {
    baseRotations: [5, 8],      // số vòng tối thiểu-tối đa
    durationMs: 5200,            // thời gian quay
    pointerOffsetDeg: 0          // nếu pointer không ở đỉnh 12h, chỉnh offset
  },
  sfx: {
    tick: '/tick.mp3',           // có thể thay bằng file bạn
    win: '/win.mp3'
  }
};

const spinQueue = [];
const eventClients = new Set(); // SSE clients

// SSE stream cho overlay & debug
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client = res;
  eventClients.add(client);

  // Gửi state ban đầu
  client.write(`event: init\n`);
  client.write(`data: ${JSON.stringify({ config, queueSize: spinQueue.length })}\n\n`);

  req.on('close', () => {
    eventClients.delete(client);
  });
});

function broadcast(evt, data) {
  const payload = `event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of eventClients) c.write(payload);
}

// Nhận webhook từ Tikfinity hoặc nguồn khác
// Bạn có thể map payload theo ý – ở đây chỉ dùng tối thiểu: user, amount, reason
app.post('/webhook', (req, res) => {
  const { user = 'Khách', amount = 1, reason = 'gift' } = req.body || {};
  const job = { id: Date.now() + '-' + Math.random().toString(36).slice(2), user, amount, reason };
  spinQueue.push(job);
  broadcast('queue', { size: spinQueue.length, last: job });
  res.json({ ok: true });
});

// Overlay sẽ gọi: xin lượt quay tiếp theo khi sẵn sàng
app.post('/next-spin', (req, res) => {
  const job = spinQueue.shift() || null;
  if (job) broadcast('queue', { size: spinQueue.length });
  res.json({ job });
});

// Config CRUD
app.get('/config', (req, res) => res.json(config));
app.post('/config', (req, res) => {
  // đơn giản: thay thế toàn bộ (admin.html gửi đúng schema)
  config = req.body;
  broadcast('config', config);
  res.json({ ok: true });
});

// Debug state
app.get('/debug-state', (req, res) => {
  res.json({ queueSize: spinQueue.length, config, clients: eventClients.size });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Roulette server listening on', PORT));


// Helper: visiting GET /webhook from browser will show info
app.get('/webhook', (req, res) => {
  res
    .status(405)
    .send('This endpoint expects POST with JSON. Use /public/webhook-test.html to send a test POST.');
});
