using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.DependencyInjection;
using JellyseerrDiscovery.Services;

namespace JellyseerrDiscovery;

public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddHttpClient<IJellyseerrService, JellyseerrService>();
        serviceCollection.AddSingleton<IScheduledTask, StartupService>();
    }
}
