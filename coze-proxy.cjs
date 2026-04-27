console.log('启动 Coze 代理服务 (详细轮询版)');

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const COZE_PAT = process.env.VITE_COZE_PAT;
const COZE_BOT_ID = process.env.VITE_COZE_BOT_ID;
const COZE_API_BASE = 'https://api.coze.cn';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

app.post('/api/coze/chat', async (req, res) => {
  const { text, userId } = req.body;
  if (!text) return res.status(400).json({ error: '请输入问题内容' });

  try {
    // 1. 创建聊天
    const createUrl = `${COZE_API_BASE}/v3/chat`;
    const createBody = {
      bot_id: COZE_BOT_ID,
      user_id: userId || 'teachingweb-user',
      additional_messages: [{ role: 'user', content: text, content_type: 'text' }],
      auto_save_history: true,
      stream: false,
    };

    console.log('📤 创建聊天请求:', JSON.stringify(createBody, null, 2));

    const createResp = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    });

    const createData = await createResp.json();
    console.log('📥 创建聊天响应:', JSON.stringify(createData, null, 2));

    if (!createResp.ok || createData.code !== 0) {
      return res.status(500).json({ error: `创建聊天失败: ${createData.msg || '未知错误'}` });
    }

    const { id: chatId, conversation_id: conversationId } = createData.data;
    console.log(`✅ 聊天已创建，chat_id: ${chatId}, conversation_id: ${conversationId}`);

    // 2. 轮询获取消息
    let attempts = 0;
    const maxAttempts = 30;
    let reply = null;

    while (attempts < maxAttempts && !reply) {
      await sleep(1000);
      attempts++;

      const msgUrl = `${COZE_API_BASE}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`;
      const msgResp = await fetch(msgUrl, {
        headers: { 'Authorization': `Bearer ${COZE_PAT}` },
      });
      const msgData = await msgResp.json();

      if (msgData.code !== 0) {
        console.error(`❌ 获取消息失败 (尝试 ${attempts}/${maxAttempts}):`, msgData.msg);
        continue;
      }

      const messages = msgData.data || [];
      console.log(`📨 第 ${attempts} 次轮询，消息数量: ${messages.length}`);

      const assistantMsg = messages.find(m => m.role === 'assistant' && m.content?.trim());
      if (assistantMsg) {
        reply = assistantMsg.content;
        break;
      }

      // 检查会话状态
      const statusUrl = `${COZE_API_BASE}/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`;
      const statusResp = await fetch(statusUrl, {
        headers: { 'Authorization': `Bearer ${COZE_PAT}` },
      });
      const statusData = await statusResp.json();
      if (statusData.data?.status === 'completed') {
        console.log('⚠️ 会话已完成，但没有 assistant 消息');
        break;
      }
    }

    if (!reply) {
      reply = '抱歉，智能体没有返回有效回复，请检查 Bot 发布状态。';
    }

    console.log(`💬 最终回复: ${reply.substring(0, 100)}`);
    res.json({ reply });

  } catch (err) {
    console.error('🔥 代理服务异常:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send('Coze Proxy 运行中'));

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));