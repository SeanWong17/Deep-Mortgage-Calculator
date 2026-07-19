const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const appUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

function watchPageErrors(page) {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    return errors;
}

test('默认方案可以计算且不会产生非有限金额', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto(appUrl);

    await expect(page.locator('#startDate')).toHaveValue(/^\d{4}-\d{2}$/);
    await expect(page.locator('#rateList .event-row')).toHaveCount(0);
    await expect(page.locator('#prepaymentList .event-row')).toHaveCount(0);

    await page.locator('#calculateButton').click();
    await expect(page.locator('#analysisArea')).toBeVisible();
    await expect(page.locator('#resultArea')).toBeVisible();
    await expect(page.locator('#resTotal')).not.toHaveText('¥0');
    await expect(page.locator('body')).not.toContainText(/NaN|Infinity/);
    await expect(page.locator('#tableRowCount')).toContainText('/ 360 期');
    expect(errors).toEqual([]);
});

test('零利率、单一贷款可以正确结清', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto(appUrl);

    await page.locator('label[for="fundEnabled"]').click();
    await expect(page.locator('#fundEnabled')).not.toBeChecked();
    await page.locator('#comRate').fill('0');
    await page.locator('#calculateButton').click();

    await expect(page.locator('#resInterest')).toHaveText('¥0');
    await expect(page.locator('#resFundInt')).toHaveText('¥0');
    await expect(page.locator('#validationSummary')).toBeHidden();
    expect(errors).toEqual([]);
});

test('示例方案可计算并拦截同月重复事件', async ({ page }) => {
    await page.goto(appUrl);
    await page.locator('#loadExampleButton').click();

    await expect(page.locator('#rateList .event-row')).toHaveCount(2);
    await expect(page.locator('#prepaymentList .event-row')).toHaveCount(1);
    await page.locator('#calculateButton').click();
    await expect(page.locator('#diffInterest')).not.toHaveText('节省 ¥0');

    await page.locator('#addRateButton').click();
    const row = page.locator('#rateList .event-row').last();
    await row.locator('[data-event-field="loanType"]').selectOption('com');
    await row.locator('[data-event-field="month"]').fill('13');
    await row.locator('[data-event-field="ratePercent"]').fill('3.2');
    await page.locator('#calculateButton').click();

    await expect(page.locator('#validationSummary')).toBeVisible();
    await expect(page.locator('#validationSummary')).toContainText('同一种贷款在同一期只能有一条利率调整');
});

test('保存、载入、帮助弹窗和表格筛选可用', async ({ page }) => {
    await page.goto(appUrl);

    await page.locator('#saveScenarioButton').click();
    await expect(page.locator('#loadScenarioButton')).toBeEnabled();
    await page.locator('#comAmount').fill('80');
    await page.locator('#loadScenarioButton').click();
    await expect(page.locator('#comAmount')).toHaveValue('100');

    await page.locator('#shareScenarioButton').click();
    await expect(page.locator('#shareModal')).toBeVisible();
    await expect(page.locator('#shareLinkInput')).toHaveValue(/scenario=/);
    await page.locator('#cancelShareButton').click();

    await page.locator('#helpButton').click();
    await expect(page.locator('#helpModal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#helpModal')).toBeHidden();
    await expect(page.locator('#helpButton')).toBeFocused();

    await page.locator('#calculateButton').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportCsvButton').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('房贷还款计划');
    await page.locator('[data-table-filter="year"]').click();
    await expect(page.locator('[data-table-filter="year"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#resultBody tr')).toHaveCount(31);
});

test('移动端没有页面级横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = watchPageErrors(page);
    await page.goto(appUrl);
    await page.locator('#loadExampleButton').click();

    const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);

    await page.locator('#calculateButton').click();
    await expect(page.locator('#loanChart')).toBeVisible();
    const canvasSize = await page.locator('#loanChart').evaluate((canvas) => ({
        width: canvas.width,
        height: canvas.height
    }));
    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);
    expect(errors).toEqual([]);
});
