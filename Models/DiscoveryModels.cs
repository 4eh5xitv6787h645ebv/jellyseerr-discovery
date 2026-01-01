using System.Text.Json.Serialization;

namespace JellyseerrDiscovery.Models;

/// <summary>
/// Response from the discovery endpoint
/// </summary>
public class DiscoveryResponse
{
    [JsonPropertyName("results")]
    public List<DiscoveryItem> Results { get; set; } = new();

    [JsonPropertyName("page")]
    public int Page { get; set; } = 1;

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; } = 1;

    [JsonPropertyName("totalResults")]
    public int TotalResults { get; set; } = 0;
}

/// <summary>
/// A discoverable media item (movie or TV show)
/// </summary>
public class DiscoveryItem
{
    [JsonPropertyName("id")]
    public int TmdbId { get; set; }

    [JsonPropertyName("mediaType")]
    public string MediaType { get; set; } = "movie";

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("originalTitle")]
    public string? OriginalTitle { get; set; }

    [JsonPropertyName("originalName")]
    public string? OriginalName { get; set; }

    [JsonPropertyName("overview")]
    public string? Overview { get; set; }

    [JsonPropertyName("posterPath")]
    public string? PosterPath { get; set; }

    [JsonPropertyName("backdropPath")]
    public string? BackdropPath { get; set; }

    [JsonPropertyName("releaseDate")]
    public string? ReleaseDate { get; set; }

    [JsonPropertyName("firstAirDate")]
    public string? FirstAirDate { get; set; }

    [JsonPropertyName("voteAverage")]
    public double? VoteAverage { get; set; }

    [JsonPropertyName("voteCount")]
    public int? VoteCount { get; set; }

    [JsonPropertyName("popularity")]
    public double? Popularity { get; set; }

    [JsonPropertyName("genreIds")]
    public List<int>? GenreIds { get; set; }

    [JsonPropertyName("mediaInfo")]
    public MediaInfo? MediaInfo { get; set; }

    /// <summary>
    /// The character name if this is from an actor's filmography
    /// </summary>
    [JsonPropertyName("character")]
    public string? Character { get; set; }

    /// <summary>
    /// The department (e.g., "Acting", "Directing") for crew
    /// </summary>
    [JsonPropertyName("department")]
    public string? Department { get; set; }

    /// <summary>
    /// The job title for crew (e.g., "Director", "Producer")
    /// </summary>
    [JsonPropertyName("job")]
    public string? Job { get; set; }

    /// <summary>
    /// Helper to get the display title
    /// </summary>
    [JsonIgnore]
    public string DisplayTitle => Title ?? Name ?? OriginalTitle ?? OriginalName ?? "Unknown";

    /// <summary>
    /// Helper to get the release year
    /// </summary>
    [JsonIgnore]
    public string? ReleaseYear => (ReleaseDate ?? FirstAirDate)?.Split('-').FirstOrDefault();
}

/// <summary>
/// Media info from Jellyseerr (availability status)
/// </summary>
public class MediaInfo
{
    [JsonPropertyName("id")]
    public int? Id { get; set; }

    [JsonPropertyName("tmdbId")]
    public int? TmdbId { get; set; }

    [JsonPropertyName("status")]
    public int Status { get; set; }

    [JsonPropertyName("requests")]
    public List<RequestInfo>? Requests { get; set; }

    /// <summary>
    /// Status codes:
    /// 1 = Unknown
    /// 2 = Pending
    /// 3 = Processing
    /// 4 = Partially Available
    /// 5 = Available
    /// </summary>
    [JsonIgnore]
    public string StatusText => Status switch
    {
        1 => "Unknown",
        2 => "Pending",
        3 => "Processing",
        4 => "Partially Available",
        5 => "Available",
        _ => "Unknown"
    };

    [JsonIgnore]
    public bool IsAvailable => Status == 5;

    [JsonIgnore]
    public bool IsRequested => Status >= 2 && Status <= 4;
}

/// <summary>
/// Request info
/// </summary>
public class RequestInfo
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("status")]
    public int Status { get; set; }
}

/// <summary>
/// Person (actor/crew) details
/// </summary>
public class PersonDetails
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("biography")]
    public string? Biography { get; set; }

    [JsonPropertyName("birthday")]
    public string? Birthday { get; set; }

    [JsonPropertyName("deathday")]
    public string? Deathday { get; set; }

    [JsonPropertyName("placeOfBirth")]
    public string? PlaceOfBirth { get; set; }

    [JsonPropertyName("profilePath")]
    public string? ProfilePath { get; set; }

    [JsonPropertyName("knownForDepartment")]
    public string? KnownForDepartment { get; set; }
}

/// <summary>
/// Person combined credits (movies and TV)
/// </summary>
public class PersonCredits
{
    [JsonPropertyName("cast")]
    public List<DiscoveryItem> Cast { get; set; } = new();

    [JsonPropertyName("crew")]
    public List<DiscoveryItem> Crew { get; set; } = new();
}

/// <summary>
/// Studio/Company details
/// </summary>
public class StudioDetails
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("headquarters")]
    public string? Headquarters { get; set; }

    [JsonPropertyName("homepage")]
    public string? Homepage { get; set; }

    [JsonPropertyName("logoPath")]
    public string? LogoPath { get; set; }

    [JsonPropertyName("originCountry")]
    public string? OriginCountry { get; set; }

    [JsonPropertyName("parentCompany")]
    public StudioDetails? ParentCompany { get; set; }
}
