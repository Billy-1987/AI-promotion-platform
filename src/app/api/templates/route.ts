import { NextRequest, NextResponse } from 'next/server'
import { writeFile, access, mkdir } from 'fs/promises'
import path from 'path'

export const maxDuration = 120

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated')

const VARIANT_STYLE = [
  'warm, classic, elegant composition, centered layout',
  'modern, bold, dynamic composition, asymmetric layout with strong visual contrast',
]

const PROMPT_MAP: Record<string, { scene: string; slogans: [string, string] }> = {
  '元旦':       { scene: 'New Year celebration: fireworks, countdown, gold numbers, festive modern style',          slogans: ['辞旧迎新，万象更新', '新年快乐，前程似锦'] },
  '春节':       { scene: 'Chinese Spring Festival: red lanterns, plum blossoms, golden clouds, traditional style',  slogans: ['新春大吉，万事如意', '阖家欢乐，岁岁平安'] },
  '元宵节':     { scene: 'Lantern Festival: colorful lanterns, full moon, tangyuan, night sky',                     slogans: ['花好月圆，元宵佳节', '灯火阑珊，共度元宵'] },
  '情人节':     { scene: "Valentine's Day: roses, hearts, pink tones, romantic aesthetic",                          slogans: ['爱你如初，情定今生', '浪漫相伴，爱意绵绵'] },
  '妇女节':     { scene: "Women's Day: flowers, spring, elegant feminine elements, pink-purple tones",              slogans: ['巾帼风采，绽放芳华', '女神当道，美丽无界'] },
  '清明节':     { scene: 'Qingming Festival: spring rain, green willow branches, misty mountains, peaceful nature', slogans: ['春和景明，慎终追远', '清明时节，寄思无限'] },
  '劳动节':     { scene: 'Labor Day: blue sky, city skyline, uplifting warm atmosphere',                            slogans: ['劳动最光荣，奋斗正当时', '致敬每一位劳动者'] },
  '母亲节':     { scene: "Mother's Day: carnations, warm sunlight, pink tones, heartfelt atmosphere",               slogans: ['感恩母爱，温暖如初', '妈妈，谢谢您的爱'] },
  '儿童节':     { scene: "Children's Day: colorful balloons, rainbow, cartoon elements, joyful playful style",     slogans: ['童心未泯，快乐无边', '六一快乐，童年无忧'] },
  '端午节':     { scene: 'Dragon Boat Festival: dragon boat, zongzi, mugwort, river, traditional festive',         slogans: ['粽情端午，安康如意', '龙舟竞渡，共庆佳节'] },
  '父亲节':     { scene: "Father's Day: blue tones, warm sunlight, steady grateful atmosphere",                     slogans: ['父爱如山，感恩有您', '爸爸，您辛苦了'] },
  '七夕节':     { scene: 'Qixi Festival: starry sky, magpie bridge, Milky Way, romantic Chinese style',            slogans: ['鹊桥相会，情定七夕', '星河灿烂，爱你如昨'] },
  '中元节':     { scene: 'Ghost Festival: lotus lanterns, water reflection, night sky, serene peaceful',           slogans: ['寄托哀思，缅怀先人', '灯火寄情，思念无尽'] },
  '中秋节':     { scene: 'Mid-Autumn Festival: full moon, mooncakes, osmanthus flowers, jade rabbit',              slogans: ['月圆人团圆，中秋共此时', '花好月圆，阖家幸福'] },
  '重阳节':     { scene: 'Double Ninth Festival: chrysanthemums, mountain peaks, autumn colors',                   slogans: ['登高望远，重阳安康', '岁岁重阳，今又重阳'] },
  '国庆节':     { scene: 'National Day: Tiananmen, red flags, fireworks, gold tones, solemn festive',              slogans: ['祖国万岁，盛世华章', '国庆同庆，山河无恙'] },
  '冬至':       { scene: 'Winter Solstice: dumplings, snow scene, warm indoor light, cozy winter',                 slogans: ['冬至暖，一碗汤圆情意长', '冬至已至，温暖同行'] },
  '圣诞节':     { scene: 'Christmas: Christmas tree, snowflakes, gifts, red-green tones, festive joyful',          slogans: ['圣诞快乐，愿望成真', '雪夜温情，圣诞同乐'] },
  '小寒':       { scene: 'Xiaohan solar term: snow, winter plum blossoms, cold morning light, Chinese ink style',  slogans: ['小寒时节，梅香暗动', '寒意渐浓，静待春归'] },
  '大寒':       { scene: 'Dahan solar term: heavy snowfall, icicles, bare branches, deep winter',                  slogans: ['大寒已至，春不远矣', '寒极生暖，岁末迎新'] },
  '立春':       { scene: 'Start of Spring: new buds, peach blossoms, spring breeze, vibrant green',                slogans: ['春回大地，万物复苏', '立春已到，好运连连'] },
  '雨水':       { scene: 'Rain Water solar term: spring rain, water droplets, fresh green, light mist',            slogans: ['春雨润物，生机盎然', '雨水时节，万物滋长'] },
  '惊蛰':       { scene: 'Awakening of Insects: spring thunder, butterflies, blooming flowers, nature awakening',  slogans: ['春雷一声，万物惊醒', '惊蛰时节，奋发向前'] },
  '春分':       { scene: 'Spring Equinox: rapeseed flower fields, blue sky, spring breeze, bright scenery',        slogans: ['春分时节，阴阳相半', '春色平分，岁月静好'] },
  '谷雨':       { scene: 'Grain Rain: tea leaves, spring rain, green hills, fresh tea garden',                     slogans: ['谷雨时节，茶香四溢', '雨生百谷，春意正浓'] },
  '立夏':       { scene: 'Start of Summer: lotus leaves, cicadas, green shade, sunlight, early summer',            slogans: ['立夏已至，清凉相伴', '夏日初临，活力满满'] },
  '小满':       { scene: 'Grain Buds: wheat ears, golden fields, blue sky, pre-harvest atmosphere',                slogans: ['小满时节，麦穗飘香', '小满不满，继续努力'] },
  '芒种':       { scene: 'Grain in Ear: rice paddies, farming, golden wheat waves, summer harvest',                slogans: ['芒种忙种，丰收在望', '挥洒汗水，收获希望'] },
  '夏至':       { scene: 'Summer Solstice: blazing sun, sunflowers, blue sky white clouds, midsummer',             slogans: ['夏至已至，阳光正好', '最长白昼，活力四射'] },
  '小暑':       { scene: 'Minor Heat: lotus flowers, cicadas, green shade, cool water surface, summer',            slogans: ['小暑不算热，大暑三伏天', '清凉一夏，快乐相伴'] },
  '大暑':       { scene: 'Major Heat: scorching sun, watermelon, ice cubes, heat waves, peak summer',              slogans: ['大暑炎炎，清凉送爽', '热情似火，激情不减'] },
  '立秋':       { scene: 'Start of Autumn: falling leaves, golden forest, autumn breeze, early autumn',            slogans: ['立秋已至，金风送爽', '秋意渐浓，丰收可期'] },
  '处暑':       { scene: 'End of Heat: clear autumn sky, blue sky, rice fields, refreshing autumn day',            slogans: ['处暑出暑，秋高气爽', '暑去凉来，岁月如歌'] },
  '白露':       { scene: 'White Dew: morning dew, reeds, light mist, autumn grass, dewy morning',                 slogans: ['白露为霜，秋意正浓', '露珠晶莹，秋色宜人'] },
  '秋分':       { scene: 'Autumn Equinox: red leaves, harvest, golden fields, full moon, autumn harvest',          slogans: ['秋分时节，硕果累累', '金秋送爽，丰收喜悦'] },
  '寒露':       { scene: 'Cold Dew: chrysanthemums, red leaves, cold dew, autumn mountains, deep autumn',          slogans: ['寒露时节，菊香满园', '露冷秋深，岁月静美'] },
  '霜降':       { scene: "Frost's Descent: frost flowers, maple leaves, morning frost, late autumn cold",          slogans: ['霜降已至，层林尽染', '霜叶红于二月花'] },
  '立冬':       { scene: 'Start of Winter: first snow, bare branches, warm light, winter arriving',                slogans: ['立冬已至，温暖相伴', '冬日暖阳，岁月静好'] },
  '小雪':       { scene: 'Minor Snow: light snowfall, pine trees, snowflakes, winter, elegant snow scene',         slogans: ['小雪飘飘，冬日温情', '雪落无声，岁月安好'] },
  '大雪':       { scene: 'Major Snow: heavy snowfall, snow plains, pine and cypress, vast snow landscape',         slogans: ['大雪纷飞，银装素裹', '瑞雪兆丰年，吉祥如意'] },
  '年货节':     { scene: 'Chinese New Year shopping festival: festive goods, red packaging, warm celebration',     slogans: ['年货大集，好礼不停', '囤年货，迎好年'] },
  '情人节促销': { scene: "Valentine's Day sale: roses, gifts, hearts, romantic pink atmosphere",                   slogans: ['爱要大声说，礼要精心选', '甜蜜特惠，爱意满满'] },
  '38女王节':   { scene: "Women's Day sale: flowers, fashion, elegant feminine power, purple-pink tones",          slogans: ['女王专属，宠爱无限', '她的节日，她做主'] },
  '春季上新':   { scene: 'Spring new arrivals: fresh flowers, light colors, fashion items, spring breeze',         slogans: ['春日焕新，潮流先行', '新品上市，春意盎然'] },
  '五一促销':   { scene: 'Labor Day sale: golden week, travel, shopping, festive atmosphere',                      slogans: ['五一出游，特惠同行', '黄金假期，购享无忧'] },
  '618大促':    { scene: '618 shopping festival: fireworks, big sale, colorful banners, exciting atmosphere',      slogans: ['618狂欢，好货不贵', '年中大促，惊喜不断'] },
  '暑期特惠':   { scene: 'Summer sale: beach, sunshine, cool products, vibrant summer colors',                     slogans: ['暑期特惠，清凉一夏', '夏日狂欢，好物低价'] },
  '七夕促销':   { scene: 'Qixi sale: starry sky, romantic gifts, couples, warm atmosphere',                        slogans: ['七夕特惠，爱意加倍', '浪漫七夕，礼遇真情'] },
  '开学季':     { scene: 'Back to school: stationery, backpacks, campus, fresh start atmosphere',                  slogans: ['开学季，新出发', '满载而归，学途无忧'] },
  '中秋礼盒':   { scene: 'Mid-Autumn gift box: mooncakes, moon, elegant packaging, warm family reunion',           slogans: ['中秋礼盒，情意满满', '月圆礼至，共享团圆'] },
  '国庆促销':   { scene: 'National Day sale: red flags, fireworks, golden week shopping, festive',                 slogans: ['国庆同庆，好礼相送', '举国同庆，特惠不停'] },
  '双十一':     { scene: 'Double 11 shopping festival: massive sale, fireworks, shopping bags, excitement',        slogans: ['双十一狂欢，全场低价', '一年一度，购物盛典'] },
  '双十二':     { scene: 'Double 12 shopping festival: year-end sale, gifts, festive shopping atmosphere',         slogans: ['双十二收官，年末大促', '岁末钜惠，好物清单'] },
  '圣诞促销':   { scene: 'Christmas sale: Christmas tree, gifts, snowflakes, festive shopping',                    slogans: ['圣诞特惠，礼遇温情', '圣诞钜惠，好礼相送'] },
  '元旦促销':   { scene: 'New Year sale: fireworks, countdown, festive shopping, gold tones',                      slogans: ['元旦特惠，新年好礼', '辞旧迎新，钜惠来袭'] },
  '新品上市':   { scene: 'New product launch: spotlight, modern display, clean premium background',                slogans: ['新品首发，惊喜登场', '全新上市，品质之选'] },
  '品牌故事':   { scene: 'Brand story: elegant, premium, heritage, warm storytelling atmosphere',                  slogans: ['匠心传承，品质如一', '每一件，都是故事'] },
  '门店活动':   { scene: 'Store event: lively mall, colorful flags, crowd, event atmosphere',                      slogans: ['门店活动，精彩不断', '到店有礼，惊喜等你'] },
  '会员专享':   { scene: 'VIP member exclusive: gold tones, premium feel, starlight, high-end',                    slogans: ['会员专属，尊享特权', '感谢有你，专属回馈'] },
  '限时秒杀':   { scene: 'Flash sale: countdown, lightning, red urgency, promotion atmosphere',                    slogans: ['限时秒杀，手慢无', '倒计时开始，抢购正当时'] },
  '满减优惠':   { scene: 'Discount offer: coupons, fireworks, red festive promotional activity',                   slogans: ['满减优惠，省钱有道', '买得多，省得多'] },
}

function safeFilename(topic: string, variant: number) {
  const base = topic.replace(/[^a-zA-Z0-9一-龥]/g, '_')
  return variant === 0 ? `${base}.png` : `${base}_v2.png`
}

async function generatePoster(scene: string, variant: number): Promise<string | null> {
  const variantStyle = VARIANT_STYLE[variant] ?? VARIANT_STYLE[0]
  const fullPrompt = `Create a 16:9 widescreen horizontal promotional poster. Scene: ${scene}. Style: ${variantStyle}. Fill the entire canvas edge to edge. No text, no typography, no words. High quality, professional design.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aipp.bigoffs.cn',
      'X-Title': 'AIPP Template Community',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [{ role: 'user', content: fullPrompt }],
      modalities: ['image'],
      image_config: { aspect_ratio: '16:9' },
    }),
  })

  if (!res.ok) {
    console.error('[templates] OpenRouter error:', res.status, await res.text())
    return null
  }

  const data = await res.json()
  return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const topic = searchParams.get('topic') || ''
  const variant = parseInt(searchParams.get('variant') ?? '0', 10)

  if (!OPENROUTER_KEY) {
    return NextResponse.json({ url: null, error: 'Missing OPENROUTER_API_KEY' }, { status: 500 })
  }

  const filename = safeFilename(topic, variant)
  const filepath = path.join(GENERATED_DIR, filename)
  const publicUrl = `/generated/${filename}`

  // Cache hit — file already exists on disk (persisted Docker volume)
  try {
    await access(filepath)
    return NextResponse.json({ url: publicUrl })
  } catch { /* not cached yet */ }

  const entry = PROMPT_MAP[topic]
  const scene = entry?.scene ?? `promotional poster for "${topic}", beautiful illustration style, festive atmosphere`

  try {
    const dataUrl = await generatePoster(scene, variant)
    if (!dataUrl) return NextResponse.json({ url: null })

    // Save to disk (works in Docker with mounted volume; silently skipped on read-only FS)
    try {
      await mkdir(GENERATED_DIR, { recursive: true })
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      await writeFile(filepath, Buffer.from(base64Data, 'base64'))
      return NextResponse.json({ url: publicUrl })
    } catch {
      // Filesystem not writable (e.g. Vercel) — return data URL directly
      return NextResponse.json({ url: dataUrl })
    }
  } catch (e) {
    console.error('[templates] Generate error:', e)
    return NextResponse.json({ url: null })
  }
}
