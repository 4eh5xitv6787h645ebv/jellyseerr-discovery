# Jellyseerr Discovery

A Jellyfin plugin that enables discovery of actor filmography and studio catalogs via Jellyseerr/TMDb.

## Features

- **Actor Filmography**: View an actor's complete filmography including movies and TV shows not yet in your library
- **Studio Catalogs**: Browse all content from a specific studio/production company
- **Network Catalogs**: Browse all TV shows from a specific network
- **Media Status**: See availability status (Available, Requested, Processing, etc.) for each item
- **Request Integration**: Items can be requested through Jellyseerr

## Installation

### From Repository

Add this repository URL to your Jellyfin plugin repositories:
```
https://raw.githubusercontent.com/4eh5xitv6787h645ebv/jellyseerr-discovery/main/manifest.json
```

Then install "Jellyseerr Discovery" from the plugin catalog.

### Manual Installation

1. Download the latest `JellyseerrDiscovery.dll` from [Releases](https://github.com/4eh5xitv6787h645ebv/jellyseerr-discovery/releases)
2. Copy to your Jellyfin plugins folder:
   - Linux: `/var/lib/jellyfin/plugins/Jellyseerr Discovery_1.0.0.0/`
   - Docker: `/config/data/plugins/Jellyseerr Discovery_1.0.0.0/`
3. Restart Jellyfin

## Configuration

1. Go to Jellyfin Dashboard > Plugins > Jellyseerr Discovery
2. Enter your Jellyseerr URL (e.g., `http://jellyseerr:5055` for Docker)
3. Enter your Jellyseerr API Key (found in Jellyseerr Settings > General)
4. Configure display options as desired
5. Click Save

## API Endpoints

All endpoints require authentication.

### Actor/Person Endpoints

#### Get Actor Filmography by TMDb ID
```
GET /JellyseerrDiscovery/person/{personId}
```

**Response:**
```json
{
  "person": {
    "id": 17419,
    "name": "Bryan Cranston",
    "biography": "...",
    "profilePath": "/7Jahy5LZX2Fo8fGJltMreAI49hC.jpg"
  },
  "credits": [
    {
      "id": 1396,
      "mediaType": "tv",
      "name": "Breaking Bad",
      "character": "Walter White",
      "posterPath": "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      "voteAverage": 9.5,
      "mediaInfo": {
        "status": 5,
        "statusText": "Available"
      }
    }
  ],
  "totalResults": 87
}
```

#### Search Actor by Name
```
GET /JellyseerrDiscovery/person/search?name=Bryan%20Cranston
```

### Studio/Company Endpoints

#### Get Studio Catalog by TMDb ID
```
GET /JellyseerrDiscovery/studio/{studioId}?page=1
```

**Response:**
```json
{
  "studio": {
    "id": 7505,
    "name": "Sony Pictures",
    "logoPath": "/...",
    "originCountry": "US"
  },
  "items": [
    {
      "id": 634649,
      "mediaType": "movie",
      "title": "Spider-Man: No Way Home",
      "posterPath": "/...",
      "voteAverage": 8.0,
      "mediaInfo": {
        "status": 5
      }
    }
  ],
  "page": 1,
  "totalPages": 50,
  "totalResults": 1000
}
```

#### Search Studio by Name
```
GET /JellyseerrDiscovery/studio/search?name=Sony&page=1
```

### Network Endpoints (TV Shows)

#### Get Network Catalog by TMDb ID
```
GET /JellyseerrDiscovery/network/{networkId}?page=1
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

## Use Cases

### For Plethorafin Android TV App

This plugin provides the backend API for displaying actor filmography and studio catalogs in the Plethorafin Android TV app. When a user clicks on an actor or studio, the app can call these endpoints to show related content.

### Example Integration

```kotlin
// Get actor filmography
val response = api.get("/JellyseerrDiscovery/person/17419")
val filmography = response.body<PersonDiscoveryResponse>()

// Display results with request status
filmography.credits.forEach { item ->
    println("${item.displayTitle} - ${item.mediaInfo?.statusText}")
}
```

## Building from Source

```bash
cd JellyseerrDiscovery
dotnet build -c Release
```

The DLL will be in `bin/Release/net9.0/JellyseerrDiscovery.dll`

## License

MIT License
