const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: true,
    retries: 0,
    reporter: 'line',
    use: {
        browserName: 'chromium',
        headless: true,
        locale: 'zh-CN'
    }
});
