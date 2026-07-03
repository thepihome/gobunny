const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function readEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function assertLocalOnly(urlString, label) {
  const allowRemote = readEnv('PLAYWRIGHT_ALLOW_REMOTE', 'false') === 'true';
  if (allowRemote) return;

  let hostname;
  try {
    hostname = new URL(urlString).hostname;
  } catch {
    throw new Error(`Invalid ${label}: ${urlString}`);
  }

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `${label} must be local (${[...LOCAL_HOSTS].join(', ')}). ` +
        `Got "${urlString}". Set PLAYWRIGHT_ALLOW_REMOTE=true to override.`
    );
  }
}

const config = {
  baseURL: readEnv('PLAYWRIGHT_BASE_URL', 'http://localhost:3000'),
  apiURL: readEnv('PLAYWRIGHT_API_URL', 'http://localhost:5023/api'),
  testRole: readEnv('PLAYWRIGHT_TEST_ROLE', 'admin'),
};

assertLocalOnly(config.baseURL, 'PLAYWRIGHT_BASE_URL');
assertLocalOnly(config.apiURL, 'PLAYWRIGHT_API_URL');

module.exports = { config, LOCAL_HOSTS, assertLocalOnly };
