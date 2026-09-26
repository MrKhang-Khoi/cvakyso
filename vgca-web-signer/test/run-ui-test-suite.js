/**
 * RUNNER CHẠY TRỌN VẸN TEST SERVER VÀ ENDPOINTS
 */
'use strict';

const { startServer } = require('../test-ui-server');

async function main() {
  await startServer();
  // Đợi server đã lắng nghe trên port 8088
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Chạy test-ui-endpoints
  const { testAll } = require('./test-ui-endpoints');
  if (typeof testAll === 'function') {
    await testAll();
  }
  console.log('✅ HOÀN TẤT RUNNER KIỂM THỬ.');
  process.exit(0);
}

main().catch(err => {
  console.error('Lỗi chạy suite:', err);
  process.exit(1);
});
