# Vercel + Turso 閮ㄧ讲璇存槑

杩欎釜椤圭洰宸茬粡瀹屾垚浜?`SQLite 鏈湴寮€鍙?+ Turso 绾夸笂婕旂ず` 鐨勫弻搴撻€傞厤锛岄€傚悎鏈湴缁х画鐢ㄦ枃浠舵暟鎹簱寮€鍙戯紝鍚屾椂鎶婄嚎涓婄増鏈儴缃插埌 Vercel銆?
## 1. 鍑嗗 Turso 鏁版嵁搴?
鍏堝湪 Turso 鍒涘缓涓€涓暟鎹簱锛屽苟鎷垮埌涓ら」閰嶇疆锛?
- `DATABASE_URL`
- `DATABASE_AUTH_TOKEN`

绀轰緥锛?
```bash
DATABASE_URL="libsql://your-db-name-your-org.turso.io"
DATABASE_AUTH_TOKEN="..."
```

## 2. 鍦?Vercel 閰嶇疆鐜鍙橀噺

鑷冲皯閰嶇疆涓嬮潰杩欎簺锛?
```bash
NEXT_PUBLIC_APP_URL="https://your-project.vercel.app"
DATABASE_DRIVER="turso"
DATABASE_URL="libsql://your-db-name-your-org.turso.io"
DATABASE_AUTH_TOKEN="..."
OPEN_LIBRARY_APP_NAME="nanfang-library-management-system"
OPEN_LIBRARY_CONTACT_EMAIL="your-email@example.com"
```

濡傛灉浣犲彧鏄湰鍦板紑鍙戯紝鍙互缁х画鐢ㄩ粯璁ょ殑锛?
```bash
DATABASE_DRIVER="sqlite"
```

## 3. 棣栨閮ㄧ讲鍚庡啓鍏ユ紨绀烘暟鎹?
鍦ㄦ湰鍦?PowerShell 閲屼复鏃跺垏鍒?Turso 閰嶇疆锛岀劧鍚庢墽琛岄噸缃剼鏈細

```powershell
$env:DATABASE_DRIVER="turso"
$env:DATABASE_URL="libsql://your-db-name-your-org.turso.io"
$env:DATABASE_AUTH_TOKEN="your-token"
npm run db:reset
```

杩欎釜鑴氭湰浼氾細

- 娓呯┖鐜版湁鍥句功鏁版嵁
- 閲嶆柊鍐欏叆绀轰緥棣嗚棌

閫傚悎棣栨閮ㄧ讲鍜屽悗缁€滄紨绀虹幆澧冩暟鎹噸缃€濄€?
## 4. Vercel 閮ㄧ讲寤鸿

- 寤鸿鐩存帴浠?GitHub 浠撳簱瀵煎叆鍒?Vercel
- 閮ㄧ讲瀹屾垚鍚庯紝鎶?GitHub 浠撳簱鐨?`homepage` 鏇存柊鎴愪綘鐨?Vercel 鍩熷悕
- 濡傛灉浣犺鍏紑婕旂ず锛孯EADME 閲屽彲浠ユ槑纭爣娉ㄢ€滄紨绀烘暟鎹細瀹氭湡閲嶇疆鈥?
## 5. 鏈湴涓庣嚎涓婄殑鍖哄埆

- 鏈湴锛氶粯璁や娇鐢?`data/library.db`
- 绾夸笂锛氫娇鐢?`Turso`
- 椤甸潰銆丼erver Actions銆佹牎楠岄€昏緫鍜岃〃缁撴瀯淇濇寔涓€鑷?
## 6. 甯歌闂

### 涓轰粈涔堟湰鍦拌繕淇濈暀 SQLite锛?
鍥犱负鏈湴寮€鍙戝拰姣曡婕旂ず鏃讹紝SQLite 渚濈劧鏄渶杞婚噺銆佹渶瀹规槗璺戣捣鏉ョ殑鏂规銆?
### 涓轰粈涔堢嚎涓婁笉缁х画鐢ㄦ湰鍦?SQLite 鏂囦欢锛?
鍥犱负 Vercel 鐨勮繍琛岀幆澧冧笉閫傚悎鎸佷箙鍖栨湰鍦版枃浠跺啓鍏ワ紝鎹㈡垚 Turso 浠ュ悗鏇寸ǔ瀹氾紝涔熸洿閫傚悎鍏紑婕旂ず銆?