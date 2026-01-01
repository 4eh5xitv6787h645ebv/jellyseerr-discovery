using System;
using System.Collections.Generic;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace JellyseerrDiscovery;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public override string Name => "Jellyseerr Discovery";

    public override string Description => "Discover actor filmography and studio catalogs via Jellyseerr/TMDb";

    public override Guid Id => new Guid("b2c3d4e5-f6a7-8901-bcde-f23456789012");

    public static Plugin? Instance { get; private set; }

    public IEnumerable<PluginPageInfo> GetPages()
    {
        return new[]
        {
            new PluginPageInfo
            {
                Name = Name,
                EmbeddedResourcePath = "JellyseerrDiscovery.Configuration.configPage.html"
            }
        };
    }
}
