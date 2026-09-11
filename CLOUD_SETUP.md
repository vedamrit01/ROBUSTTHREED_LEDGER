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

## 1. Create the free MySQL service

1. Sign up or sign in at [Aiven](https://console.aiven.io/).
2. Create a project if prompted, then select **Create service → MySQL**.
3. Select the **Free** tier. Confirm the service is free before creating it. A paid service funded by trial credits is a different choice.
4. Name the service `robustthreed-ledger` and create it. Wait until its status is **Running**.
5. Open the service overview and **Quick connect** or its connection details. Keep the hostname, port, username, and password available privately.
6. Download or copy the service's CA certificate from its connection/SSL information. If downloaded as `ca.pem`, open it with a text editor. You will paste the full certificate into Render.

The cloud username is commonly `avnadmin`; use the value Aiven actually supplies. Your computer's `root` credentials are not credentials for this new cloud service. The API setup creates a database named `robustthreed_ledger` inside the service. [Aiven service setup](https://aiven.io/docs/products/mysql/get-started), [database creation](https://aiven.io/docs/products/mysql/howto/create-database).

## 2. Deploy the API

[**Deploy Robustthreed's API to Render**](https://render.com/deploy?repo=https://github.com/vedamrit01/ROBUSTTHREED_LEDGER)

1. Open the link and sign in to Render. Connect GitHub if prompted, granting access to this repository.
2. Render reads `render.yaml` from the project. Confirm the service is `robustthreed-ledger-api` on the **Free** plan.
3. Fill in the requested values:

   | Render field | What to enter |
   | --- | --- |
   | `DB_HOST` | Aiven's hostname only, without a protocol or port |
   | `DB_PORT` | Aiven's displayed port; it might not be 3306 |
   | `DB_USER` | Aiven's database username |
   | `DB_PASSWORD` | Aiven's database password |
   | `DB_SSL_CA_PEM` | Full contents of the CA certificate, including BEGIN/END CERTIFICATE lines |
   | `LEDGER_PASSWORD` | A new owner login password of 16–256 characters |

4. Leave the other Blueprint settings as supplied. Render generates `LEDGER_AUTH_SALT` automatically; keep it unchanged between deployments.
5. Create/deploy the service. Watch its logs until you see the database ready message and `Robustthreed API listening on port ...`.
6. Copy the service's HTTPS address from Render, such as `https://robustthreed-ledger-api-xxxx.onrender.com`.
7. Open that address with `/api/health` appended. A ready API returns `{"ok":true}`.

The Blueprint installs dependencies and runs `npm run db:setup` before starting the API. That setup creates the database and tables if needed and preserves existing records. It runs again on restarts, so its database account needs creation privileges as well as ledger read/write permissions. TLS verification remains enabled. No local terminal or password-hash command is required for this route.

The supplied password stays in Render's server environment. The API derives a scrypt hash for verification; it does not send the password to GitHub Pages or save it in MySQL. [Render Blueprint secret prompts and generated values](https://render.com/docs/blueprint-spec#prompting-for-secret-values).

## 3. Connect GitHub Pages

1. Open the repository's [Pages settings](https://github.com/vedamrit01/ROBUSTTHREED_LEDGER/settings/pages). Choose **GitHub Actions** as the publishing source.
2. Open **Settings → Secrets and variables → Actions → Variables**. Create or update these repository variables:

   | Variable | Value |
   | --- | --- |
   | `VITE_API_URL` | Your Render HTTPS address, without `/api`, `/api/health`, or a trailing slash |
   | `ENABLE_PAGES_DEPLOY` | `true` |

3. Open **Actions → Deploy GitHub Pages → Run workflow**, select `main`, and run it.
4. When build and deploy both succeed, open [your ledger](https://vedamrit01.github.io/ROBUSTTHREED_LEDGER/).
5. Sign in using the `LEDGER_PASSWORD` you entered in Render. Save a small test entry, reload the page, and confirm it remains; then delete the test entry.

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
| Render does not ask for the six fields | Use the Deploy link/Blueprint flow, or add the fields manually in the service's Environment settings. |
| Database connection refused or timed out | Aiven is running; hostname and port match its dashboard; network rules allow Render. |
| Access denied | Use Aiven's generated username and password, not your old localhost login. |
| Certificate verification error | Paste the complete CA certificate into `DB_SSL_CA_PEM`; keep `DB_SSL=true`. |
| Cannot create the database | Use the service administrator for initial setup, or create `robustthreed_ledger` with an authorized database administrator. |
| Owner-login configuration error | `LEDGER_PASSWORD` needs at least 16 characters and the generated `LEDGER_AUTH_SALT` must be present. |
| API is ready but the website cannot connect | Update `VITE_API_URL`, rebuild Pages, and keep `ALLOWED_ORIGINS=https://vedamrit01.github.io`. |
| Blank/local `localhost` settings appear in your deployment | Use the included Blueprint so the six cloud fields are entered in Render. Do not upload your local `.env`. |

For the local setup and accounting rules, see [README.md](README.md).
