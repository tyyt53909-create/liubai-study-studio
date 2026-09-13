# Security policy

## Supported versions

Only the latest version on the default branch is supported.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's
private vulnerability reporting for this repository, or contact the
maintainer privately with reproduction steps and impact.

Do not include passwords, database dumps, cookies, push subscription payloads,
or other private study data in a report.

This project is a single-user self-hosted application. It is not designed as a
multi-tenant service. Production deployments must use
`compose.production.yaml`, HTTPS, unique generated secrets, encrypted backups,
and a restricted Docker host.
