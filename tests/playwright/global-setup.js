const { config } = require('./helpers/config');

async function assertSpaRoute(path) {
  const url = `${config.baseURL.replace(/\/$/, '')}${path}`;
  const res = await fetch(url);
  const body = await res.text();
  if (body.includes('The requested path could not be found')) {
    throw new Error(
      `${url} returned a static 404. Start the app with SPA fallback ` +
        `(default: npx serve -s build -l 3000) or set PLAYWRIGHT_WEB_COMMAND.`
    );
  }
}

module.exports = async function globalSetup() {
  await assertSpaRoute('/login');
  await assertSpaRoute('/jobs');
};
