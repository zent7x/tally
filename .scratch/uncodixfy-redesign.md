# Uncodixfy frontend redesign

User request: replace the sloppy UI using https://github.com/cyxzdev/Uncodixfy and redesign the 3D presentation. Follow the existing authorization to ship the working app.

Baseline: 856cf9a88f3c3d46274eb55f9e95a960f7295c0a.

- Follow Uncodixfy: remove serif display typography, decorative eyebrow labels/copy, excessive whitespace, repeated floating panels, gradient backgrounds, ornamental badges, and entrance/hover animations.
- Retain the existing green identity with neutral light and dark surfaces, readable sans-serif typography, consistent borders, and compact controls.
- Give the nine-section ledger a straightforward navigation layout. Preserve all labels, workflow behavior, encryption, persistence, and accessible keyboard operation.
- Reorganize Overview around real balances, income/spending history, accounts, and recent transactions. Remove duplicated chart presentations and empty oversized cards.
- Provide a tactile CSS 3D calculator on the landing page. The user-requested 3D object is the intentional exception to the reference's generic transform prohibition. Buttons and keyboard perform local arithmetic; the object uses no remote assets, tracking, or network APIs.
- Verify light/dark desktop, 320px/390px mobile, calculator arithmetic and keyboard behavior, existing browser workflows, core/privacy checks, and production build. Review, merge, deploy, and verify the live site.

Test seams remain public finance functions and rendered workflows. The calculator is tested via visible input/output behavior.
