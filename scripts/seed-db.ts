import "dotenv/config";

import {
  closeDatabaseRuntime,
  getBookCount,
  getDatabaseInfo,
  seedSampleBooks,
} from "../src/lib/database";

async function main() {
  await seedSampleBooks();

  const [count, databaseInfo] = await Promise.all([getBookCount(), getDatabaseInfo()]);

  console.log(`示例图书数据已写入，当前共有 ${count} 本图书。`);
  console.log(`当前数据库驱动：${databaseInfo.driver}`);
}

main()
  .catch((error) => {
    console.error("写入示例图书数据失败。");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabaseRuntime();
  });
