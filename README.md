# Trengginas WQMS

A Water Quality Monitoring System (WQMS) dashboard for PT Abinaya Trengginas
Manufaktur. Displays real-time and historical sensor data (pH, COD, TSS,
ammonia, flow rate, etc.) from multiple monitoring stations, with reports,
statistics/comparison, and a serial number/license management system for
activating a companion device/desktop app. Also works as an installable PWA
(Progressive Web App).

## Features

**User (logged in)**
- Login and role-based dashboard (superuser / admin / operator, with
  station-scoped access per user).
- Station map & list, with per-parameter cards colored by safe/warning/danger
  thresholds.
- Real-time chart and sensor data history table (2-minute/hourly/daily
  averages), with date range filtering.
- Data report (Laporan) with Excel export, and statistics/comparison between
  stations (Statistik).
- Editable profile (name, password).

**Admin (superuser)**
- Manage Stations (auto-generate Trengginas ID, choose displayed parameters).
- Manage Users (add/edit/delete, role and station access assignment).
- Manage Serial Numbers (generate, activate/deactivate, switch device,
  delete) for the companion app's licensing.
- Configure per-station displayed parameters and safe/warning/danger
  thresholds.

## Tech Stack

- **Backend:** PHP + MySQL (mysqli, prepared statements)
- **Frontend:** Vanilla JavaScript, Bootstrap 5, Chart.js, Leaflet, SweetAlert2, SheetJS
- **Database:** MySQL/MariaDB
- **PWA:** `manifest.json` + `sw.js` (service worker for offline/caching)

## Project Structure

```
├── api/                 # Backend endpoints (user) + api/admin (admin-only endpoints)
├── assets/              # Images/logo
├── css/, js/            # Frontend per page
├── manifest.json, sw.js # PWA config & service worker
├── schema.sql           # Empty database schema (structure only, no data)
├── *.html               # Pages (index, dashboard, laporan, statistik, serial_numbers)
```

## Local Setup (Development)

1. Set up MySQL/MariaDB, create a new database, then import `schema.sql`
   through phpMyAdmin (or `mysql -u root -p your_database_name < schema.sql`).
   This creates all tables (`users`, `stations`, `sensor_data_*_avg`,
   `station_thresholds`, `serial_numbers`) empty, without any data.
2. Copy `api/config.example.php` to `api/config.php`, then fill in your
   local database credentials:
   ```php
   $db_host = "localhost";
   $db_user = "root";
   $db_pass = "";
   $db_name = "your_database_name";
   ```
3. Copy `.htaccess.example` to `.htaccess` if your local server uses Apache
   with clean URLs (mod_rewrite).
4. Run it with PHP's built-in server from the project root:
   ```
   php -S 127.0.0.1:8000
   ```
5. Open `http://127.0.0.1:8000/index.html` in your browser.

## Production Deployment

This project is designed for shared hosting (cPanel) with no build step
required. Just upload the entire project folder to `public_html` (or its
subdomain), create a MySQL database through cPanel, import `schema.sql`,
then fill in `api/config.php` with the production database credentials.
Also copy `.htaccess.example` to `.htaccess` in the web root.

**Never commit an `api/config.php` containing real credentials, or a
database dump containing real data.** Both are excluded via `.gitignore`;
use `api/config.example.php` and `schema.sql` as references for their
structure.

## License

See [LICENSE](LICENSE).
