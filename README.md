# #สั่งฟ้องสว. — ตัวสร้างภาพโปรไฟล์

โปรดักชัน: <https://sw-frame.panjs.com>

เว็บสำหรับสร้างภาพโปรไฟล์ติดเฟรม **#สั่งฟ้องสว.** เพื่อร่วมแสดงจุดยืนให้ กกต.
ดำเนินการส่งฟ้อง สว. ในคดีโกงเลือก สว.

- อัปโหลดรูป → เลือกเฟรม → **ซูม/ขยับ** ให้พอดี → บันทึกเป็น PNG 1200×1200
- **ขยับชิ้นส่วนของเฟรมแยกกันได้** (รูปมือ กับโลโก้) ลากตรงชิ้นนั้นบนภาพได้เลย
  หรือใช้ปุ่มลูกศรหลังเลือกเป้าหมาย — ชิ้นส่วนขยับได้อย่างเดียว ไม่ย่อ/ขยาย
- **ไม่เก็บข้อมูลผู้ใช้ใด ๆ** ไม่มี analytics ไม่มีคุกกี้ ไม่มี backend
  รูปภาพถูกประมวลผลด้วย `<canvas>` ในเบราว์เซอร์ และไม่เคยถูกส่งออกจากเครื่อง
- ฟอนต์ Noto Sans Thai Looped และ Noto Sans Thai โฮสต์ไว้ในโปรเจกต์เอง
  (ไม่เรียก Google Fonts) เพื่อไม่ให้มีการติดต่อเซิร์ฟเวอร์ภายนอกเลยแม้แต่ครั้งเดียว

## โครงสร้าง

```
public/                     ← โฟลเดอร์ที่ deploy (static ล้วน ไม่มี build step)
├── index.html
├── _headers                ← security headers + cache policy ของ Cloudflare Pages
├── frames/
│   ├── logo-tall.png hand-lg.png     ← ชิ้นส่วนของ PF-03 / PF-04
│   ├── logo-wide.png hand-sm.png     ← ชิ้นส่วนของ PF-05 / PF-06
│   └── thumb-PF-0{3,4,5,6}.png       ← ภาพย่อในตัวเลือกเฟรม
└── assets/{css,js,fonts,img}
frame-images/               ← ไฟล์เฟรมต้นฉบับ (ยังไม่แยกชิ้นส่วน)
logo.png                    ← โลโก้ต้นฉบับ
tools/split-frames.py       ← สคริปต์แยกเฟรมเป็นชิ้นส่วน
```

### เพิ่มหรือแก้เฟรม

วางไฟล์ 1200×1200 พื้นหลังโปร่งใสไว้ใน `frame-images/` แล้วรัน

```bash
python3 tools/split-frames.py
```

สคริปต์จะแยก "มือ" (ลายเส้นขาวดำ) ออกจาก "โลโก้" (บล็อกสีแดง/น้ำเงิน) ด้วยการจำแนกสี
เขียนไฟล์ชิ้นส่วนกับภาพย่อลง `public/frames/` แล้วพิมพ์พิกัด x/y/w/h ของแต่ละชิ้นออกมา
เอาค่าเหล่านั้นไปอัปเดตตาราง `FRAMES` ใน `public/assets/js/app.js`
(ถ้ามี [oxipng](https://github.com/shssoichiro/oxipng) ให้รัน `oxipng -o 4 --strip safe public/frames/*.png`
ต่อท้ายเพื่อบีบไฟล์แบบไม่เสียคุณภาพ)

## รันบนเครื่อง

```bash
npm run dev      # เปิด http://localhost:4173
```

หรือใช้อะไรก็ได้ที่เสิร์ฟไฟล์สแตติกจากโฟลเดอร์ `public/`

## Deploy บน Cloudflare Pages

**แบบผูกกับ Git repository** (แนะนำ) — ตั้งค่าในหน้า Pages ดังนี้

| ช่อง | ค่า |
| --- | --- |
| Framework preset | None |
| Build command | *(เว้นว่าง)* |
| Build output directory | `public` |

**แบบสั่งจากเครื่อง**

```bash
npm run deploy
```

(`wrangler pages deploy public --project-name sang-fong-sw` — ครั้งแรกจะให้ล็อกอินและสร้างโปรเจกต์ให้)

ไฟล์ `public/_headers` ใส่ CSP แบบ `default-src 'self'` ไว้แล้ว ทั้งเว็บจึงโหลดได้เฉพาะ
ทรัพยากรของตัวเอง — ถ้าจะเพิ่มสคริปต์หรือฟอนต์จากภายนอกในอนาคต ต้องแก้ไฟล์นี้ด้วย

## เครดิต

- ภาพประกอบและเฟรม: ขอบคุณรูปภาพจาก [iLaw](https://www.ilaw.or.th/articles/58883)
- ฟอนต์: [Noto Sans Thai](https://fonts.google.com/noto/specimen/Noto+Sans+Thai) และ
  [Noto Sans Thai Looped](https://fonts.google.com/noto/specimen/Noto+Sans+Thai+Looped) — SIL Open Font License 1.1
- ไอคอน: [Lucide](https://lucide.dev) — ISC License (ฝังเป็น SVG sprite ใน `index.html` ไม่ได้โหลดจาก CDN)

### Custom domain

โดเมนจริงคือ `sw-frame.panjs.com` — ผูกได้ที่ Pages project → **Custom domains** → Set up a
custom domain (ถ้า `panjs.com` อยู่ใน Cloudflare อยู่แล้ว ระบบจะเพิ่มเรคคอร์ด CNAME ให้เอง)

`og:url`, `og:image` และ `<link rel="canonical">` ใน `public/index.html` ชี้ไปที่โดเมนนี้แบบ
URL เต็มแล้ว ถ้าย้ายโดเมนเมื่อไหร่ต้องแก้สามจุดนี้ด้วย
