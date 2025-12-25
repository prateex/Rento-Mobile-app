import 'dotenv/config';

const BASE_URL = 'http://127.0.0.1:3000';

// Use existing users from production database
const USER1_EMAIL = 'prateeknarvekar21@gmail.com';  // Goa bikes Rental Shop
const USER1_PASSWORD = 'Prateek@123';
const DEVICE_ID = 'isolation-test-device';

const USER2_EMAIL = 'prateekn166@gmail.com';  // Prateek Rental Shop
const USER2_PASSWORD = 'Prateek@123';

async function testShopIsolation() {
  console.log('\n=== Testing Shop Isolation with Existing Users ===\n');
  
  // Login User 1
  console.log('🔐 Logging in User 1 (Goa bikes Rental Shop)...');
  const login1Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: USER1_EMAIL,
      password: USER1_PASSWORD,
      device_id: DEVICE_ID
    })
  });
  
  if (!login1Res.ok) {
    console.error('❌ User 1 login failed:', await login1Res.text());
    return;
  }
  
  const login1Data = await login1Res.json();
  const token1 = login1Data.token;
  const shop1Id = login1Data.user.shop.id;
  console.log('✅ User 1 logged in');
  console.log('   Shop:', login1Data.user.shop.name);
  console.log('   Shop ID:', shop1Id);
  
  // Login User 2
  console.log('\n🔐 Logging in User 2 (Prateek Rental Shop)...');
  const login2Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: USER2_EMAIL,
      password: USER2_PASSWORD,
      device_id: DEVICE_ID
    })
  });
  
  if (!login2Res.ok) {
    console.error('❌ User 2 login failed:', await login2Res.text());
    return;
  }
  
  const login2Data = await login2Res.json();
  const token2 = login2Data.token;
  const shop2Id = login2Data.user.shop.id;
  console.log('✅ User 2 logged in');
  console.log('   Shop:', login2Data.user.shop.name);
  console.log('   Shop ID:', shop2Id);
  
  console.log('\n--- Testing User 1 Data Access ---');
  
  // User 1: Get bookings
  const res1Bookings = await fetch(`${BASE_URL}/api/bookings`, {
    headers: {
      'Authorization': `Bearer ${token1}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data1Bookings = await res1Bookings.json();
  console.log('📊 User 1 Bookings:', data1Bookings.bookings?.length || 0);
  const user1ShopIds = [...new Set(data1Bookings.bookings?.map((b: any) => b.shop_id) || [])];
  console.log('   Unique shop_ids:', user1ShopIds);
  
  // User 1: Get vehicles
  const res1Vehicles = await fetch(`${BASE_URL}/api/vehicles`, {
    headers: {
      'Authorization': `Bearer ${token1}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data1Vehicles = await res1Vehicles.json();
  console.log('🏍️  User 1 Vehicles:', data1Vehicles.vehicles?.length || 0);
  const user1VehicleShopIds = [...new Set(data1Vehicles.vehicles?.map((v: any) => v.shop_id) || [])];
  console.log('   Unique shop_ids:', user1VehicleShopIds);
  
  // User 1: Get customers
  const res1Customers = await fetch(`${BASE_URL}/api/customers`, {
    headers: {
      'Authorization': `Bearer ${token1}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data1Customers = await res1Customers.json();
  console.log('👥 User 1 Customers:', data1Customers.customers?.length || 0);
  const user1CustomerShopIds = [...new Set(data1Customers.customers?.map((c: any) => c.shop_id) || [])];
  console.log('   Unique shop_ids:', user1CustomerShopIds);
  
  console.log('\n--- Testing User 2 Data Access ---');
  
  // User 2: Get bookings
  const res2Bookings = await fetch(`${BASE_URL}/api/bookings`, {
    headers: {
      'Authorization': `Bearer ${token2}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data2Bookings = await res2Bookings.json();
  console.log('📊 User 2 Bookings:', data2Bookings.bookings?.length || 0);
  const user2ShopIds = [...new Set(data2Bookings.bookings?.map((b: any) => b.shop_id) || [])];
  console.log('   Unique shop_ids:', user2ShopIds);
  
  // User 2: Get vehicles
  const res2Vehicles = await fetch(`${BASE_URL}/api/vehicles`, {
    headers: {
      'Authorization': `Bearer ${token2}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data2Vehicles = await res2Vehicles.json();
  console.log('🏍️  User 2 Vehicles:', data2Vehicles.vehicles?.length || 0);
  const user2VehicleShopIds = [...new Set(data2Vehicles.vehicles?.map((v: any) => v.shop_id) || [])];
  console.log('   Unique shop_ids:', user2VehicleShopIds);
  
  // User 2: Get customers
  const res2Customers = await fetch(`${BASE_URL}/api/customers`, {
    headers: {
      'Authorization': `Bearer ${token2}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data2Customers = await res2Customers.json();
  console.log('👥 User 2 Customers:', data2Customers.customers?.length || 0);
  const user2CustomerShopIds = [...new Set(data2Customers.customers?.map((c: any) => c.shop_id) || [])];
  console.log('   Unique shop_ids:', user2CustomerShopIds);
  
  console.log('\n=== Isolation Test Results ===\n');
  
  // Check isolation
  const user1OnlySeesOwnShop = 
    user1ShopIds.every(id => id === shop1Id) &&
    user1VehicleShopIds.every(id => id === shop1Id) &&
    user1CustomerShopIds.every(id => id === shop1Id);
  
  const user2OnlySeesOwnShop = 
    user2ShopIds.every(id => id === shop2Id) &&
    user2VehicleShopIds.every(id => id === shop2Id) &&
    user2CustomerShopIds.every(id => id === shop2Id);
  
  const noShopOverlap = !user1ShopIds.includes(shop2Id) && !user2ShopIds.includes(shop1Id);
  
  if (user1OnlySeesOwnShop && user2OnlySeesOwnShop && noShopOverlap) {
    console.log('✅ PASS: Shop isolation is working correctly!');
    console.log('   ✓ User 1 can only access data from their shop:', shop1Id);
    console.log('   ✓ User 2 can only access data from their shop:', shop2Id);
    console.log('   ✓ No cross-shop data leakage detected');
  } else {
    console.log('❌ FAIL: Shop isolation breach detected!');
    if (!user1OnlySeesOwnShop) {
      console.log('   ✗ User 1 sees data from other shops:', user1ShopIds);
    }
    if (!user2OnlySeesOwnShop) {
      console.log('   ✗ User 2 sees data from other shops:', user2ShopIds);
    }
    if (!noShopOverlap) {
      console.log('   ✗ Cross-shop data leakage detected');
    }
  }
  
  console.log('\n=== Test Complete ===\n');
}

testShopIsolation().catch(console.error);
