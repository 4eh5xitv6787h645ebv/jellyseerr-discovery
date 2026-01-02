using System.Net.Http.Json;
using System.Text.Json;
using JellyseerrDiscovery.Models;
using Microsoft.Extensions.Logging;

namespace JellyseerrDiscovery.Services;

public interface IJellyseerrService
{
    /// <summary>
    /// Get person details by TMDb ID
    /// </summary>
    Task<PersonDetails?> GetPersonAsync(int personId);

    /// <summary>
    /// Get combined credits (movies and TV) for a person
    /// </summary>
    Task<PersonCredits?> GetPersonCreditsAsync(int personId);

    /// <summary>
    /// Get person details with credits
    /// </summary>
    Task<(PersonDetails? Person, List<DiscoveryItem> Credits)> GetPersonWithCreditsAsync(int personId);

    /// <summary>
    /// Get studio/company details by TMDb ID
    /// </summary>
    Task<StudioDetails?> GetStudioAsync(int studioId);

    /// <summary>
    /// Discover movies by studio/company
    /// </summary>
    Task<DiscoveryResponse?> DiscoverByStudioAsync(int studioId, int page = 1);

    /// <summary>
    /// Discover TV shows by network
    /// </summary>
    Task<DiscoveryResponse?> DiscoverByNetworkAsync(int networkId, int page = 1);

    /// <summary>
    /// Search for a person by name
    /// </summary>
    Task<List<PersonDetails>> SearchPersonAsync(string query);

    /// <summary>
    /// Search for a studio/company by name
    /// </summary>
    Task<List<StudioDetails>> SearchStudioAsync(string query);

    /// <summary>
    /// Search for network by name and return network ID if found
    /// </summary>
    Task<int?> FindNetworkIdByNameAsync(string name);

    /// <summary>
    /// Test connection to Jellyseerr
    /// </summary>
    Task<bool> TestConnectionAsync();
}

public class JellyseerrService : IJellyseerrService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<JellyseerrService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    // Common TV networks mapped to TMDb network IDs
    private static readonly Dictionary<string, int> KnownNetworks = new(StringComparer.OrdinalIgnoreCase)
    {
        { "The CW", 71 },
        { "CW", 71 },
        { "NBC", 6 },
        { "CBS", 16 },
        { "ABC", 2 },
        { "Fox", 19 },
        { "HBO", 49 },
        { "HBO Max", 3186 },
        { "Netflix", 213 },
        { "Amazon", 1024 },
        { "Prime Video", 1024 },
        { "Amazon Prime Video", 1024 },
        { "Hulu", 453 },
        { "Disney+", 2739 },
        { "Disney Plus", 2739 },
        { "Apple TV+", 2552 },
        { "Apple TV Plus", 2552 },
        { "Peacock", 3353 },
        { "Paramount+", 4330 },
        { "Paramount Plus", 4330 },
        { "Showtime", 67 },
        { "Starz", 318 },
        { "AMC", 174 },
        { "FX", 88 },
        { "USA Network", 30 },
        { "TNT", 41 },
        { "TBS", 32 },
        { "Syfy", 77 },
        { "Freeform", 1267 },
        { "BBC One", 4 },
        { "BBC Two", 332 },
        { "BBC", 4 },
        { "ITV", 9 },
        { "Channel 4", 26 },
        { "Sky", 1063 },
        { "Sky Atlantic", 1063 },
        { "Cartoon Network", 56 },
        { "Adult Swim", 80 },
        { "Comedy Central", 47 },
        { "MTV", 33 },
        { "Nickelodeon", 13 },
        { "Discovery", 64 },
        { "History", 65 },
        { "National Geographic", 43 },
        { "ESPN", 29 },
        { "Bravo", 74 },
        { "Lifetime", 34 },
        { "A&E", 129 },
        { "Hallmark", 384 },
        { "Hallmark Channel", 384 },
        { "Crunchyroll", 1112 },
        { "Max", 3186 },
    };

    public JellyseerrService(HttpClient httpClient, ILogger<JellyseerrService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    private PluginConfiguration Config => Plugin.Instance?.Configuration ?? new PluginConfiguration();

    private Uri BaseUri
    {
        get
        {
            var baseUrl = Config.JellyseerrUrl?.Trim();
            if (string.IsNullOrEmpty(baseUrl))
            {
                throw new InvalidOperationException("Jellyseerr URL is not configured");
            }

            if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri) ||
                (baseUri.Scheme != Uri.UriSchemeHttp && baseUri.Scheme != Uri.UriSchemeHttps))
            {
                throw new InvalidOperationException("Jellyseerr URL must be a valid http or https address");
            }

            return baseUri;
        }
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string endpoint)
    {
        var request = new HttpRequestMessage(method, new Uri(BaseUri, endpoint));

        if (!string.IsNullOrEmpty(Config.JellyseerrApiKey))
        {
            request.Headers.Add("X-Api-Key", Config.JellyseerrApiKey);
        }

        return request;
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            using var request = CreateRequest(HttpMethod.Get, "/api/v1/status");
            using var response = await _httpClient.SendAsync(request);
            _logger.LogInformation("Jellyseerr connection test: {StatusCode}", response.StatusCode);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Jellyseerr connection test failed");
            return false;
        }
    }

    public async Task<PersonDetails?> GetPersonAsync(int personId)
    {
        try
        {
            using var request = CreateRequest(HttpMethod.Get, $"/api/v1/person/{personId}");
            using var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get person {PersonId}: {StatusCode}", personId, response.StatusCode);
                return null;
            }

            return await response.Content.ReadFromJsonAsync<PersonDetails>(JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting person {PersonId}", personId);
            return null;
        }
    }

    public async Task<PersonCredits?> GetPersonCreditsAsync(int personId)
    {
        try
        {
            using var request = CreateRequest(HttpMethod.Get, $"/api/v1/person/{personId}/combined_credits");
            using var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get person credits {PersonId}: {StatusCode}", personId, response.StatusCode);
                return null;
            }

            return await response.Content.ReadFromJsonAsync<PersonCredits>(JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting person credits {PersonId}", personId);
            return null;
        }
    }

    public async Task<(PersonDetails? Person, List<DiscoveryItem> Credits)> GetPersonWithCreditsAsync(int personId)
    {
        var personTask = GetPersonAsync(personId);
        var creditsTask = GetPersonCreditsAsync(personId);

        await Task.WhenAll(personTask, creditsTask);

        var person = await personTask;
        var credits = await creditsTask;

        var allCredits = new List<DiscoveryItem>();

        if (credits != null)
        {
            // Add cast credits
            foreach (var item in credits.Cast)
            {
                item.MediaType = string.IsNullOrEmpty(item.Title) ? "tv" : "movie";
                allCredits.Add(item);
            }

            // Add crew credits (director, producer, etc.) if it's their known department
            if (person?.KnownForDepartment != "Acting")
            {
                foreach (var item in credits.Crew)
                {
                    item.MediaType = string.IsNullOrEmpty(item.Title) ? "tv" : "movie";
                    // Avoid duplicates
                    if (!allCredits.Any(c => c.TmdbId == item.TmdbId && c.MediaType == item.MediaType))
                    {
                        allCredits.Add(item);
                    }
                }
            }
        }

        // Sort by popularity/vote count
        allCredits = allCredits
            .OrderByDescending(c => c.Popularity ?? 0)
            .ThenByDescending(c => c.VoteCount ?? 0)
            .ToList();

        // Apply max results limit
        if (Config.MaxResults > 0 && allCredits.Count > Config.MaxResults)
        {
            allCredits = allCredits.Take(Config.MaxResults).ToList();
        }

        return (person, allCredits);
    }

    public async Task<StudioDetails?> GetStudioAsync(int studioId)
    {
        try
        {
            using var request = CreateRequest(HttpMethod.Get, $"/api/v1/studio/{studioId}");
            using var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get studio {StudioId}: {StatusCode}", studioId, response.StatusCode);
                return null;
            }

            return await response.Content.ReadFromJsonAsync<StudioDetails>(JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting studio {StudioId}", studioId);
            return null;
        }
    }

    public async Task<DiscoveryResponse?> DiscoverByStudioAsync(int studioId, int page = 1)
    {
        try
        {
            using var request = CreateRequest(HttpMethod.Get, $"/api/v1/discover/movies?page={page}&studio={studioId}");
            using var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to discover by studio {StudioId}: {StatusCode}", studioId, response.StatusCode);
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<DiscoveryResponse>(JsonOptions);

            if (result?.Results != null)
            {
                foreach (var item in result.Results)
                {
                    item.MediaType = "movie";
                }
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error discovering by studio {StudioId}", studioId);
            return null;
        }
    }

    public async Task<DiscoveryResponse?> DiscoverByNetworkAsync(int networkId, int page = 1)
    {
        try
        {
            using var request = CreateRequest(HttpMethod.Get, $"/api/v1/discover/tv?page={page}&network={networkId}");
            using var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to discover by network {NetworkId}: {StatusCode}", networkId, response.StatusCode);
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<DiscoveryResponse>(JsonOptions);

            if (result?.Results != null)
            {
                foreach (var item in result.Results)
                {
                    item.MediaType = "tv";
                }
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error discovering by network {NetworkId}", networkId);
            return null;
        }
    }

    public async Task<List<PersonDetails>> SearchPersonAsync(string query)
    {
        try
        {
            using var request = CreateRequest(HttpMethod.Get, $"/api/v1/search?query={Uri.EscapeDataString(query)}&page=1");
            using var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to search person: {StatusCode}", response.StatusCode);
                return new List<PersonDetails>();
            }

            // The search endpoint returns mixed results, we need to filter for people
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            var results = new List<PersonDetails>();
            if (doc.RootElement.TryGetProperty("results", out var resultsArray))
            {
                foreach (var item in resultsArray.EnumerateArray())
                {
                    if (item.TryGetProperty("mediaType", out var mediaType) &&
                        mediaType.GetString() == "person")
                    {
                        var person = item.Deserialize<PersonDetails>(JsonOptions);
                        if (person != null)
                        {
                            results.Add(person);
                        }
                    }
                }
            }

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching for person: {Query}", query);
            return new List<PersonDetails>();
        }
    }

    public async Task<List<StudioDetails>> SearchStudioAsync(string query)
    {
        try
        {
            // Use the dedicated company search endpoint - multi-search doesn't return companies
            using var request = CreateRequest(HttpMethod.Get, $"/api/v1/search/company?query={Uri.EscapeDataString(query)}");
            using var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to search studio: {StatusCode}", response.StatusCode);
                return new List<StudioDetails>();
            }

            var json = await response.Content.ReadAsStringAsync();
            _logger.LogDebug("Studio search response: {Json}", json);

            using var doc = JsonDocument.Parse(json);

            var results = new List<StudioDetails>();
            if (doc.RootElement.TryGetProperty("results", out var resultsArray))
            {
                foreach (var item in resultsArray.EnumerateArray())
                {
                    var studio = item.Deserialize<StudioDetails>(JsonOptions);
                    if (studio != null)
                    {
                        results.Add(studio);
                    }
                }
            }

            _logger.LogInformation("Found {Count} studios for query '{Query}'", results.Count, query);
            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching for studio: {Query}", query);
            return new List<StudioDetails>();
        }
    }

    public Task<int?> FindNetworkIdByNameAsync(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Task.FromResult<int?>(null);
        }

        // Try exact match first
        if (KnownNetworks.TryGetValue(name, out var networkId))
        {
            _logger.LogInformation("Found network ID {NetworkId} for '{Name}'", networkId, name);
            return Task.FromResult<int?>(networkId);
        }

        // Try partial match
        var matchingKey = KnownNetworks.Keys
            .FirstOrDefault(k => name.Contains(k, StringComparison.OrdinalIgnoreCase) ||
                                 k.Contains(name, StringComparison.OrdinalIgnoreCase));

        if (matchingKey != null)
        {
            var id = KnownNetworks[matchingKey];
            _logger.LogInformation("Found network ID {NetworkId} for '{Name}' via partial match '{MatchedKey}'", id, name, matchingKey);
            return Task.FromResult<int?>(id);
        }

        _logger.LogDebug("No network ID found for '{Name}'", name);
        return Task.FromResult<int?>(null);
    }
}
