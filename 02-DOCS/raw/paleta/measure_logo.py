from PIL import Image
from collections import Counter

p = r"C:\xampp\htdocs\www\Cuotas_Club\02-DOCS\attachments\brand\logo-osorno-runners.webp"
im = Image.open(p).convert("RGBA")
print("size:", im.size, "mode:", im.mode)

px = list(im.getdata())
opaque = [(r, g, b) for (r, g, b, a) in px if a > 200]
print("opaque px:", len(opaque), "of", len(px))

# Quantize to reduce noise from antialiasing
q = im.convert("RGB").quantize(colors=8, method=Image.Quantize.MEDIANCUT)
pal = q.getpalette()
counts = Counter(q.getdata())
print("\n--- dominant colors (median cut) ---")
total = sum(counts.values())
for idx, n in counts.most_common(8):
    r, g, b = pal[idx * 3: idx * 3 + 3]
    print(f"#{r:02X}{g:02X}{b:02X}  rgb({r},{g},{b})  {n*100/total:5.2f}%")

# Sample the most saturated red pixels specifically
reds = [(r, g, b) for (r, g, b, a) in px if a > 200 and r > 120 and r - g > 60 and r - b > 60]
if reds:
    rc = Counter(reds)
    print("\n--- red family (top 5) ---")
    for (r, g, b), n in rc.most_common(5):
        print(f"#{r:02X}{g:02X}{b:02X}  rgb({r},{g},{b})  n={n}")
    ar = sum(c[0] for c in reds) / len(reds)
    ag = sum(c[1] for c in reds) / len(reds)
    ab = sum(c[2] for c in reds) / len(reds)
    print(f"red average: #{round(ar):02X}{round(ag):02X}{round(ab):02X}  n={len(reds)}")

# Near-black and near-white
blacks = [(r, g, b) for (r, g, b, a) in px if a > 200 and max(r, g, b) < 30]
whites = [(r, g, b) for (r, g, b, a) in px if a > 200 and min(r, g, b) > 240]
print("\nblack px:", len(blacks), "white px:", len(whites))
if blacks:
    bc = Counter(blacks).most_common(1)[0]
    print("black mode: #%02X%02X%02X" % bc[0], "n=", bc[1])

# Does the image have transparency / dark background?
alphas = Counter(a for (_, _, _, a) in px)
print("\ntop alpha values:", alphas.most_common(3))
