import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 本機才有、已在 .gitignore 的產物，不是原始碼，掃進來只會把問題數灌水
    // （.next-old 是舊的 dev 產物，光它就佔了九千多條）。
    ".next-old/**",
    ".playwright-mcp/**",
  ]),
  {
    linterOptions: {
      // 沒作用的 eslint-disable 註解直接當錯誤，不再只是警告：留著會誤導讀 code 的人
      // 以為那裡有刻意豁免，真要開規則時也會被假豁免擋住看不到該處理的地方。
      reportUnusedDisableDirectives: "error",
    },
  },
]);

export default eslintConfig;
