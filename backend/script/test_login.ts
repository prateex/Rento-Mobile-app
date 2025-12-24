import 'dotenv/config';

async function main() {
  const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
  const email = process.env.TEST_EMAIL || 'rento.test+1766571963049@example.com';
  const password = process.env.TEST_PASSWORD || 'TestPass!12345';
  const deviceId = process.env.TEST_DEVICE_ID || 'test-device-001';

  console.log('Testing POST /api/auth/login');
  console.log('URL:', `${baseUrl}/api/auth/login`);
  console.log('Email:', email);

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, device_id: deviceId })
  });

  const text = await res.text();
  console.log('Status:', res.status);
  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
    if (res.ok && json.success) {
      console.log('\n✅ Login test PASSED');
      console.log('Token received:', json.token ? 'YES' : 'NO');
      console.log('User ID:', json.user?.id);
    } else {
      console.log('\n❌ Login test FAILED');
      process.exit(1);
    }
  } catch {
    console.log('Raw response:', text);
    console.log('\n❌ Login test FAILED - invalid JSON');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
