<div align="center">
  <h1>深度房贷计算器 · Deep Mortgage Calculator</h1>
  <h3>智能分析 · 精准计算 · 科学决策</h3>

  <p>
    <b>支持 LPR/利率变动与提前还款策略对比的深度房贷模拟器。</b><br>
    纯前端零依赖：打开浏览器即可使用，手机/PC 皆友好。
  </p>

  <h3>
    👉 <a href="https://SeanWong17.github.io/Deep-Mortgage-Calculator/">点击进入在线演示 (Live Demo)</a> 👈
  </h3>

  <p>
    <img alt="HTML5" src="https://img.shields.io/badge/html5-%23E34F26.svg?style=flat&logo=html5&logoColor=white">
    <img alt="JavaScript" src="https://img.shields.io/badge/javascript-%23323330.svg?style=flat&logo=javascript&logoColor=%23F7DF1E">
    <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">
      <img alt="CC BY-NC-SA 4.0" src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg">
    </a>
  </p>
</div>

---

## 📖 简介

市面上的房贷计算器大多只能计算“初始状态”。但在长达 20–30 年的还款周期中，我们经常会面临：

- **LPR / 利率重定价后的调整**
- **提前还款**：到底是“减月供”还是“减年限”更划算？
- 组合贷（商贷 + 公积金）两条贷款并行的复杂情况

**深度房贷计算器**以“时间轴事件”的方式（利率调整 / 提前还款）来模拟还款过程，输出：
- 新旧方案的**利息差异**
- **还款周期变化**
- **剩余本金趋势对比图**
- 全量**月度还款计划表**

> 目标不是替代银行系统，而是帮助你做“方案对比与决策预演”。

---

## ✨ 核心功能

- **📊 组合贷款支持**：商贷 + 公积金可分别设置金额、利率、期限、还款方式  
- **📅 利率调整（模拟 LPR）**：可在任意期数添加利率变动事件  
- **💰 提前还款模拟（可多次）**
  - 支持多次提前还款事件
  - 两种策略对比：**减月供 / 减年限**
- **📈 可视化分析**
  - Canvas 绘制“剩余本金趋势”对比图（原计划 vs 新计划）
  - 自动汇总：累计节省利息、周期变化、事件收益明细
- **📱 移动端友好**：响应式布局，手机也能顺畅操作  
- **🚀 轻量无构建**：无需 Node.js / 无后端 / 开箱即用

---

## 🧠 计算方式

- 按“月”模拟，每月利息约为：剩余本金 × (年利率 / 12)
- **等额本息**：按剩余期数重算月供；**等额本金**：本金按剩余期数均摊
- 利率调整与提前还款按期数触发，并影响后续还款路径

---

## ⚠️ 重要声明

本工具仅用于**估算与方案对比**。实际扣款可能因以下原因与模拟结果存在差异：

- 银行计息口径（按月/按日）、重定价日规则、扣款顺序等细节不同  
- 金额精度与四舍五入策略（元/分）导致末期误差  
- 违约金/罚息、最低提前还款额、次数限制等未纳入模拟  

请以贷款合同与银行实际结果为准。

---

## 🛠️ 技术栈

- **Core**: HTML5 / CSS3 / Vanilla JavaScript (ES6+)
- **Charts**: Canvas（无第三方图表依赖）

---

## 📂 目录结构

```text
Deep-Mortgage-Calculator/
├── index.html
├── style.css
├── script.js
└── README.md
```

---

## 🚀 本地运行

1. 下载或 Clone 本项目  
2. 直接双击 `index.html` 用浏览器打开（Chrome / Edge / Safari 均可）

> 无需安装 Node.js，也不需要本地 Server。

---

## 🧭 使用指南

1. **设置基础信息**：分别输入商贷/公积金的金额、利率、年限与还款方式  
2. **设定开始时间**：选择首次还款年月  
3. **添加事件**
   - “利率调整”：设置发生期数与新利率
   - “提前还款”：设置发生期数、金额与策略（减月供/减年限）
4. 点击 **生成还款计划**：查看分析面板与计划表

---

## 📸 截图

![示例截图](example.jpg)


---

## 🤝 贡献 (Contributing)

欢迎提交 Issue / Pull Request：
- 修复边界条件（如同月多事件、极端利率等）
- UI/UX 优化（更强的移动端体验）
- 新增功能（导出 CSV、保存方案、对比多方案等）

---

## 📄 版权与许可 (License)

本作品采用 **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International** 许可：

- ✅ 允许分享与修改
- ❌ 不可用于商业用途
- 📝 转载或修改请注明作者并以相同协议开源

协议链接：<https://creativecommons.org/licenses/by-nc-sa/4.0/>

---
<div align="center">
  <br>
  Made with ❤️ by <a href="https://github.com/seanwong17">seanwong17</a>
</div>
