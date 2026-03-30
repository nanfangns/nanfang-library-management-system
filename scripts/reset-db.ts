import "dotenv/config";

import {
  closeDatabaseRuntime,
  getBookCount,
  getDatabaseInfo,
  resetBooks,
  seedSampleBooks,
} from "../src/lib/database";

async function main() {
  await resetBooks();
  await seedSampleBooks();

  const [count, databaseInfo] = await Promise.all([getBookCount(), getDatabaseInfo()]);

  console.log(`馆藏数据已重置并重新写入示例数据，当前共有 ${count} 本图书。`);
  console.log(`当前数据库驱动：${databaseInfo.driver}`);
}

main()
  .catch((error) => {
    console.error("重置馆藏数据失败。");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabaseRuntime();
  });
