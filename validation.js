(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.MortgageValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const LOAN_TYPES = ['com', 'fund'];
    const MAX_RATE_PERCENT = 30;
    const MAX_YEARS = 50;
    const MAX_AMOUNT_WAN = 100000;

    function asNumber(value) {
        if (value === '' || value === null || value === undefined) return NaN;
        return Number(value);
    }

    function isValidMonth(value) {
        if (!/^\d{4}-\d{2}$/.test(value || '')) return false;
        const month = Number(value.slice(5));
        return month >= 1 && month <= 12;
    }

    function validateScenario(rawScenario) {
        const errors = [];
        const warnings = [];
        const scenario = {
            version: 1,
            startDate: rawScenario.startDate || '',
            loans: {},
            rateEvents: [],
            prepayments: []
        };

        const addError = (path, message) => errors.push({ path, message });

        if (!isValidMonth(scenario.startDate)) {
            addError('startDate', '请选择有效的首次还款年月。');
        }

        let enabledCount = 0;
        LOAN_TYPES.forEach((type) => {
            const source = rawScenario.loans && rawScenario.loans[type] ? rawScenario.loans[type] : {};
            const loan = {
                enabled: source.enabled !== false,
                amountWan: asNumber(source.amountWan),
                ratePercent: asNumber(source.ratePercent),
                years: asNumber(source.years),
                method: source.method
            };
            scenario.loans[type] = loan;

            if (!loan.enabled) return;
            enabledCount += 1;

            if (!Number.isFinite(loan.amountWan) || loan.amountWan <= 0 || loan.amountWan > MAX_AMOUNT_WAN) {
                addError(`loans.${type}.amountWan`, `贷款金额应大于 0 且不超过 ${MAX_AMOUNT_WAN} 万元。`);
            }
            if (!Number.isFinite(loan.ratePercent) || loan.ratePercent < 0 || loan.ratePercent > MAX_RATE_PERCENT) {
                addError(`loans.${type}.ratePercent`, `年利率应在 0% 到 ${MAX_RATE_PERCENT}% 之间。`);
            }
            if (!Number.isInteger(loan.years) || loan.years < 1 || loan.years > MAX_YEARS) {
                addError(`loans.${type}.years`, `贷款期限应为 1 到 ${MAX_YEARS} 年的整数。`);
            }
            if (loan.method !== 'annuity' && loan.method !== 'equal-principal') {
                addError(`loans.${type}.method`, '请选择有效的还款方式。');
            }
        });

        if (enabledCount === 0) {
            addError('loans', '请至少启用一种贷款。');
        }

        const duplicateRates = new Set();
        (rawScenario.rateEvents || []).forEach((source, index) => {
            const id = String(source.id || `rate-${index + 1}`);
            const path = `rateEvents.${id}`;
            const event = {
                id,
                loanType: source.loanType,
                month: asNumber(source.month),
                ratePercent: asNumber(source.ratePercent)
            };
            scenario.rateEvents.push(event);

            if (!LOAN_TYPES.includes(event.loanType)) {
                addError(`${path}.loanType`, '请选择贷款类型。');
                return;
            }
            const loan = scenario.loans[event.loanType];
            if (!loan.enabled) {
                addError(`${path}.loanType`, '不能为已停用的贷款添加利率事件。');
            }
            const maxMonths = Number.isInteger(loan.years) ? loan.years * 12 : 0;
            if (!Number.isInteger(event.month) || event.month < 1 || event.month > maxMonths) {
                addError(`${path}.month`, `期数应为 1 到 ${maxMonths || '贷款期限'} 之间的整数。`);
            }
            if (!Number.isFinite(event.ratePercent) || event.ratePercent < 0 || event.ratePercent > MAX_RATE_PERCENT) {
                addError(`${path}.ratePercent`, `调整后利率应在 0% 到 ${MAX_RATE_PERCENT}% 之间。`);
            }
            const duplicateKey = `${event.loanType}-${event.month}`;
            if (duplicateRates.has(duplicateKey)) {
                addError(`${path}.month`, '同一种贷款在同一期只能有一条利率调整。');
            }
            duplicateRates.add(duplicateKey);
        });

        const duplicatePrepayments = new Set();
        (rawScenario.prepayments || []).forEach((source, index) => {
            const id = String(source.id || `prepay-${index + 1}`);
            const path = `prepayments.${id}`;
            const event = {
                id,
                loanType: source.loanType,
                month: asNumber(source.month),
                amountWan: asNumber(source.amountWan),
                strategy: source.strategy
            };
            scenario.prepayments.push(event);

            if (!LOAN_TYPES.includes(event.loanType)) {
                addError(`${path}.loanType`, '请选择贷款类型。');
                return;
            }
            const loan = scenario.loans[event.loanType];
            if (!loan.enabled) {
                addError(`${path}.loanType`, '不能为已停用的贷款添加提前还款事件。');
            }
            const maxMonths = Number.isInteger(loan.years) ? loan.years * 12 : 0;
            if (!Number.isInteger(event.month) || event.month < 1 || event.month > maxMonths) {
                addError(`${path}.month`, `期数应为 1 到 ${maxMonths || '贷款期限'} 之间的整数。`);
            }
            if (!Number.isFinite(event.amountWan) || event.amountWan <= 0) {
                addError(`${path}.amountWan`, '提前还款金额必须大于 0。');
            } else if (Number.isFinite(loan.amountWan) && event.amountWan > loan.amountWan) {
                addError(`${path}.amountWan`, '提前还款金额不能超过该贷款的初始本金。');
            }
            if (event.strategy !== 'reduce-payment' && event.strategy !== 'reduce-term') {
                addError(`${path}.strategy`, '请选择有效的提前还款策略。');
            }
            const duplicateKey = `${event.loanType}-${event.month}`;
            if (duplicatePrepayments.has(duplicateKey)) {
                addError(`${path}.month`, '同一种贷款在同一期只能有一条提前还款。');
            }
            duplicatePrepayments.add(duplicateKey);
        });

        if (scenario.rateEvents.length + scenario.prepayments.length > 40) {
            warnings.push('事件数量较多，收益归因计算可能需要更长时间。');
        }

        return { valid: errors.length === 0, errors, warnings, scenario };
    }

    function toLoanParams(scenario, type, activeEventIds) {
        const loan = scenario.loans[type];
        const active = activeEventIds ? new Set(activeEventIds) : null;
        if (!loan || !loan.enabled) {
            return {
                principal: 0,
                rate: 0,
                months: 1,
                method: 'annuity',
                rateEvents: [],
                payEvents: []
            };
        }

        return {
            principal: loan.amountWan * 10000,
            rate: loan.ratePercent / 100,
            months: loan.years * 12,
            method: loan.method,
            rateEvents: scenario.rateEvents
                .filter((event) => event.loanType === type && (!active || active.has(event.id)))
                .map((event) => ({ id: event.id, month: event.month, rate: event.ratePercent / 100 })),
            payEvents: scenario.prepayments
                .filter((event) => event.loanType === type && (!active || active.has(event.id)))
                .map((event) => ({
                    id: event.id,
                    month: event.month,
                    amount: event.amountWan * 10000,
                    strategy: event.strategy
                }))
        };
    }

    return {
        LOAN_TYPES,
        MAX_AMOUNT_WAN,
        MAX_RATE_PERCENT,
        MAX_YEARS,
        isValidMonth,
        toLoanParams,
        validateScenario
    };
});
