# Lore Ledger App Store Submission Plan

This plan is for taking **Lore Ledger v0.5.0** from a production-grade live PWA into store-ready submission shape for:

- Microsoft Store (Windows)
- Google Play (Android)
- Apple App Store (iPhone/iPad)

The goal is to keep the current live site active and stable while building store packaging around the same hardened codebase.

---

## Core strategy

Treat store distribution as a **packaging and compliance program**, not a rewrite.

### Keep the live site as the canonical web release
- GitHub Pages remains the public production deployment.
- The live site continues to be the main browser-accessible version.
- Store packages should be generated from tagged/stable releases, not from ad hoc local builds.

### Use one app codebase with platform-specific wrappers
- **Windows Store:** PWA package / MSIX via PWABuilder
- **Google Play:** Trusted Web Activity (TWA) around the live site
- **Apple App Store:** Capacitor-based native wrapper with bundled web assets

### Release principle
Every store build should map to:
- one git tag
- one version number
- one release note set
- one QA checklist
- one known-good live web release

---

# Phase 0 — Store-readiness foundation

This is shared work that should be done before platform-specific submission work begins.

## 0.1 Brand consistency
Current store-facing identity needs to be completely consistent everywhere.

### Must unify
- app name: `Lore Ledger`
- browser tab title
- manifest name / short_name
- About dialog
- backup/export filenames
- package metadata
- screenshots / store copy
- support and privacy pages
- any remaining `Campaign Tracker` strings still visible to users

### Done looks like
- no user-facing branding mismatch remains
- screenshots and store listings all use the same name
- install name matches visible in-app name

---

## 0.2 Store metadata pack
Create a single source-of-truth metadata set for all stores.

### Prepare
- short description
- long description
- feature bullets
- support email
- support URL
- privacy policy URL
- app category / genres
- age rating answers
- release notes template
- keywords / tags where applicable

### Recommended output
Create:
- `docs/store-metadata.md`
- `docs/privacy-policy.md` or hosted equivalent
- `docs/release-notes-v0.5.0.md` and onward

---

## 0.3 Visual assets pack
Prepare store-quality visual assets once, then adapt per platform.

### Needed
- app icon master source
- store icon variants
- screenshots for:
  - tracker page
  - character page
  - map page
  - backup / data safety / settings
- promotional graphic / feature graphic where needed
- Apple-specific screenshot sizes
- Google Play feature graphic
- Microsoft Store tile/store art if needed

### Recommendation
Create a source asset folder such as:
- `branding/`
- `branding/store-assets/`

Track export requirements in:
- `docs/store-assets-checklist.md`

---

## 0.4 Privacy / compliance surface
Because submission reviews look for this immediately, make the privacy story explicit and public.

### Must have
- public privacy policy URL
- in-app link to privacy policy
- support/contact link
- clear statement that Lore Ledger stores user data locally unless/until cloud sync exists
- clear explanation of backup/import/export behavior

### Should also clarify
- no account required
- no server-side sync in current release
- data remains on device/browser unless user exports it manually

---

## 0.5 Submission branch/release model
Define a stable branching model for store work.

### Recommended branches
- `main` → live web production
- `store-prep` → shared store-readiness work
- `windows-store`
- `android-store`
- `ios-store`

### Recommended release flow
1. finish release work on branch
2. merge to `main`
3. tag release
4. deploy live site
5. generate store packages from tagged commit
6. test packaged builds
7. submit

---

# Phase 1 — Windows Store plan

Windows is the easiest and should be first.

## 1.1 Microsoft Partner Center setup
### Tasks
- confirm developer account access
- reserve the app name `Lore Ledger`
- verify publisher identity details
- set support and privacy URLs
- prepare store listing text

### Deliverables
- reserved product name
- completed listing draft
- Partner Center app entry created

---

## 1.2 PWA readiness audit for Microsoft packaging
Run the live site through PWABuilder and review all report-card items.

### Check
- manifest completeness
- icons
- screenshots
- description/category fields
- protocol / HTTPS requirements
- installability / service worker
- offline shell basics

### Fix any flagged issues
Especially:
- manifest polish
- screenshots
- missing recommended metadata
- installability warnings

---

## 1.3 Generate Windows package
### Packaging target
- PWABuilder-generated Windows package / MSIX

### Test locally
- install package
- launch from Start menu
- verify icon/name
- verify About dialog version/build
- verify persistence survives app relaunch
- verify import/export still works
- verify uninstall/reinstall expectations are understood

---

## 1.4 Windows Store submission QA
### Manual checks
- install works
- no broken assets
- no title/branding mismatch
- settings/about/privacy links work
- app functions offline at least to expected shell level
- no unexpected console/runtime errors
- app can recover from failed import / failed save scenarios visibly

### Windows submission done when
- package installs cleanly
- listing assets are complete
- submission is accepted without major metadata rejection

---

# Phase 2 — Google Play plan

Android should be second.

## 2.1 Decide Android packaging path
### Recommended
Trusted Web Activity (TWA)

Why:
- keeps live site active as the core product
- minimal divergence from current web architecture
- good fit for a strong installable PWA

### Important note
This path depends on:
- owning the live domain
- configuring Digital Asset Links correctly
- Android packaging and signing setup

---

## 2.2 Android app identity
### Decide and lock
- package name
- app display name
- signing key ownership
- release keystore handling
- support email / policy links

Document in:
- `docs/android-release.md`

---

## 2.3 Digital Asset Links
### Required work
- generate signing certificate fingerprint
- host `assetlinks.json` on the live site/domain
- verify domain ownership / package linkage
- confirm TWA verification succeeds

### Done looks like
- Android opens Lore Ledger in verified fullscreen app mode
- no fallback to browser/custom tab in normal verified conditions

---

## 2.4 Google Play policy setup
### Required
- privacy policy URL
- Data safety form
- app access / credentials answers if applicable
- content rating questionnaire
- ads declaration
- package name registration / verification if required for your account type

### Must decide clearly
What user data is collected?
For current Lore Ledger state, that answer is likely very minimal because it is local-first.

---

## 2.5 Android technical compliance
### Confirm
- current target SDK requirement is met
- package builds as AAB
- app signing is configured
- app opens and behaves correctly on modern Android devices
- export/import flow works
- local persistence survives app restarts
- versioning strategy aligns with Play requirements

---

## 2.6 Testing track plan
Depending on account type, Google may require testing before production.

### Prepare
- internal testing track
- closed test track if required
- tester checklist
- release notes
- issue triage doc

### Android submission done when
- TWA verified
- Play policy forms completed
- test track obligations satisfied
- production submission accepted

---

# Phase 3 — Apple App Store plan

Apple is the strictest and should be approached as a distinct productization pass.

## 3.1 Decide Apple packaging path
### Recommended
Capacitor iOS app with bundled web assets

Why:
- stronger “real app” story than a thin website wrapper
- preserves local-first functionality
- gives better control over icons, splash, privacy surfaces, and file flows
- reduces review risk compared to a remote-only wrapped website

---

## 3.2 Apple review readiness goals
Apple review is where “works” is not enough. The app must feel intentional.

### Focus areas
- strong branding consistency
- app-like onboarding / first-run experience
- polished About / Settings / Privacy
- visible value beyond “just a website”
- accessibility
- native-feeling import/export/share where practical

---

## 3.3 iOS wrapper work
### Technical tasks
- initialize Capacitor iOS shell
- sync web build into iOS app
- configure app icons / splash
- configure app name / bundle ID
- test offline launch behavior
- test persistence across relaunch
- test file import/export from iOS Files / share sheet if supported

### Recommendation
Create:
- `docs/ios-release.md`

---

## 3.4 Apple-specific polish pass
### Required / recommended work
- tab/title branding consistency
- accessibility labels for critical inputs and controls
- privacy link in-app
- support link in-app
- clearer first-run explanation of local data + backups
- confirm the app can be understood without browser context

### High-value additions before Apple submission
- first-launch info modal or page
- explicit “your data is stored locally on this device/browser” messaging
- better import/export affordances on mobile
- refined empty states

---

## 3.5 App Store Connect setup
### Prepare
- bundle ID
- app name
- screenshots for all required device sizes
- app privacy answers
- support URL
- privacy policy URL
- age rating
- review notes

### Submission done when
- app passes TestFlight/internal testing
- no obvious wrapper-only feel remains
- metadata and privacy details are complete
- Apple review accepts the app

---

# Phase 4 — Shared QA matrix for all store builds

Use one checklist for every packaged build.

## 4.1 Core functional checks
- app launches cleanly
- correct icon/name shown
- correct version/build shown
- tracker page works
- character page works
- map page works
- reload/relaunch persistence works
- backup export works
- invalid import is safely handled
- save failure is visible to users
- no broken assets
- no runtime errors in ordinary use

---

## 4.2 Platform-specific checks
### Windows
- Start menu launch
- install/uninstall behavior
- windowed experience
- taskbar icon/name

### Android
- app opens in TWA fullscreen
- no visible browser chrome
- back-button behavior sane
- Android share/file picker behavior if used

### iOS
- offline relaunch
- app switcher behavior
- file import/export/share behavior
- safe-area / notch / keyboard behavior
- accessibility basics

---

## 4.3 Release proof
Before any store submission, record:
- release tag
- commit hash
- package/build version
- verify result
- smoke result
- manual QA pass result
- screenshots/videos if helpful

Recommended file:
- `docs/store-submission-verification-log.md`

---

# Phase 5 — Store-specific “must have” checklist

## Microsoft Store
- [ ] Partner Center app reserved
- [ ] listing text complete
- [ ] screenshots complete
- [ ] privacy/support URLs added
- [ ] PWABuilder audit clean enough
- [ ] package generated
- [ ] install tested
- [ ] submission sent

## Google Play
- [ ] package name finalized
- [ ] signing configured
- [ ] TWA built
- [ ] Digital Asset Links verified
- [ ] privacy policy published
- [ ] Data safety completed
- [ ] content rating completed
- [ ] internal/closed test completed if required
- [ ] production submission sent

## Apple App Store
- [ ] Capacitor shell built
- [ ] web assets bundled
- [ ] branding consistent
- [ ] privacy/support/about surfaces polished
- [ ] accessibility pass completed
- [ ] screenshots complete
- [ ] App Privacy completed
- [ ] TestFlight/internal test passed
- [ ] review notes prepared
- [ ] submission sent

---

# Immediate next-step plan

## Step 1 — Build the shared store-readiness docs
Create:
- `docs/store-submission-plan.md`  ← this file
- `docs/store-metadata.md`
- `docs/store-assets-checklist.md`
- `docs/store-submission-verification-log.md`

## Step 2 — Do a shared branding/privacy pass
Fix:
- remaining `Campaign Tracker` naming leaks
- privacy policy/support URL surfaces
- metadata consistency

## Step 3 — Submit Windows first
This is the shortest path to a successful first store listing.

## Step 4 — Build Android TWA
Do policy + verification work next.

## Step 5 — Do Apple wrapper/polish pass
Approach Apple as a deliberate app-product pass, not just package-and-ship.

---

# Suggested Codex prompt sequence

## Prompt A — shared store-readiness audit
```text
Audit the Lore Ledger repo and produce a store-readiness checklist for Windows Store, Google Play, and Apple App Store submission, while preserving the current GitHub Pages live deployment as the canonical web release.

Focus on:
- current branding consistency
- manifest/app identity quality
- privacy/support surfaces
- store metadata gaps
- icon/screenshot/documentation gaps
- anything already store-ready versus missing

Output:
1) shared store-readiness findings
2) Windows-specific readiness
3) Google Play/TWA readiness
4) Apple/Capacitor readiness
5) exact files that should be updated first
```

## Prompt B — branding/privacy cleanup
```text
Fix the shared store-readiness issues in Lore Ledger that affect all platforms:
- remaining Campaign Tracker naming leaks
- privacy/support/about links and wording
- metadata consistency across manifest/title/about/export naming where appropriate

Keep the live site stable and do not start wrapper-specific work yet.
```

## Prompt C — Windows submission prep
```text
Prepare Lore Ledger for Microsoft Store submission as a packaged PWA.
Focus only on the Windows/PWABuilder path and update docs/checklists/assets/metadata as needed without affecting the live GitHub Pages deployment.
```

## Prompt D — Android TWA prep
```text
Prepare Lore Ledger for Google Play submission via Trusted Web Activity.
Focus on package identity, Digital Asset Links readiness, Play policy/data safety checklist needs, and Android release documentation without affecting the current live site.
```

## Prompt E — Apple submission prep
```text
Prepare Lore Ledger for Apple App Store submission via a Capacitor-based iOS wrapper.
Focus on identifying the exact app-like polish, privacy, accessibility, packaging, and review-readiness changes needed before submission, while keeping the web app live and stable.
```

---

# Definition of success

This plan succeeds when:

- the live web app remains stable and active
- Windows submission is packaged and accepted
- Android submission is packaged, policy-complete, and accepted
- Apple submission is packaged, polished, and accepted
- all store builds trace back to the same stable release process
- Lore Ledger remains one product with one architecture, not three forks
