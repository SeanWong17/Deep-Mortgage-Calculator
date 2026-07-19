(function (root, factory) {
    root.MortgageRenderers = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    let scheduleState = null;
    let scheduleFilter = 'key';
    let chartState = null;
    let chartObserver = null;

    function money(value, digits) {
        const fractionDigits = digits === undefined ? 0 : digits;
        return `¥${Number(value || 0).toLocaleString('zh-CN', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits
        })}`;
    }

    function monthDiff(value) {
        if (value > 0) return `缩短 ${value} 个月`;
        if (value < 0) return `增加 ${Math.abs(value)} 个月`;
        return '无变化';
    }

    function dateAt(startDate, index) {
        const [year, month] = startDate.split('-').map(Number);
        const date = new Date(year, month - 1 + index, 1);
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function setDiffClass(element, value, positiveIsGood) {
        element.classList.remove('diff-good', 'diff-bad', 'diff-neutral');
        if (value === 0) element.classList.add('diff-neutral');
        else if ((value > 0) === positiveIsGood) element.classList.add('diff-good');
        else element.classList.add('diff-bad');
    }

    function appendCell(row, text, className) {
        const cell = document.createElement('td');
        cell.textContent = text;
        if (className) cell.className = className;
        row.appendChild(cell);
        return cell;
    }

    function renderWarnings(messages) {
        const container = document.getElementById('calculationWarnings');
        container.replaceChildren();
        if (!messages || messages.length === 0) {
            container.hidden = true;
            return;
        }
        const list = document.createElement('ul');
        messages.forEach((message) => {
            const item = document.createElement('li');
            item.textContent = message;
            list.appendChild(item);
        });
        container.appendChild(list);
        container.hidden = false;
    }

    function renderAnalysis(data) {
        const interestElement = document.getElementById('diffInterest');
        const comTimeElement = document.getElementById('diffComTime');
        const fundTimeElement = document.getElementById('diffFundTime');

        interestElement.textContent = data.diffInterest >= 0
            ? `节省 ${money(data.diffInterest)}`
            : `增加 ${money(Math.abs(data.diffInterest))}`;
        setDiffClass(interestElement, data.diffInterest, true);

        comTimeElement.textContent = data.comEnabled ? monthDiff(data.diffComTime) : '未启用';
        fundTimeElement.textContent = data.fundEnabled ? monthDiff(data.diffFundTime) : '未启用';
        setDiffClass(comTimeElement, data.comEnabled ? data.diffComTime : 0, true);
        setDiffClass(fundTimeElement, data.fundEnabled ? data.diffFundTime : 0, true);

        const body = document.getElementById('analysisDetailBody');
        const fragment = document.createDocumentFragment();
        body.replaceChildren();

        if (data.steps.length === 0) {
            const row = document.createElement('tr');
            const cell = appendCell(row, '当前方案没有变动事件。', 'empty-cell');
            cell.colSpan = 5;
            fragment.appendChild(row);
        } else {
            data.steps.forEach((step) => {
                const row = document.createElement('tr');
                const dateCell = appendCell(row, `${step.date}（第 ${step.month} 期）`);
                dateCell.classList.add('date-cell');
                appendCell(row, step.descriptions.join('；'));

                const interestText = step.deltaInterest === 0
                    ? '无变化'
                    : step.deltaInterest > 0
                        ? `节省 ${money(step.deltaInterest)}`
                        : `增加 ${money(Math.abs(step.deltaInterest))}`;
                const interestCell = appendCell(row, interestText);
                setDiffClass(interestCell, step.deltaInterest, true);

                const comCell = appendCell(row, step.comEnabled ? monthDiff(step.deltaComTime) : '--');
                const fundCell = appendCell(row, step.fundEnabled ? monthDiff(step.deltaFundTime) : '--');
                setDiffClass(comCell, step.comEnabled ? step.deltaComTime : 0, true);
                setDiffClass(fundCell, step.fundEnabled ? step.deltaFundTime : 0, true);
                fragment.appendChild(row);
            });
        }

        body.appendChild(fragment);
        renderWarnings(data.warnings);
    }

    function combinedRows(result) {
        const rows = [];
        const maxLength = Math.max(result.com.schedule.length, result.fund.schedule.length);
        const empty = {
            pay: 0,
            basePay: 0,
            extraPay: 0,
            principal: 0,
            interest: 0,
            balance: 0,
            notes: [],
            isEvent: false
        };

        for (let index = 0; index < maxLength; index += 1) {
            const com = result.com.schedule[index] || empty;
            const fund = result.fund.schedule[index] || empty;
            rows.push({
                idx: index + 1,
                date: dateAt(result.startDate, index),
                totalPay: com.pay + fund.pay,
                comPay: com.pay,
                fundPay: fund.pay,
                principal: com.principal + fund.principal + com.extraPay + fund.extraPay,
                interest: com.interest + fund.interest,
                balance: com.balance + fund.balance,
                comNotes: com.notes,
                fundNotes: fund.notes,
                isEvent: com.isEvent || fund.isEvent
            });
        }
        return rows;
    }

    function includeRow(row, index, rows, filter) {
        if (filter === 'all') return true;
        if (filter === 'year') {
            return index === 0 || row.idx % 12 === 0 || row.isEvent || index === rows.length - 1;
        }
        return index < 12 || row.isEvent || index >= rows.length - 3;
    }

    function notesText(row) {
        const parts = [];
        if (row.comNotes.length) parts.push(`商贷：${row.comNotes.map((note) => note.text).join('；')}`);
        if (row.fundNotes.length) parts.push(`公积金：${row.fundNotes.map((note) => note.text).join('；')}`);
        return parts.join(' / ');
    }

    function renderSchedule() {
        if (!scheduleState) return;
        const rows = combinedRows(scheduleState);
        const visibleRows = rows.filter((row, index) => includeRow(row, index, rows, scheduleFilter));
        const body = document.getElementById('resultBody');
        const fragment = document.createDocumentFragment();
        body.replaceChildren();

        visibleRows.forEach((row) => {
            const tableRow = document.createElement('tr');
            if (row.isEvent) tableRow.classList.add('event-period');
            appendCell(tableRow, String(row.idx), 'number-cell');
            appendCell(tableRow, row.date, 'date-cell');
            appendCell(tableRow, money(row.totalPay), 'money-cell primary-money');
            appendCell(tableRow, row.comPay ? money(row.comPay) : '--', 'money-cell');
            appendCell(tableRow, row.fundPay ? money(row.fundPay) : '--', 'money-cell');
            appendCell(tableRow, money(row.principal), 'money-cell');
            appendCell(tableRow, money(row.interest), 'money-cell');
            appendCell(tableRow, money(row.balance), 'money-cell muted-money');
            appendCell(tableRow, notesText(row) || '--', 'notes-cell');
            fragment.appendChild(tableRow);
        });

        body.appendChild(fragment);
        document.getElementById('tableRowCount').textContent = `显示 ${visibleRows.length} / ${rows.length} 期`;

        document.querySelectorAll('[data-table-filter]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.tableFilter === scheduleFilter));
        });
    }

    function setSchedule(result) {
        scheduleState = result;
        const totalPay = result.com.totalPay + result.fund.totalPay;
        const totalInterest = result.com.totalInterest + result.fund.totalInterest;
        document.getElementById('resTotal').textContent = money(totalPay);
        document.getElementById('resInterest').textContent = money(totalInterest);
        document.getElementById('resComInt').textContent = money(result.com.totalInterest);
        document.getElementById('resFundInt').textContent = money(result.fund.totalInterest);
        renderSchedule();
    }

    function setScheduleFilter(filter) {
        if (!['key', 'year', 'all'].includes(filter)) return;
        scheduleFilter = filter;
        renderSchedule();
    }

    function csvEscape(value) {
        const text = String(value === undefined ? '' : value);
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    function buildCsv() {
        if (!scheduleState) return '';
        const header = ['期数', '日期', '月供合计', '商贷还款', '公积金还款', '偿还本金', '利息', '剩余本金', '备注'];
        const lines = [header.map(csvEscape).join(',')];
        combinedRows(scheduleState).forEach((row) => {
            lines.push([
                row.idx,
                row.date,
                row.totalPay.toFixed(2),
                row.comPay.toFixed(2),
                row.fundPay.toFixed(2),
                row.principal.toFixed(2),
                row.interest.toFixed(2),
                row.balance.toFixed(2),
                notesText(row)
            ].map(csvEscape).join(','));
        });
        return `\uFEFF${lines.join('\r\n')}`;
    }

    function downloadCsv() {
        const csv = buildCsv();
        if (!csv) return false;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `房贷还款计划-${scheduleState.startDate}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
        return true;
    }

    function balanceSeries(comSchedule, fundSchedule, initialTotal) {
        const length = Math.max(comSchedule.length, fundSchedule.length);
        const values = [initialTotal];
        for (let index = 0; index < length; index += 1) {
            values.push(
                (comSchedule[index] ? comSchedule[index].balance : 0) +
                (fundSchedule[index] ? fundSchedule[index].balance : 0)
            );
        }
        return values;
    }

    function drawChart() {
        if (!chartState) return;
        const canvas = document.getElementById('loanChart');
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const context = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, rect.width, rect.height);

        const initialTotal = chartState.base.com.totalPrincipal + chartState.base.fund.totalPrincipal;
        const base = balanceSeries(chartState.base.com.schedule, chartState.base.fund.schedule, initialTotal);
        const current = balanceSeries(chartState.current.com.schedule, chartState.current.fund.schedule, initialTotal);
        const points = Math.max(base.length, current.length);
        if (points < 2 || initialTotal <= 0) return;

        const mobile = rect.width < 480;
        const padding = { top: 18, right: 14, bottom: 34, left: mobile ? 48 : 60 };
        const drawWidth = rect.width - padding.left - padding.right;
        const drawHeight = rect.height - padding.top - padding.bottom;
        const maxBalance = Math.max(initialTotal, ...base, ...current, 1);
        const x = (index) => padding.left + (index / (points - 1)) * drawWidth;
        const y = (value) => padding.top + drawHeight - (value / maxBalance) * drawHeight;

        context.strokeStyle = '#d8dee7';
        context.fillStyle = '#667085';
        context.lineWidth = 1;
        context.font = `${mobile ? 10 : 11}px -apple-system, BlinkMacSystemFont, sans-serif`;
        context.textAlign = 'right';
        for (let index = 0; index <= 4; index += 1) {
            const lineY = padding.top + (drawHeight / 4) * index;
            context.beginPath();
            context.moveTo(padding.left, lineY);
            context.lineTo(rect.width - padding.right, lineY);
            context.stroke();
            context.fillText(`${Math.round((maxBalance * (4 - index)) / 40000)}万`, padding.left - 8, lineY + 4);
        }

        const intervalYears = points > 300 ? 10 : points > 180 ? 5 : 3;
        context.textAlign = 'center';
        for (let index = 0; index < points; index += intervalYears * 12) {
            const [startYear, startMonth] = chartState.startDate.split('-').map(Number);
            const date = new Date(startYear, startMonth - 1 + index, 1);
            context.fillText(String(date.getFullYear()), x(index), rect.height - 10);
        }

        function line(data, color, dashed, width) {
            context.beginPath();
            context.strokeStyle = color;
            context.lineWidth = width;
            context.setLineDash(dashed ? [6, 4] : []);
            data.forEach((value, index) => {
                if (index === 0) context.moveTo(x(index), y(value));
                else context.lineTo(x(index), y(value));
            });
            if (data.length < points) context.lineTo(x(points - 1), y(0));
            context.stroke();
        }

        line(base, '#98a2b3', true, 2);
        line(current, '#2563a6', false, 2.5);
        context.setLineDash([]);
    }

    function setChart(base, current, startDate) {
        chartState = { base, current, startDate };
        const originalMonths = Math.max(base.com.schedule.length, base.fund.schedule.length);
        const currentMonths = Math.max(current.com.schedule.length, current.fund.schedule.length);
        document.getElementById('chartSummary').textContent =
            `原计划最长 ${originalMonths} 期，当前计划最长 ${currentMonths} 期。`;
        requestAnimationFrame(drawChart);
    }

    function initChartResize() {
        const container = document.querySelector('.chart-container');
        if (!container || chartObserver) return;
        if ('ResizeObserver' in window) {
            chartObserver = new ResizeObserver(() => requestAnimationFrame(drawChart));
            chartObserver.observe(container);
        } else {
            let frame = 0;
            window.addEventListener('resize', () => {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(drawChart);
            });
        }
    }

    return {
        buildCsv,
        downloadCsv,
        initChartResize,
        money,
        renderAnalysis,
        setChart,
        setSchedule,
        setScheduleFilter
    };
});
