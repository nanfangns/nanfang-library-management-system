import { getBookCount, getDatabaseInfo, resetBooks, seedSampleBooks } from "../src/lib/database";

async function main() {
  await resetBooks();
  await seedSampleBooks();

  const [count, databaseInfo] = await Promise.all([getBookCount(), getDatabaseInfo()]);

  console.log(`图书数据已重置并重新写入示例数据，当前共有 ${count} 本图书。`);
  console.log(`当前数据库驱动：${databaseInfo.driver}`);
}

main().catch((error) => {
  console.error("重置图书数据失败。");
  console.error(error);
  process.exit(1);
});
