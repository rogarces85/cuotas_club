import math

def oklch_to_srgb(L, C, H):
    a = C * math.cos(math.radians(H))
    b = C * math.sin(math.radians(H))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    def enc(v):
        v = max(0.0, min(1.0, v))
        return 12.92 * v if v <= 0.0031308 else 1.055 * (v ** (1 / 2.4)) - 0.055

    return tuple(round(enc(v) * 255) for v in (r, g, bb))

HUE = 22.8  # tono medido del rojo del club

scale = {
    "50":  (0.965, 0.014),
    "100": (0.930, 0.032),
    "200": (0.885, 0.058),
    "300": (0.800, 0.105),
    "400": (0.680, 0.180),
    "500": (0.571, 0.2296),  # marca: #DF022F
    "600": (0.505, 0.204),
    "700": (0.435, 0.176),
    "800": (0.365, 0.148),
    "900": (0.315, 0.127),
    "950": (0.255, 0.100),
}

print("=== ESCALA ROJA EN OKLCH (tono 22.8) ===")
out = {}
for k, (L, C) in scale.items():
    r, g, b = oklch_to_srgb(L, C, HUE)
    hx = f"#{r:02X}{g:02X}{b:02X}"
    out[k] = hx
    print(f"red-{k:<4} {hx}   oklch({L*100:.1f}% {C:.4f} {HUE})")

def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(hx):
    hx = hx.lstrip("#")
    r, g, b = (int(hx[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def contrast(h1, h2):
    a, b = lum(h1), lum(h2)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)

print("\n=== CONTRASTE SOBRE BLANCO / NEGRO ===")
for k in ["500", "600", "700", "400", "300"]:
    print(f"red-{k} {out[k]}  vs blanco {contrast(out[k], '#FFFFFF'):5.2f}:1   vs negro {contrast(out[k], '#000000'):5.2f}:1")

print("\n=== TEXTO BLANCO SOBRE CADA ROJO ===")
for k in ["500", "600", "700", "800", "900"]:
    print(f"blanco sobre red-{k} {out[k]}: {contrast('#FFFFFF', out[k]):5.2f}:1")

print("\n=== TOKENS SHADCN (light) ===")
print(f"--primary: oklch(57.1% 0.2296 22.8)  -> {out['500']}")
print("--primary-foreground: oklch(100% 0 0) -> #FFFFFF (5.02:1 AA)")
print("--ring: mismo rojo al 40% de alfa")
print("\n=== TOKENS SHADCN (dark) ===")
print(f"--primary en oscuro: red-400 {out['400']} (mejor contraste sobre negro: {contrast(out['400'], '#000000'):.2f}:1)")
