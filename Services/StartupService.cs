using System.Reflection;
using System.Runtime.Loader;
using System.Text.RegularExpressions;
using JellyseerrDiscovery.Helpers;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace JellyseerrDiscovery.Services;

public class StartupService : IScheduledTask
{
    private readonly ILogger<StartupService> _logger;
    private readonly IApplicationPaths _applicationPaths;

    public string Name => "Jellyseerr Discovery Startup";
    public string Key => "JellyseerrDiscoveryStartup";
    public string Description => "Injects the Jellyseerr Discovery script into the web interface.";
    public string Category => "Jellyseerr Discovery";

    public StartupService(ILogger<StartupService> logger, IApplicationPaths applicationPaths)
    {
        _logger = logger;
        _applicationPaths = applicationPaths;
    }

    public async Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        await Task.Run(() =>
        {
            _logger.LogInformation("Jellyseerr Discovery Startup Task running...");
            RegisterFileTransformation();
            _logger.LogInformation("Jellyseerr Discovery Startup Task completed.");
        }, cancellationToken);
    }

    private void RegisterFileTransformation()
    {
        try
        {
            // Try to find the File Transformation plugin assembly
            Assembly? fileTransformationAssembly =
                AssemblyLoadContext.All.SelectMany(x => x.Assemblies).FirstOrDefault(x =>
                    x.FullName?.Contains(".FileTransformation") ?? false);

            if (fileTransformationAssembly != null)
            {
                Type? pluginInterfaceType = fileTransformationAssembly.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");

                if (pluginInterfaceType != null)
                {
                    var payload = new JObject
                    {
                        { "id", "b2c3d4e5-f6a7-8901-bcde-f23456789012" },
                        { "fileNamePattern", "index.html" },
                        { "callbackAssembly", GetType().Assembly.FullName },
                        { "callbackClass", typeof(TransformationPatches).FullName },
                        { "callbackMethod", nameof(TransformationPatches.IndexHtml) }
                    };

                    pluginInterfaceType.GetMethod("RegisterTransformation")?.Invoke(null, new object?[] { payload });
                    _logger.LogInformation("Successfully registered Jellyseerr Discovery script injection with File Transformation Plugin.");
                    return;
                }
                else
                {
                    _logger.LogWarning("Could not find PluginInterface in FileTransformation assembly.");
                }
            }
            else
            {
                _logger.LogWarning("File Transformation Plugin not found. Script injection requires File Transformation plugin.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering script injection with File Transformation.");
        }
    }

    private void InjectScriptDirectly()
    {
        try
        {
            var webPath = _applicationPaths.WebPath;
            var indexPath = Path.Combine(webPath, "index.html");

            if (!File.Exists(indexPath))
            {
                _logger.LogWarning("index.html not found at {Path}", indexPath);
                return;
            }

            var content = File.ReadAllText(indexPath);
            var pluginName = "Jellyseerr Discovery";
            var pluginVersion = Plugin.Instance?.Version.ToString() ?? "1.0.0";

            var scriptUrl = "../JellyseerrDiscovery/script";
            var scriptTag = $"<script plugin=\"{pluginName}\" version=\"{pluginVersion}\" src=\"{scriptUrl}\" defer></script>";

            // Remove any existing script tag for this plugin
            var regex = new Regex($"<script[^>]*plugin=[\"']{Regex.Escape(pluginName)}[\"'][^>]*>\\s*</script>\\n?");
            var updatedContent = regex.Replace(content, string.Empty);

            // Check if we need to inject
            if (!updatedContent.Contains(scriptTag))
            {
                if (updatedContent.Contains("</body>"))
                {
                    updatedContent = updatedContent.Replace("</body>", $"{scriptTag}\n</body>");
                    File.WriteAllText(indexPath, updatedContent);
                    _logger.LogInformation("Successfully injected Jellyseerr Discovery script into index.html.");
                }
            }
            else
            {
                _logger.LogInformation("Jellyseerr Discovery script already present in index.html.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to inject script into index.html.");
        }
    }

    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        return new[]
        {
            new TaskTriggerInfo
            {
                Type = TaskTriggerInfoType.StartupTrigger
            }
        };
    }
}
