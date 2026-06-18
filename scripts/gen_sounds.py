#!/usr/bin/env python3
"""Gera os efeitos sonoros do jogo como arquivos .wav (síntese própria, sem
licença de terceiros). Rode:  python scripts/gen_sounds.py"""
import wave, struct, math, random, os

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sounds")
os.makedirs(OUT, exist_ok=True)

def write_wav(name, samples):
    path = os.path.join(OUT, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        data = bytearray()
        for s in samples:
            v = int(max(-1.0, min(1.0, s)) * 32767)
            data += struct.pack("<h", v)
        w.writeframes(bytes(data))
    print("ok:", name, len(samples), "amostras")

# --- Pincel: ruído filtrado com leve ondulação (cerdas), em loop contínuo ---
def gen_brush():
    n = int(0.7 * SR); out = []; lp = 0.0
    for i in range(n):
        white = random.uniform(-1, 1)
        lp = lp + 0.18 * (white - lp)            # passa-baixa (abafa o chiado)
        lfo = 0.55 + 0.45 * abs(math.sin(2 * math.pi * 7 * i / SR))  # textura de cerda
        out.append(lp * lfo * 0.5)
    return out

# --- Tom com decaimento tipo sino ---
def tone(freq, dur, decay=5.0, harm=0.3):
    n = int(dur * SR); out = []
    for i in range(n):
        t = i / SR; env = math.exp(-decay * t)
        s = math.sin(2 * math.pi * freq * t) + harm * math.sin(2 * math.pi * 2 * freq * t)
        out.append(0.5 * env * s)
    return out

# --- Vitória: arpejo ascendente + brilho ---
def gen_win():
    out = []
    for f in [523.25, 659.25, 783.99, 1046.50]:   # C5 E5 G5 C6
        out += tone(f, 0.16, decay=5)
    out += tone(1318.5, 0.45, decay=4)             # sparkle final
    return out

# --- Derrota: duas notas descendentes meio "trombone triste" ---
def gen_lose():
    out = []
    for f in [440.0, 349.23]:                      # A4 -> F4
        n = int(0.42 * SR)
        for i in range(n):
            t = i / SR; env = math.exp(-2.2 * t)
            vib = 1 + 0.02 * math.sin(2 * math.pi * 5 * t)
            s = sum(math.sin(2 * math.pi * f * vib * k * t) / k for k in range(1, 6))
            out.append(0.22 * env * s)
    return out

# --- Clique do botão ---
def gen_click():
    n = int(0.05 * SR); out = []
    for i in range(n):
        t = i / SR; env = math.exp(-42 * t)
        out.append(0.5 * env * math.sin(2 * math.pi * 700 * t))
    return out

# --- Tique (últimos 5s) ---
def gen_tick():
    n = int(0.03 * SR); out = []
    for i in range(n):
        t = i / SR; env = math.exp(-80 * t)
        out.append(0.4 * env * (math.sin(2 * math.pi * 1200 * t) + random.uniform(-0.2, 0.2)))
    return out

if __name__ == "__main__":
    write_wav("brush.wav", gen_brush())
    write_wav("win.wav",   gen_win())
    write_wav("lose.wav",  gen_lose())
    write_wav("click.wav", gen_click())
    write_wav("tick.wav",  gen_tick())
    print("Sons gerados em assets/sounds/")
