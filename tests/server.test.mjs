import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import defaultApp, { createApp } from '../server.js';

function startTestServer(appInstance = createApp()) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind ephemeral port'));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
    server.on('error', reject);
  });
}

test('server.js exports a valid default Express app function for Vercel serverless runtime', async () => {
  assert.equal(typeof defaultApp, 'function');
  const { server, baseUrl } = await startTestServer(defaultApp);
  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthBody = await healthRes.json();
    assert.equal(healthBody.status, 'ok');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET / serves SK Barangay Pugaan DMS index.html with 200 OK', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.match(contentType, /text\/html/);
    const html = await res.text();
    assert.match(html, /SK Barangay Pugaan — Document Management, Requirements & Tracking System/);
    assert.match(html, /STORAGE_KEY_RELATIONAL_DB/);
    assert.match(html, /createSeedDatabase/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET unknown path falls back to index.html', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/repository`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /SK Brgy\. Pugaan/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('POST unknown path returns 404 JSON error', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/nonexistent`, { method: 'POST' });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'Not found');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

