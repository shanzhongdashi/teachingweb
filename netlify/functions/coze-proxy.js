// netlify/functions/coze-proxy.js

const COZE_API_BASE = 'https://api.coze.cn';
const MAX_POLL_ATTEMPTS = 20;      // 最多轮询 20 次，防止函数超时
const POLL_INTERVAL_MS = 1000;     // 每次间隔 1 秒

// 供轮询之间等待
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.handler = async (event, context) => {
  // 处理 CORS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // 仅允许 POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { text, userId } = JSON.parse(event.body);

    if (!text) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '请输入问题内容' }),
      };
    }

    // 1. 创建聊天
    const createUrl = `${COZE_API_BASE}/v3/chat`;
    const createBody = {
      bot_id: process.env.COZE_BOT_ID,
      user_id: userId || 'teachingweb-user',
      additional_messages: [{ role: 'user', content: text, content_type: 'text' }],
      auto_save_history: true,
      stream: false,
    };

    console.log('📤 创建聊天请求:', JSON.stringify(createBody, null, 2));

    const createResp = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COZE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    });

    const createData = await createResp.json();
    console.log('📥 创建聊天响应:', JSON.stringify(createData, null, 2));

    if (!createResp.ok || createData.code !== 0) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `创建聊天失败: ${createData.msg || '未知错误'}` }),
      };
    }

    const { id: chatId, conversation_id: conversationId } = createData.data;
    console.log(`✅ 聊天已创建，chat_id: ${chatId}`);

    // 2. 轮询获取回复
    let reply = null;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);

      const msgUrl = `${COZE_API_BASE}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`;
      const msgResp = await fetch(msgUrl, {
        headers: { 'Authorization': `Bearer ${process.env.COZE_PAT}` },
      });
      const msgData = await msgResp.json();

      if (msgData.code !== 0) {
        console.error(`❌ 拉取消息失败 (尝试 ${i + 1}/${MAX_POLL_ATTEMPTS}):`, msgData.msg);
        continue;
      }

      const messages = msgData.data || [];
      const assistantMsg = messages.find(m => m.role === 'assistant' && m.content?.trim());
      if (assistantMsg) {
        reply = assistantMsg.content;
        break;
      }

      // 检查会话状态（可选）
      const statusUrl = `${COZE_API_BASE}/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`;
      const statusResp = await fetch(statusUrl, {
        headers: { 'Authorization': `Bearer ${process.env.COZE_PAT}` },
      });
      const statusData = await statusResp.json();
      if (statusData.data?.status === 'completed') {
        console.log('⚠️ 会话已完成但没有 assistant 消息');
        break;
      }
    }

    reply = reply || '抱歉，智能体没有返回有效回复，请检查 Bot 发布状态。';
    console.log(`💬 最终回复: ${reply.substring(0, 100)}`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reply }),
    };

  } catch (err) {
    console.error('🔥 代理服务异常:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
