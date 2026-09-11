# Robustthreed · Business Ledger

A private daily ledger for Robustthreed's Amazon, Flipkart, Meesho, and direct sales. Log marketplace payouts and business expenses, track pending amounts, and see cash profit in INR.

**[Open the live Robustthreed ledger](https://vedamrit01.github.io/ROBUSTTHREED_LEDGER/)**

**Frontend:** React + Vite, ready for GitHub Pages. **Backend:** Node.js + Express. **Database:** MySQL, with a new database named `robustthreed_ledger` by default.

**Want to use cloud MySQL without running your computer?** Follow [CLOUD_SETUP.md](CLOUD_SETUP.md) for Aiven's free MySQL, a prepared Render API deployment, and GitHub Pages. This route lets you enter database details and choose your owner password through dashboards; no local MySQL installation is needed.

[Open the existing Render API service](https://dashboard.render.com/web/srv-dahpu83m8hqs73ctcvig). The Free API is live and connected to MySQL; its [health check](https://robustthreed-ledger-api.onrender.com/api/health) is passing. Your generated owner login password is stored in **Render → Environment → `LEDGER_PASSWORD`**. See [the setup and recovery guide](CLOUD_SETUP.md).

The website is published on GitHub Pages and connected to the API. The free Aiven MySQL service `robustthreed-ledger` is running, and its database `robustthreed_ledger` stores your ledger entries. All three parts are configured.

The database setup command must run on a computer that can reach your MySQL server. `localhost` means the computer running the API. The MySQL credentials from your screenshot belong in your own server's `.env`; this repository contains placeholders.

## What the app does

- Payments, expenses, received/paid status, pending amounts, and overdue indicators.
- Amazon, Flipkart, Meesho, Direct, and general business expense categories.
- Overview charts, search, date filters, a transaction ledger, and a cash P&L report.
- Add, edit, delete, and mark an entry received or paid. Each successful save is written to MySQL.
- INR amounts stored as integer paise; dates use India time (IST).
- CSV export of the current view and a separate, illustrative sample ledger.
- Owner password login, expiring sessions, retry-safe creation, and protection against overwriting another tab's edits.

### How profit is calculated

**Cash profit = payments actually received − expenses actually paid.** Pending payments and unpaid expenses are shown separately. For marketplace settlements, enter the net amount credited to your bank. Do not enter fees as expenses a second time if they were already deducted from that net payout.

This is a cash ledger. It does not calculate inventory valuation, depreciation, GST returns, tax adjustments, or accrual accounting. Equipment purchases count as cash expenses. Keep loans and owner transfers out of business payments and expenses.

Entries are manual: saving is automatic after you press **Save**, but this version does not import settlements from Amazon, Flipkart, or Meesho automatically. Existing records from an earlier hosted version are not automatically migrated. CSV export is for reporting, not a complete database backup.

## Run it on your own computer

Install **Node.js 24** and **MySQL 8.4**. Start your MySQL service before continuing.

### 1. Download and install

```bash
git clone https://github.com/vedamrit01/ROBUSTTHREED_LEDGER.git
cd ROBUSTTHREED_LEDGER
npm ci
```

### 2. Configure your database

Copy `.env.example` to `.env`. On macOS/Linux:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` in your editor. Use your MySQL username and password locally:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD="replace-with-your-MySQL-password"
DB_NAME=robustthreed_ledger
```

Keep the quotes if your password contains `#` or spaces. Use your actual password in this local file only. Keep `DB_NAME=robustthreed_ledger` to create a separate ledger database; the setup does not use `ecommerce_db`.

### 3. Create the database and your owner login

```bash
npm run db:setup
npm run password:set
```

The first command connects to MySQL, creates `robustthreed_ledger` if needed, and creates `ledger_entries` and `ledger_sessions`. Re-running it preserves existing records. It uses `CREATE DATABASE IF NOT EXISTS`; your setup account needs permission to create the database and tables. [MySQL database creation reference](https://dev.mysql.com/doc/refman/8.4/en/create-database.html).

The second command prompts for a separate owner login password, with a minimum of 12 characters. Characters are hidden while you type. Only a scrypt hash is saved to `.env`. Use this owner password to sign in to the web app.

If your database provider creates a database for you, set `DB_NAME` to that supplied name and run:

```bash
npm run db:setup -- --existing
```

### 4. Start the API and interface

Terminal 1, in the project folder:

```bash
npm run dev:api
```

Terminal 2, in the same folder:

```bash
npm run dev
```

Open [the local ledger](http://localhost:5173), sign in, and add a payment or expense. Vite forwards `/api` requests to the Node server on port 3001. Entries stay in MySQL when you close the website or restart the API. The API and MySQL must both be running to load or save entries.

## Put the API and MySQL online

GitHub Pages publishes static files. It cannot run Node.js or MySQL. The interface calls your separate HTTPS API, which connects privately to MySQL. [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

You need either a server running both Node and MySQL, or a Node hosting service plus a MySQL database service. An API hosted in the cloud cannot reach MySQL at `localhost` on your home computer.

1. Provision MySQL and keep its connection details in the API host's environment settings. Use the provider's actual database hostname. If the API and MySQL share one server, `localhost` can be correct.
2. Connect this GitHub repository to a Node hosting service. Use Node **24**, the repository root as the working directory, install command `npm ci --omit=dev`, and start command `npm start`. A `Dockerfile` is included for hosts that use containers.
3. Set the server environment variables below. Run database setup from a terminal that can reach that database. For providers with a pre-created database, use `npm run db:setup -- --existing`.
4. Enable HTTPS on the API host and obtain its URL, for example `https://your-api.example.com`. Opening `/api/health` on that URL should return `{"ok":true}`.
5. Keep MySQL accessible only to the API server or the provider's private network. Use an application database account with only the required ledger permissions after setup.

| API server variable | Production value |
| --- | --- |
| `DB_HOST`, `DB_PORT` | Your MySQL server's hostname and port |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Database connection settings |
| `DB_SSL` | `true` for a remote database requiring TLS |
| `DB_SSL_CA` | Optional local path to your provider's CA certificate |
| `DB_SSL_CA_PEM` | Alternative to a file: paste your provider's complete PEM CA certificate |
| `LEDGER_PASSWORD_HASH` | Copy the generated value from your private `.env` into the API host's environment settings |
| `ALLOWED_ORIGINS` | `https://vedamrit01.github.io` — no repository path or trailing slash |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` for a managed/container host; `127.0.0.1` behind a reverse proxy on your own server |
| `PORT` | The port assigned by your host, or `3001` |
| `TRUST_PROXY_HOPS` | `0` by default; use your host's documented proxy count, usually `1` only when there is exactly one trusted proxy |

The API's runtime database account needs `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on this ledger database. Use a separate administrative account for setup. Do not use a public MySQL root account for the running web API. TLS certificate verification stays enabled.

The cloud Blueprint also supports `LEDGER_PASSWORD` plus a generated `LEDGER_AUTH_SALT` instead of a locally generated password hash. Its automatic database setup runs before each API start and therefore requires creation privileges. See [the cloud guide](CLOUD_SETUP.md) for that route; the restricted runtime account instructions below apply when you run setup separately.

For a database on the same server, an administrator can create a restricted account after setup using the following SQL. Replace the placeholder password locally:

```sql
CREATE USER 'robustthreed_app'@'localhost'
  IDENTIFIED BY 'replace-with-a-new-strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE
  ON robustthreed_ledger.* TO 'robustthreed_app'@'localhost';
```

Then update the server's `DB_USER` and `DB_PASSWORD` and restart it. For a hosted database, create an account through the provider's controls with access restricted to the API host.

## Host the interface on GitHub Pages

GitHub Pages is already enabled for this deployment. These steps are for publishing again or setting up another deployment.

The repository contains `.github/workflows/pages.yml`. It builds only the frontend into `dist`; the server, database, and secrets are not part of that published folder.

1. Open this repository's **Settings → Pages**. Under **Build and deployment**, select **GitHub Actions** as the source.
2. Open **Actions → Deploy GitHub Pages → Run workflow**, choose `main`, and run it.
3. After the deployment succeeds, open [Robustthreed on GitHub Pages](https://vedamrit01.github.io/ROBUSTTHREED_LEDGER/).
4. Sign in with your owner password, save an entry, reload, and confirm it is still there.

The workflow sets Vite's base path to `/ROBUSTTHREED_LEDGER/` and uses the existing Render API address. No repository variables are needed for this deployment. Pushes to `main` and manual workflow runs publish the site once Pages is enabled. If you change API hosts, set the optional `VITE_API_URL` repository variable to the new HTTPS origin, without `/api` or a trailing slash, and run the workflow again. [Vite's GitHub Pages guide](https://vite.dev/guide/static-deploy.html#github-pages).

`VITE_` variables are public and are compiled into the website. Put only the API's public URL there. Database credentials, the owner password hash, and ledger records belong on the API server and in MySQL.

## Cost and ownership

GitHub Pages is available for public repositories on GitHub Free, subject to its usage limits. This app's source is in your GitHub account. [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

The MySQL/API hosting cost is separate. Running both on your existing computer avoids an additional server rental, but requires that computer to stay on; public access also needs a properly secured HTTPS endpoint. A small server can run both services if you prefer an always-on deployment. Check a provider's actual pricing and database backup terms before signing up; a free frontend does not make the database free for life.

Your code and exported backups can be moved to another host. Continued availability depends on your server, database, backups, and hosting account. No hosting plan here is a lifetime guarantee.

## Backups and privacy

- Use your provider's scheduled MySQL backups. Keep a copy outside the database server and test restoring it into a separate database.
- With the MySQL client installed, this creates a backup of ledger records and prompts for your database password:

  ```bash
  mysqldump --single-transaction --no-tablespaces -h localhost -u robustthreed_app -p robustthreed_ledger ledger_entries > robustthreed-ledger-backup.sql
  ```

- Store backups outside this repository. `.gitignore` excludes `.env`, private keys, uploads, dumps, and the `backups/` folder. The public repository must never contain your financial records or credentials.
- The owner session lasts up to 12 hours. The browser keeps only the session token in tab session storage; ledger records are fetched from MySQL. Sign out on shared devices. Sessions are revocable and only token hashes are stored in MySQL.
- To change the owner password, run `npm run password:set`, update your API host's `LEDGER_PASSWORD_HASH` if applicable, and restart the API. This invalidates previous sessions.
- This version supports one owner ledger. It does not provide staff roles or separate customer accounts.

## Checks and troubleshooting

```bash
npm test
npm run build
```

The unit/API suite checks exact paise, P&L, dates, CSV escaping, authentication, logout, input limits, origin checks, and stale updates. `.github/workflows/checks.yml` also creates a disposable MySQL 8.4 test database and verifies real persistence across connections, concurrent updates, session expiry checks, and pagination. Its fixture password is only for the disposable CI service.

To run MySQL integration checks yourself, use a separate database whose name ends in `_test`, set `RUN_MYSQL_TESTS=1`, run `npm run db:setup`, and then `npm run test:mysql`. Never point the integration suite at live business data.

| Problem | What to check |
| --- | --- |
| `Database setup failed (ECONNREFUSED)` | MySQL is running; host and port are correct. A cloud API's `localhost` is the cloud server. |
| `ER_ACCESS_DENIED_ERROR` | MySQL username, password, permitted source host, and account permissions |
| `ER_BAD_DB_ERROR` | Run database setup, or use your provider's exact database name. |
| `API startup failed` | Create the owner password, run database setup, and verify server environment variables. |
| The website says the server is not connected | Set `VITE_API_URL` in repository Variables and run the Pages workflow again. |
| Cannot reach the ledger server | Check API HTTPS availability, `/api/health`, and `ALLOWED_ORIGINS`. |
| Browser reports CORS errors | `ALLOWED_ORIGINS` must be `https://vedamrit01.github.io`, without `/ROBUSTTHREED_LEDGER/`. |
| Login is temporarily blocked | Wait 15 minutes; check proxy settings if multiple clients share the same detected IP. |
| Pages deployment says the site is not found or is disabled | Choose GitHub Actions as the source in Pages settings, then re-run the workflow or failed deployment job. |
| Styling/assets missing after hosting | Use the included Pages workflow, which sets the repository base path. |
| An edit reports a conflict | Another save changed the record. Close the form, refresh, and edit the current record. |

## Project layout

| Location | Purpose |
| --- | --- |
| `app/`, `components/`, `hooks/` | Login and ledger interface |
| `lib/ledger.ts` | Shared validation, date, currency, and P&L calculations |
| `lib/api.ts` | Browser-to-API connection and session handling |
| `server/` | Authenticated Node API, MySQL queries, and SQL schema |
| `scripts/setup-db.mjs` | Creates the ledger database and tables |
| `scripts/set-password.mjs` | Creates or changes the owner password hash |
| `.github/workflows/` | Automated checks and GitHub Pages publishing |
| `.env.example`, `.env.frontend.example` | Configuration templates containing no real credentials |

The frontend is portable static output. The backend needs a persistent MySQL database and Node.js; publishing the source alone does not start either service.
