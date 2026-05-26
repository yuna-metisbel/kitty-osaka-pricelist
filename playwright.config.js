module.exports = {
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:9321',
    launchOptions: {
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    },
  },
  webServer: {
    command: 'python3 -m http.server 9321',
    port: 9321,
    reuseExistingServer: true,
  },
};
