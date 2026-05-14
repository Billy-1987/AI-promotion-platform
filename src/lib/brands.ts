// Partner brands from the 中岛区 KT board (.ai source).
// Logos saved in /public/brand-logos/{value}.png — all HD, extracted from the .ai file.
// Used by both AI 换装 (PreviewPanel.tsx) and AI 图片设计 (ImageDesignStudio.tsx).

export type BrandOption = { value: string; label: string }

export const OTHER_BRANDS: BrandOption[] = [
  { value: 'none', label: '选择品牌' },
  { value: 'b01', label: 'Dickies' },
  { value: 'b02', label: 'adidas' },
  { value: 'b03', label: 'SKECHERS 斯凯奇' },
  { value: 'b04', label: 'SKECHERS KIDS' },
  { value: 'b05', label: 'NIKE' },
  { value: 'b06', label: 'PUMA' },
  { value: 'b07', label: 'UNDER ARMOUR' },
  { value: 'b08', label: 'AFA 阿根廷' },
  { value: 'b09', label: 'FFF 法国队' },
  { value: 'b11', label: 'GUESS' },
  { value: 'b12', label: 'Extreme Toys' },
  { value: 'b13', label: 'David Fincher' },
  { value: 'b15', label: 'PAT' },
  { value: 'b17', label: 'hummel' },
  { value: 'b18', label: 'CARTELO 卡帝乐' },
  { value: 'b19', label: 'GABRIE MANN' },
  { value: 'b21', label: 'inman 茵曼' },
  { value: 'b22', label: 'MixBlu' },
  { value: 'b24', label: 'MIZUNO 美津浓' },
  { value: 'b25', label: 'Disney 迪士尼' },
  { value: 'b26', label: 'Jeep' },
  { value: 'b27', label: 'CAMEL 骆驼' },
  { value: 'b28', label: 'PIONEER CAMP 拓路者' },
  { value: 'b29', label: 'OUTDOOR' },
  { value: 'b30', label: 'U.S. POLO ASSN.' },
  { value: 'b31', label: 'LI-NING 李宁' },
  { value: 'b32', label: 'FILA' },
  { value: 'b33', label: 'THE NORTH FACE' },
  { value: 'b34', label: 'Columbia' },
  { value: 'b35', label: 'GAP' },
  { value: 'b36', label: '贵人鸟' },
  { value: 'b37', label: 'AIRWALK' },
  { value: 'b39', label: 'JACK&JONES 杰克琼斯' },
  { value: 'b40', label: 'ONLY' },
  { value: 'b41', label: 'VERO MODA' },
  { value: 'b42', label: 'CROCODILE 鳄鱼' },
  { value: 'b43', label: 'Timberland' },
  { value: 'b45', label: 'Baleno 班尼路' },
  { value: 'b46', label: 'Jeep KIDS' },
  { value: 'b47', label: "Levi's KIDS" },
  { value: 'b48', label: 'SPAO' },
  { value: 'b49', label: 'Lee KIDS' },
  { value: 'b50', label: 'MLB' },
  { value: 'b51', label: 'GABRIEL MANN' },
  { value: 'b53', label: 'Champion KIDS' },
  { value: 'b54', label: 'Jack Wolfskin 狼爪' },
  { value: 'b55', label: 'Champion 冠军' },
  { value: 'b57', label: 'INXX' },
  { value: 'b58', label: 'bossini 堡狮龙' },
  { value: 'b61', label: 'SELECTED' },
  { value: 'b62', label: 'lotto 乐途' },
  { value: 'b63', label: 'PEAK KIDS 匹克儿童' },
  { value: 'b64', label: '马克华菲 MARK FAIRWHALE' },
  { value: 'b67', label: 'ANTA 安踏' },
  { value: 'b68', label: 'i.t' },
  { value: 'b69', label: 'I.T. GROUNDZERO' },
]

export function getBrandLogoUrl(value: string): string | null {
  if (value === 'bigoffs') return '/bigoffs-logo.png'
  if (value === 'none') return null
  return `/brand-logos/${value}.png`
}

export function getBrandLabel(value: string): string {
  if (value === 'bigoffs') return 'BigOffs'
  return OTHER_BRANDS.find(b => b.value === value)?.label ?? value
}
