(function () {
    'use strict';

    const { calculateLoan } = window.MortgageEngine;
    const { toLoanParams, validateScenario } = window.MortgageValidation;
    const Renderers = window.MortgageRenderers;
    const STORAGE_KEY = 'deep-mortgage-calculator:scenario:v1';

    let eventSequence = 0;
    let toastTimer = 0;
    let modalReturnFocus = null;

    function currentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function defaultScenario() {
        return {
            version: 1,
            startDate: currentMonth(),
            loans: {
                com: { enabled: true, amountWan: 100, ratePercent: 3.1, years: 30, method: 'annuity' },
                fund: { enabled: true, amountWan: 100, ratePercent: 2.85, years: 30, method: 'annuity' }
            },
            rateEvents: [],
            prepayments: []
        };
    }

    function nextEventId(prefix) {
        eventSequence += 1;
        return `${prefix}-${Date.now().toString(36)}-${eventSequence}`;
    }

    function setInputValue(id, value) {
        const element = document.getElementById(id);
        if (element) element.value = value;
    }

    function readEventRows(listId, kind) {
        return Array.from(document.querySelectorAll(`#${listId} .event-row`)).map((row) => {
            const read = (name) => row.querySelector(`[data-event-field="${name}"]`).value;
            if (kind === 'rate') {
                return {
                    id: row.dataset.eventId,
                    loanType: read('loanType'),
                    month: read('month'),
                    ratePercent: read('ratePercent')
                };
            }
            return {
                id: row.dataset.eventId,
                loanType: read('loanType'),
                month: read('month'),
                amountWan: read('amountWan'),
                strategy: read('strategy')
            };
        });
    }

    function readScenario() {
        return {
            version: 1,
            startDate: document.getElementById('startDate').value,
            loans: {
                com: {
                    enabled: document.getElementById('comEnabled').checked,
                    amountWan: document.getElementById('comAmount').value,
                    ratePercent: document.getElementById('comRate').value,
                    years: document.getElementById('comYear').value,
                    method: document.getElementById('comMethod').value
                },
                fund: {
                    enabled: document.getElementById('fundEnabled').checked,
                    amountWan: document.getElementById('fundAmount').value,
                    ratePercent: document.getElementById('fundRate').value,
                    years: document.getElementById('fundYear').value,
                    method: document.getElementById('fundMethod').value
                }
            },
            rateEvents: readEventRows('rateList', 'rate'),
            prepayments: readEventRows('prepaymentList', 'prepayment')
        };
    }

    function setEventField(row, name, value) {
        const field = row.querySelector(`[data-event-field="${name}"]`);
        if (field && value !== undefined && value !== null) field.value = value;
    }

    function configureEventPaths(row, collection, id) {
        row.querySelectorAll('[data-event-field]').forEach((field) => {
            field.dataset.field = `${collection}.${id}.${field.dataset.eventField}`;
        });
    }

    function addRateEvent(initial) {
        const data = initial || {};
        const id = String(data.id || nextEventId('rate'));
        const fragment = document.getElementById('rateEventTemplate').content.cloneNode(true);
        const row = fragment.querySelector('.event-row');
        row.dataset.eventId = id;
        configureEventPaths(row, 'rateEvents', id);
        setEventField(row, 'loanType', data.loanType || 'com');
        setEventField(row, 'month', data.month || '');
        setEventField(row, 'ratePercent', data.ratePercent ?? '');
        document.getElementById('rateList').appendChild(fragment);
        updateEventRow(row);
        refreshEmptyStates();
        return row;
    }

    function addPrepaymentEvent(initial) {
        const data = initial || {};
        const id = String(data.id || nextEventId('prepay'));
        const fragment = document.getElementById('prepaymentEventTemplate').content.cloneNode(true);
        const row = fragment.querySelector('.event-row');
        row.dataset.eventId = id;
        configureEventPaths(row, 'prepayments', id);
        setEventField(row, 'loanType', data.loanType || 'com');
        setEventField(row, 'month', data.month || '');
        setEventField(row, 'amountWan', data.amountWan ?? '');
        setEventField(row, 'strategy', data.strategy || 'reduce-payment');
        document.getElementById('prepaymentList').appendChild(fragment);
        updateEventRow(row);
        refreshEmptyStates();
        return row;
    }

    function applyScenario(scenario) {
        setInputValue('startDate', scenario.startDate || currentMonth());
        ['com', 'fund'].forEach((type) => {
            const loan = scenario.loans && scenario.loans[type] ? scenario.loans[type] : defaultScenario().loans[type];
            document.getElementById(`${type}Enabled`).checked = loan.enabled !== false;
            setInputValue(`${type}Amount`, loan.amountWan);
            setInputValue(`${type}Rate`, loan.ratePercent);
            setInputValue(`${type}Year`, loan.years);
            setInputValue(`${type}Method`, loan.method);
        });

        document.getElementById('rateList').replaceChildren();
        document.getElementById('prepaymentList').replaceChildren();
        (scenario.rateEvents || []).forEach(addRateEvent);
        (scenario.prepayments || []).forEach(addPrepaymentEvent);
        updateLoanPanels();
        updateAllEventRows();
        refreshEmptyStates();
        clearValidation();
    }

    function eventDate(monthValue) {
        const startValue = document.getElementById('startDate').value;
        const month = Number(monthValue);
        if (!/^\d{4}-\d{2}$/.test(startValue) || !Number.isInteger(month) || month < 1) return '--';
        const [year, startMonth] = startValue.split('-').map(Number);
        const date = new Date(year, startMonth - 1 + month - 1, 1);
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function updateEventRow(row) {
        if (!row) return;
        const loanType = row.querySelector('[data-event-field="loanType"]').value;
        const month = row.querySelector('[data-event-field="month"]').value;
        row.dataset.loanType = loanType;
        row.querySelector('.date-badge').textContent = eventDate(month);
    }

    function updateAllEventRows() {
        document.querySelectorAll('.event-row').forEach(updateEventRow);
    }

    function refreshEmptyStates() {
        document.getElementById('rateEmpty').hidden = document.getElementById('rateList').children.length > 0;
        document.getElementById('prepaymentEmpty').hidden = document.getElementById('prepaymentList').children.length > 0;
    }

    function updateLoanPanels() {
        ['com', 'fund'].forEach((type) => {
            const enabled = document.getElementById(`${type}Enabled`).checked;
            const panel = document.getElementById(`${type}LoanPanel`);
            panel.classList.toggle('is-disabled', !enabled);
            panel.querySelectorAll('.loan-fields input, .loan-fields select').forEach((field) => {
                field.disabled = !enabled;
            });
        });
    }

    function clearValidation() {
        document.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
        document.querySelectorAll('.field-error, .event-error').forEach((element) => {
            element.textContent = '';
        });
        document.querySelectorAll('.event-row.has-error').forEach((row) => row.classList.remove('has-error'));
        const summary = document.getElementById('validationSummary');
        summary.replaceChildren();
        summary.hidden = true;
    }

    function findField(path) {
        return Array.from(document.querySelectorAll('[data-field]')).find((field) => field.dataset.field === path) || null;
    }

    function showValidation(errors) {
        clearValidation();
        const summary = document.getElementById('validationSummary');
        const title = document.createElement('strong');
        title.textContent = `请修正 ${errors.length} 个输入问题`;
        const list = document.createElement('ul');

        errors.forEach((error) => {
            const item = document.createElement('li');
            item.textContent = error.message;
            list.appendChild(item);

            const field = findField(error.path);
            if (!field) return;
            field.setAttribute('aria-invalid', 'true');
            const eventRow = field.closest('.event-row');
            if (eventRow) {
                eventRow.classList.add('has-error');
                const errorElement = eventRow.querySelector('.event-error');
                if (!errorElement.textContent.includes(error.message)) {
                    errorElement.textContent += `${errorElement.textContent ? ' ' : ''}${error.message}`;
                }
            } else {
                const wrapper = field.closest('[data-field-wrap]');
                if (wrapper) wrapper.querySelector('.field-error').textContent = error.message;
            }
        });

        summary.append(title, list);
        summary.hidden = false;
        summary.focus();
        const firstField = findField(errors[0].path);
        if (firstField) firstField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function calculatePair(scenario, activeEventIds) {
        return {
            com: calculateLoan(toLoanParams(scenario, 'com', activeEventIds)),
            fund: calculateLoan(toLoanParams(scenario, 'fund', activeEventIds))
        };
    }

    function describeEvent(event) {
        const type = event.loanType === 'com' ? '商贷' : '公积金';
        if ('ratePercent' in event) return `${type}利率调整为 ${event.ratePercent}%`;
        const strategy = event.strategy === 'reduce-term' ? '减年限' : '减月供';
        return `${type}提前还款 ${event.amountWan} 万（${strategy}）`;
    }

    function dateForMonth(startDate, month) {
        const [year, startMonth] = startDate.split('-').map(Number);
        const date = new Date(year, startMonth - 1 + month - 1, 1);
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function totalInterest(result) {
        return result.com.totalInterest + result.fund.totalInterest;
    }

    function buildAnalysis(scenario, base, final) {
        const allEvents = [...scenario.rateEvents, ...scenario.prepayments];
        const months = [...new Set(allEvents.map((event) => event.month))].sort((a, b) => a - b);
        const activeIds = [];
        const steps = [];
        let previous = base;

        months.forEach((month) => {
            const events = allEvents.filter((event) => event.month === month);
            activeIds.push(...events.map((event) => event.id));
            const current = calculatePair(scenario, activeIds);
            const unapplied = new Set([
                ...current.com.unappliedEventIds,
                ...current.fund.unappliedEventIds
            ]);
            steps.push({
                month,
                date: dateForMonth(scenario.startDate, month),
                descriptions: events.map((event) =>
                    `${describeEvent(event)}${unapplied.has(event.id) ? '（贷款已结清，未触发）' : ''}`
                ),
                deltaInterest: totalInterest(previous) - totalInterest(current),
                deltaComTime: previous.com.schedule.length - current.com.schedule.length,
                deltaFundTime: previous.fund.schedule.length - current.fund.schedule.length,
                comEnabled: scenario.loans.com.enabled,
                fundEnabled: scenario.loans.fund.enabled
            });
            previous = current;
        });

        const unappliedCount = new Set([
            ...final.com.unappliedEventIds,
            ...final.fund.unappliedEventIds
        ]).size;
        const warnings = [...final.com.warnings, ...final.fund.warnings];
        if (unappliedCount) warnings.push(`${unappliedCount} 个事件因贷款已提前结清而未触发。`);

        return {
            diffInterest: totalInterest(base) - totalInterest(final),
            diffComTime: base.com.schedule.length - final.com.schedule.length,
            diffFundTime: base.fund.schedule.length - final.fund.schedule.length,
            comEnabled: scenario.loans.com.enabled,
            fundEnabled: scenario.loans.fund.enabled,
            steps,
            warnings
        };
    }

    function calculateScenario() {
        const validation = validateScenario(readScenario());
        if (!validation.valid) {
            showValidation(validation.errors);
            return;
        }

        clearValidation();
        try {
            const scenario = validation.scenario;
            const base = calculatePair(scenario, []);
            const final = calculatePair(scenario, null);
            const analysis = buildAnalysis(scenario, base, final);

            document.getElementById('analysisArea').hidden = false;
            document.getElementById('resultArea').hidden = false;
            Renderers.renderAnalysis(analysis);
            Renderers.setSchedule({ ...final, startDate: scenario.startDate });
            Renderers.setChart(base, final, scenario.startDate);
            document.getElementById('exportCsvButton').disabled = false;
            document.getElementById('analysisArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            const summary = document.getElementById('validationSummary');
            summary.textContent = error && error.message ? error.message : '计算失败，请检查输入。';
            summary.hidden = false;
            summary.focus();
        }
    }

    function loadExample() {
        const scenario = defaultScenario();
        scenario.rateEvents = [
            { id: nextEventId('rate'), loanType: 'com', month: 13, ratePercent: 2.9 },
            { id: nextEventId('rate'), loanType: 'fund', month: 13, ratePercent: 2.6 }
        ];
        scenario.prepayments = [
            { id: nextEventId('prepay'), loanType: 'com', month: 36, amountWan: 10, strategy: 'reduce-term' }
        ];
        applyScenario(scenario);
        showToast('示例方案已载入');
    }

    function saveScenario() {
        const validation = validateScenario(readScenario());
        if (!validation.valid) {
            showValidation(validation.errors);
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(validation.scenario));
            document.getElementById('loadScenarioButton').disabled = false;
            showToast('方案已保存在当前浏览器');
        } catch (error) {
            showToast('浏览器未允许保存方案', true);
        }
    }

    function loadSavedScenario() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) {
                showToast('没有已保存的方案', true);
                return;
            }
            const parsed = JSON.parse(saved);
            const validation = validateScenario(parsed);
            if (!validation.valid) throw new Error('保存的方案格式无效');
            applyScenario(validation.scenario);
            showToast('已载入保存的方案');
        } catch (error) {
            showToast(error.message || '载入方案失败', true);
        }
    }

    function encodeScenario(scenario) {
        const bytes = new TextEncoder().encode(JSON.stringify(scenario));
        let binary = '';
        bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    function decodeScenario(value) {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
        const binary = atob(padded);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    }

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.className = 'clipboard-helper';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('复制失败');
    }

    function shareScenario() {
        const validation = validateScenario(readScenario());
        if (!validation.valid) {
            showValidation(validation.errors);
            return;
        }
        const url = new URL(window.location.href);
        url.searchParams.set('scenario', encodeScenario(validation.scenario));
        openShare(url.toString());
    }

    function loadSharedScenario() {
        const encoded = new URL(window.location.href).searchParams.get('scenario');
        if (!encoded) return false;
        try {
            const scenario = decodeScenario(encoded);
            const validation = validateScenario(scenario);
            if (!validation.valid) throw new Error('链接中的方案无效');
            applyScenario(validation.scenario);
            showToast('已载入分享方案');
            return true;
        } catch (error) {
            showToast(error.message || '分享链接无效', true);
            return false;
        }
    }

    function showToast(message, isError) {
        const toast = document.getElementById('toast');
        window.clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.toggle('is-error', Boolean(isError));
        toast.hidden = false;
        toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2800);
    }

    function openHelp() {
        const modal = document.getElementById('helpModal');
        modalReturnFocus = document.activeElement;
        modal.hidden = false;
        document.body.classList.add('modal-open');
        document.getElementById('closeHelpButton').focus();
        document.addEventListener('keydown', handleModalKeydown);
    }

    function openShare(url) {
        const modal = document.getElementById('shareModal');
        const input = document.getElementById('shareLinkInput');
        modalReturnFocus = document.activeElement;
        input.value = url;
        modal.hidden = false;
        document.body.classList.add('modal-open');
        input.focus();
        input.select();
        document.addEventListener('keydown', handleShareKeydown);
    }

    function closeShare() {
        document.getElementById('shareModal').hidden = true;
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', handleShareKeydown);
        if (modalReturnFocus) modalReturnFocus.focus();
    }

    async function copyShareLink() {
        const input = document.getElementById('shareLinkInput');
        try {
            await copyText(input.value);
            showToast('方案链接已复制');
        } catch (error) {
            input.focus();
            input.select();
            showToast('请使用系统复制命令复制已选中的链接', true);
        }
    }

    function trapFocus(event, dialog) {
        if (event.key !== 'Tab') return;
        const focusable = Array.from(dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
            .filter((element) => !element.disabled);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function closeHelp() {
        const modal = document.getElementById('helpModal');
        modal.hidden = true;
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', handleModalKeydown);
        if (modalReturnFocus) modalReturnFocus.focus();
    }

    function handleModalKeydown(event) {
        if (event.key === 'Escape') {
            closeHelp();
            return;
        }
        trapFocus(event, document.querySelector('#helpModal .modal-dialog'));
    }

    function handleShareKeydown(event) {
        if (event.key === 'Escape') {
            closeShare();
            return;
        }
        trapFocus(event, document.querySelector('#shareModal .modal-dialog'));
    }

    function bindEvents() {
        document.getElementById('addRateButton').addEventListener('click', () => addRateEvent());
        document.getElementById('addPrepaymentButton').addEventListener('click', () => addPrepaymentEvent());
        document.getElementById('loadExampleButton').addEventListener('click', loadExample);
        document.getElementById('calculateButton').addEventListener('click', calculateScenario);
        document.getElementById('saveScenarioButton').addEventListener('click', saveScenario);
        document.getElementById('loadScenarioButton').addEventListener('click', loadSavedScenario);
        document.getElementById('shareScenarioButton').addEventListener('click', shareScenario);
        document.getElementById('exportCsvButton').addEventListener('click', () => {
            if (Renderers.downloadCsv()) showToast('CSV 已导出');
        });

        document.getElementById('resetScenarioButton').addEventListener('click', () => {
            if (window.confirm('重置当前方案并清空所有事件？')) {
                applyScenario(defaultScenario());
                document.getElementById('analysisArea').hidden = true;
                document.getElementById('resultArea').hidden = true;
                document.getElementById('exportCsvButton').disabled = true;
            }
        });

        document.getElementById('startDate').addEventListener('change', updateAllEventRows);
        ['comEnabled', 'fundEnabled'].forEach((id) => {
            document.getElementById(id).addEventListener('change', updateLoanPanels);
        });

        ['rateList', 'prepaymentList'].forEach((id) => {
            const list = document.getElementById(id);
            list.addEventListener('click', (event) => {
                const button = event.target.closest('[data-action="remove-event"]');
                if (!button) return;
                button.closest('.event-row').remove();
                refreshEmptyStates();
            });
            list.addEventListener('input', (event) => updateEventRow(event.target.closest('.event-row')));
            list.addEventListener('change', (event) => updateEventRow(event.target.closest('.event-row')));
        });

        document.querySelector('.segmented-control').addEventListener('click', (event) => {
            const button = event.target.closest('[data-table-filter]');
            if (button) Renderers.setScheduleFilter(button.dataset.tableFilter);
        });

        document.getElementById('helpButton').addEventListener('click', openHelp);
        document.getElementById('closeHelpButton').addEventListener('click', closeHelp);
        document.getElementById('confirmHelpButton').addEventListener('click', closeHelp);
        document.getElementById('helpModal').addEventListener('click', (event) => {
            if (event.target === event.currentTarget) closeHelp();
        });
        document.getElementById('closeShareButton').addEventListener('click', closeShare);
        document.getElementById('cancelShareButton').addEventListener('click', closeShare);
        document.getElementById('copyShareLinkButton').addEventListener('click', copyShareLink);
        document.getElementById('shareModal').addEventListener('click', (event) => {
            if (event.target === event.currentTarget) closeShare();
        });
    }

    function init() {
        document.getElementById('currentYear').textContent = String(new Date().getFullYear());
        applyScenario(defaultScenario());
        bindEvents();
        Renderers.initChartResize();
        try {
            document.getElementById('loadScenarioButton').disabled = !localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            document.getElementById('loadScenarioButton').disabled = true;
        }
        loadSharedScenario();
    }

    init();
})();
