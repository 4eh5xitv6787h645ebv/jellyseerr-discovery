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

    public JellyseerrService(HttpClient httpClient, ILogger<JellyseerrService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    private PluginConfiguration Config => Plugin.Instance?.Configuration ?? new PluginConfiguration();

    private void ConfigureClient()
    {
        if (string.IsNullOrEmpty(Config.JellyseerrUrl))
        {
            throw new InvalidOperationException("Jellyseerr URL is not configured");
        }

        _httpClient.BaseAddress = new Uri(Config.JellyseerrUrl.TrimEnd('/'));

        if (!string.IsNullOrEmpty(Config.JellyseerrApiKey))
        {
            _httpClient.DefaultRequestHeaders.Remove("X-Api-Key");
            _httpClient.DefaultRequestHeaders.Add("X-Api-Key", Config.JellyseerrApiKey);
        }
    }

    public async Task<PersonDetails?> GetPersonAsync(int personId)
    {
        try
        {
            ConfigureClient();
            var response = await _httpClient.GetAsync($"/api/v1/person/{personId}");

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
            ConfigureClient();
            var response = await _httpClient.GetAsync($"/api/v1/person/{personId}/combined_credits");

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
            ConfigureClient();
            // Jellyseerr proxies TMDb, so we query the company endpoint
            var response = await _httpClient.GetAsync($"/api/v1/studio/{studioId}");

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
            ConfigureClient();
            var response = await _httpClient.GetAsync($"/api/v1/discover/movies?page={page}&studio={studioId}");

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
            ConfigureClient();
            var response = await _httpClient.GetAsync($"/api/v1/discover/tv?page={page}&network={networkId}");

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
            ConfigureClient();
            var response = await _httpClient.GetAsync($"/api/v1/search?query={Uri.EscapeDataString(query)}&page=1");

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
            ConfigureClient();
            var response = await _httpClient.GetAsync($"/api/v1/search/company?query={Uri.EscapeDataString(query)}");

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to search studio: {StatusCode}", response.StatusCode);
                return new List<StudioDetails>();
            }

            var json = await response.Content.ReadAsStringAsync();
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

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching for studio: {Query}", query);
            return new List<StudioDetails>();
        }
    }
}
