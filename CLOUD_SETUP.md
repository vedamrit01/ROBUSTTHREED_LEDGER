# Free cloud setup: Aiven MySQL + Render + GitHub Pages

Use this route to keep the ledger available without running MySQL or Node.js on your own computer. Setup happens in the providers' dashboards. Your existing local database is separate; its entries do not transfer automatically.

| Part | Provider | Selected plan |
| --- | --- | --- |
| MySQL database | Aiven | Free |
| Node API | Render | Free |
| Website | GitHub Pages | Public repository |

These plans can keep the hosting bill at zero within their included limits. Aiven's free MySQL includes 1 GB of disk, backups, and no fixed trial expiry, but inactive services can be powered off. It has no high-availability SLA. [Aiven's free tier](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier).

Render's free API sleeps after 15 minutes without requests and typically needs about a minute to wake. Its free service is intended for testing and small projects, not a production uptime commitment. Monthly usage limits also apply. The ledger now waits up to 90 seconds for responses and shows a connection message during login. [Render's free service limits](https://render.com/docs/free).

For business-critical availability, use paid hosting and independently verified backups. This free setup is a way to start with a small owner ledger; it is not a lifetime availability guarantee.

## Deployment status on 11 September 2026

- The **Free** API service has been created in the **Robustthreed** Render workspace, in Singapore, and connected to this repository's `main` branch.
- [Open the existing API service in Render](https://dashboard.render.com/web/srv-dahpu83m8hqs73ctcvig). Its public address is `https://robustthreed-ledger-api.onrender.com`.
- The **Free MySQL 8.4** service `robustthreed-ledger` is running in the Aiven project of the same name. The database `robustthreed_ledger` has already been created inside it.
- The API is **live**, with the MySQL connection, TLS certificate verification, and owner login configured in Render. Its [health check](https://robustthreed-ledger-api.onrender.com/api/health) returns `{"ok":true}`.
- Your generated owner login password is stored in **Render → Environment → `LEDGER_PASSWORD`**. Copy it privately from there when signing in to the ledger.
- The GitHub Pages build already uses this API address. **Only Pages publishing remains:** follow section 3 below. No repository variables are required for this deployment.

Continue with the steps below using the existing Aiven and Render services. You do not need to create another database service or API service.

**For the existing deployment, sections 1 and 2 are complete.** They remain below as configuration and recovery instructions.

## 1. Open the existing MySQL service

1. Sign in at [Aiven](https://console.aiven.io/) and open project **robustthreed-ledger → Services → robustthreed-ledger (MySQL)**.
2. Confirm the service shows **Running**. Under **Databases**, `robustthreed_ledger` is already present.
3. Open **Overview → Connection information**. Keep the hostname, port, username, and password available privately. The connection example may show `defaultdb`; keep Render's `DB_NAME=robustthreed_ledger` to use the ledger database.
4. Download or copy the service's CA certificate from its connection/SSL information. If downloaded as `ca.pem`, open it with a text editor. You will paste the full certificate into Render.

The cloud username is commonly `avnadmin`; use the value Aiven actually supplies. Your computer's `root` credentials are not credentials for this cloud service. The API setup will create the ledger tables inside `robustthreed_ledger` and preserve the database. [Aiven service setup](https://aiven.io/docs/products/mysql/get-started), [database creation](https://aiven.io/docs/products/mysql/howto/create-database).

**Only for a fresh deployment in another account:** create a project, choose **Create service → MySQL → Free**, select a broad region and service name, and wait for **Running**. Confirm the selected plan is Free; a paid service funded by trial credits is a different choice. The API setup can create `robustthreed_ledger` automatically.

## 2. Connect the existing API to MySQL

1. Open [the existing Render API service](https://dashboard.render.com/web/srv-dahpu83m8hqs73ctcvig).
2. Select **Environment → Edit** and add these six environment variables. Enter their values only in Render's private environment settings:

   | Render field | What to enter |
   | --- | --- |
   | `DB_HOST` | Aiven's hostname only, without a protocol or port |
   | `DB_PORT` | Aiven's displayed port; it might not be 3306 |
   | `DB_USER` | Aiven's database username |
   | `DB_PASSWORD` | Aiven's database password |
   | `DB_SSL_CA_PEM` | Full contents of the CA certificate, including BEGIN/END CERTIFICATE lines |
   | `LEDGER_PASSWORD` | A new owner login password of 16–256 characters |

3. Leave the existing settings unchanged, including `DB_NAME=robustthreed_ledger`, `DB_SSL=true`, and `ALLOWED_ORIGINS=https://vedamrit01.github.io`. A random `LEDGER_AUTH_SALT` is already stored in the service; keep it unchanged between deployments.
4. Save the environment changes and deploy. Watch the logs until you see the database ready message and `Robustthreed API listening on port ...`.
5. Open [the API health check](https://robustthreed-ledger-api.onrender.com/api/health). A ready API returns `{"ok":true}`. Do not enable Pages until this check passes.

The service installs dependencies and runs `npm run db:setup` before starting the API. That setup creates the database and tables if needed and preserves existing records. It runs again on restarts, so its database account needs creation privileges as well as ledger read/write permissions. TLS verification remains enabled. No local terminal or password-hash command is required for this route.

The supplied password stays in Render's server environment. The API derives a scrypt hash for verification; it does not send the password to GitHub Pages or save it in MySQL. [Render Blueprint secret prompts and generated values](https://render.com/docs/blueprint-spec#prompting-for-secret-values).

**Only if you are creating a separate deployment:** [Deploy with the included Blueprint](https://render.com/deploy?repo=https://github.com/vedamrit01/ROBUSTTHREED_LEDGER). It selects the Free API plan, prompts for the same six values, and generates an authentication salt. Use the new API address as `VITE_API_URL` if it differs from the existing service.

## 3. Connect GitHub Pages

1. Open the repository's [Pages settings](https://github.com/vedamrit01/ROBUSTTHREED_LEDGER/settings/pages). Choose **GitHub Actions** as the publishing source.
2. Open **Actions → Deploy GitHub Pages → Run workflow**, select `main`, and run it. If an earlier run failed because Pages was disabled, you can instead re-run its failed deployment job after completing step 1.
3. When build and deploy both succeed, open [your ledger](https://vedamrit01.github.io/ROBUSTTHREED_LEDGER/).
4. Sign in with the generated password stored in **Render → Environment → `LEDGER_PASSWORD`**. Save a small test entry, reload the page, and confirm it remains; then delete the test entry.

The workflow publishes on pushes to `main` and on manual runs. The former `ENABLE_PAGES_DEPLOY` variable is no longer needed. Only if you move the API to another host, set `VITE_API_URL` under **Settings → Secrets and variables → Actions → Variables** to the new HTTPS address, without `/api` or a trailing slash, and run the workflow again.

Only the API's public address goes in a `VITE_` variable. All database credentials belong in Render's environment settings. [GitHub Actions publishing setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Keeping it working

- Your computer can be off. Aiven stores the data, Render runs the API, and GitHub serves the interface.
- After inactivity, the first login can take about a minute while Render starts. If Aiven has powered off the database, power it on through its dashboard and restart/redeploy the API if required.
- Check provider emails about inactivity and limits. Keep separate database backups in addition to provider backups; CSV export is a useful report but not a full database backup.
- To change the owner login, update `LEDGER_PASSWORD` in Render and redeploy. Existing sessions become invalid. Keep `LEDGER_PASSWORD_HASH` unset for this cloud login method.
- To rotate database credentials or the CA certificate, update the corresponding Render values and redeploy. Never commit them to GitHub.
- If you restrict Aiven's allowed source IPs, allow the Render service's documented outbound addresses. Those settings must permit the API to reach MySQL.
- Existing local or earlier hosted records require an explicit migration. This route starts a new cloud ledger unless records have been restored into it.

## If setup fails

| Symptom | Check |
| --- | --- |
| Render does not ask for the six fields | Open the existing service's Environment settings and add the six variables listed above. |
| Database connection refused or timed out | Aiven is running; hostname and port match its dashboard; network rules allow Render. |
| Access denied | Use Aiven's generated username and password, not your old localhost login. |
| Certificate verification error | Paste the complete CA certificate into `DB_SSL_CA_PEM`; keep `DB_SSL=true`. |
| Cannot create the database | Use the service administrator for initial setup, or create `robustthreed_ledger` with an authorized database administrator. |
| Owner-login configuration error | `LEDGER_PASSWORD` needs at least 16 characters and the generated `LEDGER_AUTH_SALT` must be present. |
| API is ready but the website cannot connect | Update `VITE_API_URL`, rebuild Pages, and keep `ALLOWED_ORIGINS=https://vedamrit01.github.io`. |
| Blank/local `localhost` settings appear in your deployment | Enter Aiven's actual connection values in the existing Render service's Environment settings. Do not upload your local `.env`. |

For the local setup and accounting rules, see [README.md](README.md).
