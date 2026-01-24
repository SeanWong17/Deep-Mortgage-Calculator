/**
 * 深度房贷计算器 - 主脚本
 * 现代化UI版本
 */

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
    addRateRow('com', 6, 3.0);
    addRateRow('fund', 13, 2.6);
    updateAllDates();
});

// ==================== 动态行管理 ====================

function addRateRow(type, month, val) {
    const tpl = document.getElementById('tpl-rate');
    const node = tpl.content.cloneNode(true);
    const div = node.querySelector('.event-row');

    if (type) div.querySelector('.evt-type').value = type;
    if (month) div.querySelector('.evt-month').value = month;
    if (val) div.querySelector('.evt-val').value = val;

    document.getElementById('rateList').appendChild(node);
    const addedRow = document.getElementById('rateList').lastElementChild;
    updateRowColor(addedRow);
    updateDatePreview(addedRow.querySelector('.evt-month'));
}

function addPrepayRow(type, month, val, strat) {
    const tpl = document.getElementById('tpl-prepay');
    const node = tpl.content.cloneNode(true);
    const div = node.querySelector('.event-row');

    if (type) div.querySelector('.evt-type').value = type;
    if (month) div.querySelector('.evt-month').value = month;
    if (val) div.querySelector('.evt-val').value = val;
    if (strat) div.querySelector('.evt-strat').value = strat;

    document.getElementById('prepayList').appendChild(node);
    const addedRow = document.getElementById('prepayList').lastElementChild;
    updateRowColor(addedRow);
    updateDatePreview(addedRow.querySelector('.evt-month'));
}

function updateRowColor(row) {
    const typeEl = row.querySelector('.evt-type');
    if (!typeEl) return;
    const type = typeEl.value;
    row.classList.remove('type-com', 'type-fund');
    row.classList.add(type === 'com' ? 'type-com' : 'type-fund');
}

function updateDatePreview(input) {
    const monthIdx = parseInt(input.value);
    const row = input.closest('.event-row');
    const badge = row.querySelector('.date-badge');
    const startVal = document.getElementById('startDate').value;

    if (!startVal || isNaN(monthIdx) || monthIdx < 1) {
        badge.innerText = '---';
        return;
    }
    const [y, m] = startVal.split('-').map(Number);
    const d = new Date(y, m - 1 + monthIdx - 1);
    badge.innerText = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function updateAllDates() {
    document.querySelectorAll('.evt-month').forEach(el => updateDatePreview(el));
}

// ==================== 核心计算 ====================

function calculateAll() {
    const startStr = document.getElementById('startDate').value;
    const [startYear, startMonth] = startStr.split('-').map(Number);

    let rawEvents = [];

    document.querySelectorAll('#rateList .event-row').forEach(row => {
        let m = parseInt(row.querySelector('.evt-month').value);
        let r = parseFloat(row.querySelector('.evt-val').value);
        let t = row.querySelector('.evt-type').value;
        if (m && !isNaN(r)) {
            rawEvents.push({
                type: 'rate',
                loanType: t,
                month: m,
                val: r / 100,
                desc: `${t === 'com' ? '商贷' : '公积金'}利率调为${r}%`
            });
        }
    });

    document.querySelectorAll('#prepayList .event-row').forEach(row => {
        let m = parseInt(row.querySelector('.evt-month').value);
        let amt = parseFloat(row.querySelector('.evt-val').value);
        let strat = row.querySelector('.evt-strat').value;
        let t = row.querySelector('.evt-type').value;
        let stratName = strat === '1' ? '减月供' : '减年限';
        if (m && !isNaN(amt)) {
            rawEvents.push({
                type: 'pay',
                loanType: t,
                month: m,
                val: amt * 10000,
                strategy: strat,
                desc: `${t === 'com' ? '商' : '公'}提前还${amt}万(${stratName})`
            });
        }
    });

    const getParams = (events) => {
        const comRates = events.filter(e => e.type === 'rate' && e.loanType === 'com')
            .map(e => ({ month: e.month, rate: e.val }));
        const fundRates = events.filter(e => e.type === 'rate' && e.loanType === 'fund')
            .map(e => ({ month: e.month, rate: e.val }));
        const comPays = events.filter(e => e.type === 'pay' && e.loanType === 'com')
            .map(e => ({ month: e.month, amount: e.val, strategy: e.strategy }));
        const fundPays = events.filter(e => e.type === 'pay' && e.loanType === 'fund')
            .map(e => ({ month: e.month, amount: e.val, strategy: e.strategy }));

        const p = (type, r, pay) => ({
            principal: parseFloat(document.getElementById(type + 'Amount').value) * 10000,
            rate: parseFloat(document.getElementById(type + 'Rate').value) / 100,
            months: parseInt(document.getElementById(type + 'Year').value) * 12,
            method: document.getElementById(type + 'Method').value,
            rateEvents: r,
            payEvents: pay
        });

        return { com: p('com', comRates, comPays), fund: p('fund', fundRates, fundPays) };
    };

    let eventMonths = [...new Set(rawEvents.map(e => e.month))].sort((a, b) => a - b);
    let analysisSteps = [];

    let baseParams = getParams([]);
    let baseRes = {
        com: calculateLoan(baseParams.com),
        fund: calculateLoan(baseParams.fund)
    };
    let lastTotalInt = baseRes.com.totalInterest + baseRes.fund.totalInterest;
    let lastMaxMonth = Math.max(baseRes.com.schedule.length, baseRes.fund.schedule.length);

    let activeEvents = [];

    eventMonths.forEach(m => {
        let monthEvents = rawEvents.filter(e => e.month === m);
        activeEvents = [...activeEvents, ...monthEvents];

        let currParams = getParams(activeEvents);
        let currRes = {
            com: calculateLoan(currParams.com),
            fund: calculateLoan(currParams.fund)
        };

        let currTotalInt = currRes.com.totalInterest + currRes.fund.totalInterest;
        let currMaxMonth = Math.max(currRes.com.schedule.length, currRes.fund.schedule.length);

        let deltaInt = lastTotalInt - currTotalInt;
        let deltaTime = lastMaxMonth - currMaxMonth;

        let dateObj = new Date(startYear, startMonth - 1 + m - 1);
        let dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

        analysisSteps.push({
            month: m,
            date: dateStr,
            events: monthEvents,
            deltaInt: deltaInt,
            deltaTime: deltaTime
        });

        lastTotalInt = currTotalInt;
        lastMaxMonth = currMaxMonth;
    });

    let finalParams = getParams(rawEvents);
    let finalCom = calculateLoan(finalParams.com);
    let finalFund = calculateLoan(finalParams.fund);

    let finalDeltaInt = (baseRes.com.totalInterest + baseRes.fund.totalInterest) -
        (finalCom.totalInterest + finalFund.totalInterest);

    let comTimeDiff = baseRes.com.schedule.length - finalCom.schedule.length;
    let fundTimeDiff = baseRes.fund.schedule.length - finalFund.schedule.length;

    document.getElementById('analysisArea').style.display = 'block';
    renderAnalysis(finalDeltaInt, comTimeDiff, fundTimeDiff, analysisSteps);

    setTimeout(() => {
        drawChart(baseRes, finalCom, finalFund, startYear, startMonth);
    }, 50);

    renderTable(finalCom, finalFund, startYear, startMonth);

    document.getElementById('analysisArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function calculateLoan(params) {
    let { principal, rate, months, method, rateEvents, payEvents } = params;

    let schedule = [];
    let balance = principal;
    let currentRate = rate / 12;
    let totalInterest = 0;
    let totalPay = 0;
    let totalMonths = months;

    if (principal <= 0) return { schedule: [], totalInterest: 0, totalPay: 0 };

    let idx = 1;
    while (balance > 0.01 && idx <= 800) {
        let note = [];
        let isRateChange = false;
        let isPrepay = false;
        let extraPay = 0;

        let rEvt = rateEvents.find(e => e.month === idx);
        if (rEvt) {
            currentRate = rEvt.rate / 12;
            isRateChange = true;
            note.push(`利率${(rEvt.rate * 100).toFixed(2)}%`);
        }

        let pEvts = payEvents.filter(e => e.month === idx);
        let strategy = '1';

        if (pEvts.length > 0) {
            isPrepay = true;

            let currentBasePmt = 0;
            if (schedule.length > 0) {
                currentBasePmt = schedule[schedule.length - 1].basePay;
            } else {
                if (method === '1') {
                    currentBasePmt = (balance * currentRate * Math.pow(1 + currentRate, totalMonths)) /
                        (Math.pow(1 + currentRate, totalMonths) - 1);
                } else {
                    currentBasePmt = (balance / totalMonths) + (balance * currentRate);
                }
            }

            let totalPrepayAmt = 0;
            pEvts.forEach(p => {
                totalPrepayAmt += p.amount;
                strategy = p.strategy;
            });

            if (totalPrepayAmt > balance) totalPrepayAmt = balance;
            extraPay = totalPrepayAmt;
            balance -= extraPay;
            note.push(`还${(extraPay / 10000).toFixed(1)}万`);

            if (balance > 0 && strategy === '2') {
                note.push(`减年限`);
                let newRemainMonths = 0;

                if (method === '1') {
                    let targetPmt = currentBasePmt;
                    let monthlyInterest = balance * currentRate;

                    if (monthlyInterest >= targetPmt) {
                        newRemainMonths = 1;
                    } else {
                        let n = Math.log(targetPmt / (targetPmt - monthlyInterest)) / Math.log(1 + currentRate);
                        newRemainMonths = Math.ceil(n);
                    }
                } else {
                    let remainBeforePrepay = totalMonths - idx + 1;
                    let balanceBeforePrepay = balance + extraPay;
                    let principalPerMonth = balanceBeforePrepay / remainBeforePrepay;
                    newRemainMonths = Math.ceil(balance / principalPerMonth);
                }

                if (newRemainMonths < 1) newRemainMonths = 1;
                totalMonths = idx + newRemainMonths - 1;
            } else if (balance > 0) {
                note.push(`减月供`);
            }
        }

        let remainMonths = totalMonths - idx + 1;
        if (remainMonths < 1) remainMonths = 1;

        let monthInterest = balance * currentRate;
        let monthPrincipal = 0;
        let monthPayment = 0;

        if (balance > 0) {
            if (method === '1') {
                if (remainMonths === 1) {
                    monthPrincipal = balance;
                    monthPayment = monthPrincipal + monthInterest;
                } else {
                    monthPayment = (balance * currentRate * Math.pow(1 + currentRate, remainMonths)) /
                        (Math.pow(1 + currentRate, remainMonths) - 1);
                    monthPrincipal = monthPayment - monthInterest;
                }
            } else {
                monthPrincipal = balance / remainMonths;
                monthPayment = monthPrincipal + monthInterest;
            }

            if (monthPrincipal > balance) {
                monthPrincipal = balance;
                monthPayment = monthPrincipal + monthInterest;
            }
        }

        if (isPrepay && balance > 0) {
            note.push(`新供${Math.round(monthPayment).toLocaleString()}`);
        }

        let actualPay = monthPayment + extraPay;
        balance -= monthPrincipal;
        if (balance < 0.01) balance = 0;
        totalInterest += monthInterest;
        totalPay += actualPay;

        schedule.push({
            idx: idx,
            pay: actualPay,
            basePay: monthPayment,
            principal: monthPrincipal,
            interest: monthInterest,
            balance: balance,
            note: note.join('; '),
            isEvent: isRateChange || isPrepay
        });

        if (balance <= 0.01) break;
        idx++;
    }

    return { schedule, totalInterest, totalPay };
}

// ==================== 渲染函数 ====================

function renderAnalysis(diffInt, diffComTime, diffFundTime, steps) {
    const formatMoney = (val) => {
        const prefix = val >= 0 ? '节省 ' : '增加 ';
        return prefix + '¥' + Math.abs(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
    };

    const elInt = document.getElementById('diffInterest');
    elInt.innerText = formatMoney(diffInt);
    elInt.className = diffInt > 0 ? 'diff-good' : (diffInt < 0 ? 'diff-bad' : 'diff-neutral');

    const elTime = document.getElementById('diffTime');

    const fmtTime = (label, v, color) => {
        if (v > 0) return `<span style="color:${color}">${label}</span> <span class="diff-good">-${v}月</span>`;
        if (v < 0) return `<span style="color:${color}">${label}</span> <span class="diff-bad">+${Math.abs(v)}月</span>`;
        return `<span style="color:${color}">${label}</span> <span class="diff-neutral">0</span>`;
    };

    elTime.innerHTML = `
        <div style="font-size:0.75em; line-height:1.6;">
            <div>${fmtTime('商贷', diffComTime, 'var(--commercial)')}</div>
            <div>${fmtTime('公积金', diffFundTime, 'var(--fund)')}</div>
        </div>
    `;

    const tbody = document.getElementById('analysisDetailBody');
    tbody.innerHTML = '';

    if (steps.length === 0) {
        let tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align:center; color:var(--gray-400); padding:24px;">暂无变动事件</td>`;
        tbody.appendChild(tr);
    } else {
        steps.forEach(step => {
            let tr = document.createElement('tr');
            let descHtml = step.events.map(e => e.desc).join('<br>');
            let intClass = step.deltaInt > 0 ? 'diff-good' : (step.deltaInt < 0 ? 'diff-bad' : 'diff-neutral');
            let intText = step.deltaInt === 0 ? '-' :
                (step.deltaInt > 0 ?
                    `省¥${Math.abs(step.deltaInt).toLocaleString(undefined, { maximumFractionDigits: 0 })}` :
                    `亏¥${Math.abs(step.deltaInt).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
            let timeClass = step.deltaTime > 0 ? 'diff-good' : (step.deltaTime < 0 ? 'diff-bad' : 'diff-neutral');
            let timeText = step.deltaTime === 0 ? '-' :
                (step.deltaTime > 0 ? `-${step.deltaTime}月` : `+${Math.abs(step.deltaTime)}月`);

            tr.innerHTML = `
                <td>
                    <span class="date-badge">${step.date}</span>
                    <div style="font-size:0.75em; color:var(--gray-400); margin-top:4px;">第${step.month}期</div>
                </td>
                <td style="font-size:0.85em;">${descHtml}</td>
                <td class="${intClass}">${intText}</td>
                <td class="${timeClass}">${timeText}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function renderTable(comData, fundData, startYear, startMonth) {
    document.getElementById('resultArea').style.display = 'block';

    let totalAll = 0;
    let totalInt = comData.totalInterest + fundData.totalInterest;

    const tbody = document.getElementById('resultBody');
    tbody.innerHTML = '';

    let maxLen = Math.max(comData.schedule.length, fundData.schedule.length);

    for (let i = 0; i < maxLen; i++) {
        let c = comData.schedule[i] || { pay: 0, basePay: 0, interest: 0, balance: 0, note: '' };
        let f = fundData.schedule[i] || { pay: 0, basePay: 0, interest: 0, balance: 0, note: '' };

        let currentTotalPay = c.pay + f.pay;
        totalAll += currentTotalPay;

        let d = new Date(startYear, startMonth - 1 + i);
        let dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;

        let tr = document.createElement('tr');
        if (c.note.includes('还') || f.note.includes('还')) tr.classList.add('row-prepay');
        else if (c.note.includes('利率') || f.note.includes('利率')) tr.classList.add('row-rate-change');

        let noteHtml = '';
        if (c.note) noteHtml += `<span class="note-tag bg-com">商</span>${c.note}<br>`;
        if (f.note) noteHtml += `<span class="note-tag bg-fund">公</span>${f.note}`;

        tr.innerHTML = `
            <td style="text-align:center; font-weight:500;">${i + 1}</td>
            <td style="text-align:center; white-space:nowrap;">${dateStr}</td>
            <td style="font-weight:600; color:var(--primary);">¥${currentTotalPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            <td>${c.pay > 0 ? '¥' + c.pay.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>
            <td>${f.pay > 0 ? '¥' + f.pay.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>
            <td style="color:var(--gray-500);">¥${(c.balance + f.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            <td style="font-size:0.8em; color:var(--gray-600); line-height:1.4; text-align:left; white-space:nowrap;">${noteHtml}</td>
        `;
        tbody.appendChild(tr);
    }

    document.getElementById('resTotal').innerText = '¥' + totalAll.toLocaleString(undefined, { maximumFractionDigits: 0 });
    document.getElementById('resInterest').innerText = '¥' + totalInt.toLocaleString(undefined, { maximumFractionDigits: 0 });
    document.getElementById('resComInt').innerText = '¥' + comData.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 });
    document.getElementById('resFundInt').innerText = '¥' + fundData.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ==================== 图表绘制 ====================

function drawChart(baseRes, finalCom, finalFund, startYear, startMonth) {
    const canvas = document.getElementById('loanChart');
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;

    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const getBalanceSeries = (cSched, fSched) => {
        const arr = [];
        const len = Math.max(cSched.length, fSched.length);
        for (let i = 0; i < len; i++) {
            let b1 = i < cSched.length ? cSched[i].balance : 0;
            let b2 = i < fSched.length ? fSched[i].balance : 0;
            arr.push(b1 + b2);
        }
        const initialTotal = (parseFloat(document.getElementById('comAmount').value) +
            parseFloat(document.getElementById('fundAmount').value)) * 10000;
        return [initialTotal, ...arr];
    };

    const baseData = getBalanceSeries(baseRes.com.schedule, baseRes.fund.schedule);
    const currData = getBalanceSeries(finalCom.schedule, finalFund.schedule);

    const maxPoints = Math.max(baseData.length, currData.length);
    if (maxPoints < 2) return;

    const maxBalance = Math.max(baseData[0], currData[0]);

    const isMobile = width < 400;
    const p = { t: 20, r: 15, b: 30, l: isMobile ? 40 : 50 };
    const dw = width - p.l - p.r;
    const dh = height - p.t - p.b;

    const getX = (i) => p.l + (i / (maxPoints - 1)) * dw;
    const getY = (val) => p.t + dh - (val / maxBalance) * dh;

    // 绘制网格
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
        let y = p.t + (dh / 4) * i;
        ctx.moveTo(p.l, y);
        ctx.lineTo(width - p.r, y);
    }
    ctx.stroke();

    // Y轴标签
    ctx.fillStyle = '#718096';
    ctx.font = (isMobile ? '10' : '11') + 'px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        let y = p.t + (dh / 4) * i;
        ctx.fillText(((maxBalance * (4 - i) / 4) / 10000).toFixed(0) + '万', p.l - 8, y + 4);
    }

    // X轴标签
    ctx.textAlign = 'center';
    const yearInterval = maxPoints > 180 ? 10 : (maxPoints > 120 ? 5 : (isMobile ? 5 : 3));
    const step = yearInterval * 12;

    for (let i = 0; i < maxPoints; i += step) {
        let x = getX(i);
        let d = new Date(startYear, startMonth - 1 + i);
        ctx.fillText(d.getFullYear(), x, height - 10);
    }

    const drawLine = (data, color, dashed, lineWidth) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth || (isMobile ? 2 : 2.5);
        if (dashed) ctx.setLineDash([6, 4]);
        else ctx.setLineDash([]);

        data.forEach((val, i) => {
            if (i === 0) ctx.moveTo(getX(i), getY(val));
            else ctx.lineTo(getX(i), getY(val));
        });
        if (data.length < maxPoints) {
            ctx.lineTo(getX(maxPoints - 1), getY(0));
        }
        ctx.stroke();
    };

    // 原计划虚线
    drawLine(baseData, '#a0aec0', true, isMobile ? 1.5 : 2);

    // 新计划填充
    ctx.beginPath();
    const gradient = ctx.createLinearGradient(0, p.t, 0, height - p.b);
    gradient.addColorStop(0, 'rgba(49, 130, 206, 0.2)');
    gradient.addColorStop(1, 'rgba(49, 130, 206, 0.02)');
    ctx.fillStyle = gradient;

    currData.forEach((val, i) => {
        if (i === 0) ctx.moveTo(getX(i), getY(val));
        else ctx.lineTo(getX(i), getY(val));
    });

    if (currData.length < maxPoints) {
        ctx.lineTo(getX(currData.length), getY(0));
        ctx.lineTo(getX(maxPoints - 1), getY(0));
    } else {
        ctx.lineTo(getX(maxPoints - 1), getY(0));
    }

    ctx.lineTo(getX(0), getY(0));
    ctx.closePath();
    ctx.fill();

    // 新计划实线
    drawLine(currData, '#3182ce', false);
}

// ==================== 事件监听 ====================

window.addEventListener('resize', () => {
    const area = document.getElementById('analysisArea');
    if (area.style.display !== 'none') {
        // 重绘图表
        const startStr = document.getElementById('startDate').value;
        if (startStr) {
            // 触发重新计算以更新图表
        }
    }
});

// ==================== 帮助弹窗 ====================

function openHelpModal() {
    const modal = document.getElementById('helpModal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    // 点击遮罩关闭（点到卡片不关闭）
    modal.addEventListener('click', onHelpOverlayClick);
    document.addEventListener('keydown', onHelpEsc);
}

function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');

    modal.removeEventListener('click', onHelpOverlayClick);
    document.removeEventListener('keydown', onHelpEsc);
}

function onHelpOverlayClick(e) {
    const card = e.currentTarget.querySelector('.modal-card');
    if (!card) return;
    if (!card.contains(e.target)) closeHelpModal();
}

function onHelpEsc(e) {
    if (e.key === 'Escape') closeHelpModal();
}