import { spawn } from 'child_process';
import assert from 'assert';

const PORT = 3009;
const BASE_URL = `http://127.0.0.1:${PORT}`;

console.log('🚀 Spawning real server.js on port', PORT, '...');
const server = spawn('node', ['server.js'], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverReady = false;
server.stdout.on('data', (buf) => {
  const msg = buf.toString();
  if (msg.includes('EduSign VGCA') || msg.includes(String(PORT))) {
    serverReady = true;
  }
});
server.stderr.on('data', (buf) => {
  console.error('[Server Error]', buf.toString());
});

for (let i = 0; i < 60; i++) {
  if (serverReady) break;
  await new Promise(r => setTimeout(r, 100));
}

try {
  console.log('✅ Server started. Performing authentication...');

  // 1. Login as Admin
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin@123' })
  });
  const adminData = await adminRes.json();
  const adminToken = adminData.token;
  assert(adminToken, 'Admin token acquired');
  console.log('  ✅ Admin token acquired');

  // 2. Login as Teacher
  const teacherRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cva.ty', password: '123456' })
  });
  const teacherData = await teacherRes.json();
  const teacherToken = teacherData.token;
  assert(teacherToken, 'Teacher token acquired');
  console.log('  ✅ Teacher token acquired');

  console.log('\n🔒 Testing Probe 1: Unauthenticated GET /uploads/signatures/school_seal.png');
  const unauthRes = await fetch(`${BASE_URL}/uploads/signatures/school_seal.png`);
  console.log(`  -> Status: ${unauthRes.status} (Expected: 401)`);
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request MUST return 401');
  const unauthJson = await unauthRes.json();
  console.log('  -> Response JSON:', unauthJson);

  console.log('\n🔒 Testing Probe 2: Regular teacher GET /uploads/signatures/school_seal.png');
  const teacherSealRes = await fetch(`${BASE_URL}/uploads/signatures/school_seal.png`, {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  console.log(`  -> Status: ${teacherSealRes.status} (Expected: 403)`);
  assert.strictEqual(teacherSealRes.status, 403, 'Teacher request MUST return 403');
  const teacherJson = await teacherSealRes.json();
  console.log('  -> Response JSON:', teacherJson);

  console.log('\n🔒 Testing Probe 3: Admin GET /uploads/signatures/school_seal.png');
  const adminSealRes = await fetch(`${BASE_URL}/uploads/signatures/school_seal.png`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`  -> Status: ${adminSealRes.status} (Expected: 200)`);
  assert.strictEqual(adminSealRes.status, 200, 'Admin request MUST return 200');
  console.log('  -> Content-Type:', adminSealRes.headers.get('content-type'));
  const buf = await adminSealRes.arrayBuffer();
  console.log(`  -> Received image buffer: ${buf.byteLength} bytes`);

  console.log('\n🔒 Testing Probe 4: Teacher accessing OWN signature sig_user_cvaty.png');
  const teacherOwnSigRes = await fetch(`${BASE_URL}/uploads/signatures/sig_user_cvaty.png`, {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  console.log(`  -> Status: ${teacherOwnSigRes.status} (Expected: 200)`);
  assert.strictEqual(teacherOwnSigRes.status, 200, 'Teacher accessing own signature MUST return 200');

  console.log('\n🔒 Testing Probe 5: Teacher accessing OTHER signature sig_user_48965ee0.png');
  const teacherOtherSigRes = await fetch(`${BASE_URL}/uploads/signatures/sig_user_48965ee0.png`, {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  console.log(`  -> Status: ${teacherOtherSigRes.status} (Expected: 403)`);
  assert.strictEqual(teacherOtherSigRes.status, 403, 'Teacher accessing other signature MUST return 403');

  console.log('\n🎉 ALL REAL SERVER PROBE TESTS PASSED 100%!');
} finally {
  server.kill('SIGKILL');
}
