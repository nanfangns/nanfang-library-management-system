import { getBookCount, getDatabaseInfo } from "../src/lib/database";

async function main() {
  const [count, databaseInfo] = await Promise.all([getBookCount(), getDatabaseInfo()]);

  console.log(`${databaseInfo.modeLabel} 已初始化，当前共有 ${count} 本图书。`);
  console.log(`当前数据库驱动：${databaseInfo.driver}`);
  console.log(`当前数据库地址：${databaseInfo.url}`);
}

main().catch((error) => {
  console.error("数据库初始化检查失败。");
  console.error(error);
  process.exit(1);
});
