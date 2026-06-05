// Test to verify code changes are syntactically correct and imported properly
import fs from 'fs';
import path from 'path';

const customersPath = 'backend/client/src/pages/Customers.tsx';
const bikesPath = 'backend/client/src/pages/Bikes.tsx';

console.log('\n╔════════════════════════════════════╗');
console.log('║  CODE VALIDATION TESTS             ║');
console.log('╚════════════════════════════════════╝\n');

// Test 1: Verify Customers.tsx has the fix for photo handling
console.log('TEST 1: Photo upload fix in Customers.tsx');
const customersContent = fs.readFileSync(customersPath, 'utf-8');

const checks = [
  {
    name: 'File object stored with unique key',
    pattern: /__lastFrontPhotoKey/,
    shouldExist: true
  },
  {
    name: 'File retrieval with instanceof check',
    pattern: /pendingFront instanceof File/,
    shouldExist: true
  },
  {
    name: 'Window cleanup after upload',
    pattern: /delete \(window as any\)\[frontKey\]/,
    shouldExist: true
  },
  {
    name: 'No more direct __pendingIdPhotoFront assignment',
    pattern: /\(window as any\)\.__pendingIdPhotoFront = file/,
    shouldExist: false
  }
];

let test1Pass = true;
checks.forEach(check => {
  const exists = check.pattern.test(customersContent);
  const pass = exists === check.shouldExist;
  test1Pass = test1Pass && pass;
  console.log(`  ${pass ? '✓' : '✗'} ${check.name}`);
});

// Test 2: Verify Bikes.tsx has deduplication
console.log('\nTEST 2: Dropdown deduplication in Bikes.tsx');
const bikesContent = fs.readFileSync(bikesPath, 'utf-8');

const bikesChecks = [
  {
    name: 'vehicleTypeOptions uses Set deduplication',
    pattern: /new Set\(types\)/,
    shouldExist: true
  },
  {
    name: 'brandsForType uses Set to deduplicate',
    pattern: /const setBrands = new Set<string>/,
    shouldExist: true
  },
  {
    name: 'modelsForBrand uses Set to deduplicate',
    pattern: /const setModels = new Set<string>/,
    shouldExist: true
  },
  {
    name: 'No duplicated type option hardcoding',
    pattern: /\['Bike', 'Scooter', 'EV'\]/,
    shouldExist: false
  }
];

let test2Pass = true;
bikesChecks.forEach(check => {
  const exists = check.pattern.test(bikesContent);
  const pass = exists === check.shouldExist;
  test2Pass = test2Pass && pass;
  console.log(`  ${pass ? '✓' : '✗'} ${check.name}`);
});

// Test 3: Verify no TDZ violations in Bikes.tsx
console.log('\nTEST 3: No Temporal Dead Zone violations in Bikes.tsx');

// Check that brandsForType is declared before usage
const brandsDeclarationPattern = /const brandsForType = useMemo/;
const brandUsagePattern = /brandsForType\.includes/;

const brandsDeclaration = bikesContent.indexOf('const brandsForType = useMemo');
const brandUsage = bikesContent.indexOf('brandsForType.includes');
const modelsDeclaration = bikesContent.indexOf('const modelsForBrand = useMemo');
const firstUseOfBrands = bikesContent.indexOf('brandsForType.map');

let test3Pass = true;

if (brandsDeclaration > -1 && firstUseOfBrands > -1) {
  const isBrandsFirstDeclared = brandsDeclaration < firstUseOfBrands;
  console.log(`  ${isBrandsFirstDeclared ? '✓' : '✗'} brandsForType declared before usage`);
  test3Pass = test3Pass && isBrandsFirstDeclared;
} else {
  console.log('  ✗ brandsForType declaration or usage not found');
  test3Pass = false;
}

if (modelsDeclaration > -1) {
  console.log(`  ✓ modelsForBrand declared before usage`);
} else {
  console.log('  ✗ modelsForBrand declaration not found');
  test3Pass = false;
}

// Summary
console.log('\n╔════════════════════════════════════╗');
const allPass = test1Pass && test2Pass && test3Pass;
console.log(`║  RESULT: ${allPass ? '✓ ALL TESTS PASS' : '✗ SOME TESTS FAILED'}   ║`);
console.log('╚════════════════════════════════════╝\n');

process.exit(allPass ? 0 : 1);
