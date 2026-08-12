# Dino Bieg — tryb społecznościowy

Bieganie dinozaurem online z innymi graczami. Dogoń kogoś od tyłu, żeby przybić piątkę i zdobyć bonus punktów.

Jeden proces Node.js (`server.js`) serwuje zarówno stronę gry, jak i WebSocket multiplayer — do wdrożenia potrzeba tylko jednej usługi.

## Uruchomienie lokalne

```
npm install
node server.js
```

Otwórz `http://localhost:8080` (albo inny port ustawiony w zmiennej `PORT`). Kilka osób w tej samej sieci może wejść pod ten sam adres i grać razem.

## Wdrożenie na hosting (żeby działało dla wszystkich w internecie)

Repo ma już gotowe pliki do wdrożenia jednym kliknięciem:

- **Render** — plik `render.yaml` (Blueprint). Wystarczy połączyć repo z kontem Render i wdrożyć jako Web Service (`node server.js`, darmowy plan).
- **Railway / Heroku-style hosting** — plik `Procfile` (`web: node server.js`).

Po wdrożeniu strona i serwer WebSocket działają pod tym samym publicznym adresem (np. `https://twoja-gra.onrender.com`) — gra sama się do niego podłączy, nic nie trzeba ręcznie konfigurować.

Bez uruchomionego serwera gra działa dalej solo (tylko bez innych graczy i przybijania piątki).
