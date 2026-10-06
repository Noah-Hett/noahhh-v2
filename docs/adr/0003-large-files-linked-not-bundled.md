# Large files hosted, never bundled or embedded

PDFs, video, and heavy images stay as linked files served from the site (`public/files/` now, R2/Stream if they grow), never imported into the JS bundle and never embedded in iframes/autoplay on load. Detail pages link out to PDFs and lazy-load media on demand. Keeps initial loads fast without forcing quality cuts on source files.
