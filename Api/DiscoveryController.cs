using System.ComponentModel.DataAnnotations;
using System.Reflection;
using JellyseerrDiscovery.Models;
using JellyseerrDiscovery.Services;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace JellyseerrDiscovery.Api;

/// <summary>
/// API controller for Jellyseerr Discovery endpoints.
/// </summary>
[ApiController]
[Route("JellyseerrDiscovery")]
[Authorize]
public class DiscoveryController : ControllerBase
{
    private readonly IJellyseerrService _jellyseerrService;
    private readonly ILibraryManager _libraryManager;
    private readonly ILogger<DiscoveryController> _logger;

    public DiscoveryController(
        IJellyseerrService jellyseerrService,
        ILibraryManager libraryManager,
        ILogger<DiscoveryController> logger)
    {
        _jellyseerrService = jellyseerrService;
        _libraryManager = libraryManager;
        _logger = logger;
    }

    private PluginConfiguration Config => Plugin.Instance?.Configuration ?? new PluginConfiguration();

    /// <summary>
    /// Get an actor's filmography from Jellyseerr/TMDb.
    /// </summary>
    /// <param name="personId">The TMDb person ID.</param>
    /// <returns>Person details and their filmography.</returns>
    [HttpGet("person/{personId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<PersonDiscoveryResponse>> GetPersonFilmography([Required] int personId)
    {
        if (!Config.Enabled)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Jellyseerr Discovery is disabled");
        }

        _logger.LogInformation("Getting filmography for person {PersonId}", personId);

        var (person, cast, crew) = await _jellyseerrService.GetPersonWithCreditsAsync(personId);

        if (person == null)
        {
            return NotFound($"Person with ID {personId} not found");
        }

        // Filter based on config
        if (!Config.IncludeLibraryItems)
        {
            cast = cast.Where(c => c.MediaInfo?.IsAvailable != true).ToList();
            crew = crew.Where(c => c.MediaInfo?.IsAvailable != true).ToList();
        }

        // Combined credits for backwards compatibility
        var allCredits = cast.Concat(crew).ToList();

        return Ok(new PersonDiscoveryResponse
        {
            Person = person,
            Credits = allCredits,
            Cast = cast,
            Crew = crew,
            TotalResults = allCredits.Count
        });
    }

    /// <summary>
    /// Get an actor's filmography by searching their name.
    /// </summary>
    /// <param name="name">The actor's name.</param>
    /// <returns>Person details and their filmography.</returns>
    [HttpGet("person/search")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<PersonDiscoveryResponse>> SearchPersonFilmography([Required] string name)
    {
        if (!Config.Enabled)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Jellyseerr Discovery is disabled");
        }

        _logger.LogInformation("Searching for person: {Name}", name);

        // First, search for the person
        var people = await _jellyseerrService.SearchPersonAsync(name);

        if (people.Count == 0)
        {
            return NotFound($"No person found matching '{name}'");
        }

        // Get the first (best) match
        var bestMatch = people.First();

        // Now get their filmography
        var (person, cast, crew) = await _jellyseerrService.GetPersonWithCreditsAsync(bestMatch.Id);

        if (person == null)
        {
            return NotFound($"Could not retrieve filmography for {bestMatch.Name}");
        }

        // Filter based on config
        if (!Config.IncludeLibraryItems)
        {
            cast = cast.Where(c => c.MediaInfo?.IsAvailable != true).ToList();
            crew = crew.Where(c => c.MediaInfo?.IsAvailable != true).ToList();
        }

        // Combined credits for backwards compatibility
        var allCredits = cast.Concat(crew).ToList();

        return Ok(new PersonDiscoveryResponse
        {
            Person = person,
            Credits = allCredits,
            Cast = cast,
            Crew = crew,
            TotalResults = allCredits.Count
        });
    }

    /// <summary>
    /// Get a studio's catalog from Jellyseerr/TMDb.
    /// </summary>
    /// <param name="studioId">The TMDb company/studio ID.</param>
    /// <param name="page">Page number for pagination.</param>
    /// <returns>Studio details and their catalog.</returns>
    [HttpGet("studio/{studioId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<StudioDiscoveryResponse>> GetStudioCatalog(
        [Required] int studioId,
        [FromQuery] int page = 1)
    {
        if (!Config.Enabled)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Jellyseerr Discovery is disabled");
        }

        _logger.LogInformation("Getting catalog for studio {StudioId}, page {Page}", studioId, page);

        var studioTask = _jellyseerrService.GetStudioAsync(studioId);
        var catalogTask = _jellyseerrService.DiscoverByStudioAsync(studioId, page);

        await Task.WhenAll(studioTask, catalogTask);

        var studio = await studioTask;
        var catalog = await catalogTask;

        if (studio == null && catalog == null)
        {
            return NotFound($"Studio with ID {studioId} not found");
        }

        var items = catalog?.Results ?? new List<DiscoveryItem>();

        // Filter based on config
        if (!Config.IncludeLibraryItems)
        {
            items = items.Where(c => c.MediaInfo?.IsAvailable != true).ToList();
        }

        return Ok(new StudioDiscoveryResponse
        {
            Studio = studio,
            Items = items,
            Page = catalog?.Page ?? 1,
            TotalPages = catalog?.TotalPages ?? 1,
            TotalResults = catalog?.TotalResults ?? items.Count
        });
    }

    /// <summary>
    /// Get a TV network's catalog from Jellyseerr/TMDb.
    /// </summary>
    /// <param name="networkId">The TMDb network ID.</param>
    /// <param name="page">Page number for pagination.</param>
    /// <returns>Network catalog.</returns>
    [HttpGet("network/{networkId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<StudioDiscoveryResponse>> GetNetworkCatalog(
        [Required] int networkId,
        [FromQuery] int page = 1)
    {
        if (!Config.Enabled)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Jellyseerr Discovery is disabled");
        }

        _logger.LogInformation("Getting catalog for network {NetworkId}, page {Page}", networkId, page);

        var catalog = await _jellyseerrService.DiscoverByNetworkAsync(networkId, page);

        if (catalog == null)
        {
            return NotFound($"Network with ID {networkId} not found");
        }

        var items = catalog.Results;

        // Filter based on config
        if (!Config.IncludeLibraryItems)
        {
            items = items.Where(c => c.MediaInfo?.IsAvailable != true).ToList();
        }

        return Ok(new StudioDiscoveryResponse
        {
            Studio = null,
            Items = items,
            Page = catalog.Page,
            TotalPages = catalog.TotalPages,
            TotalResults = catalog.TotalResults
        });
    }

    /// <summary>
    /// Search for a studio by name and get its catalog.
    /// Also checks if the name matches a known TV network and includes those results.
    /// </summary>
    /// <param name="name">The studio/network name.</param>
    /// <param name="page">Page number for pagination.</param>
    /// <returns>Studio details and catalog.</returns>
    [HttpGet("studio/search")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<StudioDiscoveryResponse>> SearchStudioCatalog(
        [Required] string name,
        [FromQuery] int page = 1)
    {
        if (!Config.Enabled)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Jellyseerr Discovery is disabled");
        }

        _logger.LogInformation("Searching for studio/network: {Name}", name);

        var allItems = new List<DiscoveryItem>();
        StudioDetails? studio = null;
        int totalResults = 0;
        int totalPages = 1;

        // Check if this is a known TV network
        var networkId = await _jellyseerrService.FindNetworkIdByNameAsync(name);
        if (networkId.HasValue)
        {
            _logger.LogInformation("Found network ID {NetworkId} for '{Name}', fetching TV shows", networkId.Value, name);
            var networkCatalog = await _jellyseerrService.DiscoverByNetworkAsync(networkId.Value, page);
            if (networkCatalog?.Results != null)
            {
                allItems.AddRange(networkCatalog.Results);
                totalResults = networkCatalog.TotalResults;
                totalPages = networkCatalog.TotalPages;
            }

            // Create a pseudo-studio for the network
            studio = new StudioDetails
            {
                Id = networkId.Value,
                Name = name
            };
        }

        // Also search for studio/company
        var studios = await _jellyseerrService.SearchStudioAsync(name);
        if (studios.Count > 0)
        {
            var bestMatch = studios.First();
            studio ??= bestMatch;

            var catalog = await _jellyseerrService.DiscoverByStudioAsync(bestMatch.Id, page);
            if (catalog?.Results != null)
            {
                // Add studio results, avoiding duplicates
                var existingIds = allItems.Select(i => $"{i.MediaType}-{i.TmdbId}").ToHashSet();
                foreach (var item in catalog.Results)
                {
                    var key = $"{item.MediaType}-{item.TmdbId}";
                    if (!existingIds.Contains(key))
                    {
                        allItems.Add(item);
                        existingIds.Add(key);
                    }
                }

                if (totalResults == 0)
                {
                    totalResults = catalog.TotalResults;
                    totalPages = catalog.TotalPages;
                }
            }
        }

        if (allItems.Count == 0 && studio == null)
        {
            return NotFound($"No studio or network found matching '{name}'");
        }

        // Filter based on config
        if (!Config.IncludeLibraryItems)
        {
            allItems = allItems.Where(c => c.MediaInfo?.IsAvailable != true).ToList();
        }

        // Sort by popularity
        allItems = allItems.OrderByDescending(i => i.Popularity ?? 0).ToList();

        return Ok(new StudioDiscoveryResponse
        {
            Studio = studio,
            Items = allItems,
            Page = page,
            TotalPages = totalPages,
            TotalResults = totalResults > 0 ? totalResults : allItems.Count
        });
    }

    /// <summary>
    /// Health check endpoint.
    /// </summary>
    [HttpGet("health")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<HealthCheckResponse>> HealthCheck()
    {
        var isConnected = false;
        var errorMessage = string.Empty;

        if (!string.IsNullOrEmpty(Config.JellyseerrUrl))
        {
            try
            {
                isConnected = await _jellyseerrService.TestConnectionAsync();
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                _logger.LogError(ex, "Health check failed");
            }
        }

        return Ok(new HealthCheckResponse
        {
            Status = isConnected ? "ok" : "error",
            Enabled = Config.Enabled,
            JellyseerrConfigured = !string.IsNullOrEmpty(Config.JellyseerrUrl),
            JellyseerrConnected = isConnected,
            ErrorMessage = errorMessage,
            Version = typeof(Plugin).Assembly.GetName().Version?.ToString() ?? "1.0.0",
            ExcludeTalkShows = Config.ExcludeTalkShows,
            DebugMode = Config.DebugMode
        });
    }

    /// <summary>
    /// Get the client-side JavaScript for the discovery feature.
    /// </summary>
    [HttpGet("script")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult GetScript()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = "JellyseerrDiscovery.js.discovery.js";
        var stream = assembly.GetManifestResourceStream(resourceName);

        if (stream == null)
        {
            _logger.LogWarning("Could not find embedded resource: {ResourceName}", resourceName);
            return NotFound();
        }

        return new FileStreamResult(stream, "application/javascript");
    }

    /// <summary>
    /// Get the plugin configuration for the client-side JavaScript.
    /// </summary>
    [HttpGet("config")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<ClientConfigResponse> GetClientConfig()
    {
        return Ok(new ClientConfigResponse
        {
            Enabled = Config.Enabled,
            JellyseerrUrl = Config.JellyseerrUrl,
            ExcludeTalkShows = Config.ExcludeTalkShows,
            DebugMode = Config.DebugMode,
            ShowPersonDiscovery = Config.ShowPersonDiscovery,
            ShowCastCredits = Config.ShowCastCredits,
            ShowCrewCredits = Config.ShowCrewCredits,
            ShowStudioDiscovery = Config.ShowStudioDiscovery,
            EnableInfiniteScroll = Config.EnableInfiniteScroll,
            ShowMediaStatus = Config.ShowMediaStatus,
            ShowMediaTypeBadge = Config.ShowMediaTypeBadge,
            ShowRatings = Config.ShowRatings,
            ShowYear = Config.ShowYear,
            ShowOverviewOnHover = Config.ShowOverviewOnHover,
            ShowCollectionBadge = Config.ShowCollectionBadge,
            ShowRoleName = Config.ShowRoleName
        });
    }
}

/// <summary>
/// Client-side configuration response.
/// </summary>
public class ClientConfigResponse
{
    public bool Enabled { get; set; }
    public string? JellyseerrUrl { get; set; }
    public bool ExcludeTalkShows { get; set; }
    public bool DebugMode { get; set; }
    public bool ShowPersonDiscovery { get; set; }
    public bool ShowCastCredits { get; set; }
    public bool ShowCrewCredits { get; set; }
    public bool ShowStudioDiscovery { get; set; }
    public bool EnableInfiniteScroll { get; set; }
    public bool ShowMediaStatus { get; set; }
    public bool ShowMediaTypeBadge { get; set; }
    public bool ShowRatings { get; set; }
    public bool ShowYear { get; set; }
    public bool ShowOverviewOnHover { get; set; }
    public bool ShowCollectionBadge { get; set; }
    public bool ShowRoleName { get; set; }
}

/// <summary>
/// Response for person discovery endpoint.
/// </summary>
public class PersonDiscoveryResponse
{
    public PersonDetails? Person { get; set; }
    public List<DiscoveryItem> Credits { get; set; } = new();
    public List<DiscoveryItem> Cast { get; set; } = new();
    public List<DiscoveryItem> Crew { get; set; } = new();
    public int TotalResults { get; set; }
}

/// <summary>
/// Response for studio discovery endpoint.
/// </summary>
public class StudioDiscoveryResponse
{
    public StudioDetails? Studio { get; set; }
    public List<DiscoveryItem> Items { get; set; } = new();
    public int Page { get; set; } = 1;
    public int TotalPages { get; set; } = 1;
    public int TotalResults { get; set; }
}

/// <summary>
/// Health check response.
/// </summary>
public class HealthCheckResponse
{
    public string Status { get; set; } = "ok";
    public bool Enabled { get; set; }
    public bool JellyseerrConfigured { get; set; }
    public bool JellyseerrConnected { get; set; }
    public string? ErrorMessage { get; set; }
    public string Version { get; set; } = "1.0.0";
    public bool ExcludeTalkShows { get; set; } = true;
    public bool DebugMode { get; set; } = false;
}
