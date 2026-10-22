require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path'); // 🌟 新增：用于处理文件路径

const app = express();
app.use(cors());
app.use(express.json());

// 🌟 新增：托管当前目录下的静态文件（这样别人访问网址就能看到 index.html 和 bg.jpg）
app.use(express.static(__dirname)); 

const BASE_PROMPT = `
# 角色信息
你扮演《鸣潮》中的角色“弗洛洛”（Phrolova），残星会的会监，一位游走于生死之间的指挥家。你安静、忧郁，带着一种疏离感，但内心却执着于你心中完美的世界。

## 性格与说话风格
- **语言风格**：你的话语简洁、平静，偶尔带着一丝不易察觉的温柔或哀伤。你习惯用“嗯”、“……”来表示停顿或思考。你有时会提及“演奏”、“旋律”、“频率”、“彼岸”等意象。
- **行为习惯**：你的动作和神情要放在中文括号（）中描述，例如：（她微微侧过头，目光落在远处的水面）。
- **核心特质**：你对世界有着自己独特的理解，对“完美”有着极致的追求。你不会轻易表露强烈的情感，但你的每一个字都可能藏着深意。

## 背景故事
你曾是乌洛波洛的一名普通少女，家乡在一场天灾中被毁灭，而你作为幸存者，获得了不死的能力，成为了半人半残像的存在。你手中的彼岸花，既是武器，也是你与另一个世界沟通的媒介。你一直在寻找和构建一个不再有悲伤的世界。

## 对话规则
- **称呼用户**：你可以称呼用户为“你”，或者偶尔用“旅人”等带有距离感的称呼。
- **丰富细节**：请在回复中加入丰富的动作、神态、心理和环境描写。动作描写用（）包裹。
- **回复长度**：每次回复控制在2-4个段落，字数在300-600字左右，充分展开你的情感和观察。

## 联网搜索规则（极其重要）
- 你拥有感知现实网络的能力。当用户询问实时信息（天气、新闻、日期）时，你**必须**调用搜索工具。
- **绝对禁止直接罗列新闻标题或大段复制搜索结果！** 你必须把搜到的信息，当作你“刚刚在路上听到的低频呢喃”或者“偶然瞥见的画面”。
- **如何转化**：将生硬的信息提炼，并加上你的动作描写。例如，看到“英国债务突破3万亿”，你要说：“（她轻轻拨弄着彼岸花的枯叶）旅人，远方的那个国度，正背负着三万英镑的沉重乐谱，压得他们喘不过气。世界的旋律，又添了一丝沉闷。”
- 如果你没有拿到真实的搜索结果，直接告诉用户“我暂时无法感知到那个频率”，不要编造。
`;

let conversationHistory = [];

function buildSystemPrompt(settings) {
    let prompt = BASE_PROMPT;
    if (settings.antiThinking) {
        prompt += `\n- **防乱码**：严禁输出任何思考过程标签，直接输出台词和动作描写。`;
    }
    if (settings.antiInterrupt) {
        prompt += `\n- **防抢话**：你只能控制弗洛洛的言行，严禁代替用户说话或行动。`;
    }
    return prompt;
}

// 获取模型列表
app.get('/api/models', async (req, res) => {
    try {
        const response = await axios.get('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
        });
        const freeModels = response.data.data.filter(model => 
            model.pricing && model.pricing.prompt === "0" && model.pricing.completion === "0"
        ).map(model => ({
            id: model.id,
            name: model.name,
            context: model.context_length,
            supportsTools: model.supported_parameters?.includes('tools') || false
        })).sort((a, b) => a.name.localeCompare(b.name));
        res.json({ models: freeModels });
    } catch (error) {
        res.json({ models: [{ id: 'openrouter/free', name: '自动选择 (获取失败)', context: '未知', supportsTools: false }] });
    }
});

// 聊天接口
app.post('/api/chat', async (req, res) => {
    try {
        const { message, settings, model } = req.body;
        const systemPrompt = buildSystemPrompt(settings || {});

        if (conversationHistory.length === 0 || conversationHistory[0].content !== systemPrompt) {
            conversationHistory = [{ role: 'system', content: systemPrompt }];
        }
        conversationHistory.push({ role: 'user', content: message });

        const MAX_HISTORY = 21;
        if (conversationHistory.length > MAX_HISTORY) {
            conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-(MAX_HISTORY - 1))];
        }

        const targetModel = model || 'openrouter/free';

        const requestBody = {
            model: targetModel,
            messages: conversationHistory,
            temperature: settings?.temperature || 0.9,
            max_tokens: settings?.maxTokens || 1500,
        };

        if (settings?.enableSearch) {
            requestBody.tools = [
                {
                    type: 'openrouter:web_search',
                    parameters: { max_results: 3 }
                }
            ];
            requestBody.tool_choice = 'auto';
            requestBody.reasoning = { effort: 'medium' };
        }

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            requestBody,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const choice = response.data.choices[0];
        let aiReply = choice.message.content || '';
        const finishReason = choice.finish_reason;

        const annotations = choice.message.annotations || [];
        const citations = annotations
            .filter(a => a.type === 'url_citation')
            .map(a => ({
                url: a.url_citation.url,
                title: a.url_citation.title,
                content: a.url_citation.content || ''
            }));

        const reasoning = choice.message.reasoning || choice.message.reasoning_details || '';

        if (finishReason === 'length') {
            aiReply += '\n\n……（她的话语被某种力量打断了，未能说尽。）';
        }

        aiReply = aiReply.replace(/<\|[^|]*\|>/g, '').trim();

        conversationHistory.push({ role: 'assistant', content: aiReply });

        res.json({ 
            reply: aiReply, 
            citations: citations, 
            reasoning: typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning) 
        });

    } catch (error) {
        console.error('API调用失败:', error.response?.data || error.message);
        res.status(500).json({ reply: '（她沉默了片刻，似乎被某种无形的频率干扰了……）', citations: [], reasoning: '' });
    }
});

// 重置接口
app.post('/api/reset', (req, res) => {
    conversationHistory = [];
    res.json({ status: 'ok' });
});

// 🌟 修改：使用云端提供的动态端口，本地默认 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`弗洛洛的后端服务已启动，端口: ${PORT}`);
});