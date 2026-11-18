# Barimnia

Prototipo dell'app per imparare il basso elettrico (gemella di Musagete). L'app è un'unica pagina HTML: `docs/index.html`, con le basi in `docs/basi/`.

## Struttura

| Cartella | Cosa contiene |
|---|---|
| `src/` | `template.html` (interfaccia, stili, logica), `notation.js` (pallini, tab, pentagramma), `audio.js` (metronomo, basi, esempio) |
| `content/` | I capitoli: un file per gruppo (T, moduli, A, L) |
| `assets/` | Pose di Polly, logo, icone della barra in basso |
| `docs/` | L'app pronta: `index.html` (generato) e `basi/` (MP3 da iReal Pro) |
| `tools/` | Script: costruzione, controllo dei capitoli, elenco e controllo delle basi |

## Requisiti

- Python 3
- Node.js (per l'elenco delle basi e il controllo dei capitoli)
- Solo per controllare le basi WAV: `pip install numpy scipy`
- Solo per convertire le basi: `ffmpeg`

## Comandi

```bash
python3 tools/build.py          # ricostruisce docs/index.html
node tools/validate.js          # controlla battute, gradi, quiz di tutti i capitoli
python3 tools/check_base.py ~/Desktop/L1-M1_100.wav   # controlla una base esportata da iReal
ffmpeg -i L1-M1_100.wav -b:a 112k docs/basi/L1-M1_100.mp3   # converte una base
```

Per provare l'app sul computer: `python3 -m http.server -d docs 8000` e apri http://localhost:8000.

## Notazione degli esercizi

`corda+tasto+durata[.][segni][:grado]`, battute separate da `|`, sigla tra `[ ]`, tempo tra `{ }`.
Durate `w h q e s t u` (semibreve … sedicesimo, terzine), segni `x g H P S ~ ^ T U O Q * A M`.
Esempio: `[Am] E5q:1 re E5e:1 A7q:5 rq`.

Basi musicali realizzate con iReal Pro.
