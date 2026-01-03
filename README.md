# Jellyseerr Discovery

A Jellyfin plugin that enables discovery of actor filmography and studio catalogs via Jellyseerr/TMDb.

## Features

- **Actor Filmography**: View an actor's complete filmography including movies and TV shows not yet in your library
- **Studio Catalogs**: Browse all content from a specific studio/production company with infinite scroll
- **Jellyfin Enhanced Integration**: When [Jellyfin Enhanced](https://github.com/n00bcodr/Jellyfin-Enhanced) is installed, clicking cards opens the detailed modal with ratings, cast, trailers, and request options
- **Media Status**: See availability status (Available, Requested, Processing, etc.) for each item
- **Smart Sorting**: Items without posters or release dates are pushed to the bottom
- **Card Design**: Matching Jellyfin Enhanced style with media type badges, status indicators, and collection badges

## Screenshots

Cards display with:
- Media type badge (MOVIE/SERIES) in top-left
- Availability status badge in top-right
- Collection badge at bottom (if part of a collection)
- Title, year, and star rating below the poster
- Hover overlay with description

## Requirements

- Jellyfin 10.11.0+
- Jellyseerr instance with API access
- (Recommended) [Jellyfin Enhanced](https://github.com/n00bcodr/Jellyfin-Enhanced) plugin for modal integration

## Installation

### From Repository

Add this repository URL to your Jellyfin plugin repositories:
```
https://raw.githubusercontent.com/4eh5xitv6787h645ebv/jellyseerr-discovery/main/manifest.json
```

Then install "Jellyseerr Discovery" from the plugin catalog.

### Manual Installation

1. Download the latest `JellyseerrDiscovery.zip` from [Releases](https://github.com/4eh5xitv6787h645ebv/jellyseerr-discovery/releases)
2. Extract to your Jellyfin plugins folder:
   - Linux: `/var/lib/jellyfin/plugins/Jellyseerr Discovery_<version>/`
   - Docker: `/config/data/plugins/Jellyseerr Discovery_<version>/`
3. Restart Jellyfin

## Configuration

1. Go to Jellyfin Dashboard > Plugins > Jellyseerr Discovery
2. Enter your Jellyseerr URL (e.g., `http://jellyseerr:5055` for Docker)
3. Enter your Jellyseerr API Key (found in Jellyseerr Settings > General)
4. Configure display options as desired
5. Click Save

## Usage

### Actor Pages
Navigate to any actor's details page in Jellyfin. A "More from [Actor Name]" section will appear at the bottom showing their filmography from TMDb via Jellyseerr.

### Studio Pages
Navigate to a studio's item list page. A "More from [Studio Name] on Jellyseerr" section will appear with infinite scroll support.

### Card Interactions
- **Click a card**: Opens the Jellyfin Enhanced modal (if installed) with full details, ratings, cast, and request options
- **Click collection badge**: Opens the collection request modal

## Changelog

### v1.3.0.4
- Fixed section positioning - now appears after Movies/Shows/Episodes sections
- Fixed URL pattern detection for Jellyfin routes (`#/details` vs `#!/details`)
- Added comprehensive debug logging

### v1.3.0.0
- Complete rewrite with Jellyfin Enhanced integration
- New card design matching Jellyfin Enhanced style
- Opens JE modal (`JellyfinEnhanced.jellyseerrMoreInfo.open()`) on card click
- Media type badges (MOVIE/SERIES)
- Collection badges with click support
- Status badges (available, requested, processing)

### v1.2.1.2
- Sort items without flicker - incomplete items (no poster/year) at bottom
- Insert new items in correct sorted position

### v1.2.1.1
- Fix fast scroll - check trigger visibility after load completes
- Fix flicker - only append new items instead of re-rendering

### v1.2.0.9
- Fix SPA navigation - poll for correct studio list container

### v1.2.0.7
- Fix userId timing - wait for getCurrentUserId in apiReady check

### v1.2.0.1
- Fix studio search - use dedicated `/api/v1/search/company` endpoint

## API Endpoints

All endpoints require authentication.

### Actor/Person Endpoints

#### Get Actor Filmography by TMDb ID
```
GET /JellyseerrDiscovery/person/{personId}
```

#### Search Actor by Name
```
GET /JellyseerrDiscovery/person/search?name=Bryan%20Cranston
```

### Studio/Company Endpoints

#### Search Studio by Name (with pagination)
```
GET /JellyseerrDiscovery/studio/search?name=Sony&page=1
```

### Health Check
```
GET /JellyseerrDiscovery/health
```

## Media Status Codes

| Status | Description |
|--------|-------------|
| 1 | Unknown |
| 2 | Pending (Requested) |
| 3 | Processing |
| 4 | Partially Available |
| 5 | Available |

## Building from Source

```bash
git clone https://github.com/4eh5xitv6787h645ebv/jellyseerr-discovery.git
cd jellyseerr-discovery
dotnet build -c Release
```

The output will be in `bin/Release/net9.0/`

## License

MIT License

## Credits

- [Jellyseerr](https://github.com/Fallenbagel/jellyseerr) for the request management API
- [Jellyfin Enhanced](https://github.com/n00bcodr/Jellyfin-Enhanced) for modal integration
- [TMDb](https://www.themoviedb.org/) for media metadata
