const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db/database');
const { initDemoData } = require('./scripts/initData');
const { recycleExpiredLeases } = require('./utils/businessRules');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/spaces', require('./routes/spaces'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/leases', require('./routes/leases'));
app.use('/api/renewals', require('./routes/renewals'));
app.use('/api/arrears', require('./routes/arrears'));
app.use('/api/payments', require('./routes/payments'));

app.get('/api/health', (req, res) => {
  res.json({
    code: 0,
    status: 'ok',
    timestamp: new Date().toLocaleString('zh-CN'),
    version: '1.0.0'
  });
});

app.use((req, res) => {
  res.status(404).json({ code: 404, message: 'API不存在' });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, message: err.message || '服务器内部错误' });
});

const checkCountSqlite = async () => {
  try {
    const db = require('./db/database');
    const spaceCount = (await db.prepare('SELECT COUNT(*) as cnt FROM parking_spaces').get()).cnt;
    if (spaceCount === 0) {
      console.log('检测到空数据库，自动初始化演示数据...');
      await initDemoData();
    }
  } catch (e) {
    console.error('数据初始化检查失败:', e);
  }
};

const startServer = async () => {
  try {
    await initDatabase();

    app.listen(PORT, async () => {
      console.log(`
============================================
🚀 车位月租续费管理系统 API 服务已启动
📡 监听端口: ${PORT}
🌐 API 基址: http://localhost:${PORT}/api
🗄️  数据目录: ${dbDir}
============================================
`);
      await checkCountSqlite();

      await recycleExpiredLeases();
      setInterval(async () => {
        try {
          await recycleExpiredLeases();
        } catch (e) {
          console.error('定时回收过期租约失败:', e);
        }
      }, 60 * 60 * 1000);
    });
  } catch (e) {
    console.error('服务启动失败:', e);
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  process.exit(0);
});

startServer();
