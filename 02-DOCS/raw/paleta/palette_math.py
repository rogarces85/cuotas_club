import math

def srgb_to_linear(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def rel_lum(rgb):
    r, g, b = (srgb_to_linear(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_oklch(rgb):
    r, g, b = (srgb_to_linear(v) for v in rgb)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(v) ** (1/3), v) for v in (l, m, s))
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    C = math.hypot(a, bb)
    H = math.degrees(math.atan2(bb, a)) % 360
    return L, C, H

def fmt_oklch(rgb):
    L, C, H = rgb_to_oklch(rgb)
    return f"oklch({L*100:.1f}% {C:.4f} {H:.1f})"

brand_red = "#DF022F"
white = "#FFFFFF"
black = "#000000"

print("=== MEDIDO EN EL LOGO ===")
for name, hx in [("rojo", brand_red), ("negro", black), ("blanco", white)]:
    rgb = hex_to_rgb(hx)
    print(f"{name:7} {hx}  {fmt_oklch(rgb)}")

print("\n=== CONTRASTE ===")
print(f"blanco sobre rojo  : {contrast(hex_to_rgb(white), hex_to_rgb(brand_red)):.2f}:1")
print(f"negro  sobre rojo  : {contrast(hex_to_rgb(black), hex_to_rgb(brand_red)):.2f}:1")
print(f"rojo   sobre blanco: {contrast(hex_to_rgb(brand_red), hex_to_rgb(white)):.2f}:1")

# Derive shades for hover/active by scaling lightness in sRGB space
def shade(hx, factor):
    r, g, b = hex_to_rgb(hx)
    return "#%02X%02X%02X" % tuple(max(0, min(255, round(v * factor))) for v in (r, g, b))

print("\n=== ESCALA DERIVADA DEL ROJO ===")
for name, f in [("950", 0.35), ("900", 0.45), ("800", 0.55), ("700", 0.70), ("600", 0.85), ("500 (marca)", 1.0), ("400", 1.25), ("300", 1.55), ("200", 1.95), ("100", 2.4), ("50", 2.85)]:
    hx = shade(brand_red, f)
    print(f"red-{name:12} {hx}  {fmt_oklch(hex_to_rgb(hx))}")

print("\n=== FONDOS NEUTROS (tinte frio hacia el rojo) ===")
for name, hx in [("blanco puro", "#FFFFFF"), ("superficie", "#FAFAFA"), ("borde", "#E7E7E7"), ("texto suave", "#6B6B6B"), ("texto", "#1A1A1A"), ("negro", "#000000"), ("negro-900", "#0E0E0E"), ("negro-800", "#1A1A1A"), ("negro-700", "#262626")]:
    print(f"{name:14} {hx}  {fmt_oklch(hex_to_rgb(hx))}")
