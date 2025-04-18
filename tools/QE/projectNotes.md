# Quick Edit (QE)

A client-side code editor with Monaco, file/folder management, GitHub/URL import, and workspace ZIP download. Integrated into Quick-Hub as an iframe tool.

## Features
- Monaco-based code editor with syntax highlighting and word wrap
- File and folder management (create, rename, delete, move, copy, cut, paste)
- Upload/download files and folders (with structure)
- Import files from URL or GitHub repository (browse and select)
- Download workspace as a ZIP file
- Session auto-save and recovery (localStorage)
- Dark theme, responsive layout, context menu, and modals

## Integration Notes
- QE is accessible from the Quick-Hub dashboard under the "Editors" category.
- Uses the main Quick-Hub dark theme for visual consistency.
- QE is fully client-side and does not require a backend.

## Limitations
- No backend: all data is stored in browser memory/localStorage.
- Large files or workspaces may impact browser performance.
- GitHub API rate limits may apply for repo browsing.

## Future Enhancements
- Tabbed editing (multiple files open at once)
- Drag-and-drop file/folder reordering
- More language features (linting, formatting, etc.)
- Improved accessibility and mobile support
