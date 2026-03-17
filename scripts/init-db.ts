import { getBookCount } from "../src/lib/database";

console.log(`SQLite 已初始化，当前共有 ${getBookCount()} 本图书。`);

