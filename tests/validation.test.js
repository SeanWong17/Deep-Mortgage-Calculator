const test = require('node:test');
const assert = require('node:assert/strict');

const {
    toLoanParams,
    validateScenario
} = require('../validation.js');

function validScenario() {
    return {
        startDate: '2026-07',
        loans: {
            com: { enabled: true, amountWan: 100, ratePercent: 3.1, years: 30, method: 'annuity' },
            fund: { enabled: false, amountWan: 0, ratePercent: 2.85, years: 30, method: 'annuity' }
        },
        rateEvents: [],
        prepayments: []
    };
}

test('有效场景转换为计算参数', () => {
    const raw = validScenario();
    raw.rateEvents.push({ id: 'r1', loanType: 'com', month: 13, ratePercent: 2.9 });
    raw.prepayments.push({
        id: 'p1',
        loanType: 'com',
        month: 24,
        amountWan: 10,
        strategy: 'reduce-term'
    });

    const result = validateScenario(raw);
    const params = toLoanParams(result.scenario, 'com');

    assert.equal(result.valid, true);
    assert.equal(params.principal, 1000000);
    assert.ok(Math.abs(params.rateEvents[0].rate - 0.029) < 1e-12);
    assert.equal(params.payEvents[0].amount, 100000);
});

test('拒绝空贷款、非法日期、负数和越界事件', () => {
    const raw = validScenario();
    raw.startDate = '2026-13';
    raw.loans.com.amountWan = -1;
    raw.rateEvents.push({ id: 'r1', loanType: 'com', month: 999, ratePercent: 2.9 });

    const result = validateScenario(raw);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.path === 'startDate'));
    assert.ok(result.errors.some((error) => error.path === 'loans.com.amountWan'));
    assert.ok(result.errors.some((error) => error.path === 'rateEvents.r1.month'));
});

test('拒绝同贷款同月重复事件和停用贷款上的事件', () => {
    const raw = validScenario();
    raw.rateEvents = [
        { id: 'r1', loanType: 'com', month: 12, ratePercent: 3 },
        { id: 'r2', loanType: 'com', month: 12, ratePercent: 2.9 },
        { id: 'r3', loanType: 'fund', month: 13, ratePercent: 2.6 }
    ];
    raw.prepayments = [
        { id: 'p1', loanType: 'com', month: 24, amountWan: 5, strategy: 'reduce-payment' },
        { id: 'p2', loanType: 'com', month: 24, amountWan: 5, strategy: 'reduce-term' }
    ];

    const result = validateScenario(raw);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.message.includes('重复') || error.message.includes('只能有一条')));
    assert.ok(result.errors.some((error) => error.message.includes('已停用')));
});
