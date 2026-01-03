using MediaBrowser.Model.Plugins;

namespace JellyseerrDiscovery;

public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Gets or sets the Jellyseerr server URL.
    /// </summary>
    public string JellyseerrUrl { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Jellyseerr API key.
    /// </summary>
    public string JellyseerrApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets whether the plugin is enabled.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Gets or sets the maximum number of results to return per query.
    /// </summary>
    public int MaxResults { get; set; } = 50;

    /// <summary>
    /// Gets or sets whether to include items already in the library.
    /// </summary>
    public bool IncludeLibraryItems { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to show the media status (available, requested, etc).
    /// </summary>
    public bool ShowMediaStatus { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to exclude talk shows and award shows from results.
    /// </summary>
    public bool ExcludeTalkShows { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to enable debug logging in the browser console.
    /// </summary>
    public bool DebugMode { get; set; } = false;

    // === Person Page Settings ===

    /// <summary>
    /// Gets or sets whether to show discovery on person/actor pages.
    /// </summary>
    public bool ShowPersonDiscovery { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to show the Appearances (cast credits) section.
    /// </summary>
    public bool ShowCastCredits { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to show the Crew credits section.
    /// </summary>
    public bool ShowCrewCredits { get; set; } = true;

    // === Studio Page Settings ===

    /// <summary>
    /// Gets or sets whether to show discovery on studio/network pages.
    /// </summary>
    public bool ShowStudioDiscovery { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to enable infinite scroll on studio pages.
    /// </summary>
    public bool EnableInfiniteScroll { get; set; } = true;

    // === Card Display Settings ===

    /// <summary>
    /// Gets or sets whether to show the media type badge (MOVIE/SERIES).
    /// </summary>
    public bool ShowMediaTypeBadge { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to show star ratings on cards.
    /// </summary>
    public bool ShowRatings { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to show the year on cards.
    /// </summary>
    public bool ShowYear { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to show the overview on hover.
    /// </summary>
    public bool ShowOverviewOnHover { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to show collection badges on cards.
    /// </summary>
    public bool ShowCollectionBadge { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to show the character/role name for cast credits.
    /// </summary>
    public bool ShowRoleName { get; set; } = true;
}
