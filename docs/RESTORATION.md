# Original gift restoration

The gift renderer uses the original presentation code with validated editable content. Root source files and private media remain untouched. The editor and storefront keep the platform interface; the gift itself retains its original presentation.

## Original sources

- `assets/css/style.css`, `us.css`, `kata.css` and `cosmos.css` supply the film, archive, surprise and sky styles. Their declarations match after removing comments/whitespace; archive author selectors were renamed to neutral `from`/`to` identifiers without changing styles.
- `assets/js/shots.js`, `finale.js` and `cosmos.js` supply scene compositions, the photo-heart finale and the original Three.js engine. Adapters replace embedded personal data with the validated gift document.
- The missing parent styles were recovered from `C:/Users/Zawadzki/Desktop/Seperated/OurMemories/app/src/main/assets/web/`. `public/original/home.css` is a byte-identical copy of `calendar-home.css`. The original `mobile.css`, `mobile.js`, Fredoka and Nunito fonts are included. The earlier approximate menu styles have been removed.
- Cormorant Garamond, Caveat and Inter use local font files with the actual weights/styles requested by the source pages. All five font families retain OFL notices under `public/original/licenses`.

## Editable content and behavior

- Film: original wax seal, 20 scene compositions, durations/order, chapters, text, emphasis, captions, map coordinates, conversations, clocks, counters, image groups, video/audio, photo-heart finale, closing text and gallery. Portrait proportions follow uploaded image dimensions. Scene changes respect pause and sound controls.
- Archive: original scratch-to-reveal canvas, timeline, letter cards/reader, reasons, jokes, galleries and portraits. Letter and reason quantities follow visible entries. Open letters update live while editing. Reader keyboard navigation and focus trapping remain available.
- Archive statistics: automatic letter/word/unique-photo counts and personal date ranges, or fully custom values, labels and ordering. The first message, first meeting, visit start and visit end are separate dates. Missing/reversed date ranges show a dash. An empty custom statistics list hides them.
- Sky: original heart and cat constellation shapes/positions, sun/planet controls, discovery effects, editable stars/planets, dates, categories, details/moons, media, colors and radius. Customer memories bind once to the original shapes; unused nodes are decorative. IDs distinguish memories with identical names. Accessible controls also update discovery progress. WebGL fallback retains access to every memory.
- Surprise: original seal and two-voice reveal layout, editable clue, displayed words, reward and names; optional local recording, preview, replay together and record-again. A real-length recording can be sealed; speech recognition is not used. Typed answers remain available if the microphone is denied. Recordings stay in memory for the visit and are never uploaded automatically.
- Shared settings: names, dates, locations, signature, dedication, title/subtitle, section opening messages/headings, four finale phrases, portraits, background music, safe colors/fonts, media ordering/crops and section visibility/order.
- The same renderer drives editor previews and published recipients. Optional schema fields preserve version-1 draft compatibility. Publication still creates an isolated snapshot under a stable recipient link.

## Safety and deliberate substitutions

Public demo stories and media are fictional. Original private letters, photographs, recordings, music, sun movie and third-party textures are excluded. The sky uses the original procedural texture fallback. The home page's external parent-navigation link is replaced by the gift's own names.

Scene adapters escape customer text before passing it to legacy scene builders. Archive/sky content uses React or textContent. Media ownership and role checks include music, portraits and additional photos. Arbitrary HTML/JavaScript remains unsupported. Three.js/OrbitControls retain upstream license headers.

`tests/fixtures/fictional-tone.mp4` and `.wav` contain a generated solid-color frame and sine tone, created locally with FFmpeg. They contain no private or third-party material and are not public demo assets.

## Verification and limits

Production build and type checking pass. The 27 domain/presentation tests cover persistence, schema compatibility, owner/file roles, custom quantities, date semantics, custom statistics, payment rules and publication isolation. Browser tests cover all 20 film compositions across dedicated scenarios, photo finale, portrait proportions, video pause/sound, voice capture/replay using Chrome's simulated microphone, denial fallback, custom names/letters/statistics, autosave/sign-in persistence, anonymous recipients, snapshot isolation, identical sky names, theme/font changes, original menu navigation, mobile controls and WebGL fallback.

CSS/source comparison, desktop/mobile screenshots and browser error/console checks support the restoration. Chrome desktop and 390 × 844 mobile dimensions are verified. Physical microphone hardware, physical iOS/Android devices and Safari remain unverified. External Stripe/Supabase/PostgreSQL/email acceptance remains deferred by the user's local-demo choice. Synthetic payment fixtures do not verify external providers.

No public deployment or live payment was performed.
`/demo/original` opens the complete fictional gift at full viewport size, beginning with the recovered original menu. `/demo` retains the storefront-style catalogue of individual experiences.
`Your story → Opening, subtitles and section headings → Enable the reveal effect` can disable the archive introduction and scratch layer for both previews and published recipients. Existing gifts keep the effect enabled unless switched off.
