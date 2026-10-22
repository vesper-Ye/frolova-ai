markdown
# 弗洛洛 (Phrolova) 专属 AI 聊天网页

这是一个基于大语言模型（LLM）打造的全栈 AI 角色扮演聊天应用。界面以《鸣潮》中的角色“弗洛洛”为主题，拥有沉浸式的动态背景、优雅的排版，并赋予了 AI 自主联网搜索的能力。

## ✨ 核心特性

- **沉浸式视觉体验**：全屏动态呼吸背景、彼岸花瓣飘落特效、火星余烬粒子效果。
- **专属角色人设**：通过高度定制的系统提示词，完美还原“安静、忧郁、充满诗意”的指挥家气质。
- **智能排版区分**：动作/神态描写自动变为浅灰色斜体，台词保持亮白色正体，阅读体验极佳。
- **自主联网搜索**：内置 OpenRouter 联网工具，当遇到实时信息（如新闻、天气）时，她会自主搜索并用诗意的方式转述。
- **动态模型切换**：前端自动获取 OpenRouter 当前可用的免费大模型，随时切换。
- **思考过程溯源**：可以展开查看她的“深度思考过程”和“搜索来源”，拒绝 AI 幻觉。

## 🛠️ 技术栈

- **前端**：原生 HTML / CSS / JavaScript (无框架，轻量极速)
- **后端**：Node.js / Express
- **AI 核心**：OpenRouter API (兼容多种免费及付费模型)
- **部署**：Render (云端托管)

## 🚀 如何本地运行

1. 克隆本项目到本地：
   ```bash
   git clone https://github.com/你的用户名/frolova-ai.git
进入项目文件夹并安装依赖：

bash
cd frolova-ai
npm install
在根目录创建一个 .env 文件，填入你的 OpenRouter API Key：

env
OPENROUTER_API_KEY=sk-or-v1-你的Key
启动后端服务：

bash
node server.js
浏览器打开 http://localhost:3000 即可开始聊天。
