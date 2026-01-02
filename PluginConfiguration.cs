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
}
