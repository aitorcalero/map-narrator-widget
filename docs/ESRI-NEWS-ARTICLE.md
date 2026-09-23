# Giving Every Map a Voice

## How one ArcGIS Experience Builder widget is helping make visual map experiences more inclusive

Maps are powerful because they make complex information easier to see. But
“seeing” a map is not the same experience for everyone. For people who are
blind or have low vision, a map can still contain valuable information—but
that information may remain locked inside colors, symbols, labels, patterns,
and spatial relationships.

Map Narrator Widget began with a simple question: What if a map could explain
itself?

The project, created by Aitor Calero García, explores how ArcGIS Experience
Builder and artificial intelligence can work together to give people a more
independent way to understand a map. With one deliberate action, the widget
captures the current map view, combines it with the map’s geographic context,
and produces an accessible description. When voice services are enabled, that
description can also be read aloud.

The goal is not to replace cartography, interpretation, or human expertise.
It is to create another doorway into the map.

## Starting with the person behind the map

Many digital mapping experiences assume that a user can interpret visual
hierarchies immediately. A basemap, a cluster of symbols, a color ramp, or a
small label can carry important meaning. A person who cannot see those
elements may receive only a partial version of the experience.

Map Narrator approaches the problem from the user’s perspective. Instead of
describing an abstract dataset, it focuses on the map currently displayed:
the visible extent, scale, basemap, layers, labels, patterns, and spatial
arrangement. The description is intended to answer the questions a person
might ask when first encountering the view:

- What is shown?
- Where are the most important elements?
- How are they distributed?
- What patterns or contrasts stand out?
- What should the user explore next?

That focus on the current view also keeps the interaction understandable. The
widget does not continuously capture the screen or send images in the
background. The user presses the description button when they want help.

## Turning a map view into a conversation

The widget connects three capabilities that are often experienced separately.
ArcGIS Experience Builder provides the interactive map and the framework for
building the user experience. OpenAI interprets the structured map context and
the optional visual capture. ElevenLabs can turn the resulting text into
speech.

The sequence is deliberately simple:

1. The user chooses to describe the current map.
2. The widget gathers the visible map context.
3. A compressed image of the view is captured when visual mode is enabled.
4. A protected backend sends the information to the language model.
5. The description appears in the widget.
6. The user can choose to listen to it.

This separation matters. The browser never receives the service credentials.
The backend validates the request and keeps the provider integrations behind a
single boundary. Voice is optional, so a user can still receive a text
description when speech synthesis is not configured.

## Learning from real-world friction

The most valuable lessons did not come from the first successful request.
They came from the requests that failed.

Early tests showed that detailed imagery and satellite basemaps could produce
large PNG screenshots. A capture that looked modest on screen could exceed
the limits of an HTTP request or the image-processing service. The project
responded by compressing captures as JPEG, limiting dimensions, and validating
the image before it left the backend.

Other failures revealed the importance of the surrounding development
environment. A request that reported “Failed to fetch” turned out to involve
cross-origin configuration. A request rejected as too large required both
client-side compression and server-side limits. Another request exposed a
mismatch between the format produced by the widget and the formats accepted by
the API.

Each error became part of the design. The backend now distinguishes
connectivity, origin, format, dimension, and size problems. The development
scripts check whether services are ready instead of assuming that a process
has started successfully.

## Making the project practical for more than one computer

The project was developed on Windows with ArcGIS Experience Builder Developer
Edition, but accessibility work should not depend on one operating system.
The solution therefore includes equivalent launchers for Windows and
Linux/macOS.

Both launchers:

- load credentials from a user-specific location outside the repository;
- validate the Experience Builder installation;
- synchronize the widget into the active Experience Builder environment;
- start the API, client, and builder in the correct order;
- wait for health checks before continuing;
- clean up development ports when restarting;
- support private Tailscale access or public Tailscale Funnel access;
- provide an explicit stop command.

This consistency is more than a convenience for developers. Reproducible
startup reduces the chance that an accessibility feature behaves differently
because it was tested from a different machine.

## Privacy as part of accessibility

An accessible experience should also be a trustworthy experience. The widget
uses an explicit user action before sending a visual capture. API keys remain
on the server, and the credential helpers store them outside the source tree.
The backend validates incoming map metadata and image data, limits request
frequency, and avoids placing images or secrets in diagnostic logs.

These choices are intentionally visible in the product behavior. The user
knows when a description is being generated and can decide whether to request
audio. Accessibility is not treated as a feature added after the technical
work; it is considered alongside consent, security, and control.

## A small widget with a larger ambition

Map Narrator is still an evolving project. Its roadmap includes a shorter,
more visual summary for speech, customizable description prompts, improved
focus management, progress feedback, richer audio controls, request
cancellation, and broader automated testing.

Those improvements follow the same principle as the original prototype:
technology should reduce barriers without taking control away from the person
using it.

For the creator, the project has also changed the way accessibility is
approached. It is not only a matter of adding an alternative label or checking
keyboard navigation at the end of development. It means asking what
information a person needs, when they need it, how much control they should
have, and what the system should do when something goes wrong.

Maps help people understand place. When a map can also explain its visual
language, more people can participate in that understanding. Map Narrator
Widget is one practical experiment in that direction: a small bridge between
the visual richness of a map and the many ways people experience geographic
information.

---

## Submission notes

**Suggested author line:** Aitor Calero García

**Suggested article type:** Accessibility, innovation, or ArcGIS Experience
Builder project story.

**Suggested visuals to provide separately:**

1. A screenshot of the Map Narrator widget alongside an ArcGIS map.
   *Caption:* “Map Narrator Widget provides a text description of the current
   map view inside ArcGIS Experience Builder.”
   *Alt text:* “An ArcGIS Experience Builder map is displayed beside a Map
   Narrator panel containing an accessible description of the visible map.”

2. A diagram showing the user-controlled flow from map view to text and
   optional audio.
   *Caption:* “The user controls when the map is described and whether the
   resulting text is converted to speech.”
   *Alt text:* “A flow diagram connects an ArcGIS map to a description service
   and then to an optional audio player.”

3. A screenshot of the audio playback state.
   *Caption:* “The generated description can be read aloud when the optional
   ElevenLabs integration is configured.”
   *Alt text:* “The Map Narrator widget displays a generated map description and
   an audio player for listening to it.”

The article follows a people-centered, solution-oriented approach suitable
for an Esri News or ArcNews technology and accessibility feature. Before
submission, the author should confirm the preferred publication, word-count
limit, image ownership, author biography, and any organizational review
requirements with Esri editors.
