// 平台點陣圖示（app/icon.tsx 在 build 時畫出來的那兩張 png）的單一來源。
//
// 為什麼要獨立一支：這組尺寸有三個地方要對齊——畫圖的 app/icon.tsx、平台的
// app/manifest.ts、以及各店 app/[slug]/site.webmanifest。散在三處寫死的話，
// 哪天加一個尺寸或改路徑，manifest 會指到一個不存在的網址，而且是安靜壞掉：
// 主畫面圖示變空白、Android 的安裝提示直接不跳，本機開店面完全看不出來。
export const PLATFORM_ICON_SIZES = [192, 512] as const;

// manifest 的 icons[] 條目。src 就是 Next 給 app/icon.tsx 的路由（/icon/<id>，
// id 即 generateImageMetadata 回的那個尺寸字串）。
//
// 每個尺寸列兩條、指同一張圖：一條不寫 purpose（等於 any，Android 的安裝判定只認
// 這種），一條寫 maskable（讓啟動器要切圓形或方角時知道可以切）。不能只寫一條
// 「any maskable」——規格允許那樣寫，但 Next 的 Manifest 型別只收單一值。
// 敢標 maskable 是因為底是實色白、芽只佔畫布 58% 高，落在安全區（中央直徑 80%
// 的圓）內，怎麼切都不會削到圖形。
export const PLATFORM_MANIFEST_ICONS = PLATFORM_ICON_SIZES.flatMap((size) => {
  const icon = {
    src: `/icon/${size}`,
    sizes: `${size}x${size}`,
    type: "image/png",
  };
  return [icon, { ...icon, purpose: "maskable" as const }];
});
