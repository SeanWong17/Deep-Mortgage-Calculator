(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.MortgageEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const MAX_MONTHS = 600;
    const MAX_ANNUAL_RATE = 1;

    class LoanInputError extends Error {
        constructor(message, code) {
            super(message);
            this.name = 'LoanInputError';
            this.code = code;
        }
    }

    function roundMoney(value) {
        if (!Number.isFinite(value)) {
            throw new LoanInputError('计算结果不是有效金额，请检查输入。', 'NON_FINITE_MONEY');
        }
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    function normalizeMethod(method) {
        if (method === '1' || method === 'annuity') return 'annuity';
        if (method === '2' || method === 'equal-principal') return 'equal-principal';
        throw new LoanInputError('不支持的还款方式。', 'INVALID_METHOD');
    }

    function assertNumber(value, label, options) {
        const settings = options || {};
        if (!Number.isFinite(value)) {
            throw new LoanInputError(`${label}必须是有效数字。`, 'INVALID_NUMBER');
        }
        if (settings.min !== undefined && value < settings.min) {
            throw new LoanInputError(`${label}不能小于${settings.min}。`, 'OUT_OF_RANGE');
        }
        if (settings.max !== undefined && value > settings.max) {
            throw new LoanInputError(`${label}不能大于${settings.max}。`, 'OUT_OF_RANGE');
        }
    }

    function paymentFor(balance, monthlyRate, months) {
        if (balance <= 0 || months <= 0) return 0;
        if (Math.abs(monthlyRate) < Number.EPSILON) {
            return roundMoney(balance / months);
        }
        const denominator = 1 - Math.pow(1 + monthlyRate, -months);
        if (!Number.isFinite(denominator) || denominator <= 0) {
            throw new LoanInputError('当前利率与期限无法计算月供。', 'INVALID_PAYMENT_FORMULA');
        }
        return roundMoney((balance * monthlyRate) / denominator);
    }

    function remainingPaymentsForTarget(balance, monthlyRate, targetPayment) {
        if (balance <= 0) return 0;
        if (targetPayment <= 0) {
            throw new LoanInputError('目标月供必须大于 0。', 'INVALID_TARGET_PAYMENT');
        }
        if (Math.abs(monthlyRate) < Number.EPSILON) {
            return Math.ceil(balance / targetPayment);
        }
        const monthlyInterest = roundMoney(balance * monthlyRate);
        if (targetPayment <= monthlyInterest) {
            throw new LoanInputError('目标月供不足以覆盖当月利息。', 'NEGATIVE_AMORTIZATION');
        }
        const ratio = 1 - (balance * monthlyRate) / targetPayment;
        const months = -Math.log(ratio) / Math.log(1 + monthlyRate);
        if (!Number.isFinite(months) || months <= 0) {
            throw new LoanInputError('无法根据目标月供计算剩余期限。', 'INVALID_REMAINING_TERM');
        }
        return Math.ceil(months);
    }

    function prepareRateEvents(events, originalMonths) {
        const byMonth = new Map();
        (events || []).forEach((event) => {
            assertNumber(event.month, '利率调整期数', { min: 1, max: originalMonths });
            assertNumber(event.rate, '调整后年利率', { min: 0, max: MAX_ANNUAL_RATE });
            if (!Number.isInteger(event.month)) {
                throw new LoanInputError('利率调整期数必须是整数。', 'INVALID_EVENT_MONTH');
            }
            if (byMonth.has(event.month)) {
                throw new LoanInputError(`第 ${event.month} 期存在重复利率调整。`, 'DUPLICATE_RATE_EVENT');
            }
            byMonth.set(event.month, { ...event, id: event.id || `rate-${event.month}` });
        });
        return byMonth;
    }

    function preparePrepaymentEvents(events, originalMonths) {
        const byMonth = new Map();
        (events || []).forEach((event) => {
            assertNumber(event.month, '提前还款期数', { min: 1, max: originalMonths });
            assertNumber(event.amount, '提前还款金额', { min: 0.01 });
            if (!Number.isInteger(event.month)) {
                throw new LoanInputError('提前还款期数必须是整数。', 'INVALID_EVENT_MONTH');
            }
            if (event.strategy !== 'reduce-payment' && event.strategy !== 'reduce-term') {
                throw new LoanInputError('不支持的提前还款策略。', 'INVALID_PREPAYMENT_STRATEGY');
            }
            if (byMonth.has(event.month)) {
                throw new LoanInputError(`第 ${event.month} 期存在重复提前还款。`, 'DUPLICATE_PREPAYMENT');
            }
            byMonth.set(event.month, {
                ...event,
                amount: roundMoney(event.amount),
                id: event.id || `prepay-${event.month}`
            });
        });
        return byMonth;
    }

    function calculateLoan(params) {
        const principal = Number(params.principal);
        const annualRate = Number(params.rate);
        const originalMonths = Number(params.months);
        const method = normalizeMethod(params.method);

        assertNumber(principal, '贷款本金', { min: 0 });
        assertNumber(annualRate, '年利率', { min: 0, max: MAX_ANNUAL_RATE });
        assertNumber(originalMonths, '贷款期限', { min: 1, max: MAX_MONTHS });
        if (!Number.isInteger(originalMonths)) {
            throw new LoanInputError('贷款期限必须是整月。', 'INVALID_TERM');
        }

        const rateEvents = prepareRateEvents(params.rateEvents, originalMonths);
        const prepaymentEvents = preparePrepaymentEvents(params.payEvents, originalMonths);
        if (principal === 0) {
            return {
                schedule: [],
                totalInterest: 0,
                totalPay: 0,
                totalPrincipal: 0,
                warnings: [],
                appliedEventIds: [],
                unappliedEventIds: [
                    ...Array.from(rateEvents.values(), (event) => event.id),
                    ...Array.from(prepaymentEvents.values(), (event) => event.id)
                ]
            };
        }

        const schedule = [];
        const warnings = [];
        const appliedEventIds = [];
        let balance = roundMoney(principal);
        let currentAnnualRate = annualRate;
        let monthlyRate = currentAnnualRate / 12;
        let totalMonths = originalMonths;
        let totalInterest = 0;
        let totalPay = 0;
        let basePayment = method === 'annuity' ? paymentFor(balance, monthlyRate, totalMonths) : 0;
        let basePrincipal = method === 'equal-principal' ? roundMoney(balance / totalMonths) : 0;

        for (let idx = 1; balance > 0 && idx <= totalMonths; idx += 1) {
            const notes = [];
            const rateEvent = rateEvents.get(idx);
            if (rateEvent) {
                currentAnnualRate = rateEvent.rate;
                monthlyRate = currentAnnualRate / 12;
                if (method === 'annuity') {
                    basePayment = paymentFor(balance, monthlyRate, totalMonths - idx + 1);
                }
                notes.push({ type: 'rate', text: `利率调整为 ${(currentAnnualRate * 100).toFixed(2)}%` });
                appliedEventIds.push(rateEvent.id);
            }

            const monthInterest = roundMoney(balance * monthlyRate);
            let monthPrincipal;
            let regularPay;

            if (idx === totalMonths) {
                monthPrincipal = balance;
                regularPay = roundMoney(monthPrincipal + monthInterest);
            } else if (method === 'annuity') {
                regularPay = Math.min(basePayment, roundMoney(balance + monthInterest));
                monthPrincipal = roundMoney(regularPay - monthInterest);
            } else {
                monthPrincipal = Math.min(basePrincipal, balance);
                regularPay = roundMoney(monthPrincipal + monthInterest);
            }

            if (monthPrincipal <= 0 && balance > 0) {
                throw new LoanInputError('月供未能偿还本金，请检查利率和期限。', 'NEGATIVE_AMORTIZATION');
            }

            balance = roundMoney(balance - monthPrincipal);
            let extraPay = 0;
            const prepaymentEvent = prepaymentEvents.get(idx);

            if (prepaymentEvent) {
                extraPay = Math.min(prepaymentEvent.amount, balance);
                extraPay = roundMoney(extraPay);
                balance = roundMoney(balance - extraPay);
                appliedEventIds.push(prepaymentEvent.id);

                if (extraPay < prepaymentEvent.amount) {
                    warnings.push(`第 ${idx} 期提前还款已按剩余本金 ${extraPay.toFixed(2)} 元执行。`);
                }

                const strategyText = prepaymentEvent.strategy === 'reduce-term' ? '缩短期限' : '减少月供';
                notes.push({
                    type: 'prepayment',
                    text: `提前还款 ${(extraPay / 10000).toFixed(2)} 万，${strategyText}`
                });

                const remainingAfterCurrent = totalMonths - idx;
                if (balance > 0 && remainingAfterCurrent > 0) {
                    if (prepaymentEvent.strategy === 'reduce-term') {
                        const newRemaining = method === 'annuity'
                            ? remainingPaymentsForTarget(balance, monthlyRate, basePayment)
                            : Math.ceil(balance / basePrincipal);
                        totalMonths = Math.min(totalMonths, idx + Math.max(1, newRemaining));
                    } else if (method === 'annuity') {
                        basePayment = paymentFor(balance, monthlyRate, remainingAfterCurrent);
                    } else {
                        basePrincipal = roundMoney(balance / remainingAfterCurrent);
                    }
                }
            }

            const actualPay = roundMoney(regularPay + extraPay);
            totalInterest = roundMoney(totalInterest + monthInterest);
            totalPay = roundMoney(totalPay + actualPay);

            schedule.push({
                idx,
                pay: actualPay,
                basePay: regularPay,
                extraPay,
                principal: monthPrincipal,
                interest: monthInterest,
                balance,
                annualRate: currentAnnualRate,
                notes,
                note: notes.map((note) => note.text).join('; '),
                isEvent: notes.length > 0
            });
        }

        if (balance > 0) {
            throw new LoanInputError('贷款在设定期限内未结清。', 'UNPAID_BALANCE');
        }

        const allEventIds = [
            ...Array.from(rateEvents.values(), (event) => event.id),
            ...Array.from(prepaymentEvents.values(), (event) => event.id)
        ];
        const applied = new Set(appliedEventIds);

        return {
            schedule,
            totalInterest,
            totalPay,
            totalPrincipal: roundMoney(principal),
            warnings,
            appliedEventIds,
            unappliedEventIds: allEventIds.filter((id) => !applied.has(id))
        };
    }

    return {
        LoanInputError,
        MAX_MONTHS,
        calculateLoan,
        paymentFor,
        roundMoney
    };
});
