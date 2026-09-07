#!/usr/bin/env python3
"""แยกไฟล์เฟรมต้นฉบับใน frame-images/ ออกเป็นชิ้นส่วน (มือ / โลโก้) สำหรับ public/frames/

เว็บวาดเฟรมทีละชิ้นบน <canvas> เพื่อให้ผู้ใช้ลากจัดตำแหน่งมือกับโลโก้แยกกันได้
สคริปต์นี้แยกชิ้นส่วนด้วยสี: พิกเซลที่มีสี (แดง/น้ำเงิน) คือโลโก้ ส่วนลายเส้นขาวดำคือมือ
แล้วขยายมาสก์ของโลโก้ออก 24px เพื่อให้ครอบเงาและตัวอักษรสีขาวที่อยู่ในบล็อกสีด้วย

รันใหม่เมื่อมีเฟรมใหม่:  python3 tools/split-frames.py
จากนั้นเอาค่าพิกัดที่พิมพ์ออกมาไปอัปเดต FRAMES ใน public/assets/js/app.js
"""
from PIL import Image, ImageFilter
import numpy as np
import pathlib

SRC = pathlib.Path('frame-images')
OUT = pathlib.Path('public/frames')
DILATE_STEPS = 12          # MaxFilter(5) 12 รอบ ≈ ขยาย 24px
THUMB = 320

# ชื่อไฟล์ของแต่ละชิ้นส่วน — None แปลว่าอาร์ตชิ้นนั้นเหมือนเฟรมก่อนหน้า เลยใช้ไฟล์ร่วมกัน
# (เฟรมที่ใช้ร่วมยังต้องประกาศพิกัดของตัวเองใน app.js ตามที่สคริปต์พิมพ์ออกมา)
NAMES = {
    ('PF-03', 'logo'): 'logo-tall.png',
    ('PF-03', 'hand'): 'hand-lg.png',
    ('PF-04', 'logo'): None,
    ('PF-05', 'logo'): 'logo-wide.png',
    ('PF-05', 'hand'): 'hand-sm.png',
    ('PF-06', 'logo'): None,
}


def split_masks(im):
    a = np.array(im)
    alpha = a[..., 3].astype(int)
    rgb = a[..., :3].astype(int)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    opaque = alpha > 16
    colored = (opaque & (sat > 40)).astype(np.uint8) * 255

    grown = Image.fromarray(colored, 'L')
    for _ in range(DILATE_STEPS):
        grown = grown.filter(ImageFilter.MaxFilter(5))
    grown = np.array(grown) > 127

    return opaque & grown, opaque & ~grown


def cut(im, mask):
    a = np.array(im).copy()
    a[..., 3] = np.where(mask, a[..., 3], 0)
    img = Image.fromarray(a, 'RGBA')
    box = img.getbbox()
    return (img.crop(box), box) if box else (None, None)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sorted(SRC.glob('PF-*.png')):
        fid = path.stem
        im = Image.open(path).convert('RGBA')
        logo_mask, hand_mask = split_masks(im)

        rows = []
        logo, lbox = cut(im, logo_mask)
        if logo:
            rows.append(('logo', logo, lbox))
        if hand_mask.sum() > 500:
            hand, hbox = cut(im, hand_mask)
            rows.append(('hand', hand, hbox))

        thumb = Image.new('RGBA', (THUMB, THUMB), (255, 255, 255, 255))
        thumb.alpha_composite(im.resize((THUMB, THUMB), Image.LANCZOS))
        thumb.convert('RGB').quantize(colors=64, method=Image.FASTOCTREE).save(
            OUT / f'thumb-{fid}.png', optimize=True)

        print(f'{fid}:')
        for key, img, box in rows:
            name = NAMES.get((fid, key), f'{fid}-{key}.png')
            if name:
                img.save(OUT / name, optimize=True)
            print(f'    {key:5s} x={box[0]:4d} y={box[1]:4d} w={img.width:4d} h={img.height:4d}'
                  f'  → {name or "ใช้ไฟล์ร่วมกับเฟรมก่อนหน้า"}')


if __name__ == '__main__':
    main()
