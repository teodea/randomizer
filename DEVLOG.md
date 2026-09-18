# DEVLOG — Randomizer

## 2026-09-18 — kickoff

- ritrovati i resti del 2022: app **Randomizer** nella dashboard Spotify (development mode, stessa idea di oggi) e repo `spotify-randomizer` con solo un README
- verificate le policy Spotify for Developers → `docs/spotify-policies.md`. punti chiave: da febbraio 2026 max 5 utenti e Premium per l'owner, extended quota solo per aziende con 250k utenti mensili, i Client ID nuovi leggono solo le playlist possedute. per questo teniamo il Client ID del 2022 invece di crearne uno nuovo
- grilling completo sul prodotto. mescolamento in tre passaggi: quali brani entrano (pool, doppioni per ISRC, filtri, lunghezza), da quale playlist pescare (casuale / bilanciato / pesi manuali; una playlist esaurita esce dal mix e le altre mantengono le proporzioni fra loro), in che ordine (casuale / alternanza / blocchi + artisti distanziati). in più rimescola-il-resto
- output: una sola playlist privata temporanea, sovrascritta a ogni mix e rimossa con un pulsante o al logout
- stack: Vite + React + TS solo browser, PKCE, GitHub Pages. tutto gratis. app solo in inglese, con una demo senza login per il portfolio
- repo rinominato `randomizer` e reso pubblico. un solo repo per codice e documenti di metodo: niente workspace separato
- skill: solo i plugin Pocock + impeccable
