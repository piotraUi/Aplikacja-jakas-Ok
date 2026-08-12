# Dino Bieg — tryb społecznościowy

Bieganie dinozaurem online z innymi graczami. Dogoń kogoś od tyłu, żeby przybić piątkę i zdobyć bonus punktów.

## Uruchomienie

1. Zainstaluj zależności i odpal serwer multiplayer:

   ```
   npm install
   node server.js
   ```

   Serwer domyślnie działa na porcie `8080` (zmienna środowiskowa `PORT`, jeśli chcesz inny).

2. Otwórz `index.html` w przeglądarce (np. przez prosty serwer statyczny: `python3 -m http.server 8000`).

3. Na ekranie wyboru dinozaura wpisz nick, sprawdź adres serwera (domyślnie `ws://<ten-host>:8080`) i kliknij **Start!**. Kilka osób z tej samej sieci może wejść pod ten sam adres serwera i grać razem.

Bez uruchomionego serwera gra działa dalej solo (tylko bez innych graczy i przybijania piątki).
