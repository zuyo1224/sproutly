// 超商熱門門市清單（demo 用，僅含台北 / 新北 / 桃園主要門市範例）
// 之後接綠界 ECPay 物流 API 後會改成全台 16000+ 即時門市選店

export type CvsStore = {
  cvs: "7-11" | "全家" | "萊爾富";
  name: string;
  code: string;
  area: string;
};

export const CVS_STORES: CvsStore[] = [
  // 7-11
  { cvs: "7-11", name: "信義門市", code: "116002", area: "台北信義區" },
  { cvs: "7-11", name: "忠孝門市", code: "117045", area: "台北大安區" },
  { cvs: "7-11", name: "東門門市", code: "115012", area: "台北中正區" },
  { cvs: "7-11", name: "中山門市", code: "112008", area: "台北中山區" },
  { cvs: "7-11", name: "西門門市", code: "114003", area: "台北萬華區" },
  { cvs: "7-11", name: "公館門市", code: "118021", area: "台北中正區" },
  { cvs: "7-11", name: "天母門市", code: "111014", area: "台北士林區" },
  { cvs: "7-11", name: "板橋門市", code: "220035", area: "新北板橋區" },
  { cvs: "7-11", name: "桃園門市", code: "330018", area: "桃園市" },
  { cvs: "7-11", name: "中壢門市", code: "320052", area: "桃園中壢區" },
  // 全家
  { cvs: "全家", name: "信義門市", code: "FX116002", area: "台北信義區" },
  { cvs: "全家", name: "忠孝門市", code: "FX117045", area: "台北大安區" },
  { cvs: "全家", name: "中山門市", code: "FX112008", area: "台北中山區" },
  { cvs: "全家", name: "公館門市", code: "FX118021", area: "台北中正區" },
  { cvs: "全家", name: "板橋門市", code: "FX220035", area: "新北板橋區" },
  { cvs: "全家", name: "新莊門市", code: "FX242011", area: "新北新莊區" },
  { cvs: "全家", name: "桃園門市", code: "FX330018", area: "桃園市" },
  { cvs: "全家", name: "中壢門市", code: "FX320052", area: "桃園中壢區" },
  // 萊爾富
  { cvs: "萊爾富", name: "信義店", code: "HL116002", area: "台北信義區" },
  { cvs: "萊爾富", name: "忠孝店", code: "HL117045", area: "台北大安區" },
  { cvs: "萊爾富", name: "中山店", code: "HL112008", area: "台北中山區" },
  { cvs: "萊爾富", name: "板橋店", code: "HL220035", area: "新北板橋區" },
  { cvs: "萊爾富", name: "桃園店", code: "HL330018", area: "桃園市" },
];

export function formatStoreLabel(s: CvsStore): string {
  return `${s.cvs} ${s.name} #${s.code}（${s.area}）`;
}

export const CVS_LOOKUP_URLS = {
  "7-11": "https://emap.pcsc.com.tw/",
  "全家": "https://www.family.com.tw/Marketing/inquiry.aspx",
  "萊爾富": "https://www.hilife.com.tw/storeInquiry_street.aspx",
};
