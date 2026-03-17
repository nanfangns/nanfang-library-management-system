import { getBookCount, seedSampleBooks } from "../src/lib/database";

seedSampleBooks();

console.log(`种子数据已写入，当前共有 ${getBookCount()} 本图书。`);

