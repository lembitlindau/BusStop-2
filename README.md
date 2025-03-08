# BusStop-2

Webi-rakendus, mis kuvab kahe bussipeatuse (Lehmja ja Tornimäe) järgmised kolm väljumist. Rakendus võimaldab lisada uusi peatusi ja väljumisaegu andmebaasi.

## Funktsionaalsus

- Kuvab iga peatuse järgmised kolm väljumisaega
- Võimaldab lisada uusi peatusi
- Võimaldab lisada uusi väljumisaegu
- Võimaldab kustutada väljumisaegu

## Tehniline kirjeldus

- **Backend**: Node.js, Express.js
- **Andmebaas**: SQLite3
- **Frontend**: HTML, CSS, JavaScript (Vanilla)

## Paigaldamine

1. Klooni või laadi alla projekt
2. Installi sõltuvused: `npm install`
3. Käivita rakendus: `npm start`
4. Ava veebibrauser aadressil: http://localhost:3000

## Kasutamine

### Peatuste ja väljumisaegade vaatamine
- Kliki peatuse nime peal, et näha järgmisi väljumisaegu

### Uue peatuse lisamine
- Täida haldamise sektsioonis väli "Peatuse nimi"
- Kliki "Lisa peatus"

### Uue väljumisaja lisamine
- Vali peatus rippmenüüst
- Sisesta väljumisaeg formaadis HH:MM
- Kliki "Lisa väljumisaeg"

### Väljumisaegade haldamine
- Vali peatus rippmenüüst
- Kuvatakse kõik väljumisajad
- Kliki "Kustuta" nuppu, et eemaldada väljumisaeg