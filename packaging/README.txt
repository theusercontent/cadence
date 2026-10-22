CADENCE 1.4 - OFFLINE EDITION
=============================

A calm, local-first task manager for focused teams.
Everything runs on this computer. No account, cloud service, or internet connection is required.

QUICK START
-----------
1. Extract the entire ZIP to a normal folder.
   Do not run Cadence from inside the ZIP preview.
2. Double-click requirements.bat to verify that everything is included.
3. Double-click run.bat.
4. Your browser opens http://127.0.0.1:4173/ automatically.
5. Sign in with one of the demo accounts below.

If the browser does not open, open http://127.0.0.1:4173/ manually.
Keep the minimized "Cadence Server" window open while using Cadence.

STOPPING CADENCE
----------------
Close the "Cadence Server" window, or press Ctrl+C in that window.
If Cadence is installed as an app, it may still open from its cached offline files;
restart run.bat before making changes.

WHAT IS INCLUDED
----------------
app\             Prebuilt Cadence application
runtime\         Portable Node.js 22.12.0 and its license
server.mjs       Local web server
run.bat          Starts Cadence and opens the browser
requirements.bat Checks that all files are present
README.txt       This guide

No installation, administrator access, npm, or network access is needed.
Windows 10/11, Chrome, Edge, or Firefox are recommended.

DEMO ACCOUNTS
-------------
Admin     ava@cadence.app      admin123
Manager   marcus@cadence.app   manager123
Employee  maya@cadence.app     maya1234
Viewer    noah@cadence.app     noah1234

The passwords are public by design. Use Settings > Reset demo workspace to restore
the original sample workspace.

WHERE YOUR DATA LIVES
---------------------
Cadence stores the workspace in the browser's local storage for
http://127.0.0.1:4173/

This means:
- Your tasks remain on this computer and in this browser profile.
- Clearing browser site data deletes the workspace.
- Using a different browser or Windows profile gives you a separate workspace.
- Moving the Cadence folder does not move or delete your data, as long as the
  address remains http://127.0.0.1:4173/
- Keep the port at 4173 to keep your existing data connected to the app.

REPORTS AND BACKUPS
-------------------
Memory > Export my data downloads a personal JSON copy of the work you can see,
your settings, local recall, and saved Weekly Cadences.

Settings > Local data offers two more downloads:
- Task report (CSV): a role-scoped summary of every task you can see, with project,
  status, priority, owner, dates, labels, and step progress. Opens in Excel, Numbers,
  or Google Sheets.
- Full workspace backup (JSON): an admin-only snapshot of the complete workspace for
  restore or migration.

All files download through the browser. The CSV report includes no credentials.
Backups contain the complete workspace, including password hashes. Keep them private.
Restore with Settings > Local data > Restore backup, or reset the sample workspace
from the same section.

ASSIGNEES
---------
The assignee field accepts a name. Start typing to choose an active teammate, or type
any other name for a contractor, vendor, or stakeholder.

- A matching teammate stays linked, with their normal role and project access.
- Any other name is saved as an external owner on the task. External owners show up
  in task lists, board cards, the calendar, search, and the CSV report, but they do
  not receive a Cadence login or access to the workspace.
- Clear the assignee field and leave it to mark a task unassigned.

THE WEEKLY CADENCE
------------------
Open Weekly Cadence in the sidebar for a quiet weekly review. It follows the same
role boundaries as the rest of Cadence: employees review their own work, managers
review the work they can see, and admins review the workspace.

The ritual looks back at what moved, notices overdue, quiet, and unowned work, and
helps you choose up to three priorities for next week. Add a short intention if you
want one, then close the week.

- One Cadence is kept per person per week.
- Priorities are limited to three, with room to search larger workspaces.
- The latest intention appears in Memory.
- Everything is saved in the browser, alongside the rest of the workspace.
- Closing a Cadence does not change task status or anyone else's review.

INSTALL AS AN APP
-----------------
Open Cadence in Chrome or Edge, then use the install icon in the address bar or
Settings > Install Cadence. The installed app works offline from the local cache.

PRIVACY
-------
Cadence makes no external network requests. App files, fonts, icons, and data remain
on this machine. The local server only listens on 127.0.0.1, so other devices on your
network cannot connect to it.

TROUBLESHOOTING
---------------
Nothing happens when I double-click run.bat
- Run requirements.bat and confirm all checks pass.
- Some ZIP tools create an extra folder. Make sure run.bat is next to app\ and runtime\.

Port 4173 is already in use
- Cadence may already be running. Close its older "Cadence Server" window and try again.
- If another program uses the port, close that program or edit APP_URL and the port
  setting in run.bat and server.mjs. Changing the port creates a separate browser data set.

The browser shows "Not found"
- run.bat should be started from the extracted Cadence folder.
- Re-extract the complete ZIP if app\ or server.mjs is missing.

Windows shows a security prompt
- The package is not code-signed. Use "More info > Run anyway" only if you downloaded
  this ZIP from a source you trust.
- Verify the bundled runtime with requirements.bat if desired.

The app does not open offline after closing the server window
- Open run.bat again. The service worker is an offline cache for the app; the local
  server must be running for first-time loading and fresh data writes.

SHARING THIS ZIP
----------------
You may copy the entire folder or ZIP to another Windows computer. Each browser gets
its own independent workspace. This edition does not synchronize data between devices.
For shared team data across devices, a secure cloud database and server-side accounts
would be required.

Version: 1.4.0
Build date: 2026-10-23
Node runtime: 22.12.0 (license in runtime\NODE-LICENSE)
