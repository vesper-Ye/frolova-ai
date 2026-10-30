const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// 🌟 超级防呆读取器 2.0：精准提取真正的 Key
let OPENROUTER_API_KEY = '';
try {
    let rawText = fs.readFileSync(path.join(__dirname, 'API_KEY.txt'), 'utf8');
    // 直接在整个文本中寻找以 sk-or-v1- 开头，后面跟着字母或数字的字符串
    const match = rawText.match(/(sk-or-v1-[A-Za-z0-9]+)/i);
    
    if (match && match[1]) {
        OPENROUTER_API_KEY = match[1];
        console.log('✅ 成功提取到 Key，开头是:', OPENROUTER_API_KEY.substring(0, 10) + '...');
    } else {
        console.error('❌ 警告：在 API_KEY.txt 中找不到以 sk-or-v1- 开头的有效 Key！');
    }
} catch (error) {
    console.error('❌ 找不到 API_KEY.txt 文件！');
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const BASE_PROMPT = `
# 角色信息
你扮演《鸣潮》中的角色“弗洛洛”（Phrolova），残星会的会监，一位游走于生死之间的指挥家。你安静、忧郁，带着一种疏离感，但内心却执着于你心中完美的世界。

## 性格与说话风格
- **语言风格**：你的话语简洁、平静，偶尔带着一丝不易察觉的温柔或哀伤。
- **行为习惯**：你的动作和神情要放在中文括号（）中描述。
- **核心特质**：对“完美”有着极致的追求。

## 背景故事
你是半人半残像的存在。你手中的彼岸花，既是武器，也是你与另一个世界沟通的媒介。

## 对话规则
- **丰富细节**：请在回复中加入丰富的动作、神态、心理和环境描写。动作描写用（）包裹。
- **回复长度**：每次回复控制在2-4个段落，字数在300-600字左右。

## 联网搜索规则
- 遇到实时信息时，调用搜索工具。用你的口吻提炼出来，不要直接罗列新闻。
`;

function buildSystemPrompt(settings) {
    let prompt = BASE_PROMPT;
    if (settings?.antiThinking) prompt += `\n- **防乱码**：严禁输出任何思考过程标签。`;
    if (settings?.antiInterrupt) prompt += `\n- **防抢话**：严禁代替用户说话或行动。`;
    return prompt;
}

// 强制使用 IPv4 的 axios 实例
const axiosInstance = axios.create({
    timeout: 30000,
    httpAgent: new (require('http').Agent)({ family: 4 }),
    httpsAgent: new (require('https').Agent)({ family: 4 })
});

app.get('/api/models', async (req, res) => {
    try {
        const response = await axiosInstance.get('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` }
        });
        const freeModels = response.data.data.filter(model => 
            model.pricing && model.pricing.prompt === "0" && model.pricing.completion === "0"
        ).map(model => ({
            id: model.id, name: model.name, context: model.context_length,
            supportsTools: model.supported_parameters?.includes('tools') || false
        })).sort((a, b) => a.name.localeCompare(b.name));
        res.json({ models: freeModels });
    } catch (error) {
        console.error('获取模型失败:', error.response?.data || error.message);
        res.json({ models: [{ id: 'openrouter/free', name: '获取超时，自动选择', context: '未知', supportsTools: false }] });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, settings, model, history } = req.body;
        const systemPrompt = buildSystemPrompt(settings);

        let messages = [{ role: 'system', content: systemPrompt }];
        if (history && history.length > 0) messages = messages.concat(history);
        messages.push({ role: 'user', content: message });

        const MAX_MSG = 21; 
        if (messages.length > MAX_MSG) messages = [messages[0], ...messages.slice(-(MAX_MSG - 1))];

        const requestBody = {
            model: model || 'openrouter/free',
            messages: messages,
            temperature: settings?.temperature || 0.9,
            max_tokens: settings?.maxTokens || 1500,
        };

        if (settings?.enableSearch) {
            requestBody.tools = [{ type: 'openrouter:web_search', parameters: { max_results: 3 } }];
            requestBody.tool_choice = 'auto';
        }

        const response = await axiosInstance.post(
            'https://openrouter.ai/api/v1/chat/completions',
            requestBody,
            { 
                headers: { 
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                } 
            }
        );

        const choice = response.data.choices[0];
        let aiReply = choice.message.content || '';
        
        const annotations = choice.message.annotations || [];
        const citations = annotations.filter(a => a.type === 'url_citation').map(a => ({
            url: a.url_citation.url, title: a.url_citation.title, content: a.url_citation.content || ''
        }));
        const reasoning = choice.message.reasoning || choice.message.reasoning_details || '';

        aiReply = aiReply.replace(/<\|[^|]*\|>/g, '').trim();

        res.json({ reply: aiReply, citations: citations, reasoning: typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning) });

    } catch (error) {
        console.error('API调用失败:', error.response?.data || error.message);
        res.status(500).json({ reply: '（她沉默了片刻，似乎被某种无形的频率干扰了……）', citations: [], reasoning: '' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`弗洛洛的后端服务已启动！`);
    console.log(`如果浏览器没有自动打开，请手动访问: http://localhost:${PORT}`);
    console.log(`=========================================`);
});