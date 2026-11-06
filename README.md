# Parking · Pagos

App per registrare i pagamenti mensili dell'affitto del parcheggio. Interfaccia in spagnolo, dati su Google Sheets (via Apps Script), pagina ospitata su GitHub Pages.

## 1. Backend (Google Sheets + Apps Script) — 5 minuti

1. Vai su [script.google.com](https://script.google.com) → **Nuovo progetto** (oppure, da un Google Sheet, **Estensioni → Apps Script**: funzionano entrambi i modi).
2. Cancella il contenuto e incolla tutto `Code.gs`. Salva.
3. Dal menu delle funzioni scegli **`inicializar`** e premi **Esegui**. Autorizza i permessi richiesti. Se lo script non è legato a un foglio, ne crea uno nuovo chiamato «Parking · Pagos» nel tuo Drive (l'indirizzo compare nel log di esecuzione). Vengono create le schede `Pagos` e `Historial` con i 20 mesi importati.
4. **Distribuisci → Nuova distribuzione → Tipo: App web**
   - Esegui come: **Io**
   - Chi ha accesso: **Chiunque**
5. Copia l'URL che termina in `/exec`.

> Se modifichi `Code.gs` in futuro, serve **Distribuisci → Gestisci distribuzioni → Modifica → Nuova versione**, altrimenti l'URL continua a usare il codice vecchio.

## 2. Frontend (GitHub Pages)

1. Apri `index.html` e sostituisci `PEGA_AQUI_LA_URL_DE_APPS_SCRIPT` con l'URL copiato.
2. Crea un repository su GitHub e carica **tutti i file tranne `Code.gs` e il README**: `index.html`, `manifest.json`, `sw.js` e le quattro immagini `.png`.
3. **Settings → Pages → Source: Deploy from a branch → `main` / root**.
4. Dopo un minuto l'app è su `https://TUO-UTENTE.github.io/NOME-REPO/`. Aprila da qualsiasi dispositivo (su telefono: «Aggiungi alla schermata Home»).

## Installarla come app

Apri il link di GitHub Pages dal dispositivo:
- **Android / Chrome / PC**: compare il pulsante «Instalar la app» in fondo alla pagina (oppure il menu del browser → *Installa app*).
- **iPhone / iPad (Safari)**: **Condividi → Aggiungi alla schermata Home**.

L'icona è un cartello di parcheggio (P gialla su asfalto) e l'app si apre a schermo intero, anche senza connessione (mostrando l'ultima copia dei dati).

## Come funziona

- **Password**: di default `5113`. Viene verificata lato server; per cambiarla usa «Cambiar contraseña» in fondo alla pagina. Serve per aggiungere, modificare ed eliminare.
- **Sincronizzazione**: ogni dispositivo si aggiorna ogni 20 secondi, quando torni sull'app e dopo ogni salvataggio.
- **Storico**: niente viene cancellato davvero. «Eliminar» segna la riga come `anulado` nella scheda `Pagos`, e ogni inserimento/modifica/annullamento è registrato nella scheda `Historial` con il valore prima e dopo.
- **Note**: ogni pagamento ha un campo nota opzionale.
