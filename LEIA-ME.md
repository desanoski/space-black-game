# SPACE BLACK — Desafio do Pneu

Joguinho de stand: a pessoa passa o dedo no pneu opaco "aplicando o SPACE BLACK"
e revela o pneu com brilho. Cobrindo 85% em até 20s → tela de **VOCÊ GANHOU**
com confete, e o atendente entrega o brinde.

## Arquivos
- `index.html` / `style.css` / `game.js` — o jogo
- `sw.js` + `manifest.json` — fazem rodar **offline** e em tela cheia
- `assets/` — as imagens (pneu com/sem pretinho, produto, logo, fundo)

## Testar no PC
Não dá pra abrir só com 2 cliques (o navegador bloqueia o service worker em `file://`).
Use um servidor local simples:

```
cd "C:\Users\lucas\Desktop\space-black-game"
python -m http.server 8000
```
Abra `http://localhost:8000` no Chrome. (Mouse funciona como dedo.)

## Ajustar dificuldade
No topo do `game.js`, em `CONFIG`:
- `TIME_LIMIT`   → segundos (padrão 20)
- `WIN_THRESHOLD`→ 0.85 = 85% do pneu (diminua p/ mais fácil)
- `BRUSH_RADIUS` → tamanho do "dedo" (aumente p/ cobrir mais rápido)
- `WIN_DISPLAY`  → tempo da tela de vitória antes de voltar sozinho
- `IDLE_RESET`   → segundos sem toque até voltar pra tela inicial

## Instalar no painel Android (modo quiosque)
1. Copie a pasta `space-black-game` inteira para o painel.
2. Na Play Store, instale **Fully Kiosk Browser** (grátis no básico).
3. Em Fully Kiosk → Settings → **Start URL**, aponte para o `index.html`
   (ex.: `file:///sdcard/space-black-game/index.html`).
   *Obs.: para o modo offline (service worker) funcionar 100%, o ideal é servir
   por http. O Fully Kiosk tem opção de servir arquivos locais; alternativamente
   um mini-servidor no painel. Se preferir, eu te ajudo a configurar isso.*
4. Ative: tela cheia, travar saída, religar ao ligar, e "reload em inatividade".

O jogo já volta sozinho para a tela inicial após a vitória e após inatividade,
então fica pronto para o próximo visitante sem ninguém precisar mexer.
