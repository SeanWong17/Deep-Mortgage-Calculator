const test = require('node:test');
const assert = require('node:assert/strict');

const {
    LoanInputError,
    calculateLoan
} = require('../loan-engine.js');

function baseParams(overrides) {
    return {
        principal: 1000000,
        rate: 0.031,
        months: 360,
        method: 'annuity',
        rateEvents: [],
        payEvents: [],
        ...overrides
    };
}

test('等额本息计划结清且满足本金加利息恒等式', () => {
    const result = calculateLoan(baseParams());

    assert.equal(result.schedule.length, 360);
    assert.equal(result.schedule.at(-1).balance, 0);
    assert.equal(result.totalPay, result.totalPrincipal + result.totalInterest);
    assert.ok(result.schedule.every((row) => Number.isFinite(row.pay) && row.principal > 0));
});

test('零利率按剩余本金平均还款', () => {
    const result = calculateLoan(baseParams({ principal: 120000, rate: 0, months: 12 }));

    assert.equal(result.schedule.length, 12);
    assert.equal(result.schedule[0].pay, 10000);
    assert.equal(result.totalInterest, 0);
    assert.equal(result.totalPay, 120000);
});

test('等额本金的月供逐月下降', () => {
    const result = calculateLoan(baseParams({ method: 'equal-principal', months: 120 }));

    assert.equal(result.schedule.length, 120);
    assert.ok(result.schedule[0].pay > result.schedule[1].pay);
    assert.equal(result.schedule.at(-1).balance, 0);
    assert.equal(result.totalPay, result.totalPrincipal + result.totalInterest);
});

test('减少月供保持期限并降低后续月供', () => {
    const baseline = calculateLoan(baseParams());
    const result = calculateLoan(baseParams({
        payEvents: [{ month: 13, amount: 100000, strategy: 'reduce-payment' }]
    }));

    assert.equal(result.schedule.length, baseline.schedule.length);
    assert.ok(result.schedule[13].basePay < baseline.schedule[13].basePay);
    assert.ok(result.totalInterest < baseline.totalInterest);
});

test('缩短期限保持目标月供并减少还款期数', () => {
    const baseline = calculateLoan(baseParams());
    const result = calculateLoan(baseParams({
        payEvents: [{ month: 13, amount: 100000, strategy: 'reduce-term' }]
    }));

    assert.ok(result.schedule.length < baseline.schedule.length);
    assert.ok(Math.abs(result.schedule[13].basePay - baseline.schedule[13].basePay) <= 0.01);
    assert.ok(result.totalInterest < baseline.totalInterest);
});

test('全额提前还款按剩余本金执行并当期结清', () => {
    const result = calculateLoan(baseParams({
        months: 120,
        payEvents: [{ month: 6, amount: 1000000, strategy: 'reduce-term' }]
    }));

    assert.equal(result.schedule.length, 6);
    assert.equal(result.schedule.at(-1).balance, 0);
    assert.equal(result.warnings.length, 1);
});

test('同一期先应用新利率再执行正常月供和提前还款', () => {
    const result = calculateLoan(baseParams({
        rateEvents: [{ id: 'rate', month: 12, rate: 0.04 }],
        payEvents: [{ id: 'pay', month: 12, amount: 50000, strategy: 'reduce-payment' }]
    }));
    const row = result.schedule[11];

    assert.equal(row.annualRate, 0.04);
    assert.equal(row.notes[0].type, 'rate');
    assert.equal(row.notes[1].type, 'prepayment');
    assert.ok(row.extraPay > 0);
});

test('拒绝负数提前还款和重复利率事件', () => {
    assert.throws(
        () => calculateLoan(baseParams({
            payEvents: [{ month: 1, amount: -10000, strategy: 'reduce-payment' }]
        })),
        LoanInputError
    );

    assert.throws(
        () => calculateLoan(baseParams({
            rateEvents: [
                { month: 1, rate: 0.02 },
                { month: 1, rate: 0.04 }
            ]
        })),
        /重复利率调整/
    );
});

test('拒绝非法期限、利率和还款方式', () => {
    assert.throws(() => calculateLoan(baseParams({ months: 0 })), LoanInputError);
    assert.throws(() => calculateLoan(baseParams({ rate: -0.01 })), LoanInputError);
    assert.throws(() => calculateLoan(baseParams({ method: 'unknown' })), LoanInputError);
});
