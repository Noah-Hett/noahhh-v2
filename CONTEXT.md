# noahhh.com v2

Personal portfolio site rebuild. Fresh start from v1 — no visual or structural carryover unless explicitly re-adopted.

## Language

**Project**:
A professional work case study with its own route under `/project/:slug`.
_Avoid_: Case study, work, piece

**Selected**:
The 3 Projects showcased on the home page.
_Avoid_: Featured, highlighted, top

**Archive**:
The personal photography collection, contained under its own route, never mixed with Projects.
_Avoid_: Gallery (for photos), personal, photos page

**Block**:
A swappable content unit inside a Project page body (text, image, video, 3D, PDF link, gallery).
_Avoid_: Section, component, widget

**ProjectLayout**:
The shared shell around every Project page (title, navigation, end prompt). Bodies differ, shell is consistent.
_Avoid_: Template, wrapper
