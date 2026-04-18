import { NextRequest, NextResponse } from 'next/server'
import { writeFile, access } from 'fs/promises'
import path from 'path'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated')

const PROMPT_MAP: Record<string, string> = {
  // 节日
  '元旦':     'Vertical poster background for New Year celebration: fireworks, countdown, gold numbers, festive modern style. No text.',
  '春节':     'Vertical poster background for Chinese Spring Festival: red lanterns, plum blossoms, golden clouds, traditional Chinese style. No text.',
  '元宵节':   'Vertical poster background for Lantern Festival: colorful lanterns, full moon, tangyuan, night sky, warm festive atmosphere. No text.',
  '情人节':   'Vertical poster background for Valentine\'s Day: roses, hearts, pink tones, romantic aesthetic. No text.',
  '妇女节':   'Vertical poster background for Women\'s Day: flowers, spring, elegant feminine elements, pink-purple tones. No text.',
  '清明节':   'Vertical poster background for Qingming Festival: spring rain, green willow branches, misty mountains, peaceful nature. No text.',
  '劳动节':   'Vertical poster background for Labor Day: red flag, blue sky, city construction, uplifting atmosphere. No text.',
  '母亲节':   'Vertical poster background for Mother\'s Day: carnations, warm sunlight, pink tones, heartfelt atmosphere. No text.',
  '儿童节':   'Vertical poster background for Children\'s Day: colorful balloons, rainbow, cartoon elements, joyful playful style. No text.',
  '端午节':   'Vertical poster background for Dragon Boat Festival: dragon boat, zongzi, mugwort, river, traditional festive atmosphere. No text.',
  '父亲节':   'Vertical poster background for Father\'s Day: blue tones, tie, warm sunlight, steady grateful atmosphere. No text.',
  '七夕节':   'Vertical poster background for Qixi Festival: starry sky, magpie bridge, Milky Way, romantic Chinese style. No text.',
  '中元节':   'Vertical poster background for Ghost Festival: lotus lanterns, water reflection, night sky, serene peaceful atmosphere. No text.',
  '中秋节':   'Vertical poster background for Mid-Autumn Festival: full moon, mooncakes, osmanthus flowers, jade rabbit, traditional atmosphere. No text.',
  '重阳节':   'Vertical poster background for Double Ninth Festival: chrysanthemums, mountain peaks, autumn colors, traditional atmosphere. No text.',
  '国庆节':   'Vertical poster background for National Day: Tiananmen, red flags, fireworks, gold tones, solemn festive atmosphere. No text.',
  '冬至':     'Vertical poster background for Winter Solstice: dumplings, snow scene, warm indoor light, cozy winter atmosphere. No text.',
  '圣诞节':   'Vertical poster background for Christmas: Christmas tree, snowflakes, gifts, red-green tones, festive joyful atmosphere. No text.',
  // 节气
  '小寒':     'Vertical poster background for Xiaohan solar term: snow, winter plum blossoms, cold morning light, elegant Chinese ink style. No text.',
  '大寒':     'Vertical poster background for Dahan solar term: heavy snowfall, icicles, bare branches, deep winter atmosphere. No text.',
  '立春':     'Vertical poster background for Start of Spring: new buds, peach blossoms, spring breeze, vibrant green, lively spring. No text.',
  '雨水':     'Vertical poster background for Rain Water solar term: spring rain, water droplets, fresh green, light mist, clean spring mood. No text.',
  '惊蛰':     'Vertical poster background for Awakening of Insects: spring thunder, butterflies, blooming flowers, nature awakening. No text.',
  '春分':     'Vertical poster background for Spring Equinox: rapeseed flower fields, blue sky, spring breeze, bright spring scenery. No text.',
  '谷雨':     'Vertical poster background for Grain Rain: tea leaves, spring rain, green hills, fresh tea garden atmosphere. No text.',
  '立夏':     'Vertical poster background for Start of Summer: lotus leaves, cicadas, green shade, sunlight, early summer freshness. No text.',
  '小满':     'Vertical poster background for Grain Buds: wheat ears, golden fields, blue sky, pre-harvest atmosphere. No text.',
  '芒种':     'Vertical poster background for Grain in Ear: rice paddies, farming, golden wheat waves, summer harvest. No text.',
  '夏至':     'Vertical poster background for Summer Solstice: blazing sun, sunflowers, blue sky white clouds, midsummer sunshine. No text.',
  '小暑':     'Vertical poster background for Minor Heat: lotus flowers, cicadas, green shade, cool water surface, summer retreat. No text.',
  '大暑':     'Vertical poster background for Major Heat: scorching sun, watermelon, ice cubes, heat waves, peak summer. No text.',
  '立秋':     'Vertical poster background for Start of Autumn: falling leaves, golden forest, autumn breeze, early autumn mood. No text.',
  '处暑':     'Vertical poster background for End of Heat: clear autumn sky, blue sky, rice fields, refreshing autumn day. No text.',
  '白露':     'Vertical poster background for White Dew: morning dew, reeds, light mist, autumn grass, dewy morning. No text.',
  '秋分':     'Vertical poster background for Autumn Equinox: red leaves, harvest, golden fields, full moon, autumn harvest. No text.',
  '寒露':     'Vertical poster background for Cold Dew: chrysanthemums, red leaves, cold dew, autumn mountains, deep autumn. No text.',
  '霜降':     'Vertical poster background for Frost\'s Descent: frost flowers, maple leaves, morning frost, late autumn cold. No text.',
  '立冬':     'Vertical poster background for Start of Winter: first snow, bare branches, warm light, winter arriving. No text.',
  '小雪':     'Vertical poster background for Minor Snow: light snowfall, pine trees, snowflakes, winter, elegant snow scene. No text.',
  '大雪':     'Vertical poster background for Major Snow: heavy snowfall, snow plains, pine and cypress, vast snow landscape. No text.',
  // 促销
  '年货节':       'Vertical poster background for Chinese New Year shopping festival: red festive, gift boxes, new year goods, spring festival elements, lively shopping. No text.',
  '情人节促销':   'Vertical poster background for Valentine\'s Day sale: roses, gift boxes, pink tones, romantic shopping atmosphere. No text.',
  '38女王节':     'Vertical poster background for Women\'s Day sale: flowers, crown, purple-pink tones, feminine fashion atmosphere. No text.',
  '春季上新':     'Vertical poster background for Spring new arrivals: spring flowers, fresh green, clean fashion, spring launch atmosphere. No text.',
  '五一促销':     'Vertical poster background for May Day sale: red, fireworks, shopping bags, holiday promotion atmosphere. No text.',
  '618大促':      'Vertical poster background for 618 shopping festival: tech feel, blue tones, shopping, lightning bolt, e-commerce big sale. No text.',
  '暑期特惠':     'Vertical poster background for summer sale: summer day, ice cream, sunshine, energetic, summer promotion. No text.',
  '七夕促销':     'Vertical poster background for Qixi sale: starry sky, roses, gift boxes, romantic, Valentine shopping. No text.',
  '开学季':       'Vertical poster background for back-to-school season: books, stationery, backpack, campus, school shopping. No text.',
  '中秋礼盒':     'Vertical poster background for Mid-Autumn gift box: mooncake gift box, full moon, gold tones, Mid-Autumn gifting. No text.',
  '国庆大促':     'Vertical poster background for National Day sale: red flags, fireworks, festive flowers, National Day shopping. No text.',
  '双11狂欢':     'Vertical poster background for Double 11 shopping festival: shopping bags, fireworks, red, number 11, carnival shopping. No text.',
  '双12年终':     'Vertical poster background for Double 12 year-end sale: gift boxes, snowflakes, year-end, red tones, year-end shopping. No text.',
  '圣诞促销':     'Vertical poster background for Christmas sale: Christmas tree, gifts, snowflakes, red-green tones, Christmas shopping. No text.',
  '年终盘点':     'Vertical poster background for year-end review: calendar, summary, gold tones, year-end, annual review atmosphere. No text.',
  // 通用
  '新品上市':   'Vertical poster background for new product launch: tech feel, spotlights, stage, modern minimalist, product launch atmosphere. No text.',
  '品牌推广':   'Vertical poster background for brand promotion: clean elegant, gradient colors, geometric shapes, modern brand atmosphere. No text.',
  '门店活动':   'Vertical poster background for store event: lively mall, colorful flags, crowd, event atmosphere. No text.',
  '会员专享':   'Vertical poster background for VIP member exclusive: gold tones, VIP, premium feel, starlight, high-end member atmosphere. No text.',
  '限时秒杀':   'Vertical poster background for flash sale: countdown, lightning, red, urgency, promotion atmosphere. No text.',
  '满减优惠':   'Vertical poster background for discount offer: coupons, fireworks, red, festive, promotional activity atmosphere. No text.',
}

function safeFilename(topic: string) {
  return topic.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const topic = searchParams.get('topic') || ''

  if (!OPENROUTER_KEY) {
    return NextResponse.json({ url: null, error: 'Missing OPENROUTER_API_KEY' }, { status: 500 })
  }

  // Check if file already exists on disk
  const filename = `${safeFilename(topic)}.png`
  const filepath = path.join(GENERATED_DIR, filename)
  const publicUrl = `/generated/${filename}`

  try {
    await access(filepath)
    // File exists — return static URL immediately
    return NextResponse.json({ url: publicUrl })
  } catch {
    // File doesn't exist yet, generate it
  }

  const prompt = PROMPT_MAP[topic]
    ?? `Vertical poster background image for "${topic}", beautiful illustration style, festive atmosphere. No text.`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aipp.local',
        'X-Title': 'AIPP Template Community',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image'],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenRouter error:', res.status, err)
      return NextResponse.json({ url: null }, { status: 200 })
    }

    const data = await res.json()
    const images = data?.choices?.[0]?.message?.images
    const base64Url: string | null = images?.[0]?.image_url?.url ?? null

    if (!base64Url) {
      return NextResponse.json({ url: null }, { status: 200 })
    }

    // Save base64 to disk, return static URL
    const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, '')
    await writeFile(filepath, Buffer.from(base64Data, 'base64'))

    return NextResponse.json({ url: publicUrl })
  } catch (e) {
    console.error('Generate error:', e)
    return NextResponse.json({ url: null }, { status: 200 })
  }
}
