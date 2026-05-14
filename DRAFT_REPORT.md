# http-cache-control-kit Draft Report

Run: 2026-05-14.

## Verdict

GO local strict pour un brouillon jetable, pas pour publication immédiate.

`http-cache-control-kit` est une petite librairie TypeScript clean-room pour parser, diagnostiquer et reformater les headers HTTP `Cache-Control`.

## Shortlist exploratoire

| Piste | Package source | Famille prometteuse | Idée clean-room | Verdict |
| --- | --- | --- | --- | --- |
| Cache-Control | `parse-cache-control` | Headers HTTP ciblés | Parser/formatter diagnostique de `Cache-Control` | GO |
| Cache-Control actif | `cache-control-parser` | Headers HTTP ciblés | Même famille, mais package actif en 2026 | Concurrent à surveiller |
| Accept-Language | `accept-language-parser` | Négociation HTTP | Parse + matching localisé | NO GO, concurrence et scope plus délicat |
| Content-Disposition | `content-disposition` | Headers HTTP | Filename diagnostics | NO GO, maintenu récemment |
| Cookie | `cookie` | Headers HTTP | Cookie parse/serialize | NO GO, leader maintenu |
| MIME/media type | `media-typer` | Content-Type/MIME | Media type strict | NO GO, maintenu récemment |
| Link header | `parse-link-header` / assimilés | Headers HTTP | Link header parser | NO GO, brouillon local déjà présent |
| URL extraction | packages URL regex | Text helpers | Extraire URL de texte | NO GO, brouillon local déjà présent |
| Durées écrites | `human-interval` | Dates/durations ciblées | Durées écrites | NO GO, doublon probable |
| Ranges numériques | parsers range | Ranges | Ranges numériques | NO GO, doublon local évident |

## Score anti-emballement

- Usage actuel vérifié: 1.5/2. Le package source existe sur npm, et la famille Cache-Control reste courante dans fetch, CDN, workers et tooling HTTP. Les téléchargements npm précis n'ont pas pu être récupérés via l'API downloads pendant ce run.
- Abandon ou maintenance faible: 1.5/2. `parse-cache-control` affiche `1.0.1` et une metadata npm `time.modified` au 2022-06-23; des index tiers indiquent une dernière mise à jour historique autour de 2015. Ce n'est pas un abandon absolu prouvé, mais la piste est vieillissante.
- Scope livrable en 1 journée: 2/2. Parser une seule grammaire de header, formatter et helpers diagnostics restent petits.
- Douleur utilisateur visible: 2/2. Les erreurs typiques sont les doublons, valeurs `delta-seconds` invalides, guillemets non fermés et directives inconnues, utiles en UI de debug ou tests.
- Différenciation non triviale: 2/2. Diagnostics stables, gestion des doublons, parsing des valeurs citées avec virgules, formatter browser-friendly.

Score: 9/10.

Différenciation en 1 journée: retourner un résultat inspectable avec diagnostics stables pour les directives invalides ou ambiguës, puis reformater proprement un header sans dépendance runtime ni API Node.

## Contrôle anti-doublon

Inventaire consulté:

- `docs/package-dashboard.md`
- `docs/npm-publication-queue.md`
- `Recoveredd/README.md`
- dossiers racine `*-kit`
- dossiers `draft-libs/*-kit`
- mémoire automation disponible via `$CODEX_HOME/automations/fabrique-brouillons-libs/memory.md`

Libs proches trouvées:

- `http-link-header-kit`: même grande famille HTTP headers, mais cible le header `Link`, pas `Cache-Control`.
- `text-url-extract-kit`: URL dans du texte, pas headers HTTP.
- `data-url-kit`: format URL `data:`, pas cache HTTP.
- `file-extension-inspect-kit`, `numeric-unit-parse-kit`, `number-range-list-kit`, `human-duration-parse-kit`: familles explicitement rejetées car sans lien direct.

Raison de non-doublon: aucun package local ne parse ni ne formate `Cache-Control`, et la promesse utilisateur est de diagnostiquer une politique de cache HTTP, pas de gérer des liens, URL, durées, unités ou chemins.

## Concurrents et risques

- `cache-control-parser` est actif en 2026 et doit être relu avant toute promotion.
- `http-cache-semantics` couvre un problème plus large et maintenu: évaluer la cacheabilité HTTP complète. Ce brouillon doit rester explicitement plus petit.
- Risque de scope creep si on ajoute `Expires`, `Age`, `ETag`, requêtes/réponses ou règles RFC complètes.

## Nom retenu

`http-cache-control-kit`.

Justification: le nom indique le domaine (`http`), le header exact (`cache-control`) et respecte la convention locale `*-kit`. Il n'est pas une reformulation d'un package local existant et npm a répondu 404 pour ce nom pendant le run.

## API proposée

- `parseCacheControl(input, options?)`
- `formatCacheControl(values, options?)`
- `hasCacheControlDirective(result, directive)`
- `getCacheControlDeltaSeconds(result, directive)`

Diagnostics stables:

- `empty-input`
- `expected-string`
- `empty-directive`
- `invalid-directive-name`
- `missing-value`
- `duplicate-directive`
- `invalid-quoted-string`
- `invalid-delta-seconds`
- `unknown-directive`

## Browser-friendly

Le coeur utilise seulement chaînes, tableaux, objets et expressions régulières. Aucune API Node obligatoire: pas de `fs`, `path`, `node:url`, `Buffer`, `process`, modules natifs ou accès réseau.

## CLI

Pas de CLI dans ce brouillon. Une CLI pourrait valider un header depuis le terminal, mais elle n'apporte pas assez de valeur pour la version locale initiale et ajouterait une surface Node inutile.

## Ce qui manque avant publication

- Refaire une recherche concurrentielle plus large avec téléchargements disponibles.
- Comparer explicitement avec `cache-control-parser` et `cache-parser`.
- Ajouter éventuellement des fixtures issues de cas RFC recodés à la main, sans copier de tests existants.
- Décider si `unknown-directive` doit être un warning non bloquant dans `ok`.
- Relire la compatibilité exacte de `max-stale` sans valeur, qui est autorisée dans certains contextes de requête.

## Validations

- `npm install`: OK après retry réseau.
- `npm run typecheck`: OK.
- `npm test`: OK, 10 tests.
- `npm run build`: OK.
- `npm pack --dry-run`: premier essai bloqué par permissions du cache npm global (`EPERM` dans `~/.npm/_cacache`), puis OK avec `npm_config_cache=.npm-cache npm pack --dry-run`.

## État Git local

À compléter après initialisation locale. Le Git doit rester strictement local au dossier du brouillon.
