# Robustthreed Portable for Windows

Carry the ledger AND its records between Windows 10/11 x64 PCs. This edition uses SQLite stored beside the app and bundles Node.js. You do not need MySQL, Node.js installation, an internet connection after downloading, or administrator access for normal use. A managed PC may restrict running apps from removable drives.

## Get the correct ZIP

Open https://github.com/vedamrit01/ROBUSTTHREED_LEDGER/releases and download **ROBUSTTHREED_PORTABLE_WINDOWS_X64.zip** from the newest portable release. Do not choose GitHub's automatic Source code ZIP: it does not include the runtime or built interface.

Extract the **complete ROBUSTTHREED_PORTABLE folder** onto your pendrive. Leave room for your database and backups (at least 1 GB free is a useful starting point). This runs a built interface, not a development build, so it does not build Vite caches on each PC.

## First use and daily use

1. Double-click **START_PORTABLE.cmd**.
2. On first use, choose a portable login password of 12–256 characters and confirm it. Typing is hidden; invalid entries can be retried in the same wizard.
3. The browser opens at **http://127.0.0.1:47831**. Sign in with that portable password.
4. Keep the command window open while working. Successful saves are written to **data/ledger.sqlite** on the pendrive.
5. When finished, press **Enter in the command window**. Wait for **Ledger closed**, then use Windows **Safely Remove Hardware** before unplugging.
6. On another Windows PC, plug in the pendrive and run the same START_PORTABLE.cmd. Your records and login travel with the complete folder, even if its drive letter changes.

Do not unplug while saving or running. A password protects access through the app; the database itself is not encrypted. Anyone with the drive can read its database files. Only use trusted PCs and keep the pendrive secure. Run one instance at a time; this is not a shared/network-drive database or a sync system.

## Copy your existing local MySQL records once

Do this on your original PC, where MySQL is installed and running. Close the old local ledger and the portable ledger first. You may import before or after choosing a portable password, but the portable ledger must contain no records.

1. Double-click **IMPORT_MYSQL.cmd** in the portable folder.
2. Paste the path to your old ledger project folder, the one containing **.env.windows.json**. It reads the MySQL details privately from that file; it never copies the MySQL password onto the pendrive.
3. Review the record count and payment/expense totals (shown as exact integer paise), then type **IMPORT**.
4. Wait for **Imported and verified**. Open the portable ledger and compare its entries and totals with your original ledger.

The import reads a consistent transaction from local MySQL and writes all portable entries in one SQLite transaction. It preserves record IDs, dates, amounts, statuses, versions and timestamps. Invalid records abort the complete import. It refuses to merge into an existing portable ledger, preventing accidental duplicates. Your original MySQL database is unchanged; it is not synchronized with later portable edits. Old browser login sessions are not imported.

## Back up to a separate drive

Close the portable ledger, then double-click **BACKUP_LEDGER.cmd**. Enter a destination folder on your PC or a different drive. It creates a timestamped folder containing a consistent SQLite backup and **owner.json**, your password hash. Check for **Backup complete**.

A rolling **data/backups/before-start.sqlite** snapshot is also made before each startup, but it is on the same drive and does not protect against losing or damaging the pendrive. Keep separate backups regularly.

To restore, close the app. Preserve your current **data** folder by renaming it, create a new **data** folder, then copy **ledger.sqlite** and **owner.json** from a verified backup into it. Restart and check your records. Never mix live journal files from another data folder into the restored database.

## Updating and troubleshooting

- To update: stop the old app, extract the new portable release into a separate folder, and copy the complete **data** folder from the old app into it. Verify the new copy before removing the old one. Never run both copies and edit them independently if you intend to keep a single ledger.
- **Runtime missing:** download the named portable release asset, not the source-code ZIP, and extract everything.
- **Database in use / port 47831 in use:** close the other portable ledger/import/backup window.
- **Not enough space:** free drive space without deleting your data folder. Keep an external backup.
- **Drive is read-only:** use a writable drive and check its write-protection settings.
- **Forgotten portable password:** restore a known owner.json backup or request help resetting it. Do not delete your ledger database.
- Do not use GitHub Pages to access these records; use the local address opened by the portable launcher.

The public release contains only app files and the bundled runtime. Your records and owner settings are created on your drive after extraction. The original MySQL/Render/GitHub Pages editions remain available separately.
