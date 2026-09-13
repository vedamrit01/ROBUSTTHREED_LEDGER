# Robustthreed ledger on Windows

Run the ledger on your own Windows PC with your installed MySQL server. No cloud database is needed for this local copy. Existing cloud data is not imported automatically.

## First time

1. Install **Node.js 24 or newer** from https://nodejs.org/ if needed. MySQL **8.4** is the project's tested database version.
2. Download this repository using **Code → Download ZIP**, then **Extract All**. Keep the extracted folder somewhere private on your PC; do not run inside the ZIP.
3. Ensure MySQL is running: press **Win+R**, enter `services.msc`, locate your MySQL service (its name varies, for example `MySQL84`), and start it if stopped.
4. In the extracted folder, double-click **SETUP_LEDGER.cmd**. Internet is required to install the project's dependencies. You do not need to install Git or run the wizard as administrator.
5. Enter your local MySQL username (Enter accepts `root`), port (Enter accepts `3306`), and password. Password typing is hidden. Choose and confirm a **new ledger login password** of 12–256 characters.
6. Wait for **Setup complete**, then double-click **START_LEDGER.cmd**. The browser opens at **http://localhost:5173** after the API and interface are ready. Sign in with the new ledger password.
7. Save a small test entry, reload, and verify it remains. Delete that test entry when finished.

The wizard creates `robustthreed_ledger` and its tables on `127.0.0.1` using the supplied port. Your MySQL account must be allowed to create databases and tables. Existing tables and records are preserved. Your other databases are not used.

## Each time you use it

Start MySQL if needed and double-click **START_LEDGER.cmd**. Keep its command window open. Press **Ctrl+C** when finished to stop the API and interface. Records remain in MySQL after closing the app or shutting down Windows. Use the localhost address for this local ledger; the GitHub Pages website still uses the separate cloud deployment.

The launcher uses local ports **3001** and **5173** and binds only to your PC's loopback interface. It checks for occupied ports and waits for database health before opening the browser. It does not install a Windows background service, expose MySQL to the internet, or change your cloud services.

## Private settings and backups

The wizard stores the local MySQL password and a hash of the new ledger password in **.env.windows.json** in the project folder. Git ignores this file. Keep the project folder private: the MySQL password is stored in readable form for the local API, so do not share or upload this file. The launcher does not give these credentials to the frontend process.

This file is separate from `.env`. The Windows launcher ignores cloud database settings and forces the interface to use its local API. Keep your usual MySQL backups; the project folder is not a backup of your database. CSV exports are reports, not full database backups.

The wizard never overwrites an existing `.env.windows.json`. To change connection settings or reset your local login, first stop the launcher, rename that file to `.env.windows.previous.json` (also private and Git-ignored), and rerun **SETUP_LEDGER.cmd**. Your database remains intact. A new owner password invalidates old sessions. After verifying the new settings, securely remove the old settings file if you no longer need it.

## Troubleshooting

| Message or problem | What to do |
| --- | --- |
| Node.js is missing or too old | Install Node.js 24 or newer, close the window, then reopen the script. |
| Dependency installation failed | Check your internet connection and rerun setup. |
| Database setup failed / connection refused | Start the MySQL Windows service and check the port. |
| Access denied | Check the local MySQL username and password and its database-creation privileges. |
| Database/schema error | Check your MySQL version; the project is tested with MySQL 8.4. Share the error code without credentials. |
| Local setup already exists | Use START_LEDGER.cmd, or follow the settings-reset steps above. |
| Dependencies missing after moving/downloading a folder | Open Command Prompt in the project folder, run `npm ci`, then rerun START_LEDGER.cmd. |
| Port 3001 or 5173 is in use | Close the other ledger window or application using that port before starting again. |
| Wrong owner password | Use the new local ledger password chosen in the wizard, not your MySQL or Render password. |
| Script blocked by Windows or company policy | Follow your organization's approved process. The scripts do not change execution policies or security settings. |

The scripts use Node.js and Command Prompt, so PowerShell script execution policy changes are unnecessary. They require a Windows run to verify the actual installed MySQL service, credentials, browser launch, and shutdown behavior on your computer.
