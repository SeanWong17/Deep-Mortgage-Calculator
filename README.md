# 🏠 深度房贷计算器 (Deep Mortgage Calculator)

> 一个支持 LPR 利率变动、提前还款策略对比的深度房贷分析工具。单文件，零依赖，手机/PC 均可完美使用。

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![Javascript](https://img.shields.io/badge/Vanilla%20JS-F7DF1E?logo=javascript&logoColor=black)

## 📖 简介

市面上的房贷计算器通常只能计算初始状态。但在长达 30 年的还款周期中，我们经常面临**LPR 利率调整**和**提前还款**的决策。

**深度房贷计算器** 旨在解决这个问题。它允许你通过时间轴的方式，添加多次利率调整和提前还款事件，精确模拟整个还款周期的资金变化，并生成直观的对比图表，帮你算出到底省了多少钱。

## ✨ 核心功能

* **📊 组合贷款支持**：完美支持商业贷款 + 公积金贷款的组合模式，可分别设置利率和年限。
* **📅 LPR 动态调整**：支持在任意月份添加利率调整事件（模拟 LPR 重定价日）。
* **💰 提前还款模拟**：
    * 支持添加多次提前还款记录。
    * **策略对比**：支持选择“减少月供”或“缩短年限”两种策略，自动计算剩余本金和利息变化。
* **📈 可视化分析**：
    * 使用 Canvas 绘制本金剩余趋势图，直观对比原计划与新计划的差异。
    * 自动计算节省的利息总额和缩短的时间。
* **📱 响应式设计**：原生 HTML/CSS 编写，针对移动端深度优化，PC 端体验同样优秀。
* **🚀 极致轻量**：核心代码仅一个 HTML 文件，无需后端，无需安装 Node.js，下载即用。

## 🖥️ 在线演示 (Demo)

[点击这里查看在线演示](https://SeanWong17.github.io/Deep-Mortgage-Calculator/)

## 🚀 快速开始

### 方式一：直接运行
1. 下载本项目中的 `index.html` 文件。
2. 双击使用浏览器（Chrome/Safari/Edge）打开即可。

### 方式二：Clone 仓库
```bash
git clone [https://github.com/SeanWong17/deep-mortgage-calculator.git](https://github.com/SeanWong17/deep-mortgage-calculator.git)
cd deep-mortgage-calculator
# 并在浏览器中打开 index.html
```

##  🛠️ 使用指南
1. 设置基础信息：输入商贷和公积金的金额、初始利率、年限及还款方式（等额本息/本金）。
2. 设定开始时间：选择你的首次还款年月。
3. 添加动态事件：
  - 点击 “+ 添加利率调整”：模拟未来的 LPR 降息或涨息。
  - 点击 “+ 添加提前还款”：输入预计在第几期（或通过日期推算）还多少钱，并选择处理策略。

4. 生成计划：点击底部按钮，查看详细的还款计划表、节省利息分析以及本金趋势图。

## 📸 截图
![示例图像](example.png)

## 🤝 贡献 (Contributing)
本项目是一个纯前端单页应用，欢迎提交 Issue 或 Pull Request 来改进代码或增加新功能。

## ⚠️ 版权与许可 (License)

本作品采用 [知识共享署名-非商业性使用-相同方式共享 4.0 国际许可协议](http://creativecommons.org/licenses/by-nc-sa/4.0/) 进行许可。

[![CC BY-NC-SA 4.0](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)](http://creativecommons.org/licenses/by-nc-sa/4.0/)

This work is licensed under a [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-nc-sa/4.0/).
