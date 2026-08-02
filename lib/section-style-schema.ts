// 每個 section 的元素級樣式覆寫：欄位表與清洗規則的單一來源。
//
// 為什麼收到這裡：同一份欄位表原本在四個地方各抄一份——公開頁 _theme.ts 的 SectionStyle
// 型別、_theme.ts 讀回時的 sanitize、editor actions.ts 存檔時的 sanitize、editor 自己的
// patch 型別。每個欄位的合法值（"compact" | "default" | "spacious" 這種）在讀、寫兩層各
// 寫成一條手打的 or 判斷，加一個控制就要在兩條長鏈各補一段，而且字串要一字不差。漏在讀
// 那層，商家設好的值存得進 DB 卻讀不回來（畫面完全沒反應）；漏在寫那層，畫面上點得動、
// 自動存檔也顯示已存，重新整理就沒了——兩種都不會報錯，只會「這個控制好像壞的」。
// 兩份手抄清單靠人工對齊，本來就是遲早會漏的結構（專案裡 format-price、store-schema、
// fetch-order-items 都是同一個出發點收掉的）。
//
// 收成這一份之後：欄位與合法值只寫在 SECTION_STYLE_ENUMS，型別由它推出來，讀寫兩層都呼叫
// 同一支 sanitizeSectionStyles。加一個控制＝在這裡加一行，剩下的是編輯器要不要給 UI。
import { normalizeHexColor } from "./hex-color";

// 每個欄位的合法值。第一個值不一定是預設——「沒設定」在這套系統裡是「這個 key 不存在」，
// 不是某個特定值（editor 端把等同預設的選擇 delete 掉，公開頁沒讀到就整條樣式不套）。
export const SECTION_STYLE_ENUMS = {
  headingAlign: ["left", "center", "right"],
  // 內文對齊（auto 跟著上面那條區段對齊走 / left 靠左 / center 置中 / right 靠右）。
  // headingAlign 設的是整段容器的 text-align，段落是繼承來的，所以標題與內文一直只能同進退；
  // 報紙與雜誌最常見的「標題置中、內文靠左」在 Sproutly 做不出來。這一欄只管內文元素。
  bodyAlign: ["auto", "left", "center", "right"],
  // 內文一行字數（auto 不限制 / normal 約 34 字 / narrow 約 24 字）。滿版區段的長段落一行
  // 會拉到整個螢幕寬，眼睛換行時找不到下一行的行首，讀起來一直在跳行；報紙與雜誌都是把
  // 內文收成窄欄解這件事。限制的是段落自己的寬度，不是整段區段（sectionWidth 收的是整段，
  // 連標題、卡片、照片一起變窄，做不出「標題滿版、內文窄欄」）。
  bodyMeasure: ["auto", "normal", "narrow"],
  // 內文字級（default 不套 / small 縮小一成 / large 放大一成多）。標題已經有 headingScale
  // 可以各段獨立調大小，內文一直只能跟著全網站走：長描述在手機上偏小、想讓某一段的短文
  // 當引言放大也做不到，商家唯一的辦法是把整段的字體設定改掉、連標題一起變。
  // 這一欄只縮放內文自己，而且是等比縮放——同一段裡描述、圖說、引言原本的大小差距照原樣
  // 保留，不會被壓成同一級（見 layout.tsx 那條規則裡為什麼不能用 font-size 的說明）。
  bodyScale: ["small", "default", "large"],
  // 內文濃淡（default 不套 / muted 更淡 / strong 跟標題同深）。描述、說明、圖說這類次要文字
  // 一律用比標題淡的那個顏色（--store-text-muted，約七成濃度）——那是排版上的層級設計，
  // 但同一個濃度不是每間店都讀得動：淺灰底配淺灰字、或客人年紀偏大時，商品描述整段是糊的。
  // 商家原本能動的只有兩個極端：「文字顏色」把整段（含標題）一起換掉，或「淡化」把整段
  // 連照片一起變透明——沒有一個只調次要文字的。這一欄補的就是那一格。
  bodyTone: ["muted", "default", "strong"],
  // 標題用色（default 跟整段文字色 / accent 全站主色 / muted 跟次要文字同深淺）。
  // 區段裡用主色畫的一直只有配件——小標 eyebrow、標題底下那截短線、常見問題的＋——標題
  // 本身固定用文字色，商家想讓某一段的標題帶品牌色（最常見的「標題用主色、內文用黑」），
  // 唯一動得到標題顏色的是「文字顏色」，但那欄換的是整段：內文、圖說全部跟著變，等於
  // 做不到。這一欄只動標題；muted 給想讓標題退後一步、把重量讓給照片的段落（相簿、合作）。
  headingTone: ["default", "accent", "muted"],
  // 該 section 獨立上下空白（覆寫全網站值）
  paddingScale: ["compact", "default", "spacious"],
  // 標題與內容的距離（tight 收緊 / normal 照這一段原本的 / loose 放寬），指的是段落最上面
  // 那塊（小標 + 大標 + 引言）跟底下卡片、照片、問答之間空多少。每一段的那個距離是寫死的
  // 一個值，而且各段差很多：選物 128px、精選與慢讀 112px、常見問題 64px、合作 48px——那組
  // 值是照站上預設內容挑的，換成商家自己的東西常常不對。標題只有兩個字、底下四張卡的段落，
  // 中間空一大片會看起來像兩段沒關係的東西；反過來標題底下還有兩三行引言的段落，距離太近時
  // 引言跟卡片黏在一起，客人分不出哪句話在說明什麼。
  // 商家原本沒有一格動得到：「區段空白」跟「上下外距」調的是段落外圍的上下，段落裡面一動
  // 也不動；「卡片間距」調的是卡片彼此之間；「一行字數」「內文對齊」動的是文字自己。
  // 沒設就沒 attribute、整條規則不存在，各段維持自己原本那個值。
  headingGap: ["tight", "normal", "loose"],
  // 標題塊裡面的距離（tight 收緊 / normal 照這一段原本的 / loose 放寬）。上面那欄調的是整塊
  // 標題「對外」跟卡片之間的距離，這欄調的是那塊「裡面」——小標跟大標之間、大標跟底下引言
  // （慢讀那段）或那截短線（客人的話 / 常見問題 / 數字 / 相簿）之間。這兩段距離同樣是寫死的
  // （小標底下 16-20px、大標底下 24px），照站上預設那種一行小標配一行大標挑的。
  // 商家換成自己的字之後常常不對：小標寫「PLANTAE MARKET / 本月選物」那種長字串、大標又是
  // 兩行的段落，三行字黏成一團分不出誰是標題；反過來只有兩三個字的短標題，中間空著反而讓
  // 小標飄在上面像跟這段沒關係。原本沒有一格動得到——「標題與內容」調的是這塊對外那一段、
  // 「標題大小」換的是字級（字大了間距不會跟著長）、「這段的上下空白」調的是段落外圍。
  // 沒設就沒 attribute、整條規則不存在，各段維持自己原本那兩個值。
  headingInnerGap: ["tight", "normal", "loose"],
  // 分隔線（上 / 下 / 上下都有 / 沒有）
  divider: ["none", "top", "bottom", "both"],
  // 該 section 標題字級（small 0.85x / default 1x / large 1.25x）
  headingScale: ["small", "default", "large"],
  // 該 section 最低高度（auto 不限制 / tall 80vh / fullscreen 100vh）
  minHeight: ["auto", "tall", "fullscreen"],
  // 內容垂直位置（top 靠上 / middle 置中 / bottom 靠下）。只有在這一段比內容高的時候才看得出
  // 差別，也就是設了上面那條「最低高度」之後——原本撐出來的空高一律留在內容下面，商家選了
  // 滿屏是想要一整螢幕的段落，拿到的是一小塊內容黏在上緣、下面一大片空白。
  contentAlign: ["top", "middle", "bottom"],
  // 這一段在哪台裝置不顯示（none 都顯示 / mobile 手機不顯示 / desktop 桌機不顯示）。
  // 同一份內容在手機與桌機不會一樣好看：橫排的合作 logo、6 張一列的照片牆在手機上會擠成
  // 一長條，商家只能整段關掉（那條開關是全站的，桌機也跟著沒了）；反過來手機專用的「直接
  // 打電話」那類段落在桌機上是多餘的。原本沒有「只在某台裝置不顯示」這一格。
  // 平板一律顯示：只有一欄，選了「手機不顯示」還要決定平板算不算手機，切在中間最好解釋
  // ——手機是 640 以下、桌機是 1024 以上，中間那段兩邊都不碰。
  hideOn: ["none", "mobile", "desktop"],
  // 照片圓角（soft 14px / round 28px），只套這一段裡的照片，不動段落自己的框。
  // 站上的照片一律是接近直角的（商品卡的圖框固定 4px），這是全站寫死的一個值：
  // 商家把某一段設成圓角卡片（bgColor + borderRadius + shadow 那三件套）之後，段落的四角
  // 圓了、裡面的照片還是方的，兩個圓角對不起來反而更像沒做完；反過來想讓某一段的照片
  // 柔一點（人像、生活情境照），現有的「圓角」那欄動的是整段的外框，照片一點都不會變。
  mediaRadius: ["none", "soft", "round"],
  // 照片比例（square 正方 / portrait 直式 3:4 / landscape 橫式 3:2），只套這一段卡片格線
  // 裡的圖框。每一段的圖框比例是寫死的：選物 3:4、精選商品 1:1、慢讀 5:3、照片牆 1:1，
  // 照片放進去一律照那個框裁——賣水壺、高盆栽這類直式商品的店，商品照在正方形的框裡
  // 被裁頭去尾，商家沒有一格動得到；反過來拍橫幅生活照的店想讓照片牆寬一點也一樣。
  // 圖都是鋪滿框再裁（fill + object-cover），所以換比例是換裁法、不是把圖壓扁。
  mediaAspect: ["auto", "square", "portrait", "landscape"],
  // 照片取景（auto 置中 / top 保留上緣 / bottom 保留下緣），只套這一段卡片圖框裡的照片。
  // 照片鋪滿框再裁的時候一律從正中間取——直式商品照放進正方或橫式的框，被裁掉的是上下
  // 兩頭，而盆栽的葉冠、水壺的瓶口偏偏都在上面，裁掉的剛好是重點；上一欄「照片比例」
  // 換的是框的形狀，救不了「同一個框裡該留哪一端」這件事，商家原本沒有一格能選。
  // 只給上下兩檔不給左右：卡片圖框永遠比照片窄邊裁長邊，直式照片在框裡被裁的是上下，
  // 左右那組要等到有橫式照片配直式框的實際案例再說，先不擺一排按了沒反應的按鈕。
  mediaFocus: ["auto", "top", "bottom"],
  // 照片放不放得下整張（cover 鋪滿框裁掉多的 / contain 整張進框、周圍留白）。
  // 上面兩欄一個換框的形狀、一個選被裁時保留哪一端，但兩欄都還在「一定會裁」這個前提裡
  // ——框的比例是固定的，照片的比例每張不同，鋪滿就一定有一邊被切掉。商家最在意的那幾張
  // （整株盆栽的全貌、水壺連把手的側面、有邊框或留白構圖的商品圖）要的不是裁得準一點，
  // 是一點都不要裁，原本沒有一格做得到。選了整張進框之後也一起關掉滑過時的放大——那個
  // 放大會把照片撐出框外再被框裁掉，等於剛留住的邊又切一次，跟商家按這一格的意思相反。
  mediaFit: ["cover", "contain"],
  // 卡片間距（tight 收緊 / loose 放寬），只套這一段排成格子的卡片與照片之間的距離。
  // 商品卡、照片牆、合作 logo 的間距是每段寫死的一組值：商家把欄數調成 4 之後卡片黏在
  // 一起、或想把照片牆做成緊貼的拼貼、把精選商品攤成鬆一點的畫廊感，全都沒有一格動得到
  // ——動得到間距的只有「區段空白」跟「上下外距」，那兩欄調的是段落外圍，卡片彼此之間
  // 一動也不動。收緊 / 放寬蓋掉該段自己的那組值，不跟原值等比（CSS 蓋不掉又乘不了）。
  gridGap: ["tight", "normal", "loose"],
  // 滑過卡片的動作（default 原樣 / calm 只留輕輕浮起 / none 完全不動），只套這一段的卡片。
  // 滑鼠移到商品卡上，站上一律做四件事：卡片浮起、照片放大一成、照片壓一層暗、標題字距
  // 撐開——那是全站寫死的一組動作，每一段都一樣。密集排的照片牆滑過去整片在動、慢讀區
  // 的文章卡被當商品卡放大、拍好構圖的商品照被放大裁掉邊，商家沒有一格關得掉；原本
  // 動得到「動」的只有「進場動畫」，那是整段進場時做一次的事，跟滑過卡片無關。
  // 觸控裝置本來就沒有滑過這件事，這一欄調的是桌機（與平板外接滑鼠）的手感。
  cardHover: ["default", "calm", "none"],
  // 卡片文字位置（auto 跟著整段 / left 靠左 / center 置中 / right 靠右），只套卡片裡
  // 品名、價錢、副標、摘要那幾行。卡片下面的文字自己沒有帶對齊，一律繼承整段容器的
  // 對齊——商家把「標題對齊」設成置中（站上預設就是置中），每張卡的品名與價錢跟著置中，
  // 而商品列表最常見的排法是「段落大標置中、卡片文字靠左」（文字左緣對齊照片左緣，
  // 一整列掃下來才不會每張卡的字都從不同位置開始），原本沒有一格做得到。
  // 還有一個更難解釋的：「內文對齊」那欄的規則落在段落上，卡片裡的價錢、副標、摘要
  // 剛好都是段落，會被一起拉走，品名（h3）不是段落、留在原地——同一張卡上下兩行各自
  // 對齊，商家只是想調段落內文，卡片就先散了。這一欄設的是整張卡（含品名），設了就
  // 兩行一起走，也就把那個散掉的狀態收回來。
  cardText: ["auto", "left", "center", "right"],
  // 卡片外觀（none 原樣 / panel 淡底色的面板 / outline 一圈細框），只套這一段的卡片。
  // 站上的卡片一律是「照片 + 底下裸著的幾行字」直接浮在段落底色上，卡片自己沒有邊界——
  // 那是雜誌感的排法，商品少、留白多的時候好看，但商家把欄數調到 3、4 欄、或每張卡的
  // 品名長短不一之後，一整列看起來就是一堆散字，客人分不出哪行字屬於哪張照片（這也是
  // 網購站的商品卡幾乎都有底或有框的原因）。原本動得到「卡片有沒有邊界」的一格都沒有：
  // 段落自己的「底色 / 外框 / 圓角 / 陰影」那四欄畫的是整段的外圍，一段一個框，不會分到
  // 每張卡身上；「卡片間距」調的是卡片之間的距離，卡片本身還是裸的。
  // 底與框的顏色都從該段的文字色算（currentColor 的淡色），所以深底淺字的段落自動變成
  // 淺色的面板與框，商家不用再挑一次顏色——跟底紋、側邊色條同一個口徑。
  // 設了之後照片自己那圈陰影收掉：卡片已經有邊界了，照片再浮一次會變成框裡還有框。
  cardSurface: ["none", "panel", "outline"],
  // 卡片內距（tight 收緊 / normal 照原本的 14px / loose 放寬），只在上面那欄設了底或框
  // 之後才有東西可調——卡片沒有邊界的時候內距是看不見的空白，調了畫面上沒有任何差別。
  // 設了底或框之後，卡片裡的東西跟框之間留多少一律是寫死的 14px：那個值配站上預設那種
  // 一列三張、品名兩三個字的商品卡剛好，換成商家自己的東西就常常不對。一列一張、照片在
  // 左的清單模式，14px 的框貼著照片邊緣像沒留白；反過來一列四張的小卡、只有品名跟價錢
  // 兩行的段落，同樣 14px 佔掉的比例大得多，一整列看起來鬆散、照片被框擠小。
  // 商家原本沒有一格動得到——「卡片間距」調的是卡片彼此之間的距離、「區段空白」跟
  // 「上下外距」調的是段落外圍，卡片裡面那圈一動也不動。
  // 圓角跟著一起收放：內距收緊還留 14px 的圓角，框的四角會比裡面的照片圓得多，看起來像
  // 兩個對不上的形狀；三檔的圓角照內距等比走（8 / 14 / 22px）。
  cardPadding: ["tight", "normal", "loose"],
  // 卡片排法（stack 照片在上 / side 照片在左），只套這一段的卡片。
  // 站上每一段的卡片都是同一種排法：照片在上、品名價錢在下面一疊——那是格子牆的排法，
  // 適合客人一眼掃過整片照片。但同一批商品換成「一列一張、照片在左、字在右」（也就是
  // 一般網購站的清單模式）時，同一個螢幕高度裡看得到的品項多得多、品名與描述也有寬度
  // 寫得完整，慢讀區那種一段文字配一張圖的卡片更是本來就該橫著排。商家原本沒有一格
  // 做得到：「卡片外觀」給的是邊界、「卡片文字」給的是字站哪、「欄數」調的是一列幾張，
  // 三個都不會把照片從上面搬到左邊。
  // 設成照片在左之後，手機自動收成一列一張——半個螢幕寬的卡片再切成左圖右字，照片只剩
  // 一小格，那不是商家按這一格想要的東西。
  // 多一檔照片在右（side-reverse）：慢讀那種一段文字配一張圖的段落，整站每張卡都照片在左
  // 的話一列列下來像同一張卡複製貼上；左右交錯是雜誌、品牌故事頁本來就在用的排法。
  // 客人的閱讀順序也跟著換——照片在右時先讀到字，主打「先講故事再看照片」的段落用得上。
  cardLayout: ["stack", "side", "side-reverse"],
  // 照片佔寬（auto 照原本的 38% / narrow 25% / wide 50%），只在卡片排法設成照片在左或在右
  // 時有作用。橫著排的那兩檔，照片跟文字的寬度比是寫死的 38 比 62——那個比例是照站上目前
  // 的內容挑的，換成商家自己的東西就常常不對：慢讀那種一段文字配一張圖的段落，照片只佔
  // 三分之一像縮圖，配的圖是橫幅生活照時尤其小；反過來只列品名跟價錢的商品清單，字沒幾個
  // 卻分到六成寬，右邊空一大片。商家原本沒有一格動得到——「一列幾張」調的是一列排幾張卡、
  // 「卡片間距」調的是卡片之間的距離、「照片比例」調的是照片自己是方是長，三個都不改左右
  // 兩欄怎麼分。
  // 只給三檔不給滑桿：這欄調的是同一列每張卡的共同骨架，能拖到 41%、43% 只會讓商家在肉眼
  // 分不出來的差別上耗時間，而三檔之間的差是一眼看得出來的（縮圖 / 對半 / 大圖）。
  // 手機上沒作用：640 以下卡片本來就收成上下排，沒有左右兩欄可分。
  cardMediaWidth: ["auto", "narrow", "wide"],
  // 手機一列幾張（auto 照這一段原本的 / one 一列一張 / two 一列兩張），只套 640 以下。
  // 每一段在手機上一列幾張是寫死的：選物、精選、照片牆、數字一律兩張，慢讀、客人的話
  // 一律一張。那組值是照「站上目前的預設內容」挑的，換成商家自己的東西就不一定對——
  // 賣小盆栽、配件的店，一列兩張在手機上每張只剩半個螢幕寬，商品照小到看不出差別；
  // 反過來照片牆放的是橫幅生活照、精選只有兩三樣主打商品時，一列一張才看得清楚。
  // 商家原本沒有一格動得到：「一列幾張」那些欄位（選物 / 精選 / 相簿 columns）調的是
  // 桌機（md 以上）那組，手機那組不跟著動；「卡片間距」只縮距離，張數一樣。
  // 只給一張 / 兩張：手機寬度就那樣，三張以上每張不到三分之一個螢幕，擺了也是給商家
  // 一個按下去必然難看的選項。
  // 跟「卡片排法」的手機規則衝突時以這一欄為準——那邊收成一列一張是沒人選過的自動處理，
  // 這邊是商家自己按的，明確的選擇蓋過自動的預設。
  mobileColumns: ["auto", "one", "two"],
  // 卡片標題行數（auto 照這一段原本的 / one 一行 / two 兩行 / full 完整顯示），只套卡片裡
  // 那行品名或文章標題。精選商品那段的品名寫死只顯示一行、超過就切掉接刪節號（逛街頁、
  // 收藏頁同一套），品名長一點的店（「保溫瓶 500ml 木紋款」這種帶規格的）在首頁只看得到
  // 前半段，客人分不出兩個同系列商品差在哪，商家沒有一格解得開；反過來選物、慢讀那兩段
  // 的標題完全不截，商家自己打了長標題就把那張卡撐高，同一列其他卡片下面空一截。
  // 「卡片文字」設的是那幾行站哪、「卡片外觀」給的是邊界，兩個都不管一行字寫不寫得完。
  // 只管標題不管底下的描述：描述本來就是次要資訊，截掉不影響客人認得出商品，而品名被截
  // 是真的看不懂——先把最痛的那一格補上，描述那格等有店家真的被長描述卡到再說。
  cardTitleLines: ["auto", "one", "two", "full"],
  // 卡片描述行數（auto 照這一段原本的 / one 一行 / two 兩行 / three 三行 / full 完整顯示），
  // 只套卡片裡品名底下那段描述。上一格（卡片標題行數）把品名那行補起來之後，剩下描述這行
  // 還是完全不截：選物那段的副標、慢讀那段的摘要，商家自己打多長就佔多高——一段兩行、
  // 一段五行的話，同一列卡片下緣參差不齊，卡片外觀設成面板或框的時候尤其明顯（一個框矮
  // 一個框高）。反過來想讓摘要多露幾行的店也沒得選，卡片高度完全被最長那段綁住。
  // 「卡片標題行數」只管品名那行、「卡片文字」設的是那幾行站哪，兩個都不管描述佔幾行。
  // 比標題多一檔三行：描述本來就是可以讀幾句的地方，一兩行常常斷在句子中間。
  // 只落在真的是描述的那些行——精選商品品名底下那行是價錢，截掉價錢對客人沒有意義。
  cardDescLines: ["auto", "one", "two", "three", "full"],
  // 外框（subtle 1px / strong 2px，用 outline 避免跟 divider 的 borderTop/Bottom 打架）
  outline: ["none", "subtle", "strong"],
  // 陰影（soft 淺 / deep 深），讓有 bgColor 的 section 像卡片浮起
  shadow: ["none", "soft", "deep"],
  // 圓角（soft 16px / strong 32px），跟 bgColor + outline + shadow 三件套組成卡片風
  borderRadius: ["none", "soft", "strong"],
  // 進場動畫（fade 淡入 / slide-up 上滑），靠 CSS scroll-driven 觸發，edit mode 內 disable
  entrance: ["none", "fade", "slide-up"],
  // 該 section 字體（default 跟全網站 / serif 思源宋體 / sans 思源黑體），讓某段獨立切字體
  fontFamily: ["default", "serif", "sans"],
  // 字距（tight -0.02em / normal 預設 / wide 0.1em），雜誌大標常見 wide
  letterSpacing: ["tight", "normal", "wide"],
  // 行高（tight 1.4 緊湊 / normal 預設不套 / relaxed 2.0 舒展）
  lineHeight: ["tight", "normal", "relaxed"],
  // 淡化（default 不套 / muted 0.85 / faint 0.7），讓次要 section 變淡襯托主角
  opacity: ["default", "muted", "faint"],
  // 濾鏡（grayscale 黑白 / sepia 復古褐），只套這段裡的照片，文字與配色不動
  filter: ["none", "grayscale", "sepia"],
  // 寬度（full 滿版預設 / boxed 置中 1100px / narrow 窄欄 760px）
  sectionWidth: ["full", "boxed", "narrow"],
  // 上下外距（none 貼緊相鄰 / normal 64px / large 112px），配 sectionWidth 讓卡片浮出來
  sectionGap: ["none", "normal", "large"],
  // 標題粗細（light 400 常規 / normal 不套維持原樣 / bold 700 粗）。只用思源黑體 / 宋體有
  // 載進來的字重（400 / 700），不挑 300 之類沒載的——瀏覽器會拿常規去假變細，中文筆畫糊掉。
  headingWeight: ["light", "normal", "bold"],
  // 底紋（grid 細格線 / dots 點陣 / lines 斜紋），純 CSS gradient 疊在底色上，不吃圖檔。
  // 線的顏色走 currentColor，所以深底淺字的 section 換成淺色紋、不用另外設一組顏色。
  texture: ["none", "grid", "dots", "lines"],
  // 底色明暗變化（top 上緣加重 / bottom 下緣加重 / vignette 四周暈影），跟底紋同樣走
  // currentColor：淺底深字的段落疊出來是變暗，深底淺字的段落疊出來是提亮，不用另挑顏色。
  bgGradient: ["none", "top", "bottom", "vignette"],
  // 標題底線（short 短線 / full 整條），畫在該段 h2 底下。顏色跟外框、分隔線同一個口徑
  // （自訂文字色算出來的淡色），所以深底淺字的段落自動變成淺色線、不用另挑一次顏色。
  headingRule: ["none", "short", "full"],
  // 標題底線的粗細（thin 1px / normal 照原本的 2px / thick 4px），只在上面那欄設了線之後
  // 才有東西可調。線的長度有短線與整條兩檔可選，粗細一直是全站寫死的一個 2px——那個值配
  // 站上預設那種中等字級的大標剛好，但商家把某一段的標題大小調成大之後，2px 的線在放大的
  // 字底下細得像沒畫；反過來標題設成小、或整段只是照片牆的一行小標題時，同樣一條 2px 橫過
  // 整個螢幕寬（整條那檔）比標題本身還搶眼。
  // 商家原本沒有一格動得到——「標題底線」只換長度、「標題大小」與「標題粗細」動的是字自己，
  // 線不會跟著長。
  // 只給三檔不給滑桿：線是配著標題看的東西，1 / 2 / 4px 之間的差一眼看得出來，中間那些
  // 半格的差別在螢幕上根本畫不出來（非整數的線會被瀏覽器抹成灰邊）。
  headingRuleWeight: ["thin", "normal", "thick"],
  // 側邊色條（left 左緣 / right 右緣），畫在該段的左或右邊緣，4px 粗。分隔線佔的是
  // borderTop/Bottom、外框走 outline，三者不互相蓋。顏色比照外框與分隔線：該段設了
  // 文字色就從它算（深底淺字自動變淺色條），沒設就用全站主色 accent。
  accentBar: ["none", "left", "right"],
} as const satisfies Record<string, readonly string[]>;

// 每一欄「等同沒設定」的那個值。editor 端商家選到它就把整欄 delete 掉（少一欄存進 DB，
// 也讓「有沒有自訂」這件事只看 key 在不在）。沒列在這裡的欄位（headingAlign / paddingScale
// / headingScale / minHeight）沒有這種值，只有明確按重設才清掉。
export const SECTION_STYLE_NEUTRAL_VALUES = {
  bodyAlign: "auto",
  bodyMeasure: "auto",
  bodyScale: "default",
  bodyTone: "default",
  headingTone: "default",
  contentAlign: "top",
  headingGap: "normal",
  headingInnerGap: "normal",
  hideOn: "none",
  divider: "none",
  mediaRadius: "none",
  mediaAspect: "auto",
  mediaFocus: "auto",
  mediaFit: "cover",
  gridGap: "normal",
  cardHover: "default",
  cardText: "auto",
  cardSurface: "none",
  cardPadding: "normal",
  cardLayout: "stack",
  cardMediaWidth: "auto",
  mobileColumns: "auto",
  cardTitleLines: "auto",
  cardDescLines: "auto",
  outline: "none",
  shadow: "none",
  borderRadius: "none",
  entrance: "none",
  fontFamily: "default",
  letterSpacing: "normal",
  lineHeight: "normal",
  opacity: "default",
  filter: "none",
  sectionWidth: "full",
  sectionGap: "none",
  headingWeight: "normal",
  texture: "none",
  bgGradient: "none",
  headingRule: "none",
  headingRuleWeight: "normal",
  accentBar: "none",
} as const satisfies Partial<{
  [K in keyof typeof SECTION_STYLE_ENUMS]: (typeof SECTION_STYLE_ENUMS)[K][number];
}>;

// `-readonly`：欄位表是 as const（整份唯讀），若不脫掉，推出來的型別每一欄都變唯讀，
// 編輯器那邊 `next.sectionGap = ...` / `delete next.opacity` 這種改法會整排編譯不過。
type SectionStyleEnums = {
  -readonly [K in keyof typeof SECTION_STYLE_ENUMS]?: (typeof SECTION_STYLE_ENUMS)[K][number];
};

// 顏色欄位跟上面的選項欄位規則不同（吃任意 hex，且 null 是「明確清掉、回到 theme 預設」
// 這個有意義的狀態，跟「沒設定」不一樣），所以獨立列。
export interface SectionStyle extends SectionStyleEnums {
  bgColor?: string | null; // null = 用 theme.bg；hex = 覆寫
  textColor?: string | null; // null = 用 theme.text；hex = 覆寫（深底配淺字常用）
}

// 編輯器改某一段樣式時送的 patch：沒提到的欄位不動，給合法值就設，給 null 就清掉這一欄。
export type SectionStylePatch = Partial<{
  [K in keyof typeof SECTION_STYLE_ENUMS]: (typeof SECTION_STYLE_ENUMS)[K][number] | null;
}> & {
  bgColor?: string | null;
  textColor?: string | null;
};

// 把 patch 疊到現有樣式上，回一份新的（不改原物件——編輯器的 undo history 靠每步一份新值）。
// 選到「等同沒設定」的那個值（見 SECTION_STYLE_NEUTRAL_VALUES）跟給 null 一樣清掉整欄。
// 顏色兩欄照舊：null 是「清掉覆寫回 theme 預設」這個有意義的狀態，要留著存回去。
export function applySectionStylePatch(
  current: SectionStyle,
  patch: SectionStylePatch
): SectionStyle {
  const next: SectionStyle = { ...current };
  const neutral = SECTION_STYLE_NEUTRAL_VALUES as Partial<Record<string, string>>;

  for (const field of Object.keys(SECTION_STYLE_ENUMS) as (keyof typeof SECTION_STYLE_ENUMS)[]) {
    const v = patch[field];
    if (v === undefined) continue;
    if (v === null || v === neutral[field]) delete next[field];
    else (next as Record<string, unknown>)[field] = v;
  }

  if (patch.bgColor !== undefined) next.bgColor = patch.bgColor;
  if (patch.textColor !== undefined) next.textColor = patch.textColor;
  return next;
}

// section key 的長度上限。存檔那層本來就擋（避免有人塞一串垃圾當 key 把 theme jsonb 撐爆），
// 讀那層以前沒擋——同一條線只守一半，改成兩層共用同一個值。
const MAX_SECTION_KEY_LENGTH = 60;

// 清洗單一個 section 的樣式覆寫。認不得的欄位、不在合法值內的值一律丟掉（不是報錯——
// 舊資料、手改過的 jsonb 都可能有殘留，丟掉那一欄比整筆不讓商家存好）。
// 清完一欄都不剩就回 null，呼叫端不留這個 key。
export function sanitizeSectionStyle(raw: unknown): SectionStyle | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const entry: Record<string, unknown> = {};

  for (const [field, allowed] of Object.entries(SECTION_STYLE_ENUMS)) {
    const v = obj[field];
    if (typeof v === "string" && (allowed as readonly string[]).includes(v)) {
      entry[field] = v;
    }
  }

  // 顏色：清得出 hex 就用清過的；明確給 null 代表「清掉覆寫」，也要留著（跟「沒設定」
  // 在畫面上同結果，但商家按了重設就該存回去，不能被當沒設定而保留舊值）。
  for (const field of ["bgColor", "textColor"] as const) {
    const hex = normalizeHexColor(obj[field]);
    if (hex) entry[field] = hex;
    else if (obj[field] === null) entry[field] = null;
  }

  // 只要有任何一欄過關就留下這個 section 的覆寫。以前是一長串 entry.X !== undefined 的
  // 手寫 or，每加一個控制就要記得補一項，漏掉那個控制單獨設定時整筆會被丟掉。
  if (Object.keys(entry).length === 0) return null;
  return entry as SectionStyle;
}

// 清洗整份 sectionStyles（key = section id）。公開頁讀回與編輯器存檔走同一支，
// 兩邊對「什麼算合法」的認定不可能再各自漂移。
export function sanitizeSectionStyles(raw: unknown): Record<string, SectionStyle> {
  const result: Record<string, SectionStyle> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k || k.length > MAX_SECTION_KEY_LENGTH) continue;
    const entry = sanitizeSectionStyle(v);
    if (entry) result[k] = entry;
  }
  return result;
}
