# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: **Security → Report a vulnerability** on this repository. Do not open a public issue for a security problem.

Include what you found, how to reproduce it and its impact. You will get an answer as soon as possible; please allow time for a fix before any public disclosure.

## Scope

In scope: the code in this repository (web app, API, packages, scripts, Docker and deployment configuration).

Particularly relevant, given what the app stores:

- exposure of a user's provider API key (it must never leave the API decrypted, and only its last 4 characters reach the browser);
- access to another user's attempts, transcripts, evaluations, recordings or settings;
- authentication or session bypass, open redirects in the sign-in flows.

Out of scope: vulnerabilities of OpenAI, Google or other third-party services themselves, and denial of service through volume.

## Supported versions

Only the latest commit of the `main` branch is supported.
