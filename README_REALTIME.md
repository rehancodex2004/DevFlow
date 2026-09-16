# CMS Organization Workspace — Realtime Edition

This version changes the CMS to organization-scoped access.

## Rules
- A user sees only organizations they belong to.
- Every organization can have multiple members and up to 3 organization admins.
- Organization admins create projects.
- Every organization member can view that organization's projects and tasks.
- Only organization admins can create/update/delete tasks and manage members.
- A task may be assigned to any member of the same organization (not only a project member).
- Members can comment and reply. Organization admins can delete comments.
- Socket.IO provides live comments, task changes and notification toasts.

## Run
Backend:
```powershell
cd .\CMS\Backend
npm install
npm run db:migrate
npm run dev
```
Frontend:
```powershell
cd .\CMS\Frontend
npm install
npm run dev
```

Open http://localhost:5173. If 5001 or 5173 is already occupied, stop the old Node/Vite process first.

## Important
The ZIP intentionally does not rely on bundled `node_modules`. Run `npm install` in both folders after extraction. The backend requires `socket.io` and the frontend requires `socket.io-client`; these are declared in their package.json files.
