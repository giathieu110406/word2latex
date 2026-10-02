# Sync Hub design
Scope: only Sync Hub. Keep conversion actions and original documents intact.
Desktop: compact white header; rounded workspace with 45% converter / 55% Google Docs; each panel scrolls independently, never h-screen nested inside app.
Mobile: stack panels; each has a usable minimum height. No body horizontal overflow.
Palette: slate text, blue primary, soft indigo background, thin borders, 16px corners. CSS/icons only, no decorative image dependencies.
Drive: Google Docs picker with all accessible, shared-with-me and shared drives views. Keep drive.file selected-file consent. Fetch metadata after selection to show title, ownership and canCopy; propose a copy for non-owned files, never automatically copy. Errors preserve existing document. External open action provides full Google Docs interface.
Acceptance: buttons readable, converter controls wrap in narrow panels, accessible labels and status, shared files are selectable subject to Google permissions.
