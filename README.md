# SPECIFIKACIJA PROJEKTA: vinoMonitor
## OPIS SISTEMA
**VinoMonitor** je mikroservisna platforma za upravljanje vinarijom koja prati proces proizvodnje vina od vinograda do flaše. Sistem omogućava vinarima da digitalizuju svoje poslovanje, prate kvalitet i optimizuju proizvodnju.

## Korisnici sistema

- Vinar (winemaker) - pun pristup

- Radnik (worker) - ograničen pristup

- Admin - sistem administrator

- User profile management

- Baza: PostgreSQL


## Arhitektura sistema

Platforma je izgrađena kao skup mikroservisa (Rust), gde svaki servis ima jasno definisanu odgovornost i koristi posebnu bazu podataka radi lakše skalabilnosti i sigurnosti.

### 1. Auth Service

**Odgovornost**: Autentifikacija i upravljanje korisnicima

- Registracija i login
- Generisanje i validacija JWT tokena
- Role-based access control (RBAC)
    - **Vinar (winemaker):** pun pristup sistemu
    - **Radnik (worker):** ograničen pristup
    - **Admin:** sistem administrator
- Upravljanje korisničkim profilima
- **Baza**: PostgreSQL

---

### 2. Vineyard Service

**Odgovornost**: Upravljanje vinogradima i parcelama

- Kreiranje i ažuriranje vinograda
- Upravljanje geo-lokacijama parcela (latitude/longitude)
- Praćenje sorti grožđa po parcelama
- Evidencija istorije zasadivanja i berbi
- **Baza**: PostgreSQL sa PostGIS ekstenzijom

---

### 3. Harvest Service

**Odgovornost**: Evidencija berbi i kvaliteta grožđa

- Evidencija svih berbi po parcelama
- Unos i praćenje parametara kvaliteta grožđa (°Brix, pH, težina)
- Praćenje vremenskih uslova tokom berbe
- Povezivanje berbe sa fermentacionim batch-ovima
- **Baza**: PostgreSQL

---

### 4. Fermentation Service

**Odgovornost**: Praćenje fermentacionog procesa

- Upravljanje fermentacionim tankovima
- Praćenje procesa fermentacije u realnom vremenu
- Evidencija hemijskih parametara
- Integracija sa IoT temperaturnim senzorima (npr. DHT11)
- **Baza**: PostgreSQL

---

### 5. Inventory Service
**Odgovornost**: Upravljanje skladištem i flašama

- Evidencija flaširanja

- Skladišno poslovanje (ulaz/izaz flaša)

- Praćenje lokacija u podrumu

- Generisanje QR kodova za šarže

- **Baza**: MongoDB

DODATNI SERVISI
### 6. ANALYTICS SERVICE (Rust)
**Odgovornost**: Analitika i izveštaji

- Generisanje grafikona (temperature, prinosi, kvalitet)

- PDF izveštaji o berbama i fermentacijama

- Dashboard sa KPI metrikama

- Poređenje rezultata kroz godine

- **Baza**: PostgreSQL (agregirani podaci)

### 7. IOT BRIDGE SERVICE (Python)
**Dodatni servis**: IoT integracija za temperaturu

- MQTT komunikacija sa ESP32 senzorima

- Čuvanje temperature u InfluxDB

- Real-time monitoring fermentacije

- WebSocket za live updates

- REST API za historijske podatke

## FUNKCIONALNOSTI
### MAPE I LOKACIJE
- Interaktivna mapa vinograda sa parcelama

- Prikaz lokacije svake parcele

- Izračunavanje površine iz koordinata

- Geo-fencing obaveštenja

- Export u KML format za GPS uređaje

## ANALITIKA I GRAFIKONI
### Grafikoni temperature fermentacije u real-time

- Istorijski trendovi prinosa po sortama

- Poređenje kvaliteta grožđa kroz godine

- Dashboard sa glavnim metrikama

- PDF izveštaji sa graficima

### KOMBINACIJA BAZA PODATAKA
- PostgreSQL za relacione podatke (korisnici, vinogradi)

- PostgreSQL + PostGIS za prostorne podatke (parcele)

- MongoDB za fleksibilne inventarne podatke

- InfluxDB za time-series podatke (temperatura)

---

## Primena IoT senzora

Sistem podržava povezivanje sa hardverskim IoT senzorima, na primer za praćenje temperature i vlažnosti tokom fermentacije. IoT funkcionalnost se razvija u Python okruženju i lako se integriše sa Rust mikroservisima putem REST API-ja ili MQTT-a.

---

## Pokretanje sistema

1. **Rust mikroservisi:** Pratite README svakog servisa za pokretanje (`cargo run`).
2. **IoT skripte:** Potrebno je podesiti RPi uređaj, Python zavisnosti i kreirati `settings.json` fajl.
3. **Baze podataka:** Potrebno je instalirati PostgreSQL i eventualno PostGIS ekstenziju.
